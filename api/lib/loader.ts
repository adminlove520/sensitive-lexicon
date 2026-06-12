/**
 * 词库加载器
 */

import { LexiconData } from './types';
import { lexiconData } from './bundle/lexicon-data';

/**
 * 词库加载器类
 */
export class LexiconLoader {
  private static instance: LexiconLoader;
  private cache: LexiconData | null = null;
  private cacheTime: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): LexiconLoader {
    if (!LexiconLoader.instance) {
      LexiconLoader.instance = new LexiconLoader();
    }
    return LexiconLoader.instance;
  }

  /**
   * 加载词库
   */
  async load(): Promise<LexiconData> {
    const now = Date.now();

    // 检查缓存
    if (this.cache && (now - this.cacheTime) < this.CACHE_TTL) {
      return this.cache;
    }

    try {
      // 尝试从构建时嵌入的数据加载
      const data = await this.loadFromBundle();
      this.cache = data;
      this.cacheTime = now;
      return data;
    } catch (error) {
      console.error('Failed to load lexicon from bundle:', error);
      throw new Error('Failed to load lexicon data');
    }
  }

  /**
   * 从 bundle 加载 (构建时预编译)
   */
  private async loadFromBundle(): Promise<LexiconData> {
    // 直接返回预编译的词库数据
    return lexiconData;
  }

  /**
   * 从 dist 目录加载 (备用方案)
   */
  private async loadFromDist(): Promise<LexiconData> {
    // 在实际的部署中，这个词库会被预加载
    // 这里提供一个默认实现

    try {
      // 在 Node.js 环境中读取文件
      // @ts-ignore - process is available in Node environment
      if (typeof process !== 'undefined' && process.versions?.node) {
        const fs = await import('fs');
        const path = await import('path');
        // @ts-ignore
        const lexiconPath = path.join(process.cwd(), 'dist', 'lexicon-full.json');
        const content = fs.readFileSync(lexiconPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('Could not load from filesystem, using fallback');
    }

    return this.getFallbackLexicon();
  }

  /**
   * 获取降级词库
   */
  private getFallbackLexicon(): LexiconData {
    return {
      version: 'fallback',
      stats: { totalWords: 0, categories: 0 },
      words: [],
      index: {}
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = null;
    this.cacheTime = 0;
  }

  /**
   * 预热缓存
   */
  async warmup(): Promise<void> {
    await this.load();
  }
}

/**
 * 获取词库数据的便捷函数
 */
export async function getLexicon(): Promise<LexiconData> {
  const loader = LexiconLoader.getInstance();
  return loader.load();
}

/**
 * 预热词库缓存
 */
export async function warmupLexicon(): Promise<void> {
  const loader = LexiconLoader.getInstance();
  await loader.warmup();
}
