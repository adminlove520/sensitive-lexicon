/**
 * 批量文本审核 API
 * POST /api/moderate/batch
 */

import { getMatcher } from '../lib/matcher';
import { authenticateRequest } from '../lib/auth';
import { getRateLimiter, extractIdentifier } from '../lib/rate-limit';
import {
  ModerateBatchRequest,
  ModerateBatchResponse,
  ModerateTextResponse,
  ErrorResponse,
  RiskLevel,
  Suggestion,
  Strictness,
  Category
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

/**
 * 单个文本审核结果
 */
interface TextModerationResult {
  passed: boolean;
  riskLevel: RiskLevel;
  confidence: number;
  matchedWords: Array<{
    word: string;
    category: string;
    position?: [number, number];
  }>;
  suggestion: Suggestion;
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
    let body: ModerateBatchRequest;
    try {
      body = await req.json();
    } catch {
      return json<ErrorResponse>(
        { success: false, error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const { texts, options = {} } = body;

    // 验证输入
    if (!Array.isArray(texts)) {
      return json<ErrorResponse>(
        { success: false, error: 'texts must be an array', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    // 限制批量数量
    if (texts.length > 100) {
      return json<ErrorResponse>(
        { success: false, error: 'maximum 100 texts per batch', code: 'TOO_MANY_TEXTS' },
        { status: 400 }
      );
    }

    // 验证每个文本
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (typeof text !== 'string') {
        return json<ErrorResponse>(
          { success: false, error: `text at index ${i} is not a string`, code: 'INVALID_INPUT' },
          { status: 400 }
        );
      }
      if (text.length > 10000) {
        return json<ErrorResponse>(
          { success: false, error: `text at index ${i} is too long (max 10000 characters)`, code: 'TEXT_TOO_LONG' },
          { status: 400 }
        );
      }
    }

    // 获取匹配器
    const matcher = await getMatcher();

    // 设置严格度
    if (options.strictness) {
      matcher.setStrictness(options.strictness);
    }

    // 批量处理
    const results: TextModerationResult[] = [];

    for (const text of texts) {
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

      results.push({
        passed: riskLevel === 'none',
        riskLevel,
        confidence,
        matchedWords: options.returnMatches ? matches : [],
        suggestion
      });
    }

    // 计算汇总统计
    const summary = {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      blocked: results.filter(r => r.suggestion === 'block').length,
      review: results.filter(r => r.suggestion === 'review').length
    };

    // 返回结果
    return json<ModerateBatchResponse>({
      success: true,
      data: {
        results,
        summary
      }
    });

  } catch (error) {
    console.error('Batch moderation error:', error);
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
