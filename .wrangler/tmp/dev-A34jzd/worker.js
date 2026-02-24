var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-HkMHOZ/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/worker.js
var worker_default = {
  // 导出默认处理器对象
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = normalizePath(url.pathname);
    console.log("Fetch function started for path:", path);
    if (path === "/admin") {
      const token = url.searchParams.get("token") || "";
      if (!token) {
        return html("<p>\u7F3A\u5C11 token\uFF0C\u8BF7\u5728 URL \u6DFB\u52A0 ?token=YOUR_TOKEN</p>");
      }
      const posts = await loadPostsIndexAll(env);
      return html(renderAdminPage(token, posts, env, url));
    }
    if (path === "/api/posts" && req.method === "POST") {
      const token = req.headers.get("x-admin-token") || "";
      if (!token || !env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
      const payload = await req.json().catch(() => null);
      if (!payload || !payload.slug || !payload.title || !payload.format || !payload.content) {
        return new Response("Bad Request", { status: 400 });
      }
      const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const item = {
        // 组装文章对象
        slug: sanitizeSlug(String(payload.slug)),
        // 规范化 slug
        title: String(payload.title),
        // 标题
        date: String(payload.date || now),
        // 日期
        desc: String(payload.desc || ""),
        // 摘要
        format: payload.format === "wt" ? "wt" : "md",
        // 格式
        content: String(payload.content)
        // 正文
      };
      await savePostToKV(env, item);
      return new Response(JSON.stringify({ ok: true, slug: item.slug }), { headers: { "content-type": "application/json" } });
    }
    if (path.startsWith("/api/posts/") && req.method === "DELETE") {
      const token = req.headers.get("x-admin-token") || "";
      if (!token || !env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
      const slug = path.slice("/api/posts/".length);
      await deletePostFromKV(env, slug);
      return new Response(JSON.stringify({ ok: true, slug }), { headers: { "content-type": "application/json" } });
    }
    if (path.startsWith("/api/posts/") && req.method === "PUT") {
      const token = req.headers.get("x-admin-token") || "";
      if (!token || !env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
      const slug = path.slice("/api/posts/".length);
      const payload = await req.json().catch(() => null);
      if (!payload || !payload.title || !payload.format || !payload.content) {
        return new Response("Bad Request", { status: 400 });
      }
      const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const item = {
        // 组装文章对象
        slug: sanitizeSlug(slug),
        // 规范化 slug (使用路径中的 slug)
        title: String(payload.title),
        // 标题
        date: String(payload.date || now),
        // 日期
        desc: String(payload.desc || ""),
        // 摘要
        format: payload.format === "wt" ? "wt" : "md",
        // 格式
        content: String(payload.content)
        // 正文
      };
      await savePostToKV(env, item);
      return new Response(JSON.stringify({ ok: true, slug: item.slug }), { headers: { "content-type": "application/json" } });
    }
    if (path === "/api/comments" && req.method === "POST") {
      const payload = await req.json().catch(() => null);
      if (!payload || !payload.slug || !payload.author || !payload.content) {
        return new Response("Bad Request", { status: 400 });
      }
      const comment = {
        // 组装评论对象
        slug: sanitizeSlug(String(payload.slug)),
        // 规范化文章 slug
        author: String(payload.author).trim(),
        // 评论作者
        content: String(payload.content).trim(),
        // 评论内容
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
        // 评论时间戳
      };
      await saveCommentToKV(env, comment);
      return new Response(JSON.stringify({ ok: true, comment }), { headers: { "content-type": "application/json" } });
    }
    if (path.startsWith("/api/comments/") && req.method === "GET") {
      const slug = path.slice("/api/comments/".length);
      const comments = await loadCommentsFromKV(env, slug);
      return new Response(JSON.stringify(comments), { headers: { "content-type": "application/json" } });
    }
    if (path === "/api/images" && req.method === "POST") {
      const token = req.headers.get("x-admin-token") || "";
      if (!token || !env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file) {
        return new Response("Bad Request: No file uploaded", { status: 400 });
      }
      const fileName = file.name;
      const fileBuffer = await file.arrayBuffer();
      const fileType = file.type;
      const imageKey = `images/${Date.now()}-${fileName}`;
      await env.IMAGES.put(imageKey, fileBuffer, {
        // 将图片存储到 IMAGES KV 命名空间
        metadata: { contentType: fileType }
        // 存储文件类型元数据
      });
      const imageUrl = `${url.origin}/image/${imageKey}`;
      return new Response(JSON.stringify({ ok: true, url: imageUrl }), { headers: { "content-type": "application/json" } });
    }
    if (path.startsWith("/image/") && req.method === "GET") {
      const imageKey = path.slice("/image/".length);
      const image = await env.IMAGES.get(imageKey, { type: "arrayBuffer", cacheTtl: 3600 });
      if (!image) {
        return new Response("Not Found", { status: 404 });
      }
      const metadata = await env.IMAGES.getWithMetadata(imageKey);
      const contentType = metadata.metadata ? metadata.metadata.contentType : "application/octet-stream";
      return new Response(image, { headers: { "content-type": contentType } });
    }
    if (path === "/") {
      const posts = await loadPostsIndexAll(env);
      const body = renderIndex(posts, env);
      return html(body);
    }
    if (path.startsWith("/posts/")) {
      const slug = path.slice("/posts/".length);
      const post = await loadPost(env, slug);
      if (post == null) {
        return notFound();
      }
      const content = post.format === "wt" ? wikitextToHtml(post.content) : markdownToHtml(post.content);
      const body = await renderPost(env, slug, content, post.title);
      return html(body);
    }
    return env.ASSETS.fetch(req);
  }
  // 结束 fetch 方法
};
function html(s) {
  return new Response(s, { headers: { "content-type": "text/html; charset=utf-8" } });
}
__name(html, "html");
function notFound() {
  return new Response("Not Found", { status: 404 });
}
__name(notFound, "notFound");
function normalizePath(p) {
  if (!p)
    return "/";
  let x = p.replace(/\\+/g, "/");
  x = x.replace(/\/\/+/, "/");
  if (!x.startsWith("/"))
    x = "/" + x;
  return x;
}
__name(normalizePath, "normalizePath");
async function loadPostsIndex(env) {
  const r = await env.ASSETS.fetch("https://assets.local/posts.json");
  if (!r.ok)
    return [];
  return r.json();
}
__name(loadPostsIndex, "loadPostsIndex");
async function loadPostsIndexAll(env) {
  const a = await loadPostsIndex(env);
  const b = await getIndexFromKV(env);
  console.log(`Static index: ${JSON.stringify(a)}`);
  console.log(`KV index: ${JSON.stringify(b)}`);
  const map = /* @__PURE__ */ new Map();
  [...a, ...b].forEach((it) => {
    if (it && it.slug)
      map.set(it.slug, it);
  });
  const merged = [...map.values()].sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")));
  console.log(`Merged index: ${JSON.stringify(merged)}`);
  return merged;
}
__name(loadPostsIndexAll, "loadPostsIndexAll");
async function loadPostMarkdown(env, slug) {
  const safe = slug.replace(/[^a-z0-9-]/gi, "");
  const url = `https://assets.local/posts/${safe}.md`;
  const r = await env.ASSETS.fetch(url);
  if (!r.ok)
    return null;
  return r.text();
}
__name(loadPostMarkdown, "loadPostMarkdown");
async function loadPost(env, slug) {
  const s = sanitizeSlug(slug);
  const kv = await loadPostFromKV(env, s);
  if (kv) {
    console.log(`Loaded post from KV: ${JSON.stringify(kv)}`);
    return kv;
  }
  const md = await loadPostMarkdown(env, s);
  if (!md)
    return null;
  const post = { slug: s, title: s, date: "", desc: "", format: "md", content: md };
  console.log(`Loaded post from Markdown: ${JSON.stringify(post)}`);
  return post;
}
__name(loadPost, "loadPost");
function markdownToHtml(md) {
  let s = md;
  s = s.replace(/&/g, "&amp;");
  s = s.replace(/</g, "&lt;");
  s = s.replace(/>/g, "&gt;");
  s = s.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  s = s.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1">');
  s = s.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\n{2,}/g, "\n\n");
  s = s.replace(/([^\n])\n([^\n])/g, "$1<br>$2");
  s = s.replace(/^(?!<h\d>|<ul>|<li>|<p>|<blockquote>|<pre>|<code>|<\/)(.+)$/gm, "<p>$1</p>");
  return s;
}
__name(markdownToHtml, "markdownToHtml");
function processListBlock(block) {
  const lines = block.trim().split("\n");
  let html2 = "";
  const stack = [];
  for (const line of lines) {
    const itemMatch = line.match(/^(\s*)(\*|-)\s(.*)/);
    if (!itemMatch)
      continue;
    const indent = itemMatch[1].length;
    const level = Math.floor(indent / 2) + 1;
    const type = itemMatch[2] === "*" ? "ul" : "ol";
    const content = itemMatch[3];
    while (stack.length > 0 && (stack[stack.length - 1].level > level || stack[stack.length - 1].level === level && stack[stack.length - 1].type !== type)) {
      html2 += `</${stack.pop().type}>`;
    }
    if (stack.length === 0 || stack[stack.length - 1].level < level) {
      stack.push({ type, level });
      html2 += `<${type}>`;
    }
    html2 += `<li>${content}</li>`;
  }
  while (stack.length > 0) {
    html2 += `</${stack.pop().type}>`;
  }
  return html2;
}
__name(processListBlock, "processListBlock");
function processDefinitionListBlock(block) {
  const lines = block.trim().split("\n");
  let html2 = "<dl>";
  for (const line of lines) {
    const match = line.match(/^(\s*)::(.+?)$/);
    if (match) {
      const term = match[2].trim();
      html2 += `<dt>${term}</dt>`;
    } else {
      const descMatch = line.match(/^(\s*)(.+)$/);
      if (descMatch) {
        const description = descMatch[2].trim();
        html2 += `<dd>${description}</dd>`;
      }
    }
  }
  html2 += "</dl>";
  return html2;
}
__name(processDefinitionListBlock, "processDefinitionListBlock");
function processTableBlock(block) {
  const lines = block.trim().split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0)
    return "";
  let html2 = "<table>";
  let inHead = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeaderRow = line.startsWith("^");
    const cellDelimiter = isHeaderRow ? "^" : "|";
    const rawCells = line.slice(1, -1).split(cellDelimiter);
    if (isHeaderRow && !inHead) {
      html2 += "<thead>";
      inHead = true;
    } else if (!isHeaderRow && inHead) {
      html2 += "</thead><tbody>";
      inHead = false;
    } else if (!isHeaderRow && i === 0) {
      html2 += "<tbody>";
    }
    html2 += "<tr>";
    let colSpan = 1;
    for (let j = 0; j < rawCells.length; j++) {
      let cellContent = rawCells[j];
      const colspanMatch = cellContent.match(/^(.*?)(::\s*)$/);
      if (colspanMatch) {
        cellContent = colspanMatch[1].trim();
        colSpan++;
      }
      let align = "";
      const trimmedContent = cellContent.trim();
      const leadingSpaces = cellContent.match(/^(\s*)/)[1].length;
      const trailingSpaces = cellContent.match(/(\s*)$/)[1].length;
      if (leadingSpaces >= 2 && trailingSpaces >= 2) {
        align = "center";
      } else if (leadingSpaces >= 2) {
        align = "right";
      } else if (trailingSpaces >= 2) {
        align = "left";
      }
      const tag = isHeaderRow ? "th" : "td";
      let attrs = "";
      if (colSpan > 1) {
        attrs += ` colspan="${colSpan}"`;
      }
      if (align) {
        attrs += ` align="${align}"`;
      }
      html2 += `<${tag}${attrs}>${trimmedContent}</${tag}>`;
      colSpan = 1;
    }
    html2 += "</tr>";
  }
  if (inHead) {
    html2 += "</thead>";
  } else {
    html2 += "</tbody>";
  }
  html2 += "</table>";
  return html2;
}
__name(processTableBlock, "processTableBlock");
function wikitextToHtml(wt) {
  let s = wt;
  const listBlocks = [];
  const listRegex = /(?:(?:^(\s*)(\*|-)\s.*(?:\n|$))+)/gm;
  s = s.replace(listRegex, (match) => {
    const placeholder = `__LIST_BLOCK_${listBlocks.length}__`;
    listBlocks.push(match);
    return placeholder;
  });
  const definitionListBlocks = [];
  const definitionListRegex = /(?:(?:^(\s*)::.*(?:\n|$))+)/gm;
  s = s.replace(definitionListRegex, (match) => {
    const placeholder = `__DEFINITION_LIST_BLOCK_${definitionListBlocks.length}__`;
    definitionListBlocks.push(match);
    return placeholder;
  });
  const tableBlocks = [];
  const tableRegex = /(?:(?:^(?:\||\^).*?(?:\||\^)(?:\n|$))+)/gm;
  s = s.replace(tableRegex, (match) => {
    const placeholder = `__TABLE_BLOCK_${tableBlocks.length}__`;
    tableBlocks.push(match);
    return placeholder;
  });
  s = s.replace(/&/g, "&amp;");
  s = s.replace(/</g, "&lt;");
  s = s.replace(/>/g, "&gt;");
  s = s.replace(/^======\s*(.+?)\s*======$/gm, "<h6>$1</h6>");
  s = s.replace(/^=====\s*(.+?)\s*=====$/gm, "<h5>$1</h5>");
  s = s.replace(/^====\s*(.+?)\s*====$/gm, "<h4>$1</h4>");
  s = s.replace(/^===\s*(.+?)\s*===$/gm, "<h3>$1</h3>");
  s = s.replace(/^==\s*(.+?)\s*==$/gm, "<h2>$1</h2>");
  s = s.replace(/^=\s*(.+?)\s*=$/gm, "<h1>$1</h1>");
  s = s.replace(/'''''(.+?)'''''/g, "<strong><em>$1</em></strong>");
  s = s.replace(/'''(.+?)'''/g, "<strong>$1</strong>");
  s = s.replace(/''(.+?)''/g, "<em>$1</em>");
  s = s.replace(/``(.+?)``/g, "<code>$1</code>");
  s = s.replace(/\[\[(.+?)\|(.*?)\]\]/g, '<a href="$1">$2</a>');
  s = s.replace(/\[\[(.+?)\]\]/g, '<a href="$1">$1</a>');
  s = s.replace(/^(?!<h\d>|<p|<a|<strong>|<em>|<code>|<u>|<s>|<pre>|__LIST_BLOCK_|__DEFINITION_LIST_BLOCK_|__TABLE_BLOCK_)/gm, "<p>$&</p>");
  for (let i = 0; i < listBlocks.length; i++) {
    const block = listBlocks[i];
    const placeholder = `__LIST_BLOCK_${i}__`;
    const listHtml = processListBlock(block);
    s = s.replace(placeholder, listHtml);
  }
  for (let i = 0; i < definitionListBlocks.length; i++) {
    const block = definitionListBlocks[i];
    const placeholder = `__DEFINITION_LIST_BLOCK_${i}__`;
    const definitionListHtml = processDefinitionListBlock(block);
    s = s.replace(placeholder, definitionListHtml);
  }
  for (let i = 0; i < tableBlocks.length; i++) {
    const block = tableBlocks[i];
    const placeholder = `__TABLE_BLOCK_${i}__`;
    const tableHtml = processTableBlock(block);
    s = s.replace(placeholder, tableHtml);
  }
  return s;
}
__name(wikitextToHtml, "wikitextToHtml");
function renderLayout(title, inner, env) {
  const avatarUrl = env.AVATAR_URL || "/avatar.svg";
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.ico" type="image/x-icon"/>
<link rel="shortcut icon" href="/favicon.ico" type="image/x-icon"/>
<link rel="stylesheet" href="/styles.css"/>
</head>
<body>
<div class="bg"></div>
<header class="site-header">
  <div class="wrap">
    <a href="/" class="brand">\u6211\u7684\u6280\u672F\u535A\u5BA2</a>
    <nav class="top-nav">
      <a href="/">\u9996\u9875</a>
      <a href="/archives">\u5F52\u6863</a>
      <a href="/tags">\u6807\u7B7E</a>
      <a href="/about" aria-disabled="true">\u5173\u4E8E\uFF08\u5EFA\u8BBE\u4E2D\uFF09</a>
    </nav>
  </div>
</header>
<div class="page">
  <aside class="sidebar">
    <div class="card profile">
      <img src="${escapeHtml(avatarUrl)}" alt="\u5934\u50CF" class="avatar">
      <div class="name">\u7F16\u7A0B\u65B0\u624B</div>
      <div class="meta">\u5206\u4EAB\u7F16\u7A0B\u5B66\u4E60\u7B14\u8BB0 \xB7 \u6301\u7EED\u66F4\u65B0</div>
      <nav class="side-nav">
        <a href="/">\u6700\u65B0\u6587\u7AE0</a>
        <a href="/frontend">\u524D\u7AEF\u5F00\u53D1</a>
        <a href="/backend">\u540E\u7AEF\u5F00\u53D1</a>
        <a href="/tools">\u5DE5\u5177\u4F7F\u7528</a>
      </nav>
    </div>
  </aside>
  <main class="content">${inner}</main>
</div>
<footer class="site-footer">\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} \u6211\u7684\u6280\u672F\u535A\u5BA2 \xB7 \u57FA\u4E8E HTML/CSS \u6784\u5EFA \xB7 \u4FDD\u7559\u6240\u6709\u6743\u5229</footer>
</body>
</html>`;
}
__name(renderLayout, "renderLayout");
function renderIndex(posts, env) {
  const items = posts.map((p) => `
  <article class="post-card">
    <div class="pc-body">
      <h2 class="pc-title"><a href="/posts/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></h2>
      <div class="pc-meta">${escapeHtml(p.date || "")}</div>
      <p class="pc-desc">${escapeHtml(p.desc || "\u70B9\u51FB\u9605\u8BFB\u5168\u6587")}</p>
    </div>
    <a class="pc-more" href="/posts/${encodeURIComponent(p.slug)}" aria-label="\u9605\u8BFB\u5168\u6587">\u9605\u8BFB\u5168\u6587</a>
  </article>`).join("\n");
  const inner = `
<section class="list">
${items}
</section>`;
  const body = renderLayout("\u535A\u5BA2", inner, env);
  console.log(`Rendered Index HTML: ${body}`);
  return body;
}
__name(renderIndex, "renderIndex");
async function renderPost(env, slug, contentHtml, title) {
  console.log("renderPost function started for slug:", slug);
  console.log("Attempting to load comments for slug:", slug);
  const comments = await loadCommentsFromKV(env, slug);
  console.log("Comments loaded:", comments.length, "comments");
  const commentsHtml = comments.map((c) => {
    const author = escapeHtml(c.author);
    const content = escapeHtml(c.content);
    const timestamp = new Date(c.timestamp).toLocaleString();
    return '<div class="comment-item"><div class="comment-meta"><span class="comment-author">' + author + '</span><span class="comment-time">' + timestamp + '</span></div><div class="comment-content">' + content + "</div></div>";
  }).join("");
  console.log("commentsHtml generated, length:", commentsHtml.length);
  const inner = '<article class="post">' + contentHtml + '</article><section class="comments-section"><h2>\u8BC4\u8BBA</h2><div id="comments-list">' + commentsHtml + '</div><div class="comment-form"><h3>\u53D1\u8868\u8BC4\u8BBA</h3><label>\u6635\u79F0 <input id="comment-author" type="text" style="width:100%;padding:8px;margin:6px 0;"/></label><label>\u8BC4\u8BBA\u5185\u5BB9 <textarea id="comment-content" style="width:100%;height:100px;padding:8px;margin:6px 0;"></textarea></label><button id="submit-comment" style="padding:10px 15px;background-color:#007bff;color:white;border:none;border-radius:5px;cursor:pointer;">\u63D0\u4EA4\u8BC4\u8BBA</button></div></section>';
  return renderLayout(title, inner, env);
  `<button id="submit-comment" style="padding:10px 14px;">\u63D0\u4EA4\u8BC4\u8BBA</button><span id="comment-msg" style="margin-left:8px;color:#9fb0c1;"></span></div></section><p><a href="/">\u8FD4\u56DE\u9996\u9875</a></p><script>const submitBtn = document.getElementById('submit-comment');submitBtn.onclick = async () => {const author = document.getElementById('comment-author').value.trim();const content = document.getElementById('comment-content').value.trim();if (!author || !content) {alert('\u6635\u79F0\u548C\u8BC4\u8BBA\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A\uFF01');return;}const res = await fetch('/api/comments', {method: 'POST',headers: { 'content-type': 'application/json' },body: JSON.stringify({ slug: '` + escapeHtml(slug) + "', author, content })});const msgSpan = document.getElementById('comment-msg');if (res.ok) {msgSpan.textContent = '\u8BC4\u8BBA\u63D0\u4EA4\u6210\u529F\uFF01';document.getElementById('comment-author').value = '';document.getElementById('comment-content').value = '';const commentsRes = await fetch('/api/comments/" + escapeHtml(slug) + `');if (commentsRes.ok) {const newComments = await commentsRes.json();const commentsList = document.getElementById('comments-list');commentsList.innerHTML = newComments.map(c => {const cAuthor = escapeHtml(c.author);const cContent = escapeHtml(c.content);const cTimestamp = new Date(c.timestamp).toLocaleString();return '<div class="comment-item">' +'<div class="comment-meta">' +'<span class="comment-author">' + cAuthor + '</span>' +'<span class="comment-time">' + cTimestamp + '</span>' +'</div>' +'<div class="comment-content">' + cContent + '</div>' +'</div>';}).join('');}} else {msgSpan.textContent = '\u8BC4\u8BBA\u63D0\u4EA4\u5931\u8D25\uFF01';}};<\/script>`;
  return renderLayout(slug, inner);
}
__name(renderPost, "renderPost");
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/`/g, "&#96;");
}
__name(escapeHtml, "escapeHtml");
async function renderAdminPage(token, posts, env, url) {
  const editSlug = url.searchParams.get("slug");
  let editPost = null;
  if (editSlug) {
    editPost = await loadPost(env, editSlug);
  }
  const postListHtml = posts.map((p) => `
    <li>
      <span>${escapeHtml(p.title)} (${escapeHtml(p.slug)})</span>
      <a href="/admin?token=${token}&slug=${p.slug}">\u7F16\u8F91</a>
      <button onclick="deletePost('${p.slug}', '${token}')">\u5220\u9664</button>
    </li>
  `).join("");
  const form = `
<section class="card" style="padding:16px;">
  <h2 style="margin:0 0 12px;">\u65B0\u5EFA/\u7F16\u8F91\u6587\u7AE0</h2>
  <label>Title <input id="title" style="width:100%;padding:8px;margin:6px 0;" value="${editPost ? escapeHtml(editPost.title) : ""}"/></label>
  <label>Slug <input id="slug" style="width:100%;padding:8px;margin:6px 0;" placeholder="my-post" value="${editPost ? escapeHtml(editPost.slug) : ""}" ${editPost ? "readonly" : ""}/></label>
  <label>Date <input id="date" style="width:100%;padding:8px;margin:6px 0;" placeholder="2026-02-20" value="${editPost ? escapeHtml(editPost.date) : ""}"/></label>
  <label>Format <select id="format" style="width:100%;padding:8px;margin:6px 0;"><option value="md" ${editPost && editPost.format === "md" ? "selected" : ""}>Markdown</option><option value="wt" ${editPost && editPost.format === "wt" ? "selected" : ""}>Wikitext</option></select></label>
  <label>Desc <input id="desc" style="width:100%;padding:8px;margin:6px 0;" placeholder="\u6458\u8981\u53EF\u9009" value="${editPost ? escapeHtml(editPost.desc) : ""}"/></label>
  <textarea id="content" style="width:100%;height:260px;padding:8px;margin:6px 0;" placeholder="# \u6807\u9898

\u6B63\u6587...">${editPost ? escapeHtml(editPost.content) : ""}</textarea>
  <button id="save" style="padding:10px 14px;">\u4FDD\u5B58</button>
  <span id="msg" style="margin-left:8px;color:#9fb0c1;"></span>
</section>
<section class="card" style="padding:16px;margin-top:16px;">
  <h2 style="margin:0 0 12px;">\u6587\u7AE0\u5217\u8868</h2>
  <ul>${postListHtml}</ul>
</section>
<script>
  const btn=document.getElementById('save'); // \u9009\u62E9\u4FDD\u5B58\u6309\u94AE
  const token='${token.replace(/'/g, "&#39;")}'; // \u5185\u5D4C\u4EE4\u724C\u5B57\u7B26\u4E32
  const editSlug = '${editPost ? escapeHtml(editPost.slug) : ""}'; // \u83B7\u53D6\u5F53\u524D\u7F16\u8F91\u7684\u6587\u7AE0 slug
  btn.onclick=async()=>{ // \u7ED1\u5B9A\u70B9\u51FB\u4E8B\u4EF6
    const p={ // \u6536\u96C6\u8868\u5355\u5B57\u6BB5
      title:document.getElementById('title').value.trim(), // \u6807\u9898
      slug:document.getElementById('slug').value.trim(), // slug
      date:document.getElementById('date').value.trim(), // \u65E5\u671F
      format:document.getElementById('format').value, // \u683C\u5F0F
      desc:document.getElementById('desc').value.trim(), // \u63CF\u8FF0
      content:document.getElementById('content').value // \u6B63\u6587
    }; // \u7ED3\u675F\u5BF9\u8C61

    let url = '/api/posts'; // \u9ED8\u8BA4\u65B0\u5EFA\u6587\u7AE0\u63A5\u53E3
    let method = 'POST'; // \u9ED8\u8BA4\u65B0\u5EFA\u6587\u7AE0\u65B9\u6CD5

    if (editSlug) { // \u5982\u679C\u662F\u7F16\u8F91\u6587\u7AE0
      url = '/api/posts/' + editSlug; // \u7F16\u8F91\u6587\u7AE0\u63A5\u53E3
      method = 'PUT'; // \u7F16\u8F91\u6587\u7AE0\u65B9\u6CD5
    }

    const r=await fetch(url,{method:method,headers:{'content-type':'application/json','x-admin-token':token},body:JSON.stringify(p)}); // \u8C03\u7528\u4FDD\u5B58\u63A5\u53E3
    const t=document.getElementById('msg'); // \u83B7\u53D6\u6D88\u606F\u8282\u70B9
    if(r.ok){const j=await r.json(); t.textContent='\u5DF2\u4FDD\u5B58\uFF1A/posts/'+j.slug; } else { t.textContent='\u4FDD\u5B58\u5931\u8D25 '+r.status; } // \u663E\u793A\u7ED3\u679C
  }; // \u7ED3\u675F\u4E8B\u4EF6

  async function deletePost(slug, token) {
    if (!confirm('\u786E\u5B9A\u8981\u5220\u9664\u8FD9\u7BC7\u6587\u7AE0\u5417\uFF1F')) return;
    const r = await fetch('/api/posts/' + slug, { method: 'DELETE', headers: { 'x-admin-token': token } });
    if (r.ok) {
      alert('\u6587\u7AE0\u5220\u9664\u6210\u529F\uFF01');
      location.reload();
    } else {
      alert('\u6587\u7AE0\u5220\u9664\u5931\u8D25\uFF01');
    }
  }
<\/script>`;
  return renderLayout("\u7F16\u8F91\u6587\u7AE0", form);
}
__name(renderAdminPage, "renderAdminPage");
function sanitizeSlug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
__name(sanitizeSlug, "sanitizeSlug");
async function loadPostFromKV(env, slug) {
  if (!env.POSTS)
    return null;
  const raw = await env.POSTS.get(`post:${slug}`);
  if (!raw)
    return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
__name(loadPostFromKV, "loadPostFromKV");
async function savePostToKV(env, item) {
  await env.POSTS.put(`post:${item.slug}`, JSON.stringify(item));
  console.log(`Saved post: ${item.slug}`);
  const idx = await getIndexFromKV(env);
  const map = new Map(idx.map((x) => [x.slug, x]));
  map.set(item.slug, { slug: item.slug, title: item.title, date: item.date, desc: item.desc });
  const arr = [...map.values()].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  await env.POSTS.put("index", JSON.stringify(arr));
  console.log(`Updated index: ${JSON.stringify(arr)}`);
}
__name(savePostToKV, "savePostToKV");
async function deletePostFromKV(env, slug) {
  if (!env.POSTS)
    return;
  await env.POSTS.delete(`post:${slug}`);
  console.log(`Deleted post: ${slug}`);
  const idx = await getIndexFromKV(env);
  const arr = idx.filter((x) => x.slug !== slug);
  await env.POSTS.put("index", JSON.stringify(arr));
  console.log(`Updated index after deletion: ${JSON.stringify(arr)}`);
}
__name(deletePostFromKV, "deletePostFromKV");
async function saveCommentToKV(env, comment) {
  if (!env.COMMENTS)
    return;
  const key = `comment:${comment.slug}:${comment.timestamp}`;
  await env.COMMENTS.put(key, JSON.stringify(comment));
  console.log(`Saved comment: ${key}`);
  const indexKey = `comments_index:${comment.slug}`;
  const rawIndex = await env.COMMENTS.get(indexKey);
  let index = rawIndex ? JSON.parse(rawIndex) : [];
  index.push(key);
  await env.COMMENTS.put(indexKey, JSON.stringify(index));
  console.log(`Updated comments index for ${comment.slug}: ${JSON.stringify(index)}`);
}
__name(saveCommentToKV, "saveCommentToKV");
async function loadCommentsFromKV(env, slug) {
  if (!env.COMMENTS)
    return [];
  const indexKey = `comments_index:${slug}`;
  const rawIndex = await env.COMMENTS.get(indexKey);
  if (!rawIndex)
    return [];
  const index = JSON.parse(rawIndex);
  const comments = [];
  for (const key of index) {
    const rawComment = await env.COMMENTS.get(key);
    if (rawComment) {
      try {
        comments.push(JSON.parse(rawComment));
      } catch (e) {
        console.error(`Failed to parse comment ${key}: ${e}`);
      }
    }
  }
  comments.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  console.log(`Loaded comments for ${slug}: ${JSON.stringify(comments)}`);
  return comments;
}
__name(loadCommentsFromKV, "loadCommentsFromKV");
async function getIndexFromKV(env) {
  if (!env.POSTS)
    return [];
  const raw = await env.POSTS.get("index");
  if (!raw)
    return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
__name(getIndexFromKV, "getIndexFromKV");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-HkMHOZ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-HkMHOZ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
