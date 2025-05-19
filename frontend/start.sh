#!/bin/bash
# 启动脚本，确保依赖项已安装，然后运行开发服务器
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
  if [ $? -ne 0 ]; then
    echo "Error: Failed to install dependencies. Check npm install output above for details."
    exit 1
  fi
  echo "Dependencies installed successfully."
fi
echo "Starting development server..."
npm run dev
if [ $? -ne 0 ]; then
  echo "Error: Failed to start development server. Check if vite is installed correctly."
  echo "Listing installed vite version for debugging:"
  npm ls vite
  exit 1
fi