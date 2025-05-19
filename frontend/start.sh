#!/bin/sh
# 启动脚本，确保依赖项已安装，然后运行开发服务器
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi
echo "Starting development server..."
npm run dev