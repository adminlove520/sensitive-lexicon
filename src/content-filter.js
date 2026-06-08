/**
 * 内容安全过滤器 - 集成所有检测模块
 * 
 * 架构:
 * ① DFA 极速过滤层 - O(n) 多模式匹配
 * ② 变体检测层 - Unicode/零宽字符处理
 * ③ 语义分析层 - MiniMax API 深度分析
 * ④ 风险评分 - 综合评级
 */

const fs = require('fs');
const path = require('path');
const { DFAMatcher } = require('./dfa-matcher.js');
const { VariantDetector } = require('./variant-detector.js');
const { SemanticAnalyzer } = require('./semantic-analyzer.js');

// ============ 配置 ============

const CONFIG = {
  // 风险等级阈值
  THRESHOLDS: { HIGH: 80, MEDIUM: 50, LOW: 30 },
  
  // 分类配置
  CATEGORIES: {
    HIGH_RISK: ['政治类型', '暴恐词库', '涉枪涉爆', '反动词库'],
    MEDIUM_RISK: ['广告类型', '民生词库', '贪腐词库', 'GFW补充词库', '补充词库'],
    LOW_RISK: ['色情类型', '色情词库', 'COVID-19词库', '网易前端过滤敏感词库']
  },
  
  // 开关
  ENABLED: {
    DFA: true,
    VARIANT: true,
    SEMANTIC: true,
    SEMANTIC_ONLY_ON_MATCH: true  // 只在 DFA 匹配时调用语义分析
  }
};

// ============ 内容过滤器类 ============

class ContentFilter {
  constructor(options = {}) {
    this.options = { ...CONFIG.ENABLED, ...options };
    this.dfa = null;
    this.variantDetector = new VariantDetector();
    this.semanticAnalyzer = new SemanticAnalyzer();
    this.stats = { total: 0, hit: 0, byLevel: { HIGH: 0, MEDIUM: 0, LOW: 0, SAFE: 0 } };
  }

  /**
   * 加载词库
   */
  loadLexicon(lexiconPath) {
    console.log('Loading lexicon...');
    const data = JSON.parse(fs.readFileSync(lexiconPath, 'utf-8'));
    const words = data.words || [];
    
    // 构建 DFA
    if (this.options.DFA) {
      this.dfa = new DFAMatcher();
      
      // 按分类添加词
      const categorized = {};
      for (const word of words) {
        let riskLevel = 'MEDIUM';
        // 这里简化处理，实际应该从分类信息获取
        categorized[word] = { category: 'default', riskLevel };
        this.dfa.addPattern(word, 'default', riskLevel);
      }
      
      this.dfa.build();
      console.log('DFA built with ' + this.dfa.words.size + ' patterns');
    }
    
    this.lexiconWords = words;
    console.log('Lexicon loaded: ' + words.length + ' words');
  }

  /**
   * 加载分类词库
   */
  loadCategorizedLexicon(categoryLexiconPath) {
    console.log('Loading categorized lexicon...');
    const data = JSON.parse(fs.readFileSync(categoryLexiconPath, 'utf-8'));
    
    this.dfa = new DFAMatcher();
    this.categoryWords = {};
    
    for (const [category, info] of Object.entries(data.categories || {})) {
      const words = info.words || [];
      this.categoryWords[category] = words;
      
      let riskLevel = 'MEDIUM';
      if (CONFIG.CATEGORIES.HIGH_RISK.includes(category)) riskLevel = 'HIGH';
      else if (CONFIG.CATEGORIES.LOW_RISK.includes(category)) riskLevel = 'LOW';
      
      for (const word of words) {
        this.dfa.addPattern(word, category, riskLevel);
      }
    }
    
    this.dfa.build();
    console.log('Categorized DFA built');
    
    // 统计
    let total = 0;
    for (const words of Object.values(this.categoryWords)) {
      total += words.length;
    }
    console.log('Total words: ' + total);
  }

  /**
   * 同步检测（快速）
   */
  checkSync(text) {
    this.stats.total++;
    const result = { safe: true, riskLevel: null, score: 0, matches: [], message: '' };

    // ① DFA 极速过滤
    if (this.options.DFA && this.dfa) {
      const matches = this.dfa.search(text);
      if (matches.length > 0) {
        result.safe = false;
        result.matches = matches.map(m => ({
          word: m.word,
          category: m.category,
          riskLevel: m.riskLevel,
          position: m.position
        }));
        
        // 计算最高风险等级
        const levels = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        result.riskLevel = result.matches.reduce((max, m) => 
          (levels[m.riskLevel] || 2) > (levels[max] || 2) ? m.riskLevel : max, 'LOW');
        
        result.score = Math.min(result.matches.length * 20 + 30, 100);
      }
    }

    // ② 变体检测
    if (!result.safe && this.options.VARIANT) {
      // 变体检测在 normalize 层已经处理
    }

    if (result.safe) {
      this.stats.byLevel.SAFE++;
    } else {
      this.stats.byLevel[result.riskLevel]++;
    }

    return result;
  }

  /**
   * 异步检测（完整，含语义分析）
   */
  async check(text) {
    const syncResult = this.checkSync(text);
    
    // 如果安全且配置只匹配时分析，则跳过
    if (syncResult.safe && this.options.SEMANTIC_ONLY_ON_MATCH) {
      return { ...syncResult, semantic: null };
    }

    // ③ 语义分析
    if (this.options.SEMANTIC) {
      const matchedWords = syncResult.matches.map(m => m.word);
      const [classification, riskScore, intent] = await Promise.all([
        this.semanticAnalyzer.classify(text),
        this.semanticAnalyzer.scoreRisk(text, matchedWords),
        this.semanticAnalyzer.detectIntent(text)
      ]);

      // 综合评分
      const semanticScore = riskScore.score || 0;
      const finalScore = Math.max(syncResult.score, semanticScore);
      
      // 确定最终风险等级
      let finalLevel = syncResult.riskLevel;
      if (semanticScore > syncResult.score) {
        finalLevel = semanticScore >= CONFIG.THRESHOLDS.HIGH ? 'HIGH' 
                   : semanticScore >= CONFIG.THRESHOLDS.MEDIUM ? 'MEDIUM' : 'LOW';
      }

      return {
        ...syncResult,
        score: finalScore,
        riskLevel: finalLevel,
        semantic: {
          classification,
          riskScore,
          intent,
          provider: this.semanticAnalyzer.provider?.name
        },
        message: this.getMessage(finalScore, finalLevel)
      };
    }

    return { ...syncResult, message: this.getMessage(syncResult.score, syncResult.riskLevel) };
  }

  /**
   * 批量检测
   */
  async checkBatch(texts, options = {}) {
    const results = [];
    const concurrency = options.concurrency || 5;
    const delay = options.delay || 500;

    for (let i = 0; i < texts.length; i += concurrency) {
      const batch = texts.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(t => this.check(t)));
      results.push(...batchResults);
      
      if (i + concurrency < texts.length) {
        await new Promise(r => setTimeout(r, delay));
      }
      
      if (options.onProgress) {
        options.onProgress(Math.min(i + concurrency, texts.length), texts.length);
      }
    }

    return results;
  }

  /**
   * 获取处理建议
   */
  getMessage(score, level) {
    if (score >= 80) return '内容违规，建议拦截';
    if (score >= 50) return '内容可疑，建议人工审核';
    if (score > 0) return '内容低风险，可警告处理';
    return '内容安全';
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.total > 0 ? (this.stats.hit / this.stats.total * 100).toFixed(2) + '%' : '0%'
    };
  }
}

// ============ CLI 测试 ============

async function main() {
  const filter = new ContentFilter();
  
  // 加载词库
  const lexiconPath = path.join(__dirname, '../dist/lexicon-full.json');
  if (fs.existsSync(lexiconPath)) {
    filter.loadLexicon(lexiconPath);
  }

  // 测试用例
  const tests = [
    '这是一段正常文本',
    '测试敏感词共产党',
    '测试变体中*共',
    '混合内容包含一些特殊情况'
  ];

  console.log('\n--- Testing Content Filter ---\n');
  
  for (const text of tests) {
    console.log('Input: ' + text);
    const result = await filter.check(text);
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('');
  }

  console.log('\n--- Stats ---');
  console.log(filter.getStats());
}

// 运行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ContentFilter, CONFIG };
