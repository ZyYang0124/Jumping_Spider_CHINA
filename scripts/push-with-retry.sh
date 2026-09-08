#!/bin/bash
# 网络恢复后自动推送 main 与 gh-pages（对 github.com 连接抖动的重试循环）
REPO="https://github.com/ZyYang0124/Salticid_Notes.git"
MAIN_DIR="C:/Research/01_Active_Projects/Jumping_Spider_CHINA"
GHP_DIR="/tmp/csfn-ghp"

for i in $(seq 1 40); do
  ok=1
  if ! (cd "$MAIN_DIR" && git -c http.version=HTTP/1.1 push -q origin main 2>/dev/null); then
    ok=0
  fi
  if ! (cd "$GHP_DIR" && git -c http.version=HTTP/1.1 push -q -f origin gh-pages 2>/dev/null); then
    ok=0
  fi
  if [ "$ok" = "1" ]; then
    echo "BOTH_PUSHED attempt=$i $(date +%H:%M:%S)"
    # 等待 Cloudflare 构建并轮询线上新数据
    sleep 150
    for t in 1 2 3 4 5 6 7 8 9 10; do
      body=$(curl -s --max-time 15 --resolve salticidnotes.cn:443:104.21.19.206 "https://salticidnotes.cn/observations/" 2>/dev/null)
      if printf '%s' "$body" | grep -q "SFN-2026-000001"; then
        echo "LIVE_UPDATED poll=$t"
        exit 0
      fi
      echo "poll $t: 线上未见 SFN，等待 60s"
      sleep 60
    done
    echo "LIVE_NOT_UPDATED_YET（构建可能仍在进行，稍后手动复测）"
    exit 0
  fi
  echo "attempt $i failed, sleep 60s ($(date +%H:%M:%S))"
  sleep 60
done
echo "GAVE_UP after 40 attempts"
exit 1
