#!/bin/bash
# 网络恢复后自动推送 main 与 gh-pages（对 github.com 连接抖动的重试循环）
REPO="https://github.com/ZyYang0124/Jumping_Spider_CHINA.git"
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
    exit 0
  fi
  echo "attempt $i failed, sleep 60s ($(date +%H:%M:%S))"
  sleep 60
done
echo "GAVE_UP after 40 attempts"
exit 1
