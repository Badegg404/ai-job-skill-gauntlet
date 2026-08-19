#!/bin/bash
# ============================================================
# AI 岗位能力试炼 · AI Job Skill Gauntlet - 一键启动脚本
# 功能：启动本地服务器（若未运行）+ 打开考核中心浏览器
# 用法：双击桌面「启动AI 岗位能力试炼 · AI Job Skill Gauntlet.command」即可
# ============================================================

# 项目根目录（脚本所在目录的上级）
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$PROJECT_DIR/web"
PORT="${1:-8765}"
URL="http://127.0.0.1:${PORT}/exam.html"

echo ""
echo "=============================================="
echo "  🎯 AI 岗位能力试炼 · AI Job Skill Gauntlet · 一键启动"
echo "=============================================="
echo ""

# 1. 检查 Python 是否可用
if ! command -v python3 &>/dev/null; then
    echo "❌ 未找到 python3，请先安装 Python 3"
    read -p "按回车键关闭..." _
    exit 1
fi

# 2. 检查服务器是否已在运行（端口占用则复用）
if lsof -i :"${PORT}" -sTCP:LISTEN &>/dev/null; then
    echo "✅ 服务器已在运行（端口 ${PORT}），直接打开考核中心…"
else
    echo "⏳ 正在启动服务器（端口 ${PORT}）…"
    # 用 nohup 后台启动，日志写到项目目录
    cd "$PROJECT_DIR" || exit 1
    nohup python3 -u server.py "${PORT}" > "${PROJECT_DIR}/server.log" 2>&1 &
    # 等待端口就绪（最多 8 秒）
    for i in $(seq 1 16); do
        if lsof -i :"${PORT}" -sTCP:LISTEN &>/dev/null; then
            break
        fi
        sleep 0.5
    done
    if ! lsof -i :"${PORT}" -sTCP:LISTEN &>/dev/null; then
        echo "❌ 服务器启动失败，请查看 ${PROJECT_DIR}/server.log"
        read -p "按回车键关闭..." _
        exit 1
    fi
    echo "✅ 服务器已启动"
fi

# 3. 打开浏览器（macOS 用 open，兼容 Safari / 默认浏览器）
echo "🌐 正在打开考核中心：${URL}"
open "${URL}"

echo ""
echo "✅ 启动完成！浏览器已打开 AI 岗位能力试炼 · AI Job Skill Gauntlet。"
echo "   📄 考核中心: ${URL}"
echo "   💾 停止服务: 终端执行 pkill -f server.py"
echo ""
echo "提示：关闭本窗口不影响服务器运行。"
echo ""
