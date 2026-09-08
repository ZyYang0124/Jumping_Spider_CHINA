#!/bin/bash
# Field Studio 远程版一键部署（Cloudflare Workers + D1 + R2）
# 前置：已运行 `npx wrangler login`（浏览器授权一次即可）
# 之后：推送 studio-remote/** 到 main 会由 GitHub Actions 自动部署（见 ../.github/workflows/studio-deploy.yml）
set -e
cd "$(dirname "$0")"

WRANGLER="npx wrangler"

# 0. 认证检查
if ! $WRANGLER whoami >/dev/null 2>&1; then
  echo "✗ 未登录 Cloudflare。请先运行: npx wrangler login"
  exit 1
fi
echo "✓ 已登录 Cloudflare"

# 1. account_id（首次运行自动填入）
if grep -q "PLACEHOLDER_ACCOUNT_ID" wrangler.jsonc; then
  ACC=$($WRANGLER whoami 2>/dev/null | grep -oE "[a-f0-9]{32}" | head -1)
  if [ -z "$ACC" ]; then echo "✗ 无法从 whoami 获取 account id"; exit 1; fi
  sed -i "s/PLACEHOLDER_ACCOUNT_ID/$ACC/" wrangler.jsonc
  echo "✓ account_id: $ACC"
fi

# 2. D1 数据库（首次运行自动创建并回填 id）
if grep -q "PLACEHOLDER_D1_ID" wrangler.jsonc; then
  $WRANGLER d1 create salticid-studio > /tmp/d1-create.log 2>&1 || true
  ID=$(grep -oE "database_id = [a-f0-9-]{36}" /tmp/d1-create.log | head -1 | awk '{print $3}')
  if [ -z "$ID" ]; then
    ID=$(grep -oE "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}" /tmp/d1-create.log | tail -1)
  fi
  if [ -z "$ID" ]; then
    echo "✗ D1 创建失败（可能已存在同名库，请到 CF 面板查看 database_id 手动填入 wrangler.jsonc）："
    cat /tmp/d1-create.log
    exit 1
  fi
  sed -i "s/PLACEHOLDER_D1_ID/$ID/" wrangler.jsonc
  echo "✓ D1 database_id: $ID"
fi

# 3. 应用迁移（远程库；schema 与种子均含在内）
$WRANGLER d1 migrations apply salticid-studio --remote

# 4. R2 存储桶
$WRANGLER r2 bucket create salticid-studio-media >/dev/null 2>&1 && echo "✓ R2 bucket 已创建" || echo "• R2 bucket 已存在（跳过）"

# 5. 会话密钥（一次性自动生成）
if ! $WRANGLER secret list 2>/dev/null | grep -q STUDIO_SESSION_SECRET; then
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" | $WRANGLER secret put STUDIO_SESSION_SECRET
  echo "✓ STUDIO_SESSION_SECRET 已生成"
else
  echo "• STUDIO_SESSION_SECRET 已存在（跳过）"
fi

# 6. OWNER_EMAIL（登录白名单 + 站长身份）。可先在环境变量里给，再运行本脚本。
if ! $WRANGLER secret list 2>/dev/null | grep -q "^OWNER_EMAIL"; then
  if [ -n "$OWNER_EMAIL" ]; then
    echo "$OWNER_EMAIL" | $WRANGLER secret put OWNER_EMAIL
    echo "✓ OWNER_EMAIL 已设置"
  else
    echo "⚠ 尚未设置 OWNER_EMAIL（受邀登录白名单 + 站长身份）。请运行:"
    echo "    OWNER_EMAIL=你的邮箱 bash deploy.sh   或   npx wrangler secret put OWNER_EMAIL"
  fi
else
  echo "• OWNER_EMAIL 已存在（跳过）"
fi

# 7. 部署
$WRANGLER deploy

echo ""
echo "完成。首次部署后："
echo "  • 绑定域名 studio.salticidnotes.cn（wrangler.jsonc routes 已声明，证书自动签发，约 1-2 分钟生效）"
echo "  • 可选：npx wrangler secret put RESEND_API_KEY 启用 OTP 邮件投递（未配置时验证码在 wrangler tail 日志）"
echo "  • 之后推送 studio-remote/** 到 main 即自动部署（需在 GitHub 仓库配置 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID secrets）"
