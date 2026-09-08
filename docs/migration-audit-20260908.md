# Salticid Notes 迁移审计（SOP §0/§152/§178）

日期：2026-09-08 · 审计对象：Jumping_Spider_CHINA（已重命名 Salticid_Notes）

## 十二个审计问题的回答（SOP §178）

1. **当前 Astro 架构**：Astro 5 纯静态站（`src/pages` 15 类路由，81 页）+ 类型化 JSON 数据层（`src/data`）+ 构建期隐私管线（`src/lib/privacy.ts`）+ 查询层（`src/lib/queries.ts`）。另有 `studio/` 私有后端（Express 5 + TypeScript + better-sqlite3，迁移文件管理 schema）承载投稿/博文/媒体管线。
2. **GitHub Pages 部署**：`main`（源码）+ `gh-pages`（dist 产物，分支根，含 `.nojekyll`）两分支；`.nojekyll` 必须（否则 `_astro/` 被 Jekyll 忽略）。Cloudflare 迁移后 Pages 降级为历史地址，保持可达（SOP §146/§147）。
3. **需删除的 China-only 假设**：`LocationRecord` 的 `state_province/county` 与固定 `country='中国'`；places/species 按省聚合；搜索索引 meta；studio 表单「省份」必填；export 字段映射；`locationLine()` 拼接。共约 120 处引用（含演示数据）。
4. **CSFN ID 是否已永久化**：是——已上线（线上页面、git 历史、两条已发布的 studio 导出演示记录 `CSFN-2026-000001/000004` 与 `CSFN-M-000001…000039`）。按 §33 保留 **CSFN-* 与 SFN-\* 长期共存**，不迁移；新记录一律 `SFN-YYYY-NNNNNN` / `SFN-M-NNNNNN`。
5. **Contributor / Review workflow 代码**：`studio/src/server.ts` 的 `TRANSITIONS` 状态机（draft→submitted→review→revision_requested/approved→published→archived）+ 审核路由 + 表单「提交审核」。无正式历史数据依赖（仅演示数据）→ 按 §144 直接迁移为 `draft/published/private/archived`，删除审核 UI。
6. **认证可否迁移邮箱 OTP**：可以。现有 dev 登录（用户名+邀请码）与微信 OAuth（凭据从未配置）都将移除（SOP §18 禁微信/密码）。改为：Owner 邀请邮箱 → 6 位 OTP（SMTP adapter；未配置 SMTP 时开发模式输出到服务器控制台）→ 受邀白名单外邮箱无权进入。
7. **上传如何工作**：multer 内存缓冲 → 校验（MIME/30MB）→ 原图原样存 `studio/storage/originals/`（gitignored）→ sharp 派生 thumb/medium/large 并剥离全部 EXIF 至 `public/media/derivatives/` → 分配媒体编号。R2 迁移时仅替换 storage adapter（SOP §61）。
8. **exact GPS 进入 public build 的可能**：仅当 `location_visibility='exact'`（作者明确勾选）经 `privacy.ts` 白名单路径输出；`test:privacy` 扫描一切非 exact 记录的坐标字符串，当前 0 泄露。
9. **EXIF GPS 泄露可能**：公开派生图全部重编码剥离 EXIF（测试断言 `metadata.exif === undefined`，108 张全过）；原图只存私有 storage。
10. **Pages 还是 Workers**：**Pages 改动最小**——纯静态 Astro + 外部服务（studio 后端暂本地），与现有架构零冲突；待上传接口云化（R2 直传/签名）再评估 Workers + Static Assets。
11. **salticidnotes.cn 绑定**：Cloudflare Pages 项目 → Custom Domain `salticidnotes.cn`（及 www）→ DNS 由 Cloudflare 托管。需要站长提供 Cloudflare 账号并完成域名接入，代码侧只需把 `site`/canonical 指向该域名（本轮已预留）。
12. **必须保持兼容的 URL**：`/observations/CSFN-2026-00000N`、`/media/CSFN-M-0000NN`、`/species/<slug>`、`/trips/<slug>`、`/places`、`/posts/<slug>`；旧 GitHub Pages 地址 `zyyang0124.github.io/Salticid_Notes/` 保持可达。

## 风险与保留项

**风险**：仓库含两处 GitHub Pages 时代 base（已改 `/Salticid_Notes/`）——Cloudflare 上线后改为自定义域根路径，届时 base 需再调（预留）；演示数据含 China 字段（随模型迁移一并处理）。
**保留**：Observation First、隐私管线、稳定 ID、三宽度视觉系统、媒体档案层、Astro、现有全部公开 URL。

## Breaking changes（本轮）

- 状态机：submitted/review/approved/rejected/revision_requested → draft/published/private/archived（含 studio UI 与 DB migration）
- LocationRecord 字段：state_province/county → country_code/country_name/admin1/admin2/site_name（含静态演示数据、页面聚合、搜索、studio 表单与 DB migration）
- 认证：邀请码/微信 → 邮箱 OTP（开发模式：验证码输出到服务器控制台）
- 新编号：SFN-YYYY-NNNNNN / SFN-M-NNNNNN（与 CSFN-* 共存）

## 分阶段执行计划（SOP §151 顺序，小步可回滚）

| 阶段 | 内容 | 本轮 |
|---|---|---|
| 01 | 品牌迁移（site.config/Base/hero/footer/about/studio/README/AGENTS §140） | ✅ |
| 02 | 中文单语统一（复查遗留英文 UI；Field Studio/Salticid Notes/学名保留） | ✅ |
| 03 | 全球地理模型（types/数据/页面聚合/搜索/studio 迁移+表单/export；验收 §163） | ✅ |
| — | 伙伴直接发布 + SFN 编号 + 状态机迁移（§26/§33/§144） | ✅ |
| — | 邮箱 OTP（开发模式控制台投递 + SMTP adapter 预留；§18–§20） | ✅ |
| 04–05 | Cloudflare Pages 连接 + salticidnotes.cn 绑定 | ⏳ 需站长 Cloudflare 账号/域名 |
| 06 生产化 | 正式 SMTP、R2 adapter、Media URL 域名 | ⏳ 需站长凭据 |
