/**
 * 生成更新报告
 */

const fs = require('fs');
const path = require('path');

const APPROVED_DIR = path.join(__dirname, '../.approved');
const REPORTS_DIR = path.join(__dirname, '../reports');

function main() {
  // 创建报告目录
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  
  // 读取所有审核文件
  const files = fs.readdirSync(APPROVED_DIR).filter(f => f.endsWith('-approved.json'));
  
  let totalApproved = 0;
  let totalRejected = 0;
  const categoryStats = [];
  
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(APPROVED_DIR, file), 'utf-8'));
    
    totalApproved += data.approvedWords.length;
    totalRejected += data.rejectedWords.length;
    
    categoryStats.push({
      category: data.category,
      riskLevel: data.riskLevel,
      approved: data.approvedWords.length,
      rejected: data.rejectedWords.length,
      rate: data.stats.approvalRate
    });
  }
  
  // 生成 Markdown 报告
  const report = `# 敏感词库自动更新报告

**生成时间**: ${new Date().toISOString()}
**更新方式**: AI 自动生成 + AI 自动审核

---

## 📊 总体统计

| 指标 | 数值 |
|------|------|
| 总审核词数 | ${totalApproved + totalRejected} |
| 审核通过 | ${totalApproved} (${(totalApproved / (totalApproved + totalRejected) * 100).toFixed(2)}%) |
| 审核拒绝 | ${totalRejected} (${(totalRejected / (totalApproved + totalRejected) * 100).toFixed(2)}%) |

---

## 📋 分类统计

| 分类 | 风险等级 | 通过 | 拒绝 | 通过率 |
|------|----------|------|------|--------|
${categoryStats.map(s => `| ${s.category} | ${s.riskLevel} | ${s.approved} | ${s.rejected} | ${s.rate} |`).join('\n')}

---

## 🛡️ 质量保证

### 审核流程

1. **AI 生成变体**: 基于现有词库生成新变体
2. **规则过滤**: 检查误伤（常用词、过度模糊）
3. **AI 语义审核**: 判断词汇是否合理
4. **人工抽查**: 定期审查审核通过的高风险词

### 防误伤机制

- ✅ 长度检查 (2-20 字符)
- ✅ 常用词对比
- ✅ 模糊度限制 (星号不超过 70%)
- ✅ AI 语义分析

---

## 📦 输出文件

- \`dist/lexicon-full.json\` - 完整词库（含索引）
- \`dist/lexicon-by-category.json\` - 分类词库
- \`dist/lexicon-words-only.txt\` - 纯词版

---

## 🔍 人工抽查建议

以下分类建议人工抽查：

${categoryStats.filter(s => s.riskLevel === 'HIGH_RISK').map(s => `- **${s.category}**: ${s.approved} 个新词`).join('\n')}

抽查方式：
\`\`\`bash
# 查看某分类的审核通过词
cat .approved/${categoryStats.filter(s => s.riskLevel === 'HIGH_RISK')[0]?.category}-approved.json | jq '.approvedWords'
\`\`\`

---

**Powered by AI 自动更新系统 🤖**
`;

  console.log(report);
}

// 运行
main();
