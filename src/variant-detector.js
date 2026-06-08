/**
 * 变体检测器 - 处理各种敏感词变形手段
 * 
 * 支持的变形类型:
 * 1. Unicode 混淆（形近字、同音字）
 * 2. 零宽字符插入
 * 3. 特殊符号干扰
 * 4. 拼音转换
 * 5. 数字/字母谐音
 * 6. 拆字/组合
 */

const fs = require('fs');
const path = require('path');

// ============ 字符映射表 ============

// 形近字映射
const SIMILAR_CHARS = {
  '党': '挡', '共': '供', '国': '裹', '导': '道',
  '领': '另', '中': '种', '人': '入', '大': '太',
  '民': '皿', '主': '炢', '席': '习', '近': '进',
  '平': '苹', '和': '合', '政': '正', '治': '治',
  '爆': '报', '恐': '孔', '枪': '仓', '亡': '芒'
};

// 同音字/近似音映射
const HOMOPHONE_MAP = {
  '中': ['种', '重', '终'], '共': ['供', '公', '工'],
  '党': ['挡', '当'], '国': ['裹', '过'],
  '领': ['另', '领'], '导': ['道', '到'],
  '人': ['人', '仁'], '大': ['大', '达', '打'],
  '我': ['我', '沃'], '你': ['你', '妮'],
  '他': ['他', '她', '它'], '是': ['是', '时']
};

// 数字谐音
const NUMBER_HOMOPHONES = {
  '一': ['1', '幺', '伊'], '二': ['2', '爱'],
  '三': ['3', '散', '山'], '四': ['4', '死', '似'],
  '五': ['5', '我', '午'], '六': ['6', '溜'],
  '七': ['7', '七', '期'], '八': ['8', '八', '发'],
  '九': ['9', '久', '纠'], '零': ['0', '零', '灵']
};

// 零宽字符列表
const ZERO_WIDTH_CHARS = [
  '​',  // Zero Width Space
  '‌',  // Zero Width Non-Joiner
  '‍',  // Zero Width Joiner
  '﻿',  // Zero Width No-Break Space
  '᠎',  // Mongolian Vowel Separator
  '‎',  // Left-to-Right Mark
  '‏',  // Right-to-Left Mark
  ' ',  // Line Separator
  ' ',  // Paragraph Separator
];

// 特殊符号（用于插入干扰）
const SPECIAL_SYMBOLS = ['*', '-', '.', '·', '×', '#', '@', '!', '~', '+', '=', '_', ':', ';', ','];

// ============ 变体检测器类 ============

class VariantDetector {
  constructor() {
    this.normalizedCache = new Map();
  }

  /**
   * 标准化文本（移除变体干扰）
   */
  normalize(text) {
    if (this.normalizedCache.has(text)) {
      return this.normalizedCache.get(text);
    }

    let normalized = text;

    // 1. 移除零宽字符
    for (const zwc of ZERO_WIDTH_CHARS) {
      normalized = normalized.replace(new RegExp(zwc, 'g'), '');
    }

    // 2. 移除常见干扰符号
    normalized = normalized.replace(/[\s*#@!~+=\-_:,;.]/g, '');

    // 3. 统一全角半角
    normalized = this.toHalfWidth(normalized);

    // 4. 统一大小写（对英文）
    normalized = normalized.toLowerCase();

    // 5. 移除重复字符（可选）
    // normalized = normalized.replace(/(.)\1+/g, '$1');

    this.normalizedCache.set(text, normalized);
    return normalized;
  }

  /**
   * 全角转半角
   */
  toHalfWidth(text) {
    return text.replace(/[！-～]/g, (char) => {
      const code = char.charCodeAt(0);
      return String.fromCharCode(code - 0xFEE0);
    }).replace(/　/g, ' ');
  }

  /**
   * 生成变体模式（用于检测）
   */
  generateVariantPatterns(word) {
    const patterns = new Set();

    // 原始词
    patterns.add(word);

    // 标准化后的词
    patterns.add(this.normalize(word));

    // 1. 字符拆分模式
    for (let i = 1; i < word.length; i++) {
      const pattern = word.slice(0, i) + '.' + word.slice(i);
      patterns.add(pattern);
    }

    // 2. 任意位置插入单字符
    for (let i = 0; i <= word.length; i++) {
      const pattern = word.slice(0, i) + '.' + word.slice(i);
      patterns.add(pattern);
    }

    // 3. 首字母大写（对拼音）
    if (/^[a-z]+$/i.test(word)) {
      patterns.add(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
      patterns.add(word.toUpperCase());
    }

    // 4. 零宽字符插入
    const zwc = '​'; // Zero Width Space
    for (let i = 0; i <= word.length; i++) {
      patterns.add(word.slice(0, i) + zwc + word.slice(i));
    }

    // 5. 形近字替换
    for (const [original, similar] of Object.entries(SIMILAR_CHARS)) {
      if (word.includes(original)) {
        patterns.add(word.replace(original, similar));
        patterns.add(word.replace(new RegExp(original, 'g'), similar));
      }
    }

    // 6. 数字谐音
    let numReplaced = word;
    for (const [cn, nums] of Object.entries(NUMBER_HOMOPHONES)) {
      for (const num of nums) {
        if (numReplaced.includes(cn)) {
          numReplaced = numReplaced.replace(new RegExp(cn, 'g'), num);
        }
      }
    }
    if (numReplaced !== word) {
      patterns.add(numReplaced);
    }

    return Array.from(patterns);
  }

  /**
   * 检测文本中的变体
   */
  detectVariants(text, knownWords) {
    const normalized = this.normalize(text);
    const results = [];

    for (const word of knownWords) {
      // 精确匹配
      if (normalized.includes(word)) {
        results.push({ word, type: 'exact', normalized: this.normalize(word) });
        continue;
      }

      // 检查变体模式
      const variants = this.generateVariantPatterns(word);
      for (const variant of variants) {
        if (normalized.includes(variant)) {
          results.push({ word, type: 'variant', variant, normalized: this.normalize(word) });
          break;
        }
      }
    }

    return results;
  }

  /**
   * 相似度检测（用于模糊匹配）
   */
  similarity(text1, text2) {
    const t1 = this.normalize(text1);
    const t2 = this.normalize(text2);

    if (t1 === t2) return 1.0;
    if (t1.length === 0 || t2.length === 0) return 0;

    // 计算编辑距离
    const distance = this.levenshteinDistance(t1, t2);
    const maxLen = Math.max(t1.length, t2.length);

    return 1 - distance / maxLen;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2[i - 1] === str1[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.normalizedCache.clear();
  }
}

module.exports = { VariantDetector, ZERO_WIDTH_CHARS, SIMILAR_CHARS };
