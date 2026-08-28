# 每日时事简报 · news-digest

> Cloudflare Workers 轻量版 | 现状已够用，冻结功能，只做运维

每日 07:00 早报 · 19:00 晚报（北京时间）自动推送。数据源：微博热搜 + BBC中文 / DW中文 / NYT中文 / FT中文 / RFA中文 / RFI中文 / Solidot（7源）→ 深度正文抓取 → 去重评分 → Workers AI 三级回退总结 → KV/D1/R2 存储 → 多渠道分发。

**线上地址**：https://news.leilaomi.cc.cd  ·  **健康检查**：https://news.leilaomi.cc.cd/health

## 现状（v3 封版）

- **搜**：7源 RSS 并行 7s 超时 + 微博热搜，去重评分，按民生关键词加权
- **AI**：`deepseek-r1-distill-qwen-32b` → `qwq-32b` → `gpt-oss-20b` 三级回退，自动清理 `<think>`，`temperature 0.32`
- **存**：KV（主）+ D1 `news-digest-db`（items/digests）+ R2 `news-digest-archive`（永久归档）
- **触发**：`0 11,23 * * *`（UTC 11/23 = 北京时间 19:00/07:00），周一早报后追加周报

## 功能（已上线，网页可见）

| 页面 | 路径 | 说明 |
|------|------|------|
| 归档 | `/` | 工具栏 RSS/JSON Feed/健康/统计/周报，搜索、追问、近7天、最新卡片、晚报徽标 |
| 详情 | `/d/2026-08-27` | 早/晚报标签，复制Markdown，JSON，卡片，数据源明细，追问本期 |
| 卡片 | `/card/2026-08-27.svg` | 1200×630 SVG，本地生成真二维码（扫码直达详情页），历史卡片已修复 |
| RSS | `/rss.xml` | 20条 RSS 2.0 |
| Feed | `/feed.json` | JSON Feed 1.1 |
| 健康 | `/health` | 白盒：feeds/AI/D1/R2/耗时 |
| 周报 | `/weekly` | 聚合近7天，周一自动生成（目前 weekly_count:0 待触发） |

## API

```
GET /api/latest
GET /api/d/2026-08-27
GET /api/search?q=西藏&limit=12   # KV + D1 LIKE
GET /api/timeline?days=7&q=&tag=
GET /api/stats
GET /ask?q=高兟案是什么&date=2026-08-27   # RAG 追问
POST /api/ask {"q":"...","date":"2026-08-27"}
GET /card/2026-08-27.svg
GET /ai/v1/models  /ai/v1/chat/completions  # OpenAI 兼容代理，需 AI_PROXY_KEY
```

## 部署

```bash
npm i -g wrangler
wrangler login
# 创建资源（已创建，可跳过）
# wrangler kv namespace create news-digest-kv
# wrangler d1 create news-digest-db
# wrangler r2 bucket create news-digest-archive
wrangler secret put TRIGGER_KEY
wrangler secret put SERVERCHAN_SENDKEY
wrangler secret put AI_PROXY_KEY
wrangler secret put PUBLIC_BASE_URL # https://news.leilaomi.cc.cd
wrangler deploy
# 手动触发
curl "https://news.leilaomi.cc.cd/trigger?key=YOUR_TRIGGER_KEY&edition=morning"
```

## 配置

`wrangler.toml` 已绑定：

```toml
name = "news-digest"
main = "worker.js"
compatibility_date = "2025-01-15"
[triggers]
crons = ["0 11,23 * * *"]
[ai] binding = "AI"
[[kv_namespaces]] binding = "KV" id = "c875..."
[[d1_databases]] binding = "DB" database_id = "603266..."
[[r2_buckets]] binding = "ARCHIVE" bucket_name = "news-digest-archive"
```

## 卡片说明

`扫码查看完整版` 右下角为本地生成二维码（`qrcode-generator 1.4.4 MIT` 内嵌，`~5600B path`），非占位，不依赖外部API，微信缓存后仍可扫。历史卡片（2026-08-26前旧格式）已做段落回退，不再空白。

## 运维

- 免费版 Cron 限 5 个/账号，已合并为单条 `0 11,23 * * *`，Worker 内按 `hour===11` 分流早晚报
- Worker 大小 111KB / gzip 29KB，`qrcode` 内嵌 +3KB，可长期免费
- 搜索/追问前端曾因模板字符串中 `replace(/\\n/g` 转义为真实换行导致 `Invalid regex`，已修复为 `replace(/\\\\n/g`

## 轻量定位

当前已达轻量上限，后续建议冻结功能，只做源可用性与 Prompt 微调。更多拓展思路见 Issues（邮件订阅 / FTS5 / 播客 TTS / 话题聚合 / PWA 等）

---

Generated from Cloudflare Worker `news-digest` at `2026-08-27T02:49:26Z` · tag `ba964304ffad42eeb256b9c807469f0f` · 3409 lines
