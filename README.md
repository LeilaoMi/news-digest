# 每日时事简报 · news-digest

<p align="center">
  <a href="https://news.leilaomi.cc.cd"><img src="https://img.shields.io/badge/线上访问-news.leilaomi.cc.cd-c0392b?style=flat-square" alt="线上访问" /></a>
  <a href="https://news.leilaomi.cc.cd/health"><img src="https://img.shields.io/badge/健康检查-health-2ecc71?style=flat-square" alt="健康检查" /></a>
  <a href="https://news.leilaomi.cc.cd/rss.xml"><img src="https://img.shields.io/badge/RSS-rss.xml-orange?style=flat-square" alt="RSS" /></a>
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT" />
</p>

<p align="center">
  <b>Cloudflare Workers 原生 · 零服务器 · 7源聚合 + 深度正文 + Workers AI 总结</b><br/>
  <span>每日 07:00 早报 · 19:00 晚报（北京时间）自动推送 · 已稳定运行 · 开箱即用</span>
</p>

---

## ✨ 线上预览

| 入口 | 地址 | 说明 |
|------|------|------|
| 🏠 归档首页 | https://news.leilaomi.cc.cd | 历史归档、搜索、追问、时间线、卡片 |
| 📰 最新一期 | https://news.leilaomi.cc.cd/d/2026-08-27 | Markdown 渲染 + 数据源明细 + 复制/追问 |
| 🖼 分享卡片 | https://news.leilaomi.cc.cd/card/2026-08-27.svg | 1200×630 SVG，真二维码扫码直达 |
| 📡 RSS | https://news.leilaomi.cc.cd/rss.xml | 20条 RSS 2.0，通用阅读器订阅 |
| 💚 健康 | https://news.leilaomi.cc.cd/health | 白盒监控：耗时/源状态/D1/R2 |

> 卡片右下角已为**本地生成真二维码**（非外链图片），微信/朋友圈缓存后仍可扫码。历史卡片（2026-08-26 前旧格式）已做段落回退，不再空白。

---

## 📌 这是什么

`news-digest` 是一个部署在 **Cloudflare Workers** 上的轻量信息简报：

- **搜**：并行抓取 **微博热搜（30条）** + **7个中文RSS**，失败自动跳过
- **读**：对 Top10 文章深度抓取正文并提纯，弥补 RSS 只有标题的不足
- **筛**：标题去重 + 民生关键词加权评分，自动过滤娱乐八卦
- **写**：调用 **Workers AI** 三级回退模型生成结构化 Markdown 简报
- **存**：写入 **KV（主）+ D1（检索）+ R2（永久归档）**
- **推**：通过 **Server酱** 推送到微信「服务通知」，同时提供 Web / RSS / API 多端访问

**定位：轻量**。当前 `v3` 已达轻量上限，现状态已够用，建议冻结功能，只做可用性运维。

---

## 🗂 功能清单（已上线 · 网页均可见）

### 网页

| 页面 | 路径 | 能力 |
|------|------|------|
| 归档首页 `/` | `https://news.leilaomi.cc.cd/` | 工具栏（RSS/JSON Feed/健康/统计/周报/API）、搜索框、追问框、近7天时间线、最新一期卡片、晚报徽标、每条归档附 JSON/卡片入口 |
| 详情页 `/d/:date` | `https://news.leilaomi.cc.cd/d/2026-08-27` | 早报/晚报标签、生成时间/耗时/微博&外媒&正文&评分统计、复制 Markdown、JSON、卡片、RSS、健康快捷入口、全文 Markdown 渲染、数据源明细（微博热搜 + 7源文章列表）、本期追问 |
| 分享卡 `/card/:date.svg` | `https://news.leilaomi.cc.cd/card/2026-08-27.svg` | 1200×630 SVG，标题 + 4条摘要 + 真二维码（本地 `qrcode-generator 1.4.4 MIT` 生成，`~5600B path`） |
| 健康页 `/health` | `https://news.leilaomi.cc.cd/health` | `latest/index_count/weekly_count/duration/feed_count/bodies/D1/R2/feeds/AI/端点` 白盒 |
| 周报页 `/weekly` | `https://news.leilaomi.cc.cd/weekly` | 聚合近7天，周一早报后自动生成（当前 `weekly_count:0` 待下周一触发） |

### 订阅与接口

| 类型 | 路径 | 说明 |
|------|------|------|
| RSS | `/rss.xml` | RSS 2.0，20条，可直接被 Flomo/Notion/邮件客户端订阅 |
| JSON Feed | `/feed.json` | JSON Feed 1.1 |
| 统计 | `/api/stats` | `index_count/latest/D1/R2` |
| 搜索 | `/api/search?q=西藏&limit=12` | KV 全文 + D1 `items LIKE`，含 snippet |
| 时间线 | `/api/timeline?days=7&q=&tag=` | 近 N 天一句话总结 |
| 追问 | `/ask?q=高兟案是什么&date=2026-08-27` / `POST /api/ask` | 基于当日简报 + 7源正文 RAG，不编造 |
| 最新 | `/api/latest` / `/api/d/:date` | 原始 JSON |
| AI代理 | `/ai/v1/chat/completions` `/ai/v1/models` | OpenAI 兼容，需 `AI_PROXY_KEY` |

---

## 🏗 架构与数据流

```
微博热搜 ─┐
          ├─→ 并行 fetch（7s超时）→ parseRss → 去重评分（dedupAndScore）→ 深度正文（fetchArticleBodies Top10）
7个RSS  ──┘                                              │
                                                         ├─→ buildPromptContext（热搜+标题+正文+排序TOP）
                                                         │         ↓
                                                         │    aiSummarize（deepseek-32b → qwq-32b → gpt-oss-20b，清理<think>）
                                                         │         ↓
                                                         ↓    Markdown 简报
                                               ┌─ KV digest:{date} / digest:latest / digest:index（120条，归档列表）
                                               ├─ D1 news-digest-db · digests + items（40条/d，用于搜索/追问）
                                               └─ R2 news-digest-archive · digests/{date}.json（永久）
                                                         │
                              Web/RSS/Feed/API/卡片/周报/健康 ←─────────┘
                                                         └─→ Server酱 → 微信服务通知
```

---

## 🧰 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 运行时 | Cloudflare Workers | `compatibility_date 2025-01-15`，`standard` 模式 |
| 存储 | KV `news-digest-kv` | 主存储：`digest:{date}` `digest:index` `digest:latest` |
| 检索 | D1 `news-digest-db` | 表 `digests(date,summary_md, ...)` `items(id,date,title,link,source,score,body)` |
| 归档 | R2 `news-digest-archive` | 永久归档 `digests/YYYY-MM-DD.json` |
| AI | Workers AI | `deepseek-r1-distill-qwen-32b`（主力，中文强）` → qwq-32b → gpt-oss-20b`，`temperature 0.32` `max_tokens 2800` |
| 推送 | Server酱 | `sctapi.ftqq.com`，标题 `📰 YYYY-MM-DD 时事简报·早报/晚报` |
| 二维码 | qrcode-generator 1.4.4 MIT | 内嵌 Worker，`renderQRToSvgPath` 生成 SVG `<path>`，不依赖外网 |
| 定时 | Cron `0 11,23 * * *` | UTC 11/23 = 北京时间 19:00/07:00，周一早报后追加周报 |

---

## 📁 目录结构

```
news-digest/
├── worker.js       # 单文件 Worker，3409行 / 113KB / gzip 29KB（含内嵌二维码库）
├── wrangler.toml   # 绑定与定时配置（KV/D1/R2/AI/cron）
├── package.json    # wrangler 3.80 脚本
├── README.md       # 本文件
└── LICENSE         # MIT
```

---

## 🚀 快速开始

### 前置要求

- Node.js ≥ 18
- `wrangler` ≥ 3.80：`npm i -g wrangler`
- Cloudflare 账号（免费版即可，已验证 7源 + AI 在免费额度内）
- Server酱 SendKey（用于微信推送，可选，不填则仅 Web 可用）

### 本地预览

```bash
git clone https://github.com/LeilaoMi/news-digest.git
cd news-digest
npm install
wrangler dev
# 打开 http://127.0.0.1:8787/  查看归档
# 调试定时任务
curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"
```

---

## ☁️ 部署到 Cloudflare（一步一说明）

### 1) 登录

```bash
wrangler login
# 浏览器授权后
wrangler whoami
```

### 2) 资源准备（已创建的 ID 可直接复用，无需重建）

```bash
# KV（主存储）
wrangler kv namespace create news-digest-kv
# → 得到 id: c875d451df2e40498c6c910736bdaaae 填入 wrangler.toml

# D1（检索）
wrangler d1 create news-digest-db
# → 得到 database_id: 603266f5-cf1f-45eb-9bd2-b6483967081c
wrangler d1 execute news-digest-db --file=./schema.sql
# schema.sql 内容：
# CREATE TABLE IF NOT EXISTS digests (date TEXT PRIMARY KEY, summary_md TEXT, generated_at TEXT, duration_ms INTEGER, weibo_count INTEGER, feed_count INTEGER);
# CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, date TEXT, title TEXT, link TEXT, source TEXT, pubTs INTEGER, score INTEGER, tag TEXT, body TEXT);
# CREATE INDEX IF NOT EXISTS idx_items_date ON items(date);
# CREATE INDEX IF NOT EXISTS idx_items_tag ON items(tag);

# R2（归档）
wrangler r2 bucket create news-digest-archive

# AI 无需创建，Workers AI 为账号级能力，免费额度 10000 Neurons/天，本项目单次约 180+170 左右
```

当前仓库的 `wrangler.toml` 已填好上述生产 ID，开箱即用：

```toml
name = "news-digest"
main = "worker.js"
compatibility_date = "2025-01-15"

[triggers]
crons = ["0 11,23 * * *"]

[ai]
binding = "AI"

[[kv_namespaces]]
binding = "KV"
id = "c875d451df2e40498c6c910736bdaaae"

[[d1_databases]]
binding = "DB"
database_name = "news-digest-db"
database_id = "603266f5-cf1f-45eb-9bd2-b6483967081c"

[[r2_buckets]]
binding = "ARCHIVE"
bucket_name = "news-digest-archive"

[vars]
PUBLIC_BASE_URL = "https://news.leilaomi.cc.cd"
```

### 3) 配置密钥（为什么需要）

| 名称 | 类型 | 是否必填 | 在哪里获取 | 为何需要 | 不填会怎样 |
|------|------|----------|------------|----------|------------|
| `TRIGGER_KEY` | Secret | ✅ 必填 | 自行生成，如 `openssl rand -hex 16` | 鉴权 `GET /trigger?key=`，防止任何人随意触发你的 AI 计费任务 | 任何人可刷触发，烧掉 Workers AI 额度 |
| `SERVERCHAN_SENDKEY` | Secret | 可选但推荐 | https://sct.ftqq.com/sendkey | 调用 `sctapi.ftqq.com/{key}.send` 推送到微信「服务通知」 | 不推送，仅 Web 可看，简报仍正常生成 |
| `AI_PROXY_KEY` | Secret | 可选 | 自行生成 | 鉴权 `/ai/v1/*` OpenAI 兼容代理，防止被白嫖 Workers AI | 不填则该代理直接返回 401，不影响简报生成 |
| `PUBLIC_BASE_URL` | Var/Secret | 推荐 | 你的域名，如 `https://news.leilaomi.cc.cd` | 生成简报内跳转链接、RSS `link`、卡片二维码指向 | 默认为 `https://news.leilaomi.cc.cd`，若换域名则链接/二维码指向错误 |

设置方式：

```bash
wrangler secret put TRIGGER_KEY        # 输入你生成的随机串
wrangler secret put SERVERCHAN_SENDKEY # 输入 SCT 开头的 SendKey
wrangler secret put AI_PROXY_KEY       # 可选
wrangler secret put PUBLIC_BASE_URL    # 也可在 wrangler.toml [vars] 中明文配置
```

> `KV/D1/R2/AI` 为 **绑定（binding）**，在 `wrangler.toml` 中声明后由 Cloudflare 自动注入 `env.KV/env.DB/env.ARCHIVE/env.AI`；`Secret/Var` 为 **环境变量**，通过 `wrangler secret put` 或 `[vars]` 注入 `env.*`。两者缺一，`runDigest` 会在 `saveToD1/archiveToR2` 处自动 `try/catch` 跳过，不会崩溃，但会失去检索/归档能力。

### 4) 部署与验证

```bash
wrangler deploy
# 输出：deployed to https://news-digest.<子域>.workers.dev
# 如已绑定自定义域 https://news.leilaomi.cc.cd，会自动生效

# 健康检查（白盒）
curl https://news.leilaomi.cc.cd/health | jq
# 预期：{"ok":true,"latest":"2026-08-27","index_count":100,"has_d1":true,"has_r2":true,"feeds":[...]}

# 手动触发（测试全链路，约 25-45s）
curl "https://news.leilaomi.cc.cd/trigger?key=YOUR_TRIGGER_KEY&edition=morning"
# 返回 202 triggered morning，后台开始：抓 RSS → 深度正文 → 去重评分 → AI 总结 → 写 KV/D1/R2 → Server酱推送
# 约半分钟后
curl https://news.leilaomi.cc.cd/d/2026-08-27 | head
curl https://news.leilaomi.cc.cd/card/2026-08-27.svg | head  # 应含 <path d="M10,10h5...">
```

### 5) 自定义域（可选）

Workers → `news-digest` → Settings → Triggers → Custom Domains → Add `news.yourdomain.com`，自动签发证书。改完同步改 `PUBLIC_BASE_URL`，否则卡片二维码仍指向旧域。

---

## 🔌 接口一览

| 方法 | 路径 | 鉴权 | 说明 | 示例 |
|------|------|------|------|------|
| GET | `/` | 无 | 归档首页（SSR） | `curl https://news.leilaomi.cc.cd/` |
| GET | `/d/:date` | 无 | 详情页，支持 `2026-08-27` 与 `2026-08-27-evening` | `curl https://news.leilaomi.cc.cd/d/2026-08-27` |
| GET | `/card/:date.svg` | 无 | 分享卡，本地二维码 | `curl https://news.leilaomi.cc.cd/card/2026-08-27.svg -o card.svg` |
| GET | `/rss.xml` `/feed.xml` | 无 | RSS 2.0 20条 |  |
| GET | `/feed.json` | 无 | JSON Feed 1.1 |  |
| GET | `/health` | 无 | 白盒 | `curl https://news.leilaomi.cc.cd/health` |
| GET | `/weekly` `/weekly/:id` | 无 | 周报 HTML，`_W` 后缀 | `curl https://news.leilaomi.cc.cd/weekly` |
| GET | `/api/latest` | 无 CORS | 最新一期原始 JSON |  |
| GET | `/api/d/:date` | 无 CORS | 指定日期 JSON |  |
| GET | `/api/search?q=&limit=` | 无 CORS | KV+ D1 联合检索 | `curl "https://news.leilaomi.cc.cd/api/search?q=西藏&limit=5"` |
| GET | `/api/timeline?days=&q=&tag=` | 无 CORS | 近 N 天时间线 |  |
| GET | `/api/stats` | 无 CORS | 统计 |  |
| GET | `/ask?q=&date=` | 无 | RAG 追问，基于当日正文 | `curl "https://news.leilaomi.cc.cd/ask?q=高兟案是什么"` |
| POST | `/api/ask` | 无 | 同上，`{"q":"...","date":"2026-08-27"}` |  |
| POST | `/ai/v1/chat/completions` | Bearer `AI_PROXY_KEY` | OpenAI 兼容代理 |  |
| GET | `/ai/v1/models` | Bearer `AI_PROXY_KEY` | 模型列表 |  |
| GET | `/trigger?key=&edition=` | `TRIGGER_KEY` | 手动触发，`edition=morning/evening` |  |

---

## 🖥 网页使用指南

- **首页**：顶部工具栏 `RSS/JSON Feed/健康/统计/周报/API`；两个输入框：`搜关键词` → 调 `/api/search`，`追问AI` → 调 `/ask`；`近7天` 看时间线；`最新` 卡片显示耗时/微博&外媒&正文计数；归档每条右侧 `JSON` `卡片` 快捷入口，晚报带蓝色徽标。
- **详情页**：标题下显示 `早报/晚报 · 生成时间 · 耗时 · 微博/外媒/正文/评分`；工具栏 `复制Markdown（一键）/JSON/卡片/RSS/健康`；正文为 Markdown 渲染；底部 `追问本期` 输入框基于本期 7源正文回答；数据源明细可展开查看微博热搜与 7源文章列表。
- **卡片**：`1200×630`，微信分享友好，右下角二维码为本地生成，扫码直达对应 `/d/:date`。

---

## ⏰ 定时与数据

| 项 | 当前值 | 说明 |
|---|---|---|
| Cron | `0 11,23 * * *` | 单条 Cron 规避免费版 5个限制，Worker 内按 `hour===11` 分流：UTC 23→07:00早报，UTC 11→19:00晚报 |
| 周报 | `runWeekly()` | 早报时若 `day===1`（周一）自动聚合近7天生成 `weekly:YYYY-MM-DD_W`，存 `KV weekly:index` 与 `R2 weekly/*.json`，当前 `weekly_count:0` 属正常（待下周一触发），可 `GET /weekly` 查看 |
| 归档 | `digest:index` 120条 | 超过自动截断，最新在前 |
| 去重 | `dedupAndScore` | 标题归一化去重 + 民生关键词加权（中国/经济/民生 +分，娱乐 -分）+ 12小时内 +0.8 |
| 正文 | `fetchArticleBodies(10)` | 按关键词与时效挑 Top10，并发 `fetch(link, timeout 6s)`，`extractArticleText` 提纯 `<article>/<main>` 内 `<p>`，每篇取 3500字，供 Prompt 参考 |
| 推送 | Server酱 | 标题 `📰 YYYY-MM-DD 时事简报·早报/晚报`，正文为 Markdown + 尾链 `查看完整简报/历史归档` + 统计 |

---

## ❓ 常见问题

**Q: 不填 `SERVERCHAN_SENDKEY` 会怎样？**
A: 简报仍正常生成与落库，只是 `pushServerChan` 会 `throw` 并被 `catch` 记录到 `console.log`，不影响主流程。你仍可在 Web/RSS 上查看。

**Q: 换了域名，卡片二维码还是旧域？**
A: 改 `PUBLIC_BASE_URL` 并重新部署。`showCard` 取 `env.PUBLIC_BASE_URL || "https://news.leilaomi.cc.cd"` 生成二维码指向，若仍缓存，访问 `.../card/2026-08-27.svg?v=2` 绕过 `max-age=3600`。

**Q: 为什么 `health` 里 `feeds` 某项 `error`？**
A: 7源有 `404/超时` 属正常（如财新/澎湃早期已下线，已在 v3 中移除），`fetchRss` 会 `catch` 单源失败，不影响其他 6源与整体简报。`health.feeds[].error` 即为单源失败原因。

**Q: 为什么历史卡片曾空白？**
A: 8-26 前旧格式为纯段落无 `-`/`1.` 子弹头，旧卡片提取逻辑只认子弹头导致 `lines=[]`。现已改为双级提取：子弹头 → 回退段落（过滤 `#`/`---`/`##`），历史卡片已修复。

**Q: 搜索/追问点不动？**
A: 曾因 Worker 模板字符串中 `replace(/\\n/g` 转义为真实换行导致 `Invalid regex` 使整个 `<script>` 失效，现已修复为 `replace(/\\\\n/g`。若仍不动，请 `Ctrl+F5` 硬刷新。

**Q: 免费额度够吗？**
A: 够。单次简报 `deepseek-32b 约180 + qwq-32b 170` Neurons，免费额度 `10000/天`，每日两报约 `400`，`D1/R2/KV` 免费额度也远超本项目 `88条/天`。Worker 大小 `111KB / gzip 29KB` 远低于 `1MB` 限制。

---

## 📄 许可

MIT © 2026 LeilaoMi · 本项目内嵌 `qrcode-generator 1.4.4 MIT`（© Kazuhiko Arase）

---

<p align="center">如觉得有用，欢迎 <a href="https://github.com/LeilaoMi/news-digest">Star ⭐</a> · 问题请提 <a href="https://github.com/LeilaoMi/news-digest/issues">Issues</a></p>
