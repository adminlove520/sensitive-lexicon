/**
 * 内容安全过滤系统 - 统一导出
 * 
 * 使用示例:
 * const { ContentFilter } = require('./src');
 * const filter = new ContentFilter();
 * await filter.loadLexicon('./dist/lexicon-full.json');
 * const result = await filter.check('测试文本');
 */

const { ContentFilter } = require('./content-filter.js');
const { DFAMatcher } = require('./dfa-matcher.js');
const { VariantDetector } = require('./variant-detector.js');
const { SemanticAnalyzer } = require('./semantic-analyzer.js');

module.exports = {
  ContentFilter,
  DFAMatcher,
  VariantDetector,
  SemanticAnalyzer
};
