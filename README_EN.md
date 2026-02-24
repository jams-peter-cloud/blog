# 🚀 Minimalist Blog Setup Tutorial with Cloudflare Workers

This is a lightweight blog system built on **Cloudflare Workers + KV + Static Assets Binding**. It features high performance, zero-cost hosting, and a powerful online IDE management backend.

---

## **1. Tech Stack**
- **Backend**: Cloudflare Workers (JavaScript / Module Worker)
- **Storage**: 
  - **ASSETS**: Stores static files like CSS, icons, and initial posts.
  - **KV (Key-Value)**: Stores dynamic posts, user comments, and image indexes.
- **Frontend**: Native HTML/CSS + Marked.js (Markdown parsing) + Highlight.js (Syntax highlighting).

---

## **2. Prerequisites**

1. **Install Node.js**: Ensure Node.js is installed on your system.
2. **Install Wrangler CLI**: 
   ```bash
   npm install -g wrangler
   ```
3. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

---

## **3. Quick Start**

### **Step A: Initialize Project**
```bash
git clone https://github.com/jams-peter-cloud/blog.git
cd blog
npm install
```

### **Step B: Configure `wrangler.toml`**
Create three KV namespaces in your Cloudflare dashboard and fill in their IDs in `wrangler.toml`:

```toml
name = "blog"
main = "src/worker.js"
compatibility_date = "2024-02-24"

# Static Assets Binding
assets = { directory = "./public", binding = "ASSETS" }

# KV Namespace Bindings
[[kv_namespaces]]
binding = "POSTS"
id = "YOUR_POSTS_KV_ID"

[[kv_namespaces]]
binding = "COMMENTS"
id = "YOUR_COMMENTS_KV_ID"

[[kv_namespaces]]
binding = "IMAGES"
id = "YOUR_IMAGES_KV_ID"

[vars]
ADMIN_TOKEN = "123456" # Token used to access the IDE backend
```

---

## **4. Core Features**

### **✨ Online IDE Backend**
Access at: `https://your-domain.com/ide/build?token=YOUR_TOKEN`
- **Live Preview**: Edit Markdown on the left and see results instantly on the right.
- **Sync Scroll**: The editor and preview panes scroll together based on percentage.
- **File Upload**: Drag and drop `.md` or image files to publish them directly.

### **✨ Custom Syntax Support**
Supports `'''` syntax to wrap raw code or text, preventing Markdown parsing interference:
```text
'''python
print("This code will remain raw and highlighted")
'''
```

### **✨ Smart Post Loading**
The system loads posts from both `public/posts/` (static) and `KV` (dynamic), merging and de-duplicating them automatically. KV modifications have higher priority.

---

## **5. Deployment Commands**

### **Local Development**
```bash
wrangler dev
```

### **Deploy to Production**
```bash
wrangler deploy
```

---

## **6. Troubleshooting**

- **Posts Not Appearing**: Check if `public/posts.json` is correctly formatted or if KV bindings are successful.
- **IDE Unauthorized**: Ensure the `token` in the URL matches the `ADMIN_TOKEN` in `wrangler.toml`.
- **No Syntax Highlighting**: Check if the `cdnjs` links for `highlight.js` in `worker.js` are loading correctly.

---
© 2026 High-speed blog system powered by Cloudflare Workers.
