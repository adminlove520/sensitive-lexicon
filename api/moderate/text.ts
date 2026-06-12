/**
 * 文本审核 API
 * POST /api/moderate/text
 */

import { getMatcher } from '../lib/matcher';
import { resultCache } from '../lib/cache';
import { authenticateRequest } from '../lib/auth';
import { getRateLimiter, extractIdentifier } from '../lib/rate-limit';
import {
  ModerateTextRequest,
  ModerateTextResponse,
  ErrorResponse,
  RiskLevel,
  Suggestion
} from '../lib/types';

/**
 * Edge Request/Response 类型
 */
interface EdgeRequest {
  method: string;
  json(): Promise<any>;
  headers?: Headers;
}

interface EdgeResponseInit {
  status?: number;
  headers?: Record<string, string>;
}

interface EdgeResponse {
  json(data: any, init?: EdgeResponseInit): Response;
}

/**
 * 处理 POST 请求
 */
export default async function handler(req: EdgeRequest): Promise<Response> {
  // 只允许 POST
  if (req.method !== 'POST') {
    return json<ErrorResponse>(
      { success: false, error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
      { status: 405 }
    );
  }

  // 验证 API 密钥
  const authResult = authenticateRequest(req.headers);
  if (!authResult.authenticated) {
    return json<ErrorResponse>(
      { success: false, error: authResult.error || 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  // 检查速率限制
  const apiKey = req.headers?.get('x-api-key') || undefined;
  const identifier = extractIdentifier(req.headers, apiKey);
  const rateLimitResult = getRateLimiter().check(identifier);

  if (!rateLimitResult.allowed) {
    return json<ErrorResponse>(
      {
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.resetTime)
        }
      }
    );
  }

  try {
    // 解析请求体
    let body: ModerateTextRequest;
    try {
      body = await req.json();
    } catch {
      return json<ErrorResponse>(
        { success: false, error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const { text, options = {} } = body;

    // 验证输入
    if (!text || typeof text !== 'string') {
      return json<ErrorResponse>(
        { success: false, error: 'text is required and must be a string', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    // 限制文本长度
    if (text.length > 10000) {
      return json<ErrorResponse>(
        { success: false, error: 'text too long (max 10000 characters)', code: 'TEXT_TOO_LONG' },
        { status: 400 }
      );
    }

    // 检查缓存
    const cached = resultCache.get(text, options);
    if (cached) {
      return json<ModerateTextResponse>({
        success: true,
        data: {
          passed: cached.riskLevel === 'none',
          riskLevel: cached.riskLevel as RiskLevel,
          confidence: cached.confidence,
          matchedWords: options.returnMatches ? cached.matches : [],
          suggestion: cached.suggestion as Suggestion
        }
      });
    }

    // 获取匹配器
    const matcher = await getMatcher();

    // 设置严格度
    if (options.strictness) {
      matcher.setStrictness(options.strictness);
    }

    // 执行匹配
    const matches = matcher.match(text, {
      categories: options.categories,
      returnPosition: options.returnMatches ?? true
    });

    // 计算风险等级
    const riskLevel = matcher.calculateRiskLevel(matches);

    // 计算置信度
    const confidence = matcher.calculateConfidence(matches);

    // 获取建议
    const suggestion = matcher.getSuggestion(riskLevel);

    // 缓存结果
    resultCache.set(text, {
      matches,
      riskLevel,
      confidence,
      suggestion
    }, options);

    // 返回结果
    return json<ModerateTextResponse>({
      success: true,
      data: {
        passed: riskLevel === 'none',
        riskLevel,
        confidence,
        matchedWords: options.returnMatches ? matches : [],
        suggestion
      }
    });

  } catch (error) {
    console.error('Moderation error:', error);
    return json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * JSON 响应辅助函数
 */
function json<T>(data: T, init: EdgeResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers
    }
  });
}

/**
 * 配置 Edge 路由
 */
export const config = {
  runtime: 'edge'
};
