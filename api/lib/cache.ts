/**
 * 简单的内存缓存
 * 用于缓存审核结果
 */

import { MatchResult } from './types';

interface CacheEntry {
  matches: MatchResult[];
  riskLevel: string;
  confidence: number;
  suggestion: string;
  timestamp: number;
}

/**
 * 简单的 LRU 缓存
 */
export class ResultCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries = 1000;
  private ttl = 5 * 60 * 1000; // 5分钟

  /**
   * 生成缓存键
   */
  private generateKey(text: string, options?: any): string {
    const optsStr = options ? JSON.stringify(options) : '';
    return `${text}:${optsStr}`;
  }

  /**
   * 简单的文本哈希 (用于缓存)
   */
  private hash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * 获取缓存
   */
  get(text: string, options?: any): CacheEntry | null {
    const key = this.hash(text) + ':' + (options ? JSON.stringify(options) : '');
    const entry = this.cache.get(key);

    if (!entry) return null;

    // 检查过期
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // LRU: 移动到末尾
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry;
  }

  /**
   * 设置缓存
   */
  set(text: string, result: Omit<CacheEntry, 'timestamp'>, options?: any): void {
    const key = this.hash(text) + ':' + (options ? JSON.stringify(options) : '');

    // 检查容量
    if (this.cache.size >= this.maxEntries) {
      // 删除最旧的 (第一个)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      ...result,
      timestamp: Date.now()
    });
  }

  /**
   * 清除缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * 全局缓存实例
 */
export const resultCache = new ResultCache();
