const categories = {
  articles: { name: "文章", add: "新建文章" },
  websites: { name: "网页", add: "上传网页" },
  commissions: { name: "约稿", add: "上传图片" },
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function navigation(active) {
  return Object.entries(categories).map(([key, category]) =>
    `<a href="/${key}"${active === key ? ' aria-current="page"' : ""}>${category.name}</a>`
  ).join("");
}

function layout(title, content, { category = "", home = false } = {}) {
  const editUrl = category ? "/edit?category=" + category : "/edit";
  const header = home ? "" : `
    <header class="topbar wrap">
      <a class="brand" href="/">SilasHugo</a>
      <nav aria-label="作品栏目">${navigation(category)}</nav>
    </header>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#edf3e9">
  <title>${escapeHTML(title)}${home ? "" : " · SilasHugo"}</title>
  <link rel="stylesheet" href="/style.css">
  <script src="/archive.js" defer></script>
</head>
<body class="${home ? "home" : "inner"}">
  ${header}
  ${content}
  <footer class="wrap">
    <a href="/">SilasHugo</a>
    <a href="${editUrl}">编辑网站</a>
  </footer>
</body>
</html>`;
}

function homePage() {
  return layout("SilasHugo", `
    <main class="home-main wrap">
      <div class="home-title">
        <p>同人作品集</p>
        <h1>SilasHugo</h1>
        <nav aria-label="作品栏目">${navigation("")}</nav>
      </div>
    </main>`, { home: true });
}

function mediaUrl(item) {
  return "/media/" + item.id + "?v=" + item.revision;
}

function itemCard(item) {
  const title = escapeHTML(item.title);
  const note = escapeHTML(item.note);
  return `
    <a class="work-card" href="/${item.category}/${item.id}">
      <h2>${title}</h2>
      ${note ? `<p class="note">${note}</p>` : ""}
      <span class="card-arrow" aria-hidden="true">↗</span>
    </a>`;
}

function categoryPage(category, items) {
  const name = categories[category].name;
  const images = category === "commissions";
  const gallery = images ? items.map((item) => {
    const alt = escapeHTML(item.alt || "约稿图片");
    return `<button class="gallery-item" type="button" aria-label="查看大图：${alt}">
      <img src="${mediaUrl(item)}" alt="${alt}" loading="lazy" decoding="async">
    </button>`;
  }).join("") : "";
  const body = images
    ? `<div class="gallery">${gallery}</div>
       <dialog id="image-viewer" aria-label="查看大图">
         <button class="viewer-close" type="button" aria-label="关闭大图">×</button>
         <img id="viewer-image" alt="">
       </dialog>`
    : `<div class="work-list ${category === "websites" ? "web-list" : ""}">${items.map(itemCard).join("")}</div>`;
  return layout(name, `
    <main class="wrap section">
      <div class="page-heading">
        <h1>${name}</h1>
        <a class="button subtle" href="/edit?category=${category}">编辑</a>
      </div>
      ${body}
    </main>`, { category });
}

function itemPage(item) {
  const title = escapeHTML(item.title);
  const note = escapeHTML(item.note);
  const article = item.category === "articles";
  const category = categories[item.category].name;
  return layout(item.title, `
    <main class="wrap section ${article ? "reading" : ""}">
      <a class="back-link" href="/${item.category}">← ${category}</a>
      <div class="detail-heading">
        <h1>${title}</h1>
        ${note ? `<p class="note">${note}</p>` : ""}
      </div>
      ${article
        ? `<article class="article-body">${escapeHTML(item.body)}</article>`
        : `<iframe class="website-frame" src="${mediaUrl(item)}" title="${title}" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>`}
    </main>`, { category: item.category });
}

function messagePage(title, message, action = "") {
  return layout(title, `
    <main class="wrap section reading">
      <div class="notice">
        <h1>${escapeHTML(title)}</h1>
        <p>${escapeHTML(message)}</p>
        ${action}
      </div>
    </main>`);
}

function editorPage(category, items) {
  const group = categories[category];
  const rows = items.map((item) => `
    <li>
      ${category === "commissions" ? `<img src="${mediaUrl(item)}" alt="" loading="lazy">` : ""}
      <span>${escapeHTML(item.title || item.alt || "约稿图片")}</span>
      <a class="button subtle" href="/edit/items/${item.id}">编辑</a>
    </li>`).join("");
  const tabs = Object.entries(categories).map(([key, value]) =>
    `<a href="/edit?category=${key}"${key === category ? ' aria-current="page"' : ""}>${value.name}</a>`
  ).join("");
  return layout("编辑网站", `
    <main class="wrap section reading">
      <div class="page-heading">
        <h1>编辑网站</h1>
        <a class="back-link" href="/${category}">查看栏目 ↗</a>
      </div>
      <nav class="editor-tabs" aria-label="编辑栏目">${tabs}</nav>
      <div class="editor-heading">
        <h2>${group.name}</h2>
        <a class="button" href="/edit/new?category=${category}">${group.add}</a>
      </div>
      ${rows ? `<ul class="editor-list">${rows}</ul>` : ""}
    </main>`, { category });
}

function editorForm(item, { existing = false, error = "" } = {}) {
  const category = item.category;
  const group = categories[category];
  const title = existing ? "编辑" + (category === "commissions" ? "图片" : group.name) : group.add;
  const action = existing ? "/edit/items/" + item.id : "/edit/new?category=" + category;
  const image = category === "commissions";
  const article = category === "articles";
  const e = escapeHTML;
  return layout(title, `
    <main class="wrap section reading">
      <a class="back-link" href="/edit?category=${category}">← 管理${group.name}</a>
      <div class="detail-heading"><h1>${title}</h1></div>
      <form class="edit-form" method="post" action="${action}" enctype="multipart/form-data">
        <input type="hidden" name="id" value="${e(item.id)}">
        <input type="hidden" name="revision" value="${e(item.revision)}">
        ${error ? `<p class="error" role="alert">${e(error)}</p>` : ""}
        ${!image ? `
          <label>标题<input name="title" value="${e(item.title)}" maxlength="120" required></label>
          <label>${article ? "备注" : "网页介绍"}<textarea name="note" rows="3" maxlength="2500">${e(item.note)}</textarea></label>` : ""}
        ${article ? `<label>正文<textarea class="body-input" name="body" rows="14" maxlength="50000" required>${e(item.body)}</textarea></label>` : `
          ${image && existing ? `<img class="edit-preview" src="${mediaUrl(item)}" alt="${e(item.alt || "当前图片")}">` : ""}
          <label>${existing ? "替换" : "选择"}${image ? "图片" : " HTML 文件"}
            <input type="file" name="file" accept="${image ? ".png,.jpg,.jpeg,.webp,.gif" : ".html,.htm"}"${existing ? "" : " required"}>
          </label>
          <p class="field-hint">${image ? "PNG、JPG、WebP 或 GIF，最大 10 MB。" : "单个 UTF-8 HTML 文件，最大 2 MB。"}</p>
          ${image ? `<label>图片描述（供读屏使用）<input name="alt" value="${e(item.alt)}" maxlength="250"></label>` : ""}`}
        <div class="form-actions"><button class="button" type="submit">保存</button><a href="/edit?category=${category}">取消</a></div>
      </form>
      ${existing ? `<details class="delete-item">
        <summary>删除${image ? "图片" : group.name}</summary>
        <form method="post" action="/edit/items/${item.id}/delete">
          <input type="hidden" name="revision" value="${e(item.revision)}">
          <button class="button danger" type="submit">确认删除</button>
        </form>
      </details>` : ""}
    </main>`, { category });
}
