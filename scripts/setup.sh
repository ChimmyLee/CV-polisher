#!/usr/bin/env bash
# CV Polisher 一键安装 / 测试 / 构建（Git Bash / macOS / Linux）
set -e

cd "$(dirname "$0")/.."

echo "== 清除本地代理环境变量 =="
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy

echo "== npm install =="
npm install --no-audit --no-fund

echo "== npm test =="
npm test

echo "== npm run build =="
npm run build

echo ""
echo "全部通过。运行 npm run dev 后打开 http://localhost:3000"
