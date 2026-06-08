const fs = require('fs');
const path = require('path');

const CONFIG = {
  APPROVED_DIR: path.join(__dirname, '../.approved'),
  REPORTS_DIR: path.join(__dirname, '../reports'),
  OUTPUT_DIR: path.join(__dirname, '../dist'),
  VOCABULARY_DIR: path.join(__dirname, '../Vocabulary')
};

function pct(n, d) {
  if (d === 0 || !d) return '0.00%';
  return (n / d * 100).toFixed(2) + '%';
}

function formatNumber(n) {
  return n.toLocaleString();
}

function main() {
  console.log('Generating report...\n');

  if (!fs.existsSync(CONFIG.REPORTS_DIR)) {
    fs.mkdirSync(CONFIG.REPORTS_DIR, { recursive: true });
  }

  let files = [];
  try {
    if (fs.existsSync(CONFIG.APPROVED_DIR)) {
      files = fs.readdirSync(CONFIG.APPROVED_DIR).filter(f => f.endsWith('-approved.json'));
    }
  } catch (e) {}

  let totalApproved = 0, totalRejected = 0, totalGenerated = 0;
  const catStats = [];

  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(CONFIG.APPROVED_DIR, f), 'utf-8'));
      const approved = d.approvedWords?.length || 0;
      const rejected = d.rejectedWords?.length || 0;
      const generated = approved + rejected;
      totalApproved += approved;
      totalRejected += rejected;
      totalGenerated += generated;
      catStats.push({
        category: d.category,
        riskLevel: d.riskLevel,
        approved, rejected, generated,
        rate: pct(approved, generated)
      });
    } catch (e) {}
  }

  let totalWords = 0, vocabularyWords = 0;
  try {
    const fullLexicon = path.join(CONFIG.OUTPUT_DIR, 'lexicon-full.json');
    if (fs.existsSync(fullLexicon)) {
      totalWords = JSON.parse(fs.readFileSync(fullLexicon, 'utf-8')).words?.length || 0;
    }
  } catch (e) {}

  try {
    if (fs.existsSync(CONFIG.VOCABULARY_DIR)) {
      const txtFiles = fs.readdirSync(CONFIG.VOCABULARY_DIR).filter(f => f.endsWith('.txt'));
      for (const f of txtFiles) {
        const content = fs.readFileSync(path.join(CONFIG.VOCABULARY_DIR, f), 'utf-8');
        vocabularyWords += content.split('\n').filter(l => l.trim()).length;
      }
    }
  } catch (e) {}

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const timestamp = now.toISOString();

  const byRiskLevel = {
    HIGH_RISK: catStats.filter(s => s.riskLevel === 'HIGH_RISK'),
    MEDIUM_RISK: catStats.filter(s => s.riskLevel === 'MEDIUM_RISK'),
    LOW_RISK: catStats.filter(s => s.riskLevel === 'LOW_RISK')
  };

  let report = '# 敏感词库自动更新报告\n\n';
  report += '**生成时间**: ' + timeStr + '\n';
  report += '**更新方式**: 本地规则生成 + 自动审核\n\n';
  report += '---\n\n';
  report += '## 一、总体统计\n\n';
  report += '| 指标 | 数值 | 说明 |\n';
  report += '|:-----|:-----|:-----|\n';
  report += '| 本次生成变体 | ' + formatNumber(totalGenerated) + ' | 个新变体 |\n';
  report += '| 审核通过 | ' + formatNumber(totalApproved) + ' | ' + pct(totalApproved, totalGenerated) + ' |\n';
  report += '| 审核拒绝 | ' + formatNumber(totalRejected) + ' | ' + pct(totalRejected, totalGenerated) + ' (误伤过滤) |\n';
  report += '| 基础词库 | ' + formatNumber(vocabularyWords) + ' | 词 |\n';
  report += '| 最终总词数 | ' + formatNumber(totalWords) + ' | 含新增变体 |\n\n';
  report += '---\n\n';
  report += '## 二、分类详情\n\n';

  report += '### 高风险词库 (' + byRiskLevel.HIGH_RISK.length + ' 个分类)\n\n';
  report += '| 分类 | 生成 | 通过 | 拒绝 | 通过率 |\n';
  report += '|:-----|:----:|:----:|:----:|:------:|\n';
  if (byRiskLevel.HIGH_RISK.length > 0) {
    byRiskLevel.HIGH_RISK.forEach(s => {
      report += '| ' + s.category + ' | ' + s.generated + ' | ' + s.approved + ' | ' + s.rejected + ' | ' + s.rate + ' |\n';
    });
  } else {
    report += '| - | 0 | 0 | 0 | 0% |\n';
  }
  report += '\n';

  report += '### 中风险词库 (' + byRiskLevel.MEDIUM_RISK.length + ' 个分类)\n\n';
  report += '| 分类 | 生成 | 通过 | 拒绝 | 通过率 |\n';
  report += '|:-----|:----:|:----:|:----:|:------:|\n';
  if (byRiskLevel.MEDIUM_RISK.length > 0) {
    byRiskLevel.MEDIUM_RISK.forEach(s => {
      report += '| ' + s.category + ' | ' + s.generated + ' | ' + s.approved + ' | ' + s.rejected + ' | ' + s.rate + ' |\n';
    });
  } else {
    report += '| - | 0 | 0 | 0 | 0% |\n';
  }
  report += '\n';

  report += '### 低风险词库 (' + byRiskLevel.LOW_RISK.length + ' 个分类)\n\n';
  report += '| 分类 | 生成 | 通过 | 拒绝 | 通过率 |\n';
  report += '|:-----|:----:|:----:|:----:|:------:|\n';
  if (byRiskLevel.LOW_RISK.length > 0) {
    byRiskLevel.LOW_RISK.forEach(s => {
      report += '| ' + s.category + ' | ' + s.generated + ' | ' + s.approved + ' | ' + s.rejected + ' | ' + s.rate + ' |\n';
    });
  } else {
    report += '| - | 0 | 0 | 0 | 0% |\n';
  }
  report += '\n';

  report += '---\n\n';
  report += '## 三、质量保证\n\n';
  report += '本次更新采用以下机制确保质量：\n\n';
  report += '### 生成阶段\n';
  report += '- 符号干扰：使用 *, -, #, @ 等符号插入\n';
  report += '- 空格分散：字符之间插入空格\n';
  report += '- 字符遮蔽：部分字符用 * 遮蔽\n';
  report += '- 形近字替换：替换为视觉相似的字符\n';
  report += '- 数字谐音：中文数字替换为阿拉伯数字\n';
  report += '- 拼音转换：中文转拼音\n';
  report += '- 零宽字符：插入不可见字符\n\n';
  report += '### 审核阶段\n';
  report += '- 长度检查：2-20 字符范围\n';
  report += '- 常用词过滤：排除日常用语\n';
  report += '- 模糊度限制：遮蔽字符不超过 70%\n';
  report += '- 格式验证：JSON 结构正确性\n\n';

  report += '---\n\n';
  report += '## 四、输出文件\n\n';
  report += '| 文件 | 说明 |\n';
  report += '|:-----|:-----|\n';
  report += '| dist/lexicon-full.json | 完整词库（含索引） |\n';
  report += '| dist/lexicon-by-category.json | 分类词库 |\n';
  report += '| dist/lexicon-by-risk-level.json | 风险分级词库 |\n';
  report += '| dist/lexicon-words-only.txt | 纯词列表 |\n\n';

  report += '---\n\n';
  report += '## 五、版本信息\n\n';
  report += '| 项目 | 值 |\n';
  report += '|:-----|:-----|\n';
  report += '| 版本 | ' + dateStr + ' |\n';
  report += '| 生成时间 | ' + timestamp + ' |\n';
  report += '| 词库规模 | ' + formatNumber(totalWords) + ' 词 |\n\n';
  report += '---\n\n';
  report += '> 此报告由自动化系统生成\n';

  console.log(report);

  const reportFile = path.join(CONFIG.REPORTS_DIR, 'update-report-' + dateStr.replace(/-/g, '') + '.md');
  fs.writeFileSync(reportFile, report);
  console.log('\nSaved: ' + reportFile);
}

main();
