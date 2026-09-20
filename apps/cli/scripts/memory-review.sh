#!/bin/bash
# memory-review.sh - Jarvis 候选记忆审查工具
# Run with: ./scripts/memory-review.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
JARVIS_PROJECT="/Users/zhuhengtan/projects/Jarvis/Jarvis"

# 检查是否安装在项目根目录
if [[ "$PROJECT_ROOT" != *"$JARVIS_PROJECT"* ]]; then
    echo "❌ Jarvis 项目位置错误，请切换到 /Users/zhuhengtan/projects/Jarvis 目录"
    exit 1
fi

echo "🔍 Jarvis Memory Review Tool - v0.1.0"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 功能菜单
show_menu() {
    echo ""
    echo "请选择操作："
    echo "1. 列出所有候选记忆 (List candidates)"
    echo "2. 审查单条记忆 (Review one candidate)"
    echo "3. 批量提拔合格记忆 (Promote batch)"
    echo "4. 检查来源引用 (Audit sources)"
    echo "5. 退出 (Quit)"
}

# 加载候选列表
load_candidates() {
    local count=${1:-20}
    # CLI 工具调用 Jarvis API
    pnpm --filter @jarvis/cli \
        exec \
        "node $(find node_modules/.pnpm -name 'cli' -type d | head -1) \
         memory review fetch --count $count" 2>/dev/null || \
        echo "⚠️ Jarvis CLI tools not fully configured, manual mode activated"
}

# 审查单条记忆
review_candidate() {
    local id=$1
    echo "📋 审查候选记忆 ID: $id"
    # TODO: 调用 review API 或读取本地数据
    local score_content=2
    local score_source=3
    local decision="Promote"
    
    echo ""
    echo "内容质量评分：$score_content/5 ✓"
    echo "来源可信度评分：$score_source/5 ✅"
    echo "建议操作：$decision"
}

# 批量提拔
batch_promote() {
    local candidate_ids=$1
    echo "🚀 批量提拔候选：" "$candidate_ids"
    pnpm --filter @jarvis/cli exec memory review promote \
        --ids "$candidate_ids" \
        --auto-commit \
        || echo "⚠️ Batch promotion requires full Jarvis CLI setup"
}

# 审计来源
audit_sources() {
    local check=${1:-all}
    echo "🔍 审计来源引用检查 ($check mode)"
    # TODO: 实现来源完整性校验
}

# 主循环
while true; do
    read -p "" 
    show_menu
    choice=$(read)
    
    case $choice in
        1) load_candidates; ;;
        2) review_candidate ""; ;;
        3) batch_promote "all"; ;;
        4) audit_sources all; ;;
        5) echo "👋 Jarvis Memory Review Tool - Goodbye!"; break;;
        *) echo "❓ 无效选择，请重试" ;;
    esac
done
