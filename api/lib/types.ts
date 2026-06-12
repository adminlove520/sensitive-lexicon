/**
 * 类型定义
 */

/**
 * 敏感词分类
 */
export type Category =
  | '政治'
  | '暴恐'
  | '色情'
  | '广告'
  | '辱骂'
  | '违禁'
  | '其他';

/**
 * 风险等级
 */
export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

/**
 * 建议操作
 */
export type Suggestion = 'allow' | 'review' | 'block';

/**
 * 严格度
 */
export type Strictness = 'low' | 'medium' | 'high';

/**
 * 匹配结果
 */
export interface MatchResult {
  /** 匹配的词 */
  word: string;
  /** 分类 */
  category: Category | string;
  /** 位置 [start, end] */
  position?: [number, number];
}

/**
 * 匹配选项
 */
export interface MatchOptions {
  /** 指定分类，空表示全部分类 */
  categories?: Category[];
  /** 是否返回位置 */
  returnPosition?: boolean;
}

/**
 * 词库数据
 */
export interface LexiconData {
  /** 版本 */
  version: string;
  /** 统计信息 */
  stats: {
    totalWords: number;
    categories: number;
  };
  /** 所有词 */
  words: string[];
  /** 按长度分组的索引 */
  index: Record<number, string[]>;
}

/**
 * 文本审核请求
 */
export interface ModerateTextRequest {
  /** 待审核文本 */
  text: string;
  /** 选项 */
  options?: {
    /** 指定分类 */
    categories?: Category[];
    /** 严格度 */
    strictness?: Strictness;
    /** 是否返回匹配的词 */
    returnMatches?: boolean;
    /** 是否启用 AI 增强 */
    aiEnhanced?: boolean;
  };
}

/**
 * 文本审核响应
 */
export interface ModerateTextResponse {
  success: true;
  data: {
    /** 是否通过 */
    passed: boolean;
    /** 风险等级 */
    riskLevel: RiskLevel;
    /** 置信度 (0-1) */
    confidence: number;
    /** 匹配的词 */
    matchedWords: MatchResult[];
    /** 建议 */
    suggestion: Suggestion;
  };
}

/**
 * 批量审核请求
 */
export interface ModerateBatchRequest {
  /** 待审核文本数组 */
  texts: string[];
  /** 选项 */
  options?: ModerateTextRequest['options'];
}

/**
 * 批量审核响应
 */
export interface ModerateBatchResponse {
  success: true;
  data: {
    /** 每个文本的审核结果 */
    results: ModerateTextResponse['data'][];
    /** 汇总统计 */
    summary: {
      total: number;
      passed: number;
      blocked: number;
      review: number;
    };
  };
}

/**
 * API 错误响应
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}
