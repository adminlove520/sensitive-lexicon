/**
 * DFA (Aho-Corasick) 高效多模式匹配器
 * 
 * 特点:
 * - O(n) 时间复杂度（n = 文本长度）
 * - 支持 50,000+ 模式同时匹配
 * - 内存高效、匹配速度快
 */

class DFANode {
  constructor() {
    this.children = new Map();
    this.fail = null;
    this.output = [];  // 匹配的词列表
    this.isEnd = false;
  }
}

class DFAMatcher {
  constructor() {
    this.root = new DFANode();
    this.words = new Map();  // 词 -> 分类信息
  }

  /**
   * 添加模式
   */
  addPattern(word, category = 'default', riskLevel = 'MEDIUM') {
    if (!word || word.length < 2) return;
    
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new DFANode());
      }
      node = node.children.get(char);
    }
    node.isEnd = true;
    node.output.push({ word, category, riskLevel });
    this.words.set(word, { category, riskLevel });
  }

  /**
   * 构建 Fail 指针（KMP 思想）
   */
  build() {
    const queue = [];
    
    // 第一层节点的 fail 指向根
    for (const [char, node] of this.root.children) {
      node.fail = this.root;
      queue.push(node);
    }

    // BFS 构建 fail 指针
    while (queue.length > 0) {
      const current = queue.shift();

      for (const [char, child] of current.children) {
        queue.push(child);

        // 找到 fail 节点
        let fail = current.fail;
        while (fail && !fail.children.has(char)) {
          fail = fail.fail;
        }
        child.fail = fail ? fail.children.get(char) : this.root;

        // 合并输出
        if (child.fail.output.length > 0) {
          child.output = [...child.output, ...child.fail.output];
        }
      }
    }
  }

  /**
   * 搜索匹配
   * @returns Array<{word, category, riskLevel, position}>
   */
  search(text) {
    const results = [];
    let node = this.root;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // 顺着 fail 指针找到可以匹配的节点
      while (node && !node.children.has(char)) {
        node = node.fail;
      }
      node = node ? node.children.get(char) : this.root;

      // 收集所有匹配结果（包括 fail 链上的）
      let temp = node;
      while (temp) {
        for (const match of temp.output) {
          results.push({
            ...match,
            position: i - match.word.length + 1,
            matched: match.word
          });
        }
        temp = temp.fail;
      }
    }

    return results;
  }

  /**
   * 检查是否包含敏感词
   */
  contains(text) {
    return this.search(text).length > 0;
  }

  /**
   * 获取词库统计
   */
  getStats() {
    const categories = {};
    const riskLevels = { HIGH: 0, MEDIUM: 0, LOW: 0, DEFAULT: 0 };

    for (const [word, info] of this.words) {
      const cat = info.category;
      categories[cat] = (categories[cat] || 0) + 1;
      
      const risk = info.riskLevel || 'DEFAULT';
      riskLevels[risk] = (riskLevels[risk] || 0) + 1;
    }

    return {
      totalPatterns: this.words.size,
      categories,
      riskLevels
    };
  }
}

/**
 * 构建 DFA 匹配器
 */
function buildDFA(lexiconData) {
  const matcher = new DFANode();
  const categories = {
    HIGH_RISK: ['政治类型', '暴恐词库', '涉枪涉爆', '反动词库'],
    MEDIUM_RISK: ['广告类型', '民生词库', '贪腐词库', 'GFW补充词库'],
    LOW_RISK: ['色情类型', '色情词库', 'COVID-19词库']
  };

  for (const [category, words] of Object.entries(lexiconData)) {
    let riskLevel = 'MEDIUM';
    if (categories.HIGH_RISK.includes(category)) riskLevel = 'HIGH';
    else if (categories.LOW_RISK.includes(category)) riskLevel = 'LOW';

    for (const word of words) {
      matcher.addPattern(word, category, riskLevel);
    }
  }

  matcher.build();
  return matcher;
}

module.exports = { DFAMatcher, buildDFA };
