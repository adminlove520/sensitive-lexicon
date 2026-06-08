const fs = require('fs');
const path = require('path');

const CONFIG = {
  CATEGORIES: {
    HIGH_RISK: ['政治类型', '暴恐词库', '涉枪涉爆', '反动词库'],
    MEDIUM_RISK: ['广告类型', '民生词库', 'GFW补充词库'],
    LOW_RISK: ['COVID-19词库', '网易前端过滤敏感词库']
  },
  VOCABULARY_DIR: path.join(__dirname, '../Vocabulary'),
  OUTPUT_DIR: path.join(__dirname, '../.generated'),
  VARIANTS_PER_CATEGORY: 30
};

function generateVariants(word) {
  const variants = new Set();

  // 1. 符号干扰
  const symbols = ['*', '-', '.', '#', '@'];
  for (const sym of symbols) {
    if (word.length >= 2) {
      const mid = Math.floor(word.length / 2);
      variants.add(word.slice(0, mid) + sym + word.slice(mid));
      variants.add(word.split('').join(sym));
      for (let i = 1; i < word.length - 1; i++) {
        variants.add(word.slice(0, i) + sym + word.slice(i + 1));
      }
    }
  }

  // 2. 空格分散
  if (word.length >= 2) {
    variants.add(word.split('').join(' '));
    variants.add(word.split('').join('-'));
    variants.add(word.split('').join('_'));
  }

  // 3. 字符遮蔽
  if (word.length >= 2) {
    variants.add(word[0] + '*'.repeat(word.length - 1));
    variants.add('*'.repeat(word.length - 1) + word[word.length - 1]);
    for (let i = 1; i < word.length; i++) {
      variants.add(word.slice(0, i) + '*'.repeat(word.length - i));
    }
    for (let i = 0; i < word.length; i++) {
      variants.add(word.slice(0, i) + '*' + word.slice(i + 1));
    }
  }

  // 4. 形近字
  const similar = { '中': ['种', '重'], '共': ['供', '公'], '党': ['挡', '当'], '国': ['裹', '过'], '导': ['道'], '人': ['入', '仁'] };
  for (const [char, alts] of Object.entries(similar)) {
    if (word.includes(char)) {
      for (const alt of alts) {
        variants.add(word.replace(char, alt));
      }
    }
  }

  // 5. 数字谐音
  const numMap = { '一': '1', '二': '2', '三': '3', '七': '7', '八': '8', '零': '0' };
  let rep = word;
  for (const [cn, num] of Object.entries(numMap)) {
    rep = rep.replace(new RegExp(cn, 'g'), num);
  }
  if (rep !== word) variants.add(rep);

  // 6. 拼音
  const pyMap = { '中': 'zhong', '共': 'gong', '党': 'dang', '国': 'guo', '导': 'dao', '北': 'bei', '京': 'jing' };
  if (pyMap[word[0]]) {
    const py = pyMap[word[0]];
    variants.add(py);
    variants.add(py[0].toUpperCase() + py.slice(1));
    variants.add(py.toUpperCase());
  }

  // 7. 零宽字符
  const zwc = '​';
  for (let i = 0; i <= word.length; i++) {
    variants.add(word.slice(0, i) + zwc + word.slice(i));
  }

  // 8. 颠倒重复
  if (word.length >= 2) {
    variants.add(word.split('').reverse().join(''));
    variants.add(word + word);
  }

  return Array.from(variants).filter(v => v && v !== word && v.length >= 2 && v.length <= 25);
}

function main() {
  console.log('Generating variants (local rules)...\n');

  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  let totalGen = 0;
  let totalCats = 0;

  for (const [level, cats] of Object.entries(CONFIG.CATEGORIES)) {
    console.log(level);
    console.log('-'.repeat(30));

    for (const cat of cats) {
      const fp = path.join(CONFIG.VOCABULARY_DIR, cat + '.txt');
      if (!fs.existsSync(fp)) { console.log('  Skip: ' + cat); continue; }

      const words = fs.readFileSync(fp, 'utf-8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && l.length >= 2);
      if (words.length === 0) { console.log('  Skip: ' + cat + ' (empty)'); continue; }

      console.log('  ' + cat + ': ' + words.length + ' words');

      const allVar = new Set();
      for (const w of words) {
        generateVariants(w).forEach(v => allVar.add(v));
        if (allVar.size >= CONFIG.VARIANTS_PER_CATEGORY) break;
      }

      if (allVar.size < CONFIG.VARIANTS_PER_CATEGORY && words.length >= 2) {
        for (let i = 0; i < words.length - 1 && allVar.size < CONFIG.VARIANTS_PER_CATEGORY * 2; i++) {
          allVar.add(words[i] + words[i + 1].charAt(0));
        }
      }

      const newWords = Array.from(allVar).slice(0, CONFIG.VARIANTS_PER_CATEGORY);

      fs.writeFileSync(path.join(CONFIG.OUTPUT_DIR, cat + '-pending.json'),
        JSON.stringify({ category: cat, riskLevel: level, existingWordsCount: words.length, newWords, generatedBy: 'local-rules', timestamp: new Date().toISOString() }, null, 2));

      console.log('    Generated: ' + newWords.length);
      totalGen += newWords.length;
      totalCats++;
    }
  }

  console.log('\nDone!');
  console.log('Categories: ' + totalCats);
  console.log('Total variants: ' + totalGen);
  console.log('\nNext: node scripts/ai-review.js');
}

main();
