/**
 * 构建高效索引 v2.0
 */
const fs = require('fs');
const path = require('path');

const CONFIG = { VOCABULARY_DIR: path.join(__dirname, '../Vocabulary'), APPROVED_DIR: path.join(__dirname, '../.approved'), OUTPUT_DIR: path.join(__dirname, '../dist') };

function cleanWord(word) {
  if (!word || typeof word !== 'string') return null;
  const n = word.trim().replace(/[​-‏﻿]/g, '');
  if (n.length < 2 || n.length > 20 || /^\s+$/.test(n)) return null;
  return n;
}

function readAllLexicons() {
  const words = new Set();
  const catMap = new Map();
  console.log('Reading vocabulary...');
  if (fs.existsSync(CONFIG.VOCABULARY_DIR)) {
    for (const f of fs.readdirSync(CONFIG.VOCABULARY_DIR).filter(f => f.endsWith('.txt'))) {
      const cat = f.replace('.txt', '');
      const wf = fs.readFileSync(path.join(CONFIG.VOCABULARY_DIR, f), 'utf-8').split('\n').map(l => cleanWord(l)).filter(l => l);
      console.log('  ' + cat + ': ' + wf.length);
      wf.forEach(w => { words.add(w); if (!catMap.has(w)) catMap.set(w, new Set()); catMap.get(w).add(cat); });
    }
  }
  console.log('\nReading approved...');
  if (fs.existsSync(CONFIG.APPROVED_DIR)) {
    for (const f of fs.readdirSync(CONFIG.APPROVED_DIR).filter(f => f.endsWith('-approved.json'))) {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(CONFIG.APPROVED_DIR, f), 'utf-8'));
        console.log('  ' + d.category + ': ' + (d.approvedWords?.length || 0));
        (d.approvedWords || []).forEach(w => { const c = cleanWord(w); if (c) { words.add(c); if (!catMap.has(c)) catMap.set(c, new Set()); catMap.get(c).add(d.category); } });
      } catch(e) { console.log('  Error: ' + e.message); }
    }
  }
  return { words: Array.from(words), catMap: new Map([...catMap].map(([w, c]) => [w, Array.from(c)])) };
}

function buildIndex(words) {
  const idx = {};
  words.forEach(w => { if (!idx[w.length]) idx[w.length] = []; idx[w.length].push(w); });
  Object.keys(idx).forEach(len => idx[len].sort());
  return idx;
}

function groupByRisk(catMap) {
  const groups = { HIGH_RISK: [], MEDIUM_RISK: [], LOW_RISK: [], OTHER: [] };
  const map = { '政治类型': 'HIGH_RISK', '暴恐词库': 'HIGH_RISK', '涉枪涉爆': 'HIGH_RISK', '反动词库': 'HIGH_RISK', '广告类型': 'MEDIUM_RISK', '民生词库': 'MEDIUM_RISK', 'GFW补充词库': 'MEDIUM_RISK', 'COVID-19词库': 'LOW_RISK', '网易前端过滤敏感词库': 'LOW_RISK' };
  catMap.forEach((cats, word) => { cats.forEach(cat => { const risk = map[cat] || 'OTHER'; if (!groups[risk].includes(word)) groups[risk].push(word); }); });
  return groups;
}

function main() {
  console.log('Building index...\n');
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  const { words, catMap } = readAllLexicons();
  console.log('\nTotal: ' + words.length + ' words, ' + catMap.size + ' categories');
  const idx = buildIndex(words);
  console.log('Index groups: ' + Object.keys(idx).length);
  const riskGroups = groupByRisk(catMap);
  
  console.log('\nGenerating lexicon-full.json...');
  fs.writeFileSync(path.join(CONFIG.OUTPUT_DIR, 'lexicon-full.json'), JSON.stringify({ version: new Date().toISOString().split('T')[0], generatedAt: new Date().toISOString(), stats: { total: words.length, categories: catMap.size, lengthGroups: Object.keys(idx).length }, words, index: idx, riskGroups: { high: riskGroups.HIGH_RISK.length, medium: riskGroups.MEDIUM_RISK.length, low: riskGroups.LOW_RISK.length } }, null, 2));
  
  console.log('Generating lexicon-by-category.json...');
  const catStats = {}; catMap.forEach((cats, word) => { cats.forEach(c => { if (!catStats[c]) catStats[c] = new Set(); catStats[c].add(word); }); });
  fs.writeFileSync(path.join(CONFIG.OUTPUT_DIR, 'lexicon-by-category.json'), JSON.stringify({ version: new Date().toISOString().split('T')[0], generatedAt: new Date().toISOString(), categories: Object.fromEntries(Object.entries(catStats).map(([c, ws]) => [c, { words: Array.from(ws).sort(), count: ws.size }])) }, null, 2));
  
  console.log('Generating lexicon-words-only.txt...');
  fs.writeFileSync(path.join(CONFIG.OUTPUT_DIR, 'lexicon-words-only.txt'), words.join('\n'));
  
  console.log('Generating lexicon-by-risk-level.json...');
  fs.writeFileSync(path.join(CONFIG.OUTPUT_DIR, 'lexicon-by-risk-level.json'), JSON.stringify({ version: new Date().toISOString().split('T')[0], generatedAt: new Date().toISOString(), stats: { high: riskGroups.HIGH_RISK.length, medium: riskGroups.MEDIUM_RISK.length, low: riskGroups.LOW_RISK.length }, highRisk: riskGroups.HIGH_RISK.sort(), mediumRisk: riskGroups.MEDIUM_RISK.sort(), lowRisk: riskGroups.LOW_RISK.sort() }, null, 2));
  
  console.log('\nDone!\nOutput:\n  dist/lexicon-full.json\n  dist/lexicon-by-category.json\n  dist/lexicon-words-only.txt\n  dist/lexicon-by-risk-level.json');
}

main();
