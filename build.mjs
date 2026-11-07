import { mkdir, readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const assets = Object.fromEntries(await Promise.all([
  ["/style.css", "./dist/style.css"],
  ["/archive.js", "./dist/archive.js"],
].map(async ([route, path]) => [route, await read(path)])));

const worker = await Promise.all([read("./server/pages.js"), read("./server/worker.js")]);
await mkdir(new URL("./dist/server/", import.meta.url), { recursive: true });
await writeFile(new URL("./dist/server/index.js", import.meta.url),
  "const assets = " + JSON.stringify(assets) + ";\n" + worker.join("\n"));
