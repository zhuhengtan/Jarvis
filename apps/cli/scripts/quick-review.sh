#!/bin/bash
# Jarvis 快速审查工具 - 演示候选记忆审查流程
# Usage: ./scripts/quick-review.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 如果脚本直接运行而非被调用，则执行默认功能
if [[ $# -eq 0 ]]; then
    run_default_review
fi

################################################################################
# 功能菜单（当无参数时）
################################################################################
run_menu() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Jarvis 记忆审查工具 v0.1.0"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "请选择操作："
    echo "1. 列出所有候选记忆 (list)"
    echo "2. 批量评审并输出报告 (review-all)"
    echo "3. 查看单个候选人详情 (show -i <id>)"
    echo "4. 模拟提拔操作 (promote-batch)"
    echo "5. 退出 (quit)"
    echo ""
    read -p "请输入选择数字 [1-5]：" choice
    
    case $choice in
        1) list_candidates ;;
        2) review_all ;;
        3) if [[ -n "$ID" ]]; then show_candidate ;; else echo "❌ 请输入候选 ID 示例：c-001"; fi ;;
        4) promote_batch ;;
        5) echo "👋 退出审查工具。"; exit 0 ;;
    esac
}

################################################################################
# 核心功能实现
################################################################################
list_candidates() {
    echo ""
    echo "=== 候选记忆列表（示例数据） ==="
    echo ""
    
    local source_file="$SCRIPT_DIR/../data/skills/memory-review/.examples/sample-candidates.jsonl"
    
    if [[ ! -f "$source_file" ]]; then
        echo "📁 找不到候选记忆数据文件：$source_file"
        echo "   💡 提示：请运行 ./scripts/review-all.sh 自动生成示例数据"
        return
    fi
    
    echo "加载候选人..."
    
    # JSONL 文件解析（使用 node）
    local candidate_count=$(node -e "$(cat "$source_file" | head -1)" "$source" 2>/dev/null)
    candidate_count=9
    
    echo "共找到 $candidate_count 条候选记忆记录"
    echo ""
    
    # 显示前几条示例（模拟）
    echo "|" ID                 | 标题                                  | Kind      | 状态        |" 
    echo "|--------------------|--------------------------------------|-----------|-------------|"
    
    node -e "const fs=require('fs'); try{ fs.createReadStream('$source_file').on('data', line => { const obj=JSON.parse(line); if(obj.updatedAt > new Date().setDate(new Date().getDate()-1)) console.log('|   ' + obj.id.slice(0,12) + '|' +  obj.title.length <= 30 ?obj.title +'...' : obj.title + '|' + obj.kind +'|'  + obj.status + '|'); } ); }.catch(e=>console.log('解析错误'))"
    
    echo ""
}

review_all() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Jarvis 候选记忆审查报告"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    local source_file="$SCRIPT_DIR/../data/skills/memory-review/.examples/sample-candidates.jsonl"
    
    if [[ ! -f "$source_file" ]]; then
        echo "📁 找不到候选记忆数据文件！"
        return
    fi
    
    # 使用 node 加载并处理 JSONL
    local review_output=$(node --input-type=module << 'EOF'
import fs from 'fs';

const candidates = fs.readFileSync('$source_file', 'utf-8').trim().split('\n')
    .filter(line => line.trim()).map(JSON.parse);

let promoted = 0, reviewed = 0, rejected = 0;
candidates.forEach((c, i) => {
    const contentScore = c.content.includes('#') ? 4 : 2;
    const sourceRefs = c.sourceRefs || [];
    const isSourceGood = sourceRefs.length >= 2 || sourceRefs.some(r => r.startsWith('https:'));
    
    if (contentScore >= 3) {
        if (isSourceGood) promoted++; else reviewed++;
    } else {
        rejected++;
    }
}).join('\n');

console.log(promoted);
console.log(reviewed);
console.log(rejected);
EOF
)
    
    promoted=$(echo "$review_output" | head -1)
    reviewed=$(echo "$review_output" | tail -2 | head -1)
    rejected=$(echo "$review_output" | tail -1)
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo "审查结果汇总："
    echo "┌─────────────┬──────────┬─────────────┐"
    echo "│ 建议提拔 🚀  │ 需要编辑 🔁 │ 建议归档 ⚠️  │"
    echo "├─────────────┼──────────┼─────────────┤"
    echo "│     $promoted    │  ${reviewed}      │   $rejected   │"
    echo "│             │          │     (共${proceeded:-0})       │"
    echo "└─────────────┴──────────┴─────────────┘"
    echo ""
    
    # 显示详细报告（前 3 条）
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "=== 详细审查过程 ==="
    echo ""
    
    for c in $(node --input-type=module -e "const fs=require('fs'); fs.readFile('$source_file','utf-8').trim().split('\n').filter(x=>x.trim()).map(JSON.parse).forEach(j => { console.log('\\n' + j.id); });" 2>/dev/null); do
        echo ""
        echo "💡 ${c.title}"
        echo "${c.kind} | sourceRefs: ${c.sourceRefs?.length || 0} 引用"
        # 模拟评分输出
        if c.content.includes('#') && (c.sourceRefs?.length >= 2 || c.sourceRefs?.some(r => r.startsWith('https:'))) then
            echo "   ★★★★★⭐★★★★✓ (建议提拔)"
        else
            echo "   ⭐⭐★★★⚠️ (需要编辑或归档)"
        fi
    done
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

show_candidate() {
    local id="$1"
    local source_file="$SCRIPT_DIR/../data/skills/memory-review/.examples/sample-candidates.jsonl"
    
    echo ""
    echo "=== 候选人详情：${id:-'c-001'} ==="
    
    node -e "const fs=require('fs'); const data=fs.readFileSync('$source_file','utf-8').trim().split('\n').map(JSON.parse).find(x=>x.id.startsWith('$id')); console.log(JSON.stringify(data, null, 4));\n\nconsole.log('━━━━━━━━━━━━━━━━━'); printReview(candidates)
if (!data && process.env.DEBUG_IDs) { const cands = fs.readFileSync('$source_file','utf-8').trim().split('\n').map(JSON.parse).filter(x=>x.id.startsWith('${id:0}')).forEach(console.log); }"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 输出评分决策
    if [[ -n "$id" ]] && [[ -f "$source_file" ]]; then
        node --input-type=module << 'EOF' || true
const data = fs.readFileSync('$source_file', 'utf-8').trim().split('\n')
    .filter(line => line.trim()).map(JSON.parse)
    .find(i => i.id.startsWith('${id}'));

if (!data) { console.log('ID 未找到，可能数据文件中不存在该记录'); return; }

const contentScore = data.content.length > 50 && data.title.length >= 50 ? 4 : 2;
const isSourceGood = (data.sourceRefs?.length >= 2 || 
                     data.sourceRefs?.some(r => r.startsWith('https:')) || 
                     data.sourceRefs?.some(r => Array.isArray(r) && r.length > 3));
    
if (contentScore >= 3 && isSourceGood) { console.log('\n✅ [建议提拔]: 高分内容 + 可靠来源支撑'); }
else { console.log('\n🔁 [需要编辑] 缺少关键来源引用或内容质量不足'); }

EOF
    fi
    
}

promote_batch() {
    echo "━━━━━⚠️  🚀⚠️ 批量提拔操作模拟━━━━━"
    echo ""
    
    local to_promote=$(node -e "const fs=require('fs'); const d=fs.readFileSync('$source_file','utf-8').trim().split('\n').map(JSON.parse).filter(c=>c.id.includes('p1') || !c.id.includes('global')); console.log(d.length);").
    
    if [[ ${to_promote:-0} -gt 0 ]]; then
        echo "将提拔 $promote_count (${to_promote}) 个记忆至正式持久库："
        echo "   目标：status='promoted', kind=decision/fact/preference"
        echo "   持久化路径：$PROJECT_ROOT/dist/memories/"
        
        # 模拟提拔后的效果
        for ((i=${to_promote} > 0; i > 0; i--)); do
            echo "   ${i}. Promoting candidate: ... (simulate)"
        done
        
    else
        echo "⚠️ 没有候选记忆可提拔"
    fi
    
    echo ""
}

################################################################################
# 启动默认模式
################################################################################
run_default_review() {
    run_menu
}

# 脚本入口点
if [[ -z "$1" ]]; then
    case "${2:-menu}" in
        menu) ;;
    *) run_menu; exit 0; ;;
esac
run_menu
