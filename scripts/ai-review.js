/**
 * AI 自动审核脚本 v2.0
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CONFIG = {
  GENERATED_DIR: path.join(__dirname, '../.generated'),
  APPROVED_DIR: path.join(__dirname, '../.approved'),
  API_PROVIDERS: [
    { name: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', model: 'abab6.5s-chat', enabled: () => !!process.env.MINIMAX_API_KEY },
    { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', enabled: () => !!process.env.DEEPSEEK_API_KEY },
    { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', enabled: () => !!process.env.OPENAI_API_KEY }
  ],
  BATCH_SIZE: 10
};

function getEnabledProvider() { for (const p of CONFIG.API_PROVIDERS) if (p.enabled()) return p; return null; }
function getApiKey(p) { return p.name === 'MiniMax' ? process.env.MINIMAX_API_KEY : p.name === 'DeepSeek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY; }

function loadCommonWords() {
  const f = path.join(__dirname, 'common-words.txt');
  const defaults = ['的', '了', '和', '是', '在', '我', '有', '就', '不', '人'];
  if (!fs.existsSync(f)) return defaults;
  const words = fs.readFileSync(f, 'utf-8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('-'));
  return words.length > 0 ? words : defaults;
}

function ruleBasedReview(word, commonWords) {
  if (word.length < 2 || word.length > 20) return { approved: false, reason: 'Length out of range' };
  for (const c of commonWords) { if (word === c) return { approved: false, reason: 'Common word' }; if (word.includes(c) && c.length > 2) return { approved: false, reason: 'Contains common: ' + c }; }
  const asteriskCount = (word.match(/[*·×#@]/g) || []).length;
  if (asteriskCount > word.length * 0.7) return { approved: false, reason: 'Too fuzzy' };
  if (/^[a-zA-Z]+$/.test(word) && word.length > 3 && /^(the|and|for|are|but|not|you|all|can|had|was|one|our)$/i.test(word)) return { approved: false, reason: 'Common English' };
  if (/^\d+$/.test(word)) return { approved: false, reason: 'Pure numbers' };
  return { approved: true, reason: 'Passed' };
}

async function batchAiReview(words, category, provider) {
  const apiKey = getApiKey(provider);
  if (!apiKey) return null;
  const prompt = 'Review these words for sensitive content filtering:\n' + words.map((w, i) => i+1 + '. ' + w).join('\n') + '\nCategory: ' + category + '\nOutput JSON array: {"word": "", "approved": true/false, "reason": ""}';
  try {
    const resp = await axios.post(provider.baseUrl + '/chat/completions', { model: provider.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3 }, { headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' }, timeout: 30000 });
    const content = resp.data.choices[0].message.content;
    try { return JSON.parse(content); } catch(e) { const m = content.match(/\[[\s\S]*\]/); if (m) try { return JSON.parse(m[0]); } catch(e2) {} }
    return null;
  } catch(e) { if (e.response?.data?.error?.code === 1027 || e.message?.includes('1027')) return null; throw e; }
}

async function main() {
  console.log('Reviewing...\n');
  if (!fs.existsSync(CONFIG.APPROVED_DIR)) fs.mkdirSync(CONFIG.APPROVED_DIR, { recursive: true });
  const commonWords = loadCommonWords();
  console.log('Common words loaded: ' + commonWords.length);
  const files = fs.readdirSync(CONFIG.GENERATED_DIR).filter(f => f.endsWith('-pending.json'));
  if (files.length === 0) { console.log('No pending files'); return; }
  console.log('Found ' + files.length + ' files\n');
  const provider = getEnabledProvider();
  console.log(provider ? 'Using API: ' + provider.name : 'Using local rules');
  const stats = { total: 0, approved: 0, rejected: 0 };
  for (const file of files) {
    console.log('\n' + '-'.repeat(40) + '\n' + file + '\n' + '-'.repeat(40));
    const data = JSON.parse(fs.readFileSync(path.join(CONFIG.GENERATED_DIR, file), 'utf-8'));
    const { category, riskLevel, newWords } = data;
    const approved = [], rejected = [];
    console.log('Rule review...');
    for (const w of newWords) { const r = ruleBasedReview(w, commonWords); (r.approved ? approved : rejected).push(r.approved ? w : { word: w, reason: r.reason }); }
    console.log('  Passed: ' + approved.length + ', Rejected: ' + rejected.length);
    if (provider && approved.length > 0) {
      console.log('AI review...');
      for (let i = 0; i < approved.length; i += CONFIG.BATCH_SIZE) {
        const batch = approved.slice(i, i + CONFIG.BATCH_SIZE);
        try {
          const results = await batchAiReview(batch, category, provider);
          if (results && Array.isArray(results)) {
            for (const r of results) {
              if (r.word && r.approved === false) {
                const idx = approved.indexOf(r.word);
                if (idx > -1) { approved.splice(idx, 1); rejected.push({ word: r.word, reason: r.reason || 'AI rejected' }); }
              }
            }
          }
        } catch(e) { console.log('  Batch error: ' + e.message); }
        process.stdout.write('\r  Progress: ' + Math.min(i + CONFIG.BATCH_SIZE, approved.length) + '/' + approved.length);
      }
      console.log();
    }
    stats.total += newWords.length; stats.approved += approved.length; stats.rejected += rejected.length;
    fs.writeFileSync(path.join(CONFIG.APPROVED_DIR, category + '-approved.json'), JSON.stringify({ category, riskLevel, approvedWords: approved, rejectedWords: rejected, stats: { total: newWords.length, approved: approved.length, rejected: rejected.length, rate: newWords.length > 0 ? (approved.length / newWords.length * 100).toFixed(2) + '%' : '0%' }, timestamp: new Date().toISOString() }, null, 2));
    console.log('\nResult: ' + approved.length + ' passed, ' + rejected.length + ' rejected');
  }
  console.log('\n' + '='.repeat(40) + '\nTotal: ' + stats.total + '\nApproved: ' + stats.approved + ' (' + (stats.total > 0 ? (stats.approved / stats.total * 100).toFixed(2) : 0) + '%)\nRejected: ' + stats.rejected + '\nDone!');
}

main().catch(console.error);
