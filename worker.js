const recordId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const editorPath = /^\/edit\/items\/([0-9a-f-]{36})(\/delete)?$/;
const mediaPath = /^\/media\/([0-9a-f-]{36})$/;
const detailPath = /^\/(articles|websites)\/([0-9a-f-]{36})$/;
const sitePolicy = "default-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-src 'self'";
const uploadedPagePolicy = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline' https:",
  "style-src 'unsafe-inline' https:",
  "img-src data: blob: https:",
  "font-src data: https:",
  "media-src data: blob: https:",
  "connect-src https:",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");
const megabyte = 1024 * 1024;

function response(body, type, status = 200, headers = {}) {
  return new Response(body, { status, headers: {
    "Content-Type": type,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    ...headers,
  } });
}

function html(body, status = 200) {
  return response(body, "text/html; charset=utf-8", status, { "Content-Security-Policy": sitePolicy });
}

function redirect(path) {
  return new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });
}

function notFound() {
  return html(messagePage("页面不存在", "这个作品可能已被移除。", '<a class="button" href="/">返回首页</a>'), 404);
}

function selectedCategory(url) {
  const requested = url.searchParams.get("category");
  return Object.hasOwn(categories, requested) ? requested : "articles";
}

function listItems(env, category) {
  return env.DB.prepare(
    "SELECT id, category, title, note, alt, revision FROM archive_items WHERE category = ? ORDER BY created_at DESC, id DESC",
  ).bind(category).all().then((result) => result.results);
}

function findItem(env, id) {
  if (!recordId.test(id)) return null;
  return env.DB.prepare("SELECT * FROM archive_items WHERE id = ?").bind(id).first();
}

function authorizeEditor(request, env, url) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const user = request.headers.get("oai-authenticated-user-id");
  if (!email || !user) {
    const path = "/signin-with-chatgpt?return_to=" + encodeURIComponent("/edit?category=" + selectedCategory(url));
    return html(messagePage("登录后编辑", "请使用这个网站的站主账号登录。", `<a class="button" href="${path}" target="_top">使用 ChatGPT 登录</a>`), 401);
  }
  if (email !== env.SITE_EDITOR_EMAIL?.trim().toLowerCase()) {
    return html(messagePage("此账号没有编辑权限", "请切换到站主账号。", '<a class="button" href="/signout-with-chatgpt?return_to=%2Fedit" target="_top">切换账号</a>'), 403);
  }
  if (request.method === "POST" && request.headers.get("Origin") !== url.origin) {
    return html(messagePage("保存请求被拒绝", "请从本站编辑页重新提交。"), 403);
  }
  return null;
}

function formValue(form, name) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function imageType(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes[0] === 137 && ascii(1, 4) === "PNG" && bytes[4] === 13 &&
      bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) return "image/gif";
  return null;
}

async function fileType(file, category) {
  if (category === "commissions") {
    if (file.size > 10 * megabyte) throw new Error("图片超过 10 MB。");
    const type = await imageType(file);
    if (!type) throw new Error("请选择 PNG、JPG、WebP 或 GIF 图片。");
    return type;
  }
  if (file.size > 2 * megabyte) throw new Error("HTML 文件超过 2 MB。");
  if (!/\.html?$/i.test(file.name)) throw new Error("请选择 .html 或 .htm 文件。");
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    if (!source.trim()) throw new Error();
  } catch {
    throw new Error("请选择有内容的 UTF-8 HTML 文件。");
  }
  return "text/html; charset=utf-8";
}

function removeObject(env, ctx, key) {
  if (key) ctx.waitUntil(env.BUCKET.delete(key).catch(() => console.error("Could not remove replaced media")));
}

function editConflict(category) {
  return html(messagePage("作品已更新", "请重新打开编辑页，再保存你的改动。",
    `<a class="button" href="/edit?category=${category}">返回编辑</a>`), 409);
}

async function saveItem(form, env, ctx, category, old) {
  const article = category === "articles";
  const image = category === "commissions";
  const id = old?.id ?? formValue(form, "id");
  const item = {
    id, category,
    title: image ? "" : formValue(form, "title"),
    note: image ? "" : formValue(form, "note"),
    body: article ? formValue(form, "body") : "",
    alt: image ? formValue(form, "alt") : "",
    revision: old?.revision ?? 1,
  };
  const invalid = (error) => html(editorForm(item, { existing: !!old, error }), 400);
  if (!recordId.test(id)) return invalid("请返回栏目后重新打开编辑页。");
  if (old && formValue(form, "revision") !== String(old.revision)) return editConflict(category);
  if (!image && (!item.title || item.title.length > 120)) return invalid("请输入 1 至 120 字的标题。");
  if (item.note.length > 2500 || item.alt.length > 250) return invalid("备注、介绍或图片描述超过长度限制。");
  if (article && (!item.body || item.body.length > 50000)) return invalid("请输入 1 至 50,000 字的正文。");

  let objectKey = old?.object_key ?? "";
  const file = form.get("file");
  if (!article && file && typeof file !== "string" && file.size) {
    let type;
    try {
      type = await fileType(file, category);
    } catch (error) {
      return invalid(error.message);
    }
    objectKey = category + "/" + id + "/" + crypto.randomUUID();
    await env.BUCKET.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
  }
  if (!article && !objectKey) return invalid(image ? "请选择要上传的图片。" : "请选择要上传的 HTML 文件。");

  const fields = [item.title, item.note, item.body, objectKey, item.alt];
  const result = old
    ? await env.DB.prepare(
      "UPDATE archive_items SET title = ?, note = ?, body = ?, object_key = ?, alt = ?, revision = revision + 1 WHERE id = ? AND revision = ?",
    ).bind(...fields, id, old.revision).run()
    : await env.DB.prepare(
      "INSERT OR IGNORE INTO archive_items (id, category, title, note, body, object_key, alt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, category, ...fields, Date.now()).run();

  if (result.meta.changes !== 1) {
    if (objectKey !== old?.object_key) removeObject(env, ctx, objectKey);
    return old ? editConflict(category) : redirect("/edit?category=" + category);
  }
  if (old && objectKey !== old.object_key) removeObject(env, ctx, old.object_key);
  return redirect("/edit?category=" + category);
}

async function editor(request, env, ctx, url) {
  const rejected = authorizeEditor(request, env, url);
  if (rejected) return rejected;
  const category = selectedCategory(url);
  const path = url.pathname;
  const match = editorPath.exec(path);

  if (request.method === "GET") {
    if (path === "/edit") return html(editorPage(category, await listItems(env, category)));
    if (path === "/edit/new") return html(editorForm({ category, id: crypto.randomUUID() }));
    if (!match || match[2]) return notFound();
    const item = await findItem(env, match[1]);
    return item ? html(editorForm(item, { existing: true })) : notFound();
  }

  if (request.method !== "POST" || (path !== "/edit/new" && !match)) return notFound();
  if (Number(request.headers.get("Content-Length")) > 11 * megabyte) {
    return html(messagePage("上传文件过大", "请返回编辑页并选择较小的文件。"), 413);
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return html(messagePage("无法读取表单", "请返回编辑页并重新提交。"), 400);
  }
  if (path === "/edit/new") return saveItem(form, env, ctx, category, null);
  const item = await findItem(env, match[1]);
  if (!item) return notFound();
  if (!match[2]) return saveItem(form, env, ctx, item.category, item);
  if (formValue(form, "revision") !== String(item.revision)) return editConflict(item.category);

  const result = await env.DB.prepare("DELETE FROM archive_items WHERE id = ? AND revision = ?")
    .bind(item.id, item.revision).run();
  if (result.meta.changes !== 1) return editConflict(item.category);
  removeObject(env, ctx, item.object_key);
  return redirect("/edit?category=" + item.category);
}

async function serveMedia(request, env, id) {
  const item = await findItem(env, id);
  if (!item?.object_key) return notFound();
  const object = await env.BUCKET.get(item.object_key);
  if (!object) return notFound();
  if (item.category === "websites") {
    return response(request.method === "HEAD" ? null : object.body, "text/html; charset=utf-8", 200,
      { "Content-Security-Policy": uploadedPagePolicy, "Referrer-Policy": "no-referrer" });
  }
  return response(request.method === "HEAD" ? null : object.body,
    object.httpMetadata?.contentType ?? "application/octet-stream");
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/$/, "") || "/";
      if (path === "/edit" || path.startsWith("/edit/")) {
        if (url.pathname !== path && request.method === "GET") return redirect(path + url.search);
        return await editor(request, env, ctx, url);
      }
      if (request.method !== "GET" && request.method !== "HEAD") return notFound();
      if (Object.hasOwn(assets, path)) {
        const type = path.endsWith(".css") ? "text/css" : "text/javascript";
        return response(request.method === "HEAD" ? null : assets[path], type + "; charset=utf-8");
      }
      if (path === "/") return html(homePage());
      const category = path.slice(1);
      if (Object.hasOwn(categories, category)) return html(categoryPage(category, await listItems(env, category)));
      const media = mediaPath.exec(path);
      if (media) return await serveMedia(request, env, media[1]);
      const detail = detailPath.exec(path);
      if (detail) {
        const item = await findItem(env, detail[2]);
        if (item?.category === detail[1]) return html(itemPage(item));
      }
      return notFound();
    } catch (error) {
      console.error(error);
      return html(messagePage("暂时无法加载", "请稍后重试。"), 500);
    }
  },
};
