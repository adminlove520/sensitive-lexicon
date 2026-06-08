const axios = require('axios');

const CONFIG = {
  API_PROVIDERS: [
    { name: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', model: 'abab6.5s-chat', enabled: () => !!process.env.MINIMAX_API_KEY, getKey: () => process.env.MINIMAX_API_KEY },
    { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', enabled: () => !!process.env.DEEPSEEK_API_KEY, getKey: () => process.env.DEEPSEEK_API_KEY },
    { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', enabled: () => !!process.env.OPENAI_API_KEY, getKey: () => process.env.OPENAI_API_KEY }
  ],
  CATEGORIES: { POLITICAL: '政治敏感', VIOLENCE: '暴力恐怖', PORN: '色情低俗', FRAUD: '欺诈诈骗', AD: '广告垃圾', CUSTOM: '敏感内容', NORMAL: '正常内容' },
  RISK_THRESHOLDS: { HIGH: 80, MEDIUM: 50, LOW: 30 }
};

function getEnabledProvider() {
  for (const p of CONFIG.API_PROVIDERS) { if (p.enabled()) return p; }
  return null;
}

class SemanticAnalyzer {
  constructor() {
    this.provider = getEnabledProvider();
    this.cache = new Map();
  }

  getApiKey() { return this.provider?.getKey(); }

  async classify(text) {
    const cacheKey = text.slice(0, 50);
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    if (!this.provider) return this.ruleBasedClassify(text);

    const prompt = '内容安全审核，判断类型：POLITICAL(政治),VIOLENCE(暴力),PORN(色情),FRAUD(欺诈),AD(广告),CUSTOM(其他敏感),NORMAL(正常)\n文本：' + text.slice(0, 500) + '\n只输出分类名称。';

    try {
      const resp = await axios.post(this.provider.baseUrl + '/chat/completions',
        { model: this.provider.model, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 50 },
        { headers: { 'Authorization': 'Bearer ' + this.getApiKey(), 'Content-Type': 'application/json' }, timeout: 10000 });
      const category = resp.data.choices[0].message.content.trim().toUpperCase();
      const result = { category, categoryName: CONFIG.CATEGORIES[category] || CONFIG.CATEGORIES.CUSTOM };
      this.cache.set(cacheKey, result);
      return result;
    } catch (e) { return this.ruleBasedClassify(text); }
  }

  async scoreRisk(text, matchedWords = []) {
    if (!this.provider) return this.ruleBasedScore(text, matchedWords);

    const matchedStr = matchedWords.length > 0 ? '命中敏感词: ' + matchedWords.join(', ') : '无精确匹配';
    const prompt = '评估风险(0-100分)：文本：' + text.slice(0, 500) + '\n' + matchedStr + '\n0-30低,31-50中需审核,51-80高,81-100极高\n输出JSON:{"score":数字,"level":"高/中/低","reason":"原因"}';

    try {
      const resp = await axios.post(this.provider.baseUrl + '/chat/completions',
        { model: this.provider.model, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 200 },
        { headers: { 'Authorization': 'Bearer ' + this.getApiKey(), 'Content-Type': 'application/json' }, timeout: 15000 });
      const content = resp.data.choices[0].message.content;
      try { return JSON.parse(content); } catch (e2) { return this.ruleBasedScore(text, matchedWords); }
    } catch (e) { return this.ruleBasedScore(text, matchedWords); }
  }

  async detectIntent(text) {
    if (!this.provider) return { intent: 'unknown', confidence: 0.5 };
    const prompt = '判断意图：MALICIOUS(恶意),EXPLORING(无意),NORMAL(正常),UNCLEAR(不明确)\n文本：' + text.slice(0, 300) + '\n输出:{"intent":"类型","confidence":0.0-1.0}';
    try {
      const resp = await axios.post(this.provider.baseUrl + '/chat/completions',
        { model: this.provider.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 100 },
        { headers: { 'Authorization': 'Bearer ' + this.getApiKey(), 'Content-Type': 'application/json' }, timeout: 10000 });
      try { return JSON.parse(resp.data.choices[0].message.content); } catch (e) { return { intent: 'unknown', confidence: 0.5 }; }
    } catch (e) { return { intent: 'unknown', confidence: 0.5 }; }
  }

  ruleBasedClassify(text) {
    const t = text.toLowerCase();
    const patterns = {
      POLITICAL: [/领导/, /政府/, /国家/, /政治/, /党/],
      VIOLENCE: [/暴力/, /恐怖/, /武器/, /炸弹/, /杀人/],
      PORN: [/色情/, /裸体/, /成人/],
      FRAUD: [/诈骗/, /骗子/, /欺诈/, /钓鱼/],
      AD: [/广告/, /推广/, /优惠/, /促销/]
    };
    for (const [cat, regexes] of Object.entries(patterns)) {
      if (regexes.some(r => r.test(t))) return { category: cat, categoryName: CONFIG.CATEGORIES[cat] };
    }
    return { category: 'NORMAL', categoryName: CONFIG.CATEGORIES.NORMAL };
  }

  ruleBasedScore(text, matchedWords = []) {
    let score = Math.min(matchedWords.length * 10, 40);
    const t = text.toLowerCase();
    if (/敏感|违规|违法/.test(t)) score += 20;
    if (/政治|暴恐|色情/.test(t)) score += 30;
    score = Math.min(Math.max(score, 0), 100);
    let level = score >= 80 ? '高' : score >= 50 ? '中' : '低';
    return { score, level, reason: matchedWords.length > 0 ? '命中 ' + matchedWords.length + ' 个敏感词' : '无明显风险' };
  }

  clearCache() { this.cache.clear(); }
}

module.exports = { SemanticAnalyzer, SemanticConfig: CONFIG };
