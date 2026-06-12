/**
 * 文本匹配引擎
 */

import { LexiconData, MatchResult, MatchOptions, Category, RiskLevel, Suggestion, Strictness } from './types';
import { getLexicon } from './loader';

/**
 * 严格度配置
 */
interface StrictnessConfig {
  /** 高风险分类阈值 */
  highRiskThreshold: number;
  /** 中风险阈值 */
  mediumRiskThreshold: number;
  /** 是否需要高风险分类才触发 */
  requireHighRiskCategory: boolean;
}

/**
 * 严格度配置映射
 */
const STRICTNESS_CONFIGS: Record<Strictness, StrictnessConfig> = {
  low: {
    highRiskThreshold: 5,
    mediumRiskThreshold: 3,
    requireHighRiskCategory: false
  },
  medium: {
    highRiskThreshold: 3,
    mediumRiskThreshold: 2,
    requireHighRiskCategory: false
  },
  high: {
    highRiskThreshold: 1,
    mediumRiskThreshold: 1,
    requireHighRiskCategory: true
  }
};

/**
 * 高风险分类
 */
const HIGH_RISK_CATEGORIES = new Set<string>([
  '政治',
  '暴恐',
  'COVID-19词库',
  '政治类型',
  '涉政'
]);

/**
 * 文本匹配器类
 */
export class TextMatcher {
  private lexicon: Map<number, string[]> = new Map();
  private categoryMap: Map<string, string[]> = new Map();
  private initialized = false;
  private currentStrictness: Strictness = 'medium';

  /**
   * 初始化匹配器
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    const data = await getLexicon();

    // 构建长度索引
    for (const [length, words] of Object.entries(data.index)) {
      this.lexicon.set(parseInt(length, 10), words);
    }

    // 加载分类映射
    await this.loadCategoryMap();

    this.initialized = true;
  }

  /**
   * 加载分类映射
   */
  private async loadCategoryMap(): Promise<void> {
    try {
      // 动态导入分类数据
      const { wordCategoryMap } = await import('./bundle/lexicon-data');
      for (const [word, categories] of Object.entries(wordCategoryMap)) {
        this.categoryMap.set(word, categories);
      }
    } catch (error) {
      console.warn('无法加载分类映射，使用默认值');
      // 使用默认分类
      for (const words of this.lexicon.values()) {
        for (const word of words) {
          if (!this.categoryMap.has(word)) {
            this.categoryMap.set(word, ['其他']);
          }
        }
      }
    }
  }

  /**
   * 设置严格度
   */
  setStrictness(strictness: Strictness): void {
    this.currentStrictness = strictness;
  }

  /**
   * 获取当前严格度配置
   */
  private getStrictnessConfig(): StrictnessConfig {
    return STRICTNESS_CONFIGS[this.currentStrictness];
  }

  /**
   * 匹配文本中的敏感词
   */
  match(text: string, options: MatchOptions = {}): MatchResult[] {
    if (!this.initialized) {
      throw new Error('Matcher not initialized. Call init() first.');
    }

    const results: MatchResult[] = [];
    const { categories, returnPosition = true } = options;

    // 按长度从长到短匹配，优先匹配更长的词
    const lengths = Array.from(this.lexicon.keys()).sort((a, b) => b - a);

    for (const length of lengths) {
      const words = this.lexicon.get(length);
      if (!words) continue;

      for (let i = 0; i <= text.length - length; i++) {
        const substring = text.slice(i, i + length);
        const matched = this.findMatch(substring, words);

        if (matched && this.shouldInclude(matched, categories)) {
          // 检查是否已经被更长的匹配覆盖
          const isOverlapped = results.some(r =>
            r.position &&
            r.position[0] <= i &&
            r.position[1] >= i + length
          );

          if (!isOverlapped) {
            const wordCategories = this.categoryMap.get(matched) || ['其他'];
            results.push({
              word: matched,
              category: wordCategories[0],
              position: returnPosition ? [i, i + length] : undefined
            });
          }
        }
      }
    }

    // 按位置排序
    if (returnPosition) {
      results.sort((a, b) => (a.position?.[0] || 0) - (b.position?.[0] || 0));
    }

    return results;
  }

  /**
   * 查找匹配（支持模糊匹配）
   */
  private findMatch(text: string, words: string[]): string | null {
    // 精确匹配
    if (words.includes(text)) return text;

    // 模糊匹配（带 * 和 + 的词）
    for (const word of words) {
      if (this.fuzzyMatch(text, word)) return word;
    }

    return null;
  }

  /**
   * 模糊匹配逻辑
   * 支持：
   * - * 通配符 (匹配任意字符)
   * - + 通配符 (匹配空格或无)
   */
  private fuzzyMatch(text: string, pattern: string): boolean {
    // 处理 + 号 (匹配空格或无)
    const normalizedPattern = pattern.replace(/\+/g, ' *?');

    // 处理 * 号 (匹配任意字符)
    const regexStr = '^' + normalizedPattern.replace(/\*/g, '.') + '$';

    try {
      const regex = new RegExp(regexStr);
      return regex.test(text);
    } catch {
      return false;
    }
  }

  /**
   * 判断是否应该包含此匹配结果
   */
  private shouldInclude(word: string, categories?: string[]): boolean {
    if (!categories || categories.length === 0) return true;

    const wordCategories = this.categoryMap.get(word) || [];
    return categories.some(c => wordCategories.includes(c));
  }

  /**
   * 判断是否为高风险分类
   */
  private isHighRiskCategory(category: string): boolean {
    return HIGH_RISK_CATEGORIES.has(category);
  }

  /**
   * 计算风险等级（考虑严格度）
   */
  calculateRiskLevel(matches: MatchResult[]): RiskLevel {
    if (matches.length === 0) return 'none';

    const config = this.getStrictnessConfig();

    // 检查是否有高风险分类
    const hasHighRiskCategory = matches.some(m =>
      this.isHighRiskCategory(m.category)
    );

    const matchCount = matches.length;

    // 如果配置要求必须有高风险分类
    if (config.requireHighRiskCategory && !hasHighRiskCategory) {
      return matchCount >= config.mediumRiskThreshold ? 'medium' : 'low';
    }

    // 高风险判断
    if (matchCount >= config.highRiskThreshold) return 'high';
    if (hasHighRiskCategory && matchCount >= 1) return 'high';

    // 中风险判断
    if (matchCount >= config.mediumRiskThreshold) return 'medium';

    return 'low';
  }

  /**
   * 计算置信度
   */
  calculateConfidence(matches: MatchResult[]): number {
    if (matches.length === 0) return 1.0;

    // 基于匹配数量和类型计算置信度
    let confidence = 0.7;

    // 匹配越多，置信度越高
    confidence += Math.min(matches.length * 0.05, 0.2);

    // 高风险分类增加置信度
    if (matches.some(m => this.isHighRiskCategory(m.category))) {
      confidence += 0.1;
    }

    // 严格度越高，置信度越高
    const strictnessBonus = {
      low: 0,
      medium: 0.05,
      high: 0.1
    };
    confidence += strictnessBonus[this.currentStrictness];

    return Math.min(confidence, 0.99);
  }

  /**
   * 获取建议操作
   */
  getSuggestion(riskLevel: RiskLevel): Suggestion {
    switch (riskLevel) {
      case 'none':
      case 'low':
        return 'allow';
      case 'medium':
        return 'review';
      case 'high':
        return 'block';
      default:
        return 'block';
    }
  }

  /**
   * 获取所有支持的分类
   */
  getSupportedCategories(): string[] {
    const categories = new Set<string>();
    for (const cats of this.categoryMap.values()) {
      for (const cat of cats) {
        categories.add(cat);
      }
    }
    return Array.from(categories).sort();
  }
}

/**
 * 全局匹配器实例
 */
let globalMatcher: TextMatcher | null = null;

/**
 * 获取匹配器实例
 */
export async function getMatcher(): Promise<TextMatcher> {
  if (!globalMatcher) {
    globalMatcher = new TextMatcher();
    await globalMatcher.init();
  }
  return globalMatcher;
}

/**
 * 重置全局匹配器 (用于测试或热更新)
 */
export function resetMatcher(): void {
  globalMatcher = null;
}
