/**
 * 生成更新报告 v2.0
 */
const fs = require('fs');
const path = require('path');

const CONFIG = { APPROVED_DIR: path.join(__dirname, '../.approved'), REPORTS_DIR: path.join(__dirname, '../reports'), OUTPUT_DIR: path.join(__dirname, '../dist') };

function pct(n, d) { return d === 0 || !d ? '0.00%' : (n / d * 100).toFixed(2) + '%'; }

function main() {
  console.log('Generating report...\n');
  if (!fs.existsSync(CONFIG.REPORTS_DIR)) fs.mkdirSync(CONFIG.REPORTS_DIR, { recursive: true });
  let files = []; try { if (fs.existsSync(CONFIG.APPROVED_DIR)) files = fs.readdirSync(CONFIG.APPROVED_DIR).filter(f => f.endsWith('-approved.json')); } catch(e) {}
  let totalApproved = 0, totalRejected = 0;
  const catStats = [];
  files.forEach(f => { try { const d = JSON.parse(fs.readFileSync(path.join(CONFIG.APPROVED_DIR, f), 'utf-8')); const a = d.approvedWords?.length || 0, r = d.rejectedWords?.length || 0; totalApproved += a; totalRejected += r; catStats.push({ cat: d.category, risk: d.riskLevel, a, r, rate: pct(a, a+r) }); } catch(e) {} });
  let totalWords = 0; try { const f = path.join(CONFIG.OUTPUT_DIR, 'lexicon-full.json'); if (fs.existsSync(f)) totalWords = JSON.parse(fs.readFileSync(f, 'utf-8')).words?.length || 0; } catch(e) {}
  const total = totalApproved + totalRejected;
  const now = new Date().toISOString();
  const date = now.split('T')[0];
  const display = now.replace('T', ' ').split('.')[0];
  
  const report = `# 敏感词库自动更新报告

**生成时间**: ${display}
**更新方式**: AI 自动生成 + AI 自动审核

---

## 总体统计

| 指标 | 数值 |
|------|------|
| 本次审核 | ${total} |
| 通过 | ${totalApproved} (${pct(totalApproved, total)}) |
| 拒绝 | ${totalRejected} (${pct(totalRejected, total)}) |
| 总词数 | ${totalWords} |

---

## 分类统计

| 分类 | 风险 | 通过 | 拒绝 | 通过率 |
|------|------|------|------|--------|
${catStats.length ? catStats.map(s => '| ' + s.cat + ' | ' + s.risk + ' | ' + s.a + ' | ' + s.r + ' | ' + s.rate + ' |').join('\n') : '| - | - | 0 | 0 | 0% |'}

---

## 防误伤机制

- 长度检查 (2-20)
- 常用词对比
- 模糊度限制
- AI 语义分析

---

**Powered by AI 🤖**
`;

  console.log(report);
  fs.writeFileSync(path.join(CONFIG.REPORTS_DIR, 'update-report-' + date.replace(/-/g, '') + '.md'), report);
  console.log('Saved to reports/');
}

main();
