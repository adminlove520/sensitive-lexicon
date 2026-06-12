/**
 * 速率限制中间件
 * 基于滑动窗口算法
 */

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 最大请求数 */
  maxRequests: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 分钟
  maxRequests: 100 // 每分钟 100 次
};

/**
 * 速率限制器
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 检查是否超过限制
   */
  check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // 获取该标识符的请求时间戳
    let timestamps = this.requests.get(identifier) || [];

    // 移除窗口外的旧请求
    timestamps = timestamps.filter(t => t > windowStart);

    // 检查是否超过限制
    if (timestamps.length >= this.config.maxRequests) {
      // 找到最早的请求过期时间
      const oldestTimestamp = timestamps[0];
      const resetTime = oldestTimestamp + this.config.windowMs;

      return {
        allowed: false,
        remaining: 0,
        resetTime
      };
    }

    // 添加当前请求
    timestamps.push(now);
    this.requests.set(identifier, timestamps);

    // 计算剩余配额
    const remaining = this.config.maxRequests - timestamps.length;
    const resetTime = now + this.config.windowMs;

    return {
      allowed: true,
      remaining,
      resetTime
    };
  }

  /**
   * 清除某个标识符的记录
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * 清除所有记录
   */
  clear(): void {
    this.requests.clear();
  }

  /**
   * 清理过期记录（定期调用）
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [identifier, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(t => t > windowStart);
      if (validTimestamps.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validTimestamps);
      }
    }
  }
}

/**
 * 全局速率限制器实例
 */
let globalRateLimiter: RateLimiter | null = null;

/**
 * 获取速率限制器实例
 */
export function getRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter(config);
  }
  return globalRateLimiter;
}

/**
 * 从请求中提取标识符（IP 地址或 API 密钥）
 */
export function extractIdentifier(headers?: Headers, apiKey?: string): string {
  // 优先使用 API 密钥
  if (apiKey) {
    return `apikey:${apiKey}`;
  }

  // 使用 IP 地址
  const ip = headers?.get('x-forwarded-for') ||
             headers?.get('x-real-ip') ||
             headers?.get('cf-connecting-ip') ||
             'unknown';

  return `ip:${ip}`;
}

/**
 * 速率限制中间件
 */
export function withRateLimit(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const limiter = getRateLimiter();

    // 提取 API 密钥
    const authHeader = req.headers.get('Authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const apiKeyHeader = req.headers.get('x-api-key');
    const effectiveApiKey = apiKey || apiKeyHeader || undefined;

    const identifier = extractIdentifier(req.headers, effectiveApiKey);

    // 检查速率限制
    const result = limiter.check(identifier);

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          data: {
            resetTime: result.resetTime
          }
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(getRateLimiter()['config'].maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(result.resetTime)
          }
        }
      );
    }

    const response = await handler(req);

    // 添加速率限制头
    response.headers.set('X-RateLimit-Limit', String(getRateLimiter()['config'].maxRequests));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(result.resetTime));

    return response;
  };
}

/**
 * 启动定期清理任务
 */
export function startCleanupTask(intervalMs: number = 5 * 60 * 1000): void {
  setInterval(() => {
    const limiter = getRateLimiter();
    limiter.cleanup();
  }, intervalMs);
}

/**
 * 获取速率限制状态
 */
export function getRateLimitStatus(): {
  enabled: boolean;
  config: RateLimitConfig;
  activeIdentifiers: number;
} {
  const limiter = getRateLimiter();
  return {
    enabled: true,
    config: limiter['config'],
    activeIdentifiers: limiter['requests'].size
  };
}
