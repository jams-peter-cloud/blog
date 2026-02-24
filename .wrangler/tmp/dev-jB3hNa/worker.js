var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var worker_default = {
  // 导出默认处理器对象
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = normalizePath(url.pathname);
    if (path === "/admin") {
      const token = url.searchParams.get("token") || "";
      if (!token) {
        return html("<p>\u7F3A\u5C11 token\uFF0C\u8BF7\u5728 URL \u6DFB\u52A0 ?token=YOUR_TOKEN</p>");
      }
      return html(renderAdminPage(token));
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
    if (path === "/") {
      const posts = await loadPostsIndexAll(env);
      const body = renderIndex(posts);
      return html(body);
    }
    if (path.startsWith("/posts/")) {
      const slug = path.slice("/posts/".length);
      const post = await loadPost(env, slug);
      if (post == null) {
        return notFound();
      }
      const content = post.format === "wt" ? wikitextToHtml(post.content) : markdownToHtml(post.content);
      const body = renderPost(slug, content);
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
  if (!p) return "/";
  let x = p.replace(/\\+/g, "/");
  x = x.replace(/\/\/+/, "/");
  if (!x.startsWith("/")) x = "/" + x;
  return x;
}
__name(normalizePath, "normalizePath");
async function loadPostsIndex(env) {
  const r = await env.ASSETS.fetch("https://assets.local/posts.json");
  if (!r.ok) return [];
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
    if (it && it.slug) map.set(it.slug, it);
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
  if (!r.ok) return null;
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
  if (!md) return null;
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
  s = s.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/^(?!<h\d>|<ul>|<li>|<p>|<blockquote>|<pre>|<code>|<\/)/gm, "<p>$&</p>");
  return s;
}
__name(markdownToHtml, "markdownToHtml");
function wikitextToHtml(wt) {
  let s = wt;
  s = s.replace(/&/g, "&amp;");
  s = s.replace(/</g, "&lt;");
  s = s.replace(/>/g, "&gt;");
  s = s.replace(/^======\s*(.+?)\s*======$/gm, "<h6>$1</h6>");
  s = s.replace(/^=====\s*(.+?)\s*=====$/gm, "<h5>$1</h5>");
  s = s.replace(/^====\s*(.+?)\s*====$/gm, "<h4>$1</h4>");
  s = s.replace(/^===\s*(.+?)\s*===$/gm, "<h3>$1</h3>");
  s = s.replace(/^==\s*(.+?)\s*==$/gm, "<h2>$1</h2>");
  s = s.replace(/^=\s*(.+?)\s*=$/gm, "<h1>$1</h1>");
  s = s.replace(/'''([^']+?)'''/g, "<strong>$1</strong>");
  s = s.replace(/''([^']+?)''/g, "<em>$1</em>");
  s = s.replace(/\[\[(.+?)\|(.*?)\]\]/g, '<a href="$1">$2</a>');
  s = s.replace(/\[\[(.+?)\]\]/g, '<a href="$1">$1</a>');
  s = s.replace(/\[(https?:[^\s]+)\s+([^\]]+)\]/g, '<a href="$1">$2</a>');
  s = s.replace(/^(\*+)\s+(.+)$/gm, (_, stars, text) => {
    const level = stars.length;
    return `<p class="li li-${level}">\u2022 ${text}</p>`;
  });
  s = s.replace(/^(?!<h\d>|<p|<a|<strong>|<em>)/gm, "<p>$&</p>");
  return s;
}
__name(wikitextToHtml, "wikitextToHtml");
function renderLayout(title, inner) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.ico" type="image/x-icon"/>
<link rel="shortcut icon" href="/favicon.ico" type="image/x-icon"/>
<link rel="stylesheet" href="/styles.css"/>
</head>
<body>
<div class="bg"></div>
<header class="site-header">
  <div class="wrap">
    <a href="/" class="brand">blog</a>
    <nav class="top-nav">
      <a href="/">\u9996\u9875</a>
      <a href="/" aria-disabled="true">\u5F52\u6863</a>
      <a href="/" aria-disabled="true">\u5173\u4E8E</a>
    </nav>
  </div>
</header>
<div class="page">
  <aside class="sidebar">
    <div class="card profile">
      <img src="/avatar.svg" alt="avatar" class="avatar"/>
      <div class="name">\u535A\u4E3B</div>
      <div class="meta">\u8BB0\u5F55\xB7\u601D\u8003\xB7\u5206\u4EAB</div>
    </div>
    <nav class="side-nav">
      <a href="/">\u9996\u9875</a>
      <a href="/" aria-disabled="true">\u6807\u7B7E</a>
      <a href="/" aria-disabled="true">RSS</a>
    </nav>
  </aside>
  <main class="content">${inner}</main>
</div>
<footer class="site-footer">\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} blog</footer>
</body>
</html>`;
}
__name(renderLayout, "renderLayout");
function renderIndex(posts) {
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
  const body = renderLayout("\u535A\u5BA2", inner);
  console.log(`Rendered Index HTML: ${body}`);
  return body;
}
__name(renderIndex, "renderIndex");
function renderPost(slug, contentHtml) {
  const inner = `<article class="post">${contentHtml}</article>
<p><a href="/">\u8FD4\u56DE\u9996\u9875</a></p>`;
  return renderLayout(slug, inner);
}
__name(renderPost, "renderPost");
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
__name(escapeHtml, "escapeHtml");
function renderAdminPage(token) {
  const form = `
<section class="card" style="padding:16px;">
  <h2 style="margin:0 0 12px;">\u65B0\u5EFA/\u7F16\u8F91\u6587\u7AE0</h2>
  <label>Title <input id="title" style="width:100%;padding:8px;margin:6px 0;"/></label>
  <label>Slug <input id="slug" style="width:100%;padding:8px;margin:6px 0;" placeholder="my-post"/></label>
  <label>Date <input id="date" style="width:100%;padding:8px;margin:6px 0;" placeholder="2026-02-20"/></label>
  <label>Format <select id="format" style="width:100%;padding:8px;margin:6px 0;"><option value="md">Markdown</option><option value="wt">Wikitext</option></select></label>
  <label>Desc <input id="desc" style="width:100%;padding:8px;margin:6px 0;" placeholder="\u6458\u8981\u53EF\u9009"/></label>
  <textarea id="content" style="width:100%;height:260px;padding:8px;margin:6px 0;" placeholder="# \u6807\u9898

\u6B63\u6587..."></textarea>
  <button id="save" style="padding:10px 14px;">\u4FDD\u5B58</button>
  <span id="msg" style="margin-left:8px;color:#9fb0c1;"></span>
</section>
<script>
  const btn=document.getElementById('save'); // \u9009\u62E9\u4FDD\u5B58\u6309\u94AE
  const token='${token.replace(/'/g, "&#39;")}'; // \u5185\u5D4C\u4EE4\u724C\u5B57\u7B26\u4E32
  btn.onclick=async()=>{ // \u7ED1\u5B9A\u70B9\u51FB\u4E8B\u4EF6
    const p={ // \u6536\u96C6\u8868\u5355\u5B57\u6BB5
      title:document.getElementById('title').value.trim(), // \u6807\u9898
      slug:document.getElementById('slug').value.trim(), // slug
      date:document.getElementById('date').value.trim(), // \u65E5\u671F
      format:document.getElementById('format').value, // \u683C\u5F0F
      desc:document.getElementById('desc').value.trim(), // \u63CF\u8FF0
      content:document.getElementById('content').value // \u6B63\u6587
    }; // \u7ED3\u675F\u5BF9\u8C61
    const r=await fetch('/api/posts',{method:'POST',headers:{'content-type':'application/json','x-admin-token':token},body:JSON.stringify(p)}); // \u8C03\u7528\u4FDD\u5B58\u63A5\u53E3
    const t=document.getElementById('msg'); // \u83B7\u53D6\u6D88\u606F\u8282\u70B9
    if(r.ok){const j=await r.json(); t.textContent='\u5DF2\u4FDD\u5B58\uFF1A/posts/'+j.slug; } else { t.textContent='\u4FDD\u5B58\u5931\u8D25 '+r.status; } // \u663E\u793A\u7ED3\u679C
  }; // \u7ED3\u675F\u4E8B\u4EF6
<\/script>`;
  return renderLayout("\u7F16\u8F91\u6587\u7AE0", form);
}
__name(renderAdminPage, "renderAdminPage");
function sanitizeSlug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
__name(sanitizeSlug, "sanitizeSlug");
async function loadPostFromKV(env, slug) {
  if (!env.POSTS) return null;
  const raw = await env.POSTS.get(`post:${slug}`);
  if (!raw) return null;
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
async function getIndexFromKV(env) {
  if (!env.POSTS) return [];
  const raw = await env.POSTS.get("index");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
__name(getIndexFromKV, "getIndexFromKV");

// D:/Scoop/scoop/persist/nodejs/bin/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
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

// D:/Scoop/scoop/persist/nodejs/bin/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
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

// .wrangler/tmp/bundle-P1YXla/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// D:/Scoop/scoop/persist/nodejs/bin/node_modules/wrangler/templates/middleware/common.ts
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

// .wrangler/tmp/bundle-P1YXla/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
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
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
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
