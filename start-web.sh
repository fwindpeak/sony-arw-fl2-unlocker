#!/usr/bin/env bash
cd "$(dirname "$0")/web"
echo "⚡ [Sony ARW Web Unlocker] Starting Web Application..."
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run dev
