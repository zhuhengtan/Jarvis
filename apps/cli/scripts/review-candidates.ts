#!/usr/bin/env node
// Jarvis 候选记忆审查工具
// Usage: pnpm --filter @jarvis/cli exec review-candidates.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = '/Users/zhuhengtan/projects/Jarvis/Jarvis';
const SKILLS_DIR = path.join(PROJECT_ROOT, 'data', 'skills', 'memory-review', '.examples');

let candidates: any[] = [];

// 加载候选记忆数据
function loadCandidates(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.trim().split('\n').filter(line => line).map(JSON.parse);
}

// 评估候选人质量
function reviewCandidate(c: any): { action: 'promote' | 'reject' | 'review'; reason: string } {
  const sourceRefs = c.sourceRefs || [];
  const sourceScore = sourceRefs.length >= 2 ? 5 : sourceRefs.length >= 1 ? 3 : 1;
  
  // 评估内容质量
  const contentScore = 
    typeof c.content === 'string' && c.title.split('###').length <= 2 ? 4 : 2;

  // 基于评分的决策
  if (contentScore >= 3) {
    return {
      action: sourceScore >= 3 ? 'promote' : 'review',
      reason: `内容质量：${contentScore}/5 | 来源可信度：${sourceScore}/5`
    };
  }
  
  return {
    action: 'reject',
    reason: `内容质量过低 (${contentScore}/5)`
  };
}

// 输出审查结果
function printReviewResults(reviewed: any[]) {
  console.log('\n========== Jarvis 候选记忆审查报告 ==========\n');
  
  let promotedCount = 0;
  let reviewedCount = 0;
  let rejectedCount = 0;
  
  reviewed.forEach((c, i) => {
    const result = reviewCandidate(c);
    
    console.log(`[${i + 1}] ${c.title}`);
    console.log(`   ID: ${c.id}`);
    console.log(`   Kind: ${c.kind}`);
    console.log(`   评分：${result.reason}`);
    console.log(`   ─────────────────────`);
    
    switch(result.action) {
      case 'promote':
        promotedCount++;
        console.log('   ✅ [建议提拔] 符合高质量标准');
        break;
      case 'review':
        reviewedCount++;
        console.log('   🔁 [建议编辑] 需要补充来源引用');
        break;
      case 'rejected':
        rejectedCount++;
        console.log('   ⚠️ [建议归档] 质量不足，考虑删除');
        break;
    }
  });
  
  console.log('\n========== 统计 ==========\');
  console.log(`总计审查：${reviewed.length}`);
  console.log(`✅ 建议提拔：${promotedCount}\n`);
}

// 主程序入口
if (import.meta.meta?.url && import.meta.meta.url.startsWith('file://')) {
  const candidatePath = path.join(SKILLS_DIR, 'sample-candidates.jsonl');
  
  if (!fs.existsSync(candidatePath)) {
    console.error('🔍 示例候选记忆文件不存在，请创建数据文件：');
    console.log(`   ${candidatePath}\n`);
    process.exit(1);
  }
  
  // 加载并审查候选记忆
  candidates = loadCandidates(candidatePath);
  printReviewResults(candidates);
}
