import { marked } from 'marked'; // 导入 marked 库

// 导出默认对象以使用模块 Worker 接口
export default { // 导出默认处理器对象
  async fetch(req, env) { // 处理每个进入的请求
    const url = new URL(req.url); // 解析请求 URL
    const path = normalizePath(url.pathname); // 归一化路径去除多余斜杠
    console.log("Fetch function started for path:", path); // 记录 fetch 函数开始和路径

    if (path === "/admin") { // 匹配管理端编辑页
      const token = url.searchParams.get("token") || ""; // 从查询参数读取 token
      if (!token) { // 判断是否缺少 token
        return html('<p>缺少 token，请在 URL 添加 ?token=YOUR_TOKEN</p>'); // 返回提示页面
      } // 结束 token 校验
      const posts = await loadPostsIndexAll(env); // 加载所有文章
      return html(renderAdminPage(token, posts, env, url)); // 返回编辑器页面 HTML
    } // 结束 /admin 分支

    if (path === "/ide/build") { // 匹配 IDE 构建页面
      const token = url.searchParams.get("token") || ""; // 从查询参数读取 token
      if (!env.ADMIN_TOKEN) { // 检查是否配置了 ADMIN_TOKEN
        return html(`
          <div style="padding: 20px; font-family: sans-serif;">
            <h2>未配置管理员 Token</h2>
            <p>请在 Cloudflare 控制台或 wrangler.toml 中设置 <code>ADMIN_TOKEN</code> 环境变量。</p>
            <p>当前环境变量状态: <b>未定义</b></p>
          </div>
        `);
      }
      if (!token || token !== env.ADMIN_TOKEN) { // 校验 token
        return html(`
          <div style="padding: 20px; font-family: sans-serif;">
            <h2>验证失败</h2>
            <p>请在 URL 中添加正确的 token，例如：<code>?token=YOUR_TOKEN</code></p>
            <p style="color: #666; font-size: 0.9em;">提示：您设置的 token 长度为 ${env.ADMIN_TOKEN.length} 位</p>
          </div>
        `);
      } // 结束 token 校验
      const posts = await loadPostsIndexAll(env); // 加载所有文章
      return html(renderIdePage(env, posts)); // 返回 IDE 管理页面，并传递文章列表
    } // 结束 /ide/build 分支

    if (path === "/api/posts" && req.method === "POST") { // 匹配保存文章接口
      const token = req.headers.get("x-admin-token") || ""; // 从请求头读取 token
      if (!token || !env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) { // 校验 token 与环境变量
        return new Response("Unauthorized", { status: 401 }); // 未授权响应
      } // 结束鉴权
      const payload = await req.json().catch(() => null); // 解析 JSON 负载
      if (!payload || !payload.slug || !payload.title || !payload.format || !payload.content) { // 校验必要字段
        return new Response("Bad Request", { status: 400 }); // 返回 400
      } // 结束请求体验证
      const now = new Date().toISOString().slice(0, 10); // 生成默认日期
      const item = { // 组装文章对象
        slug: sanitizeSlug(String(payload.slug)), // 规范化 slug
        title: String(payload.title), // 标题
        date: String(payload.date || now), // 日期
        desc: String(payload.desc || ""), // 摘要
        format: String(payload.format || "md"), // 格式
        tags: payload.tags || [], // 标签
        content: String(payload.content), // 正文
      }; // 结束对象
      await savePostToKV(env, item); // 保存文章并更新索引
      return new Response(JSON.stringify({ ok: true, slug: item.slug }), { headers: { "content-type": "application/json" } }); // 返回成功 JSON
    } // 结束 /api/posts 分支

    if (path.startsWith("/api/posts/") && req.method === "DELETE") { // 匹配删除文章接口
      const token = req.headers.get("x-admin-token") || ""; // 从请求头读取 token
      if (!token || !env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) { // 校验 token 与环境变量
        return new Response("Unauthorized", { status: 401 }); // 未授权响应
      } // 结束鉴权
      const slug = sanitizeSlug(path.slice("/api/posts/".length)); // 提取文章标识并规范化
      await deletePostFromKV(env, slug); // 删除文章并更新索引
      return new Response(JSON.stringify({ ok: true, slug: slug }), { headers: { "content-type": "application/json" } }); // 返回成功 JSON
    } // 结束 /api/posts/:slug DELETE 分支

    if (path.startsWith("/api/posts/") && req.method === "PUT") { // 匹配更新文章接口
      const token = req.headers.get("x-admin-token") || ""; // 从请求头读取 token
      if (!token || !env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) { // 校验 token 与环境变量
        return new Response("Unauthorized", { status: 401 }); // 未授权响应
      } // 结束鉴权
      const slug = path.slice("/api/posts/".length); // 从路径中提取 slug
      const payload = await req.json().catch(() => null); // 解析 JSON 负载
      if (!payload || !payload.title || !payload.format || !payload.content) { // 校验必要字段
        return new Response("Bad Request", { status: 400 }); // 返回 400
      } // 结束请求体验证
      const now = new Date().toISOString().slice(0, 10); // 生成默认日期
      const item = { // 组装文章对象
        slug: sanitizeSlug(slug), // 规范化 slug (使用路径中的 slug)
        title: String(payload.title), // 标题
        date: String(payload.date || now), // 日期
        desc: String(payload.desc || ""), // 摘要
        format: "md", // 格式
        tags: payload.tags || [], // 标签
        content: String(payload.content), // 正文
      }; // 结束对象
      await savePostToKV(env, item); // 保存文章并更新索引 (savePostToKV 会覆盖同 slug 的文章)
      return new Response(JSON.stringify({ ok: true, slug: item.slug }), { headers: { "content-type": "application/json" } }); // 返回成功 JSON
    } // 结束 /api/posts/:slug PUT 分支

    if (path.startsWith("/api/posts/") && req.method === "GET") { // 匹配获取单篇文章接口
      const slug = decodeURIComponent(path.slice("/api/posts/".length)); // 提取并解码 slug
      const post = await loadPost(env, slug); // 加载文章
      if (post) { // 如果文章存在
        return new Response(JSON.stringify(post), { headers: { "content-type": "application/json" } }); // 返回文章 JSON
      } else { // 如果文章不存在
        return new Response("Not Found", { status: 404 }); // 返回 404
      } // 结束文章存在判断
    } // 结束 /api/posts/:slug GET 分支

    if (path === "/api/comments" && req.method === "POST") { // 匹配提交评论接口
      const payload = await req.json().catch(() => null); // 解析 JSON 负载
      if (!payload || !payload.slug || !payload.author || !payload.content) { // 校验必要字段
        return new Response("Bad Request", { status: 400 }); // 返回 400
      } // 结束请求体验证
      const comment = { // 组装评论对象
        slug: sanitizeSlug(String(payload.slug)), // 规范化文章 slug
        author: String(payload.author).trim(), // 评论作者
        content: String(payload.content).trim(), // 评论内容
        timestamp: new Date().toISOString(), // 评论时间戳
      }; // 结束对象
      await saveCommentToKV(env, comment); // 保存评论到 KV
      return new Response(JSON.stringify({ ok: true, comment }), { headers: { "content-type": "application/json" } }); // 返回成功 JSON
    } // 结束 /api/comments POST 分支

    if (path.startsWith("/api/comments/") && req.method === "GET") { // 匹配获取评论接口
      const slug = path.slice("/api/comments/".length); // 从路径中提取文章 slug
      const comments = await loadCommentsFromKV(env, slug); // 从 KV 加载评论
      return new Response(JSON.stringify(comments), { headers: { "content-type": "application/json" } }); // 返回评论列表 JSON
    } // 结束 /api/comments/:slug GET 分支

    if (path === "/api/images" && req.method === "POST") { // 匹配图片上传接口
      const token = req.headers.get("x-admin-token") || ""; // 从请求头读取 token
      if (!token || !env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) { // 校验 token 与环境变量
        return new Response("Unauthorized", { status: 401 }); // 未授权响应
      } // 结束鉴权

      const formData = await req.formData(); // 解析表单数据
      const file = formData.get("file"); // 获取文件
      if (!file) { // 校验文件是否存在
        return new Response("Bad Request: No file uploaded", { status: 400 }); // 返回 400
      } // 结束文件校验

      const fileName = file.name; // 获取文件名
      const fileBuffer = await file.arrayBuffer(); // 获取文件内容
      const fileType = file.type; // 获取文件类型

      // 生成一个唯一的 key，例如使用文件名和时间戳
      const imageKey = `images/${Date.now()}-${fileName}`; // 生成 KV 存储 key

      await env.IMAGES.put(imageKey, fileBuffer, { // 将图片存储到 IMAGES KV 命名空间
        metadata: { contentType: fileType }, // 存储文件类型元数据
      }); // 结束 KV 存储

      const imageUrl = `${url.origin}/image/${imageKey}`; // 构造图片访问 URL
      return new Response(JSON.stringify({ ok: true, url: imageUrl }), { headers: { "content-type": "application/json" } }); // 返回成功 JSON 和图片 URL
    } // 结束 /api/images POST 分支

    if (path.startsWith("/image/") && req.method === "GET") { // 匹配图片获取接口
      const imageKey = path.slice("/image/".length); // 从路径中提取图片 key
      const image = await env.IMAGES.get(imageKey, { type: "arrayBuffer", cacheTtl: 3600 }); // 从 IMAGES KV 获取图片，设置缓存
      if (!image) { // 如果图片不存在
        return new Response("Not Found", { status: 404 }); // 返回 404
      } // 结束图片校验
      const metadata = await env.IMAGES.getWithMetadata(imageKey); // 获取图片元数据
      const contentType = metadata.metadata ? metadata.metadata.contentType : "application/octet-stream"; // 获取内容类型
      return new Response(image, { headers: { "content-type": contentType } }); // 返回图片内容
    } // 结束 /image/:imageKey GET 分支

    if (path === "/") { // 匹配首页路由
      const posts = await loadPostsIndexAll(env); // 加载合并后的文章索引
      const body = renderIndex(posts, env); // 渲染首页 HTML
      return html(body); // 返回 HTML 响应
    } // 结束首页分支

    if (path === "/archives") {
      const posts = await loadPostsIndexAll(env);
      const inner = renderArchives(posts);
      return html(renderLayout("归档", inner, env));
    }

    if (path === "/tags") {
      const posts = await loadPostsIndexAll(env);
      const inner = renderTags(posts);
      return html(renderLayout("标签", inner, env));
    }

    if (path === "/about") {
      const inner = renderAbout();
      return html(renderLayout("关于", inner, env));
    }

    if (path === "/frontend") {
      const posts = await loadPostsIndexAll(env);
      const inner = renderCategory(posts, "前端开发");
      return html(renderLayout("前端开发", inner, env));
    }

    if (path === "/backend") {
      const posts = await loadPostsIndexAll(env);
      const inner = renderCategory(posts, "后端开发");
      return html(renderLayout("后端开发", inner, env));
    }

    if (path === "/tools") {
      const posts = await loadPostsIndexAll(env);
      const inner = renderCategory(posts, "工具使用");
      return html(renderLayout("工具使用", inner, env));
    }

    if (path.startsWith("/posts/")) { // 匹配文章详情路由
      console.log("Entering /posts/ route for path:", path); // 记录进入文章路由
      const slug = path.slice("/posts/".length); // 提取文章标识
      const post = await loadPost(env, slug); // 加载文章（KV 或静态）
      console.log("Loaded post object:", post); // 记录加载的文章对象
      if (post == null) { // 如果未找到文章
        return notFound(); // 返回 404
      } // 结束未找到处理
      console.log("Post content before conversion:", post.content); // 记录转换前的文章内容
      const content = markdownToHtml(post.content); // 将文章内容转换为 HTML
      console.log("Content after wikitextToHtml/markdownToHtml:", content); // 记录转换后的内容
      const body = await renderPost(env, slug, content, post.title); // 渲染文章页 HTML，传递 post.title
            return html(body); // 返回 HTML 响应
    } // 结束文章路由分支

    // 其余请求交给静态资源处理
    return env.ASSETS.fetch(req); // 使用静态资源绑定返回文件
  }, // 结束 fetch 方法
}; // 结束默认导出对象

// 将字符串包装为 HTML 响应
function html(s) { // 定义 HTML 响应构造函数
  return new Response(s, { headers: { "content-type": "text/html; charset=utf-8" } }); // 设置内容类型并返回
} // 结束 html 函数

// 返回 404 响应
function notFound() { // 定义 404 响应函数
  return new Response("Not Found", { status: 404 }); // 返回简单的 404 文本
} // 结束 notFound 函数

// 归一化路径，去除多余斜杠并保证前导斜杠
function normalizePath(p) { // 定义路径归一化函数
  if (!p || p === "/") return "/"; // 空路径或根路径直接返回
  let x = p.replace(/\\+/g, "/"); // 替换反斜杠为正斜杠
  x = x.replace(/\/+$/, ""); // 去除末尾斜杠
  x = x.replace(/\/+/g, "/"); // 合并重复斜杠
  if (!x.startsWith("/")) x = "/" + x; // 确保以斜杠开头
  return x; // 返回处理后的路径
} // 结束 normalizePath 函数

// 从静态资源加载文章索引
async function loadPostsIndex(env) { // 定义加载文章索引函数
  try {
    if (!env.ASSETS) return []; // 若未绑定 ASSETS 返回空
    // 在 Cloudflare Workers 中，env.ASSETS.fetch 期望一个 Request 对象或 URL 字符串
    // 使用 assets.local 域名是正确的，但需要确保它是通过内部绑定访问的
    const r = await env.ASSETS.fetch(new Request("https://assets.local/posts.json")); // 通过绑定获取 posts.json
    if (!r.ok) {
      console.warn("posts.json not found in assets, status:", r.status);
      return []; // 若文件不存在返回空列表
    }
    return await r.json(); // 返回解析后的 JSON 数组
  } catch (e) {
    console.error("loadPostsIndex error:", e);
    return [];
  }
} // 结束 loadPostsIndex 函数

// 从 KV 与静态资源合并加载索引
async function loadPostsIndexAll(env) { // 定义合并索引加载函数
  try {
    const a = await loadPostsIndex(env); // 加载静态索引
    const b = await getIndexFromKV(env); // 加载 KV 索引
    
    // 调试日志：在生产环境中查看 Cloudflare Logs
    console.log(`Loaded ${a.length} posts from Assets and ${b.length} posts from KV`);
    
    const map = new Map(); // 创建去重映射
    
    // 先处理静态文章
    if (Array.isArray(a)) {
      a.forEach(it => { if (it && it.slug) map.set(it.slug, it); });
    }
    
    // 后处理 KV 文章（KV 版本优先）
    if (Array.isArray(b)) {
      b.forEach(it => { if (it && it.slug) map.set(it.slug, it); });
    }
    
    const merged = [...map.values()].sort((x, y) => {
      const dateX = x.date || "0000-00-00";
      const dateY = y.date || "0000-00-00";
      return dateY.localeCompare(dateX);
    });
    
    return merged; // 返回合并后的索引
  } catch (e) {
    console.error("Error in loadPostsIndexAll:", e);
    return [];
  }
} // 结束 loadPostsIndexAll 函数

// 从静态资源加载指定文章 Markdown
async function loadPostMarkdown(env, slug) { // 定义加载单篇文章函数
  // 直接使用经过 sanitizeSlug 处理后的 slug，不再进行二次过滤，确保与文件名一致
  const url = `https://assets.local/posts/${slug}.md`; // 构造静态资源路径
  try {
    const r = await env.ASSETS.fetch(new Request(url)); // 通过绑定获取 Markdown 文件
    if (!r.ok) {
      console.warn(`Markdown file not found: ${url} (Status: ${r.status})`);
      return null;
    }
    return await r.text(); // 返回 Markdown 文本
  } catch (e) {
    console.error(`Error loading markdown for ${slug} from ${url}:`, e);
    return null;
  }
} // 结束 loadPostMarkdown 函数

// 从 KV 或静态资源读取文章
async function loadPost(env, slug) { // 定义综合加载文章函数
  // 不要在加载时强行 sanitizeSlug，因为静态资源的文件名可能包含大写字母或特殊字符
  // 我们应该优先使用原始传入的 slug 进行匹配
  const kv = await loadPostFromKV(env, slug); // 尝试使用原始 slug 读取 KV
  if (kv) return kv;

  // 如果 KV 没找到，再尝试一下规范化后的 slug（兼容旧数据）
  const s = sanitizeSlug(slug);
  if (s !== slug) {
    const kv2 = await loadPostFromKV(env, s);
    if (kv2) return kv2;
  }

  // 尝试读取静态 Markdown
  const md = await loadPostMarkdown(env, slug); // 使用原始 slug
  if (md !== null) {
    return { slug: slug, title: slug, date: "", desc: "", format: "md", content: md };
  }

  // 最后尝试规范化后的路径读取静态资源
  if (s !== slug) {
    const md2 = await loadPostMarkdown(env, s);
    if (md2 !== null) {
      return { slug: s, title: s, date: "", desc: "", format: "md", content: md2 };
    }
  }

  return null; // 全都没找到
} // 结束 loadPost 函数

// 使用 marked 库进行 Markdown 转 HTML
function markdownToHtml(md) {
  // 1. 处理自定义代码块语法 '''
  const processedMd = md.replace(/'''(\w*)\n?([\s\S]*?)'''/g, '```$1\n$2\n```');
  
  // 2. 使用 marked 解析
  return marked.parse(processedMd);
}

// 渲染 IDE 管理页面
function renderIdePage(env, posts) {
  const inner = `
    <section class="ide-section">
      <h2>文件管理</h2>
      
      <div class="ide-card" id="drop-zone" style="border: 3px dashed rgba(255,255,255,0.2); padding: 40px; text-align: center; cursor: pointer; margin-bottom: 20px; border-radius: 10px; transition: all 0.3s ease;">
        <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.7;">📂</div>
        <p style="font-size: 1.2em; margin-bottom: 10px; font-weight: bold;">拖拽文件到此处或点击上传</p>
        <p style="color: #888; font-size: 0.9em;">支持 Markdown (.md), HTML (.html) 自动发布为文章，以及图片上传</p>
        <input type="file" id="file-input" multiple style="display: none;" accept="image/*,.html,.md" />
        <div id="upload-preview" style="margin-top: 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;"></div>
      </div>

      <div class="ide-card">
        <h3>选择文章进行编辑</h3>
        <select id="post-selector" style="width:100%;padding:8px;margin:6px 0;">
          <option value="">-- 选择一篇文章 --</option>
          ${posts.map(p => `<option value="${escapeHtml(p.slug)}">${escapeHtml(p.title)}</option>`).join('')}
        </select>
        <h3>添加/编辑文章</h3>
        <label>文章 Slug: <input type="text" id="ide-slug" style="width:100%;padding:8px;margin:6px 0;"/></label>
        <label>文章标题: <input type="text" id="ide-title" style="width:100%;padding:8px;margin:6px 0;"/></label>
        <label>文章摘要: <input type="text" id="ide-desc" style="width:100%;padding:8px;margin:6px 0;"/></label>
        <label>文章格式: 
          <select id="ide-format" style="width:100%;padding:8px;margin:6px 0;">
            <option value="md">Markdown</option>
            <option value="html">HTML</option>
          </select>
        </label>
        <label>Tags (逗号分隔) <input type="text" id="ide-tags" style="width:100%;padding:8px;margin:6px 0;" placeholder="tag1, tag2"/></label>
        
        <div style="display: flex; gap: 20px; margin-top: 10px;">
          <div style="flex: 2;">
            <label>文章内容 (Markdown/HTML): <textarea id="ide-content" style="width:100%;height:600px;padding:8px;margin:6px 0; font-family: monospace; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px;" placeholder="# 标题\n\n正文...\n\n'''\n这里的内容不会被解析为 Markdown\n可以放代码或纯文本\n'''"></textarea></label>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
            <label>实时预览:</label>
            <div id="markdown-content" class="post" style="flex: 1; padding: 20px; margin: 6px 0; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow-y: scroll; background: rgba(21, 28, 45, 0.6); height: 600px; max-height: 600px; font-size: 0.9em; box-sizing: border-box;"></div>
          </div>
        </div>
        
        <button id="ide-save-post" style="padding:10px 15px;background-color:#28a745;color:white;border:none;border-radius:5px;cursor:pointer;margin-top:10px;">保存文章</button>
      </div>

      <div class="ide-card">
        <h3>删除文章</h3>
        <select id="delete-post-selector" style="width:100%;padding:8px;margin:6px 0;">
          <option value="">-- 选择要删除的文章 --</option>
          ${posts.map(p => `<option value="${escapeHtml(p.slug)}">${escapeHtml(p.title)}</option>`).join('')}
        </select>
        <label>要删除的文章 Slug: <input type="text" id="ide-delete-slug" style="width:100%;padding:8px;margin:6px 0;"/></label>
        <button id="ide-delete-post" style="padding:10px 15px;background-color:#dc3545;color:white;border:none;border-radius:5px;cursor:pointer;">删除文章</button>
      </div>
    </section>
    <script>
      const ADMIN_TOKEN = "${String(env.ADMIN_TOKEN).replace(/"/g, '\\"')}";
      
      // 预览功能
      const ideContentInput = document.getElementById('ide-content');
      const previewDiv = document.getElementById('markdown-content');
      const formatSelect = document.getElementById('ide-format');

      function updatePreview() {
        if (typeof marked === 'undefined') {
          previewDiv.innerHTML = '正在加载解析器...';
          return;
        }

        const text = ideContentInput.value;
        const format = formatSelect.value;
        
        if (format === 'html') {
           previewDiv.innerHTML = text;
        } else {
           // 使用简单的字符串替换，避免在模板字符串中嵌套复杂正则导致的转义问题
           let processed = text;
           const parts = text.split("'''");
           if (parts.length > 1) {
             let newText = "";
             for (let i = 0; i < parts.length; i++) {
               if (i % 2 === 1) {
                 const content = parts[i];
                 const firstNewline = content.indexOf('\\n');
                 if (firstNewline !== -1) {
                   const lang = content.substring(0, firstNewline).trim();
                   const code = content.substring(firstNewline + 1);
                   newText += "\\n\`\`\`" + lang + "\\n" + code + "\\n\`\`\`\\n";
                 } else {
                   newText += "\\n\`\`\`\\n" + content + "\\n\`\`\`\\n";
                 }
               } else {
                 newText += parts[i];
               }
             }
             processed = newText;
           }
           
           // 解析 Markdown
           previewDiv.innerHTML = marked.parse(processed);
           
           // 手动触发高亮
           if (typeof hljs !== 'undefined') {
             previewDiv.querySelectorAll('pre code').forEach((el) => {
               hljs.highlightElement(el);
             });
           }
        }
      }

      // 监听输入
      ideContentInput.addEventListener('input', updatePreview);
      formatSelect.addEventListener('change', updatePreview);

      // 滚动同步功能
      let isScrolling = false;

      ideContentInput.addEventListener('scroll', () => {
        if (isScrolling) return;
        isScrolling = true;
        const percentage = ideContentInput.scrollTop / (ideContentInput.scrollHeight - ideContentInput.clientHeight);
        previewDiv.scrollTop = percentage * (previewDiv.scrollHeight - previewDiv.clientHeight);
        setTimeout(() => { isScrolling = false; }, 50); // 增加小延迟防止回环触发
      });

      previewDiv.addEventListener('scroll', () => {
        if (isScrolling) return;
        isScrolling = true;
        const percentage = previewDiv.scrollTop / (previewDiv.scrollHeight - previewDiv.clientHeight);
        ideContentInput.scrollTop = percentage * (ideContentInput.scrollHeight - ideContentInput.clientHeight);
        setTimeout(() => { isScrolling = false; }, 50);
      });
      
      // 初始渲染一次
      setTimeout(updatePreview, 500);

      // Drag & Drop Logic
      const dropZone = document.getElementById('drop-zone');
      const fileInput = document.getElementById('file-input');
      const previewArea = document.getElementById('upload-preview');

      dropZone.addEventListener('click', (e) => {
        if (e.target !== fileInput) fileInput.click();
      });

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#4CAF50';
        dropZone.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'rgba(255,255,255,0.2)';
        dropZone.style.backgroundColor = 'transparent';
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(255,255,255,0.2)';
        dropZone.style.backgroundColor = 'transparent';
        handleFiles(e.dataTransfer.files);
      });

      fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
      });

      async function handleFiles(files) {
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            uploadImage(file);
          } else if (file.name.endsWith('.html') || file.name.endsWith('.md')) {
            uploadPost(file);
          } else {
            alert('不支持的文件类型: ' + file.name + ' (支持 .jpg, .png, .gif, .html, .md)');
          }
        }
      }

      async function uploadImage(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const card = createPreviewCard(file.name, 'Uploading image...');
        previewArea.appendChild(card.element);

        try {
          const res = await fetch('/api/images', {
            method: 'POST',
            headers: { 'x-admin-token': ADMIN_TOKEN },
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            card.setContent(\`<img src="\${data.url}" style="max-width:100%;max-height:80px;border-radius:4px;display:block;margin:0 auto;"><div style="font-size:10px;margin-top:5px;word-break:break-all;">\${data.url}</div>\`);
            card.setStatus('success');
          } else {
            card.setContent('Upload failed: ' + res.statusText);
            card.setStatus('error');
          }
        } catch (e) {
          card.setContent('Error: ' + e.message);
          card.setStatus('error');
        }
      }

      async function uploadPost(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target.result;
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
          const slug = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const title = nameWithoutExt;
          const format = file.name.endsWith('.html') ? 'html' : 'md';
          
          const card = createPreviewCard(file.name, 'Publishing article...');
          previewArea.appendChild(card.element);

          try {
            const res = await fetch('/api/posts', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-admin-token': ADMIN_TOKEN 
              },
              body: JSON.stringify({ slug, title, desc: 'Imported from ' + file.name, format, content })
            });
            
            if (res.ok) {
              card.setContent('Published!<br><small>Slug: ' + slug + '</small>');
              card.setStatus('success');
            } else {
              card.setContent('Failed: ' + res.statusText);
              card.setStatus('error');
            }
          } catch (e) {
             card.setContent('Error: ' + e.message);
             card.setStatus('error');
          }
        };
        reader.readAsText(file);
      }

      function createPreviewCard(title, initialStatus) {
        const div = document.createElement('div');
        div.style.background = 'rgba(255,255,255,0.05)';
        div.style.border = '1px solid rgba(255,255,255,0.1)';
        div.style.borderRadius = '6px';
        div.style.padding = '10px';
        div.style.fontSize = '12px';
        div.style.textAlign = 'center';
        div.innerHTML = \`<div style="font-weight:bold;margin-bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${title}</div><div class="status">\${initialStatus}</div>\`;
        
        return {
          element: div,
          setContent: (html) => { div.querySelector('.status').innerHTML = html; },
          setStatus: (status) => {
            if (status === 'success') div.style.borderColor = '#28a745';
            if (status === 'error') div.style.borderColor = '#dc3545';
          }
        };
      }

      document.getElementById('post-selector').addEventListener('change', async (event) => {
        const selectedSlug = event.target.value;
        const ideSlugInput = document.getElementById('ide-slug');
        const ideTitleInput = document.getElementById('ide-title');
        const ideDescInput = document.getElementById('ide-desc');
        const ideTagsInput = document.getElementById('ide-tags');

        if (selectedSlug) {
          // 对 slug 进行编码，并根据需要添加鉴权头（尽管 GET 目前是公开的，但为了统一建议加上）
          const res = await fetch('/api/posts/' + encodeURIComponent(selectedSlug), {
            headers: { 'x-admin-token': ADMIN_TOKEN }
          });
          
          if (res.ok) {
            const post = await res.json();
            ideSlugInput.value = post.slug || '';
            ideTitleInput.value = post.title || '';
            ideDescInput.value = post.desc || '';
            formatSelect.value = post.format || 'md';
            ideTagsInput.value = (post.tags || []).join(', ');
            ideContentInput.value = post.content || '';
            updatePreview();
          } else {
            console.error('Fetch post failed:', res.status, res.statusText);
            alert('获取文章详情失败 (状态码: ' + res.status + ')。请检查控制台日志。');
            ideSlugInput.value = ''; ideTitleInput.value = ''; ideDescInput.value = ''; formatSelect.value = 'md'; ideTagsInput.value = ''; ideContentInput.value = '';
            updatePreview();
          }
        } else {
          ideSlugInput.value = ''; ideTitleInput.value = ''; ideDescInput.value = ''; formatSelect.value = 'md'; ideTagsInput.value = ''; ideContentInput.value = '';
          updatePreview();
        }
      });

      document.getElementById('delete-post-selector').addEventListener('change', (event) => {
        document.getElementById('ide-delete-slug').value = event.target.value;
      });

      document.getElementById('ide-save-post').addEventListener('click', async () => {
        const slug = document.getElementById('ide-slug').value;
        const title = document.getElementById('ide-title').value;
        const desc = document.getElementById('ide-desc').value;
        const format = document.getElementById('ide-format').value;
        const tags = document.getElementById('ide-tags').value.split(',').map(t => t.trim()).filter(t => t);
        const content = document.getElementById('ide-content').value;

        if (!slug || !title || !content) {
          alert('Slug, 标题和内容不能为空！');
          return;
        }

        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
          body: JSON.stringify({ slug, title, desc, format, tags, content })
        });

        if (res.ok) {
          alert('文章保存成功！');
          document.getElementById('ide-slug').value = '';
          document.getElementById('ide-title').value = '';
          document.getElementById('ide-desc').value = '';
          document.getElementById('ide-format').value = 'md';
          document.getElementById('ide-tags').value = '';
          document.getElementById('ide-content').value = '';
        } else {
          alert('文章保存失败: ' + res.statusText);
        }
      });

      document.getElementById('ide-delete-post').addEventListener('click', async () => {
        const slug = document.getElementById('ide-delete-slug').value;
        if (!slug) { alert('文章 Slug 不能为空！'); return; }
        if (!confirm('确定要删除文章 ' + slug + ' 吗？')) return;

        const res = await fetch('/api/posts/' + slug, {
          method: 'DELETE',
          headers: { 'x-admin-token': ADMIN_TOKEN }
        });

        if (res.ok) {
          alert('文章删除成功！');
          document.getElementById('ide-delete-slug').value = '';
          location.reload();
        } else {
          alert('文章删除失败: ' + res.statusText);
        }
      });
    </script>
  `;
  return renderLayout("IDE 管理", inner, env);
}

// 渲染页面通用布局
function renderLayout(title, inner, env, theme = 'dark-mode') { // 定义布局渲染函数
  const avatarUrl = env.AVATAR_URL || "/avatar.svg"; // 获取头像 URL，如果未设置则使用默认值
  return `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8"/>\n<meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n<title>${escapeHtml(title)}</title>\n<link rel="icon" href="/favicon.ico" type="image/x-icon"/>\n<link rel="shortcut icon" href="/favicon.ico" type="image/x-icon"/>\n<link rel="stylesheet" href="/styles.css"/>\n<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"/>\n</head>\n<body class="${theme}">\n<div class="bg"></div>\n<header class="site-header">\n  <div class="wrap">\n    <a href="/" class="brand">我的技术博客</a>\n    <nav class="top-nav">\n      <a href="/">首页</a>\n      <a href="/archives">归档</a>\n      <a href="/tags">标签</a>\n      <a href="/about">关于</a>\n    </nav>\n  </div>
</header>\n<div class="page">\n  <aside class="sidebar">
    <div class="card profile">
      <img src="${escapeHtml(avatarUrl)}" alt="头像" class="avatar">
      <div class="name">柠檬先生</div>
      <div class="meta"> <a href="mailto:jams-peter@outlook.com" target="_blank" style="color: inherit; text-decoration: none;">jams-peter@outlook.com</a></div>
      <div class="meta"> <a href="mailto:mr.lemon@lemonworld.dpdns.org" target="_blank" style="color: inherit; text-decoration: none;">mr.lemon@lemonworld.dpdns.org</a></div>
      <div class="meta">
        <a href="https://github.com/jams-peter-cloud" target="_blank" style="color: inherit; text-decoration: none;">GitHub</a>
      </div>
      <nav class="side-nav">
        <a href="/">最新文章</a>
        <a href="/archives">归档</a>
        <a href="/tags">标签</a>
        <a href="/about">关于</a>
      </nav>
    </div>
  </aside>\n  <main class="content">${inner}</main>\n</div>\n<footer class="site-footer">© ${new Date().getFullYear()} 我的技术博客 · 基于 HTML/CSS 构建 · 保留所有权利</footer>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/python.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/cpp.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/javascript.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/ini.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/xml.min.js"></script>
<script>
  if (typeof marked !== 'undefined') {
    marked.use({ breaks: true, gfm: true });
  }
  if (typeof hljs !== 'undefined') {
    hljs.highlightAll();
  }
</script>
</body>\n</html>`; // 返回完整 HTML 文档
} // 结束 renderLayout 函数

// 渲染首页
function renderIndex(posts, env) { // 定义首页渲染函数
  const items = posts.map(p => `\n  <article class="post-card">\n    <div class="pc-body">\n      <h2 class="pc-title"><a href="/posts/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></h2>\n      <div class="pc-meta">${escapeHtml(p.date || "")}</div>\n      <p class="pc-desc">${escapeHtml(p.desc || '点击阅读全文')}</p>\n    </div>\n    <a class="pc-more" href="/posts/${encodeURIComponent(p.slug)}" aria-label="阅读全文">阅读全文</a>\n  </article>`).join("\n"); // 生成卡片式文章列表项
  const inner = `\n<section class="list">\n${items}\n</section>`; // 拼接首页主体
  const body = renderLayout("博客", inner, env); // 渲染首页 HTML
  console.log(`Rendered Index HTML: ${body}`); // 记录渲染后的首页 HTML
  return body; // 返回布局包裹的页面
} // 结束 renderIndex 函数

// 渲染文章页
async function renderPost(env, slug, contentHtml, title) { // 定义文章页渲染函数
  console.log("renderPost function started for slug:", slug); // 记录 renderPost 函数开始和 slug
  console.log("Attempting to load comments for slug:", slug); // 记录尝试加载评论
  const comments = await loadCommentsFromKV(env, slug); // 加载文章评论
  console.log("Comments loaded:", comments.length, "comments"); // 记录评论加载结果
  const commentsHtml = comments.map(c => { // 遍历评论列表
    const author = escapeHtml(c.author); // 转义作者名
    const content = escapeHtml(c.content); // 转义评论内容
    const timestamp = new Date(c.timestamp).toLocaleString(); // 格式化时间
    return '<div class="comment-item">' + // 评论项容器
           '<div class="comment-meta">' + // 评论元信息容器
           '<span class="comment-author">' + author + '</span>' + // 作者
           '<span class="comment-time">' + timestamp + '</span>' + // 时间
           '</div>' + // 结束评论元信息容器
           '<div class="comment-content">' + content + '</div>' + // 评论内容
           '</div>'; // 结束评论项容器
  }).join(''); // 生成评论列表 HTML
  console.log("commentsHtml generated, length:", commentsHtml.length); // 记录 commentsHtml 生成结果

  const inner = '<article class="post">' + contentHtml + '</article>' + // 文章主体
    '<section class="comments-section">' + // 评论区
    '<h2>评论</h2>' + // 评论标题
    '<div id="comments-list">' + commentsHtml + '</div>' + // 评论列表容器
    '<div class="comment-form">' + // 评论表单
    '<h3>发表评论</h3>' + // 表单标题
    '<label>昵称 <input id="comment-author" type="text" style="width:100%;padding:8px;margin:6px 0;"/></label>' + // 昵称输入框
    '<label>评论内容 <textarea id="comment-content" style="width:100%;height:100px;padding:8px;margin:6px 0;"></textarea></label>' + // 评论内容输入框
    '<button id="submit-comment" style="padding:10px 15px;background-color:#007bff;color:white;border:none;border-radius:5px;cursor:pointer;">提交评论</button>' + // 提交评论按钮
    '</div>' + // 结束评论表单
    '</section>'; // 结束评论区
  return renderLayout(title, inner, env); // 渲染布局，传入文章标题、内容和环境变量
} // 结束 renderPost 函数

// HTML 文本转义
function escapeHtml(s) { // 定义转义函数
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/`/g, "&#96;"); // 替换特殊字符，包括反引号
} // 结束 escapeHtml 函数

// 生成管理端编辑页面 HTML
async function renderAdminPage(token, posts, env, url) { // 定义编辑器页面渲染函数
  const editSlug = url.searchParams.get("slug"); // 从 URL 获取编辑文章的 slug
  let editPost = null; // 初始化编辑文章对象
  if (editSlug) { // 如果存在编辑 slug
    editPost = await loadPost(env, editSlug); // 从 KV 或静态资源加载文章
  }

  const postListHtml = posts.map(p => `
    <li>
      <span>${escapeHtml(p.title)} (${escapeHtml(p.slug)})</span>
      <a href="/admin?token=${token}&slug=${p.slug}">编辑</a>
      <button onclick="deletePost('${p.slug}', '${token}')">删除</button>
    </li>
  `).join('');

  const form = `\n<section class="card" style="padding:16px;">\n  <h2 style="margin:0 0 12px;">新建/编辑文章</h2>\n  <label>Title <input id="title" style="width:100%;padding:8px;margin:6px 0;" value="${editPost ? escapeHtml(editPost.title) : ''}"/></label>\n  <label>Slug <input id="slug" style="width:100%;padding:8px;margin:6px 0;" placeholder="my-post" value="${editPost ? escapeHtml(editPost.slug) : ''}" ${editPost ? 'readonly' : ''}/></label>\n  <label>Date <input id="date" style="width:100%;padding:8px;margin:6px 0;" placeholder="2026-02-20" value="${editPost ? escapeHtml(editPost.date) : ''}"/></label>\n  <label>Format <select id="format" style="width:100%;padding:8px;margin:6px 0;"><option value="md" ${editPost && editPost.format === 'md' ? 'selected' : ''}>Markdown</option><option value="wt" ${editPost && editPost.format === 'wt' ? 'selected' : ''}>Wikitext</option></select></label>\n  <label>Desc <input id="desc" style="width:100%;padding:8px;margin:6px 0;" placeholder="摘要可选" value="${editPost ? escapeHtml(editPost.desc) : ''}"/></label>\n  <textarea id="content" style="width:100%;height:260px;padding:8px;margin:6px 0;" placeholder="# 标题\n\n正文...">${editPost ? escapeHtml(editPost.content) : ''}</textarea>\n  <button id="save" style="padding:10px 14px;">保存</button>\n  <span id="msg" style="margin-left:8px;color:#9fb0c1;"></span>\n</section>\n<section class="card" style="padding:16px;margin-top:16px;">\n  <h2 style="margin:0 0 12px;">文章列表</h2>\n  <ul>${postListHtml}</ul>\n</section>\n<script>\n  const btn=document.getElementById('save'); // 选择保存按钮
  const token='${token.replace(/'/g, "&#39;")}'; // 内嵌令牌字符串
  const editSlug = '${editPost ? escapeHtml(editPost.slug) : ''}'; // 获取当前编辑的文章 slug
  btn.onclick=async()=>{ // 绑定点击事件
    const p={ // 收集表单字段
      title:document.getElementById('title').value.trim(), // 标题
      slug:document.getElementById('slug').value.trim(), // slug
      date:document.getElementById('date').value.trim(), // 日期
      format:document.getElementById('format').value, // 格式
      desc:document.getElementById('desc').value.trim(), // 描述
      content:document.getElementById('content').value // 正文
    }; // 结束对象

    let url = '/api/posts'; // 默认新建文章接口
    let method = 'POST'; // 默认新建文章方法

    if (editSlug) { // 如果是编辑文章
      url = '/api/posts/' + editSlug; // 编辑文章接口
      method = 'PUT'; // 编辑文章方法
    }

    const r=await fetch(url,{method:method,headers:{'content-type':'application/json','x-admin-token':token},body:JSON.stringify(p)}); // 调用保存接口
    const t=document.getElementById('msg'); // 获取消息节点
    if(r.ok){const j=await r.json(); t.textContent='已保存：/posts/'+j.slug; } else { t.textContent='保存失败 '+r.status; } // 显示结果
  }; // 结束事件

  async function deletePost(slug, token) {
    if (!confirm('确定要删除这篇文章吗？')) return;
    const r = await fetch('/api/posts/' + slug, { method: 'DELETE', headers: { 'x-admin-token': token } });
    if (r.ok) {
      alert('文章删除成功！');
      location.reload();
    } else {
      alert('文章删除失败！');
    }
  }
</script>`; // 结束内联脚本
  return renderLayout("编辑文章", form); // 使用通用布局返回页面
} // 结束 renderAdminPage 函数

// 规范化 slug
function sanitizeSlug(s) { // 定义 slug 规范化函数
  return String(s).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""); // 仅保留小写字母数字和短横
} // 结束 sanitizeSlug 函数

// 渲染归档页面
function renderArchives(posts) {
  const postsByYear = {};
  posts.forEach(p => {
    const year = (p.date || "").slice(0, 4);
    if (!postsByYear[year]) postsByYear[year] = [];
    postsByYear[year].push(p);
  });

  const years = Object.keys(postsByYear).sort((a, b) => b - a);
  
  let inner = '<div class="archives-page">';
  years.forEach(year => {
    inner += `<h2 style="margin-top: 30px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">${year}</h2>`;
    inner += '<ul style="list-style: none; padding: 0;">';
    postsByYear[year].forEach(p => {
      inner += `
        <li style="margin: 10px 0; display: flex; align-items: baseline;">
          <span style="color: #888; margin-right: 15px; font-family: monospace;">${(p.date || "").slice(5)}</span>
          <a href="/posts/${encodeURIComponent(p.slug)}" style="text-decoration: none; color: inherit; font-size: 1.1em; transition: color 0.2s;">${escapeHtml(p.title)}</a>
        </li>
      `;
    });
    inner += '</ul>';
  });
  inner += '</div>';
  return inner;
}

// 渲染标签页面
function renderTags(posts) {
  const postsByTag = {};
  posts.forEach(p => {
    const tags = p.tags || [];
    tags.forEach(tag => {
      if (!postsByTag[tag]) postsByTag[tag] = [];
      postsByTag[tag].push(p);
    });
  });

  const sortedTags = Object.keys(postsByTag).sort();
  
  let inner = '<div class="tags-page">';
  
  if (sortedTags.length === 0) {
    inner += '<p style="text-align:center;margin-top:40px;color:#888;">暂无标签</p>';
  } else {
    sortedTags.forEach(tag => {
      inner += `<h2 style="margin-top: 30px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">${escapeHtml(tag)} <small style="font-size:0.6em;color:#888;">(${postsByTag[tag].length})</small></h2>`;
      inner += '<ul style="list-style: none; padding: 0;">';
      postsByTag[tag].forEach(p => {
        inner += `
          <li style="margin: 10px 0; display: flex; align-items: baseline;">
            <span style="color: #888; margin-right: 15px; font-family: monospace;">${(p.date || "").slice(5)}</span>
            <a href="/posts/${encodeURIComponent(p.slug)}" style="text-decoration: none; color: inherit; font-size: 1.1em; transition: color 0.2s;">${escapeHtml(p.title)}</a>
          </li>
        `;
      });
      inner += '</ul>';
    });
  }
  
  inner += '</div>';
  return inner;
}

// 渲染关于页面
function renderAbout() {
  return `
    <div class="card" style="padding: 40px; text-align: center;">
      <h1>关于我</h1>
      <p style="margin-top: 20px; line-height: 1.8;">
        这里是柠檬先生的个人博客。<br>
        本站为本人全手搓制成，由 HTML、CSS、JavaScript 等前端技术构建，后端则使用 Cloudflare Workers 部署。
      </p>
      <div style="margin-top: 40px;">
        <h3>联系方式</h3>
        <p>Email: <a href="mailto:mr.lemon@lemonworld.dpdns.org" target="_blank" style="color: inherit; text-decoration: none;">mr.lemon@lemonworld.dpdns.org</a></p>
      </div>
    </div>
  `;
}

// 渲染分类页面（占位）
function renderCategory(posts, category) {
  return `
    <div style="padding: 20px;">
      <h2>${category}</h2>
      <p>分类功能建设中...</p>
      ${renderArchives(posts)}
    </div>
  `;
}

// 从 KV 读取文章
async function loadPostFromKV(env, slug) { // 定义从 KV 读取文章函数
  if (!env.POSTS) return null; // 若未绑定 KV 返回空
  // 优先尝试 posts/ 前缀（新路径）
  let raw = await env.POSTS.get(`posts/${slug}`); 
  if (!raw) {
    // 兼容旧的 post: 前缀
    raw = await env.POSTS.get(`post:${slug}`);
  }
  if (!raw) return null; // 若不存在返回空
  try { return JSON.parse(raw); } catch { return null; } // 解析 JSON 并返回
} // 结束 loadPostFromKV 函数

// 保存文章到 KV 并更新索引
async function savePostToKV(env, item) { // 定义保存文章函数
  // 统一存储在 posts/slug 路径下
  await env.POSTS.put(`posts/${item.slug}`, JSON.stringify(item)); 
  console.log(`Saved post: posts/${item.slug}`); // 记录保存的文章
  const idx = await getIndexFromKV(env); // 读取当前索引
  const map = new Map(idx.map(x => [x.slug, x])); // 构建映射
  map.set(item.slug, { slug: item.slug, title: item.title, date: item.date, desc: item.desc, tags: item.tags }); // 更新条目
  const arr = [...map.values()].sort((a, b) => String(b.date||"").localeCompare(String(a.date||""))); // 排序
  await env.POSTS.put('index', JSON.stringify(arr)); // 写回索引
  console.log(`Updated index: ${JSON.stringify(arr)}`); // 记录更新后的索引
} // 结束 savePostToKV 函数

// 从 KV 删除文章并更新索引
async function deletePostFromKV(env, slug) { // 定义从 KV 删除文章函数
  if (!env.POSTS) return; // 若未绑定 KV 则直接返回
  // 同时尝试删除新旧前缀
  await env.POSTS.delete(`posts/${slug}`);
  await env.POSTS.delete(`post:${slug}`);
  console.log(`Deleted post: ${slug}`); // 记录删除的文章
  const idx = await getIndexFromKV(env); // 读取当前索引
  const arr = idx.filter(x => x.slug !== slug); // 从索引中移除被删除的文章
  await env.POSTS.put('index', JSON.stringify(arr)); // 写回更新后的索引
  console.log(`Updated index after deletion: ${JSON.stringify(arr)}`); // 记录删除后更新的索引
} // 结束 deletePostFromKV 函数

// 保存评论到 KV
async function saveCommentToKV(env, comment) { // 定义保存评论函数
  if (!env.COMMENTS) return; // 若未绑定 KV 则直接返回
  const key = `comment:${comment.slug}:${comment.timestamp}`; // 构建评论的唯一键
  await env.COMMENTS.put(key, JSON.stringify(comment)); // 写入评论详情
  console.log(`Saved comment: ${key}`); // 记录保存的评论

  // 更新评论索引
  const indexKey = `comments_index:${comment.slug}`; // 构建评论索引的键
  const rawIndex = await env.COMMENTS.get(indexKey); // 读取当前评论索引
  let index = rawIndex ? JSON.parse(rawIndex) : []; // 解析索引或初始化为空数组
  index.push(key); // 将新评论的键添加到索引中
  await env.COMMENTS.put(indexKey, JSON.stringify(index)); // 写回更新后的评论索引
  console.log(`Updated comments index for ${comment.slug}: ${JSON.stringify(index)}`); // 记录更新后的评论索引
} // 结束 saveCommentToKV 函数

// 从 KV 加载评论
async function loadCommentsFromKV(env, slug) { // 定义从 KV 加载评论函数
  if (!env.COMMENTS) return []; // 若未绑定 KV 则返回空数组
  const indexKey = `comments_index:${slug}`; // 构建评论索引的键
  const rawIndex = await env.COMMENTS.get(indexKey); // 读取评论索引
  if (!rawIndex) return []; // 若无索引则返回空数组

  const index = JSON.parse(rawIndex); // 解析评论索引
  const comments = []; // 初始化评论数组
  for (const key of index) { // 遍历索引中的每个键
    const rawComment = await env.COMMENTS.get(key); // 读取评论详情
    if (rawComment) { // 如果评论存在
      try {
        comments.push(JSON.parse(rawComment)); // 解析并添加到评论数组
      } catch (e) {
        console.error(`Failed to parse comment ${key}: ${e}`); // 记录解析错误
      }
    }
  }
  // 按时间戳排序评论（最新在前）
  comments.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))); // 按时间戳倒序
  console.log(`Loaded comments for ${slug}: ${JSON.stringify(comments)}`); // 记录加载的评论
  return comments; // 返回评论数组
} // 结束 loadCommentsFromKV 函数

// 读取 KV 索引
async function getIndexFromKV(env) { // 定义读取索引函数
  if (!env.POSTS) return []; // 未绑定返回空
  const raw = await env.POSTS.get('index'); // 读取索引 JSON
  if (!raw) return []; // 不存在返回空
  try { return JSON.parse(raw); } catch { return []; } // 解析失败返回空
} // 结束 getIndexFromKV 函数

