# Field Studio 远程版（Cloudflare Workers + D1 + R2）

把 Studio 从「仅本地」搬到线上：任何设备（含手机）都能登录记录观察、写札记。
业务规则与本地版（`studio/`）完全一致；差异只在运行时适配。

## 架构

| 本地版 | 远程版 |
|---|---|
| Express 5 + better-sqlite3 | Hono + Cloudflare D1（SQLite） |
| 文件系统（data/studio.db） | D1 + R2（`salticid-studio-media` 桶） |
| sharp 生成派生图 | 浏览器端 canvas 生成（AVIF/WebP/JPG，多宽度），原图 + 派生图成对上传 |
| nodemailer（SMTP） | Resend API（可选；未配置时验证码输出到 `wrangler tail` 日志） |
| 导出直写 `src/data/studio-*.json` | 导出为 **zip 下载包**（JSON + 新增原图 + README） |

不变的部分：SFN/CSFN 编号规则、OTP 受邀制（无公开注册）、发布校验（日期+坐标+照片）、
修订与审计、坐标全量精确公开（Studio SOP §7）、GitHub 仍是唯一源码真源（规则 5）。

## 首次部署（只需一次 `wrangler login`）

```bash
cd studio-remote
npx wrangler login          # 浏览器授权你的 Cloudflare 账户
OWNER_EMAIL=你的邮箱 bash deploy.sh
```

脚本会自动：填 account_id → 创建 D1 `salticid-studio` → 应用迁移 → 创建 R2 桶
→ 生成会话密钥 → 绑定 `studio.salticidnotes.cn`（证书自动签发）→ 部署。

完成后访问 **https://studio.salticidnotes.cn/studio**，用 OWNER_EMAIL 邮箱收验证码登录。

## 可选配置

```bash
npx wrangler secret put RESEND_API_KEY   # 启用 OTP 邮件投递（resend.com 免费档 100 封/天；
                                         # 需在 Resend 验证 salticidnotes.cn 域名）
npx wrangler secret put MAIL_FROM        # 默认 Salticid Notes <no-reply@salticidnotes.cn>
```

邀请协作者（规则 11：无公开注册）：

```bash
npx wrangler d1 execute salticid-studio --remote \
  --command "INSERT INTO invitations (code, label, email) VALUES ('INV-2026-01', '李涛', 'taoli@example.com')"
```

## 之后的部署（规则 7：push 触发）

本地改动推送到 main 后，GitHub Actions（`.github/workflows/studio-deploy.yml`）自动部署。
首次需在 GitHub 仓库 Settings → Secrets and variables → Actions 配置：

- `CLOUDFLARE_API_TOKEN`（权限：Workers Scripts:Edit、D1:Edit、R2:Edit、Zone → Workers Routes:Edit、Account Settings:Read）
- `CLOUDFLARE_ACCOUNT_ID`

## 日常流（手机野外记录 → 自动上线）

1. 野外：手机打开 `https://studio.salticidnotes.cn/studio`，拍照记录、autosave、直接发布；
2. **点发布即完成**：发布动作会自动把已发布内容提交到 GitHub 仓库（`src/data/studio-*.json` +
   新增 `media/originals/`），push 自动触发公开站构建，约 1-2 分钟后上线。所有人（站长与受邀伙伴）相同；
3. 失败重试：工作台首页底部「同步到公开站」按钮可随时手动重试；
   「导出备份（zip）」保留作为手动备份通道。

自动同步需要 Worker secret `GITHUB_TOKEN`（对仓库有 Contents: Read/Write 权限的 token；
`wrangler secret put GITHUB_TOKEN`）。未配置时发布不受影响，仅不同步。

## 开发与测试

```bash
npx wrangler d1 migrations apply salticid-studio --local   # 本地模拟库
npx wrangler dev --port 4344                               # 本地 D1/R2 模拟运行
npx tsx scripts/e2e-remote.mts <wrangler日志路径>           # 场景 A/B/C/D/F + 安全探测
```

本地变量用 `.dev.vars`（已 gitignore，模板见 `.dev.vars.example`）。

## 已知限制（与本地版一致 + 远程特有）

- 发布上线已自动化（发布即自动提交仓库并触发构建）；导出 zip 保留为手动备份通道。
- 浏览器端派生图不含 AVIF 时（旧浏览器）自动只出 WebP/JPG，公开站构建时 process-media 仍会补齐全部格式。
- 删除媒体仅删 D1 行与本地预览，R2 原图永不删除（规则 20）；编号永不复用（规则 19）。
