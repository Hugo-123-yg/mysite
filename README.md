# SilasHugo

网站首页链接到文章、网页和约稿三个独立栏目。进入栏目，点击「编辑」，使用站主的 ChatGPT 账号登录后即可新增、更新或删除作品。

- 文章使用标题、备注和正文。
- 网页上传单个 UTF-8 HTML 文件，填写标题和介绍。网页在隔离的框架内运行。
- 约稿上传图片。访客点击图片可以放大。

`node build.mjs` 将页面和 Worker 打包到 `dist/server/index.js`。网站依赖 `DB`、`BUCKET` 和服务器端的 `SITE_EDITOR_EMAIL`，站主邮箱由 Sites 的运行环境提供。数据库结构在 `drizzle/` 中。
