/**
 * AI 生成新词脚本 v2.0
 *
 * 改进：
 * 1. 增强本地规则生成（API 被拒时自动降级）
 * 2. 支持多种 AI API（MiniMax/DeepSeek/OpenAI）
 * 3. 更好的错误处理
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CONFIG = {
  CATEGORIES: {
    HIGH_RISK: ['政治类型', '暴恐词库', '涉枪涉爆', '反动词库'],
    MEDIUM_RISK: ['广告类型', '民生词库', 'GFW补充词库'],
    LOW_RISK: ['COVID-19词库', '网易前端过滤敏感词库']
  },
  VOCABULARY_DIR: path.join(__dirname, '../Vocabulary'),
  OUTPUT_DIR: path.join(__dirname, '../.generated'),
  VARIANTS_PER_CATEGORY: 30,
  API_PROVIDERS: [
    { name: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', model: 'abab6.5s-chat', enabled: () => !!process.env.MINIMAX_API_KEY },
    { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', enabled: () => !!process.env.DEEPSEEK_API_KEY },
    { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', enabled: () => !!process.env.OPENAI_API_KEY }
  ]
};

function readLexicon(category) {
  const filePath = path.join(CONFIG.VOCABULARY_DIR, category + '.txt');
  if (!fs.existsSync(filePath)) { console.log('  File not found'); return []; }
  return fs.readFileSync(filePath, 'utf-8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}

function getEnabledProvider() {
  for (const p of CONFIG.API_PROVIDERS) { if (p.enabled()) return p; }
  return null;
}

function getApiKey(p) { return p.name === 'MiniMax' ? process.env.MINIMAX_API_KEY : p.name === 'DeepSeek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY; }

function generateRuleBasedVariants(word) {
  const variants = new Set();
  const pinyinMap = { '中': 'zhong', '共': 'gong', '党': 'dang', '国': 'guo', '领': 'ling', '导': 'dao', '北': 'bei', '京': 'jing', '人': 'ren' };
  if (pinyinMap[word[0]]) { const py = pinyinMap[word[0]]; variants.add(py); variants.add(py[0].toUpperCase() + py.slice(1)); variants.add(py.toUpperCase()); }
  if (word.length >= 2) {
    const chars = word.split('');
    variants.add(chars.join(' ')); variants.add(chars.join('*')); variants.add(chars.join('-'));
    variants.add(word[0] + '*'.repeat(word.length - 1));
    const similar = { '党': '挡', '共': '供', '国': '裹', '导': '道' };
    for (const [o, s] of Object.entries(similar)) { if (word.includes(o)) variants.add(word.replace(o, s)); }
  }
  ['*', '-', '.', '·'].forEach(sym => { if (word.length >= 2) variants.add(word.slice(0, Math.floor(word.length/2)) + sym + word.slice(Math.floor(word.length/2))); });
  const numMap = { '一': '1', '二': '2', '三': '3', '七': '7', '八': '8' };
  let rep = word; for (const [c, n] of Object.entries(numMap)) { rep = rep.replace(c, n); }
  if (rep !== word) variants.add(rep);
  if (word.length >= 2) { variants.add(word + word); variants.add(word.split('').reverse().join('')); }
  return Array.from(variants).filter(v => v !== word && v.length >= 2 && v.length <= 20);
}

function generateAllRuleVariants(words, target = 50) {
  const all = new Set();
  for (const w of words) { generateRuleBasedVariants(w).forEach(v => all.add(v)); if (all.size >= target) break; }
  if (all.size < target && words.length >= 2) { for (let i = 0; i < words.length-1 && all.size < target; i++) { for (let j = i+1; j < words.length && all.size < target; j++) { all.add(words[i]+words[j][0]); all.add(words[j]+words[i][0]); } } }
  return Array.from(all).slice(0, target);
}

async function callAIApi(words, provider) {
  const apiKey = getApiKey(provider);
  if (!apiKey) return null;
  const prompt = 'You are a Chinese sensitive word expert. Generate variants for: ' + words.slice(0, 10).join(', ') + '. Output JSON array only.';
  try {
    const resp = await axios.post(provider.baseUrl + '/chat/completions', { model: provider.model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 1000 }, { headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' }, timeout: 30000 });
    const content = resp.data.choices[0].message.content;
    try { return JSON.parse(content); } catch(e) { const m = content.match(/\[[\s\S]*\]/); if (m) try { return JSON.parse(m[0]); } catch(e2) {} }
    return null;
  } catch(e) { if (e.response?.data?.error?.code === 1027 || e.message?.includes('1027')) { console.log('  API blocked, using local rules'); return null; } console.log('  API error: ' + e.message); return null; }
}

async function main() {
  console.log('Generating variants...\n');
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  const provider = getEnabledProvider();
  console.log(provider ? 'Using API: ' + provider.name : 'No API configured, using local rules');
  for (const [level, cats] of Object.entries(CONFIG.CATEGORIES)) {
    console.log('\n' + '='.repeat(40) + '\n' + level + '\n' + '='.repeat(40));
    for (const cat of cats) {
      console.log('\nProcessing: ' + cat);
      const words = readLexicon(cat);
      if (words.length === 0) { console.log('  Skipped (no words)'); continue; }
      console.log('  Existing: ' + words.length);
      let newWords = [];
      if (provider) { newWords = await callAIApi(words, provider); if (!newWords?.length) { console.log('  Using local rules'); newWords = generateAllRuleVariants(words, CONFIG.VARIANTS_PER_CATEGORY); } }
      else { newWords = generateAllRuleVariants(words, CONFIG.VARIANTS_PER_CATEGORY); }
      console.log('  Generated: ' + newWords.length);
      fs.writeFileSync(path.join(CONFIG.OUTPUT_DIR, cat + '-pending.json'), JSON.stringify({ category: cat, riskLevel: level, existingWordsCount: words.length, newWords, timestamp: new Date().toISOString() }, null, 2));
      console.log('  Saved');
    }
  }
  console.log('\nDone!');
}

main().catch(console.error);
