# Salticid Notes · 跳蛛观察志

> 每一条记录，都始于一次相遇。

**Salticid Notes（跳蛛观察志）** 是一本由站长与受邀专业伙伴共同维护的数字自然史观察志，记录我们在野外与日常观察中遇见的跳蛛：活体摄影、行为、生境、野外笔记、标本信息、分类鉴定与长期鉴定修订历史。地理范围不限中国。

它不是任何地区的跳蛛完整名录，不是 GBIF / iNaturalist / World Spider Catalog 的替代品，更不是公众上传或鉴定平台。网站的边界由「我们实际观察过什么」决定。

**每条记录都始于一次观察，而不是一个物种条目。**

## 线上地址

- 正式域名（规划）：**https://salticidnotes.cn**（Cloudflare Pages + 自定义域）
- 当前历史地址：https://zyyang0124.github.io/Salticid_Notes/（GitHub Pages，Cloudflare 上线后降级为历史地址，保持可达）

## 技术栈

- **公开站**：Astro 5 纯静态 + 类型化 JSON 数据层 + 构建期隐私管线
- **Field Studio**：`studio/` 轻量私有后端（Express + TypeScript + better-sqlite3），邮箱 OTP 登录（受邀白名单）、观察投稿与直接发布、观察博文、媒体管线
- **规划**：Cloudflare（构建/部署/CDN/DNS）、Supabase（Auth + PostgreSQL）、Cloudflare R2（科学影像）

## 本地开发

```bash
npm install
npm run dev              # 公开站开发服务器
npm run studio:migrate   # Studio 数据库迁移（migration-first）
npm run studio           # Field Studio 后端（http://localhost:4322/studio）
npm run studio:export    # 将 Studio 已发布内容导出为静态站数据
npm run build            # 媒体管线 + 静态构建
npm run test:privacy     # 公开数据安全测试（坐标/未发布/私有媒体/EXIF）
```

## 环境变量

只提交 `.env.example`，真实凭据只进 `.env` 或 Cloudflare Secrets：

- `STUDIO_PORT` / `STUDIO_DB` / `STUDIO_SESSION_SECRET`
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`（OTP 邮件；未配置时验证码输出到服务器控制台）
- `OWNER_EMAIL`（站长邮箱，自动授予 owner 角色）

## 部署链路

```text
本地开发 → git push → GitHub（源码唯一真源）
        → Cloudflare Git Integration 自动构建
        → Preview（feature 分支）/ Production（main）
        → salticidnotes.cn
```

当前过渡期仍以 GitHub Pages（`gh-pages` 分支）承载公开站；Cloudflare 接入后 Pages 降级为历史地址，保持可达。

## 隐私与数据

- 地点四级公开：精确公开 / 模糊公开 / 仅公开地点名称 / 隐藏地点；脱敏在数据层完成，公开产物从源头不携带未脱敏坐标；
- 公开派生图一律剥离 EXIF（含 GPS）；原图不可变，存于私有 storage；
- 观察与影像使用稳定永久编号（`SFN-*`；历史 `CSFN-*` 长期共存，永不改写）；
- 定期导出 CSV/JSON 备份——网站永远不是野外数据的唯一副本。

## 目录结构

```text
src/data/     类型化 JSON 源表（含私有字段，绝不直接公开）
src/lib/      store（装载+校验）· privacy（公开 DTO）· queries · format
src/pages/    公开页面
studio/       Field Studio 私有后端（migrations/src/scripts）
scripts/      媒体派生 · 隐私测试 · 部署辅助
docs/         审计与迁移文档
```

## 路线图

见 `SOP-SalticidNotes-20260908.md` 与 `docs/migration-audit-20260908.md`：Cloudflare 接入 → salticidnotes.cn → 正式 SMTP → R2 → 生产加固。
