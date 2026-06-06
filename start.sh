#!/bin/bash

echo "=========================================="
echo "  城市更新居民签约系统 - 启动脚本"
echo "=========================================="

BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)/backend"
FRONTEND_DIR="$(cd "$(dirname "$0")" && pwd)/frontend"

echo ""
echo "📦 安装后端依赖..."
cd "$BACKEND_DIR"
if [ ! -d "node_modules" ]; then
  npm install
  echo "✅ 后端依赖安装完成"
else
  echo "✅ 后端依赖已存在"
fi

echo ""
echo "📦 安装前端依赖..."
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  npm install
  echo "✅ 前端依赖安装完成"
else
  echo "✅ 前端依赖已存在"
fi

echo ""
echo "🚀 启动后端服务 (端口 3001)..."
cd "$BACKEND_DIR"
node server.js &
BACKEND_PID=$!

sleep 3

if kill -0 $BACKEND_PID 2>/dev/null; then
  echo "✅ 后端服务启动成功"
else
  echo "❌ 后端服务启动失败"
  exit 1
fi

echo ""
echo "🚀 启动前端开发服务 (端口 3000)..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

sleep 3

echo ""
echo "=========================================="
echo "  ✅ 系统启动完成！"
echo "=========================================="
echo ""
echo "  前端地址: http://localhost:3000"
echo "  后端地址: http://localhost:3001"
echo ""
echo "  测试账号 (密码均为 123456):"
echo "    - resident1 (居民)"
echo "    - evaluator1 (评估人员)"
echo "    - handler1 (街道经办人)"
echo "    - legal1 (法务)"
echo ""
echo "  运行验收测试: node tests/acceptance.js"
echo ""
echo "  停止服务: kill $BACKEND_PID $FRONTEND_PID"
echo "=========================================="

wait
