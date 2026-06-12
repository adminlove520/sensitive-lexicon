/**
 * API 认证中间件
 * 支持多种认证方式
 */

/**
 * 认证结果
 */
export interface AuthResult {
  authenticated: boolean;
  error?: string;
}

/**
 * 认证配置
 */
export interface AuthConfig {
  /** API 密钥列表 */
  apiKeys?: string[];
  /** 是否需要认证 (默认 false) */
  requireAuth?: boolean;
}

/**
 * 全局认证配置
 * 在环境变量中设置 API_KEYS，用逗号分隔
 */
const DEFAULT_API_KEYS = process.env.API_KEYS?.split(',').filter(Boolean) || [];

/**
 * 检查 API 密钥
 */
export function checkApiKey(apiKey?: string): AuthResult {
  // 如果没有配置 API 密钥，则不需要认证
  if (DEFAULT_API_KEYS.length === 0) {
    return { authenticated: true };
  }

  // 检查是否提供了密钥
  if (!apiKey) {
    return {
      authenticated: false,
      error: 'API key is required'
    };
  }

  // 验证密钥
  if (!DEFAULT_API_KEYS.includes(apiKey)) {
    return {
      authenticated: false,
      error: 'Invalid API key'
    };
  }

  return { authenticated: true };
}

/**
 * 从请求头中提取 API 密钥
 */
export function extractApiKey(headers?: Headers): string | undefined {
  if (!headers) return undefined;

  // 支持 Authorization: Bearer <key>
  const authHeader = headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 支持 x-api-key: <key>
  return headers.get('x-api-key') || undefined;
}

/**
 * 验证请求
 */
export function authenticateRequest(headers?: Headers): AuthResult {
  const apiKey = extractApiKey(headers);
  return checkApiKey(apiKey);
}

/**
 * 认证中间件 (用于 Edge Functions)
 */
export function withAuth(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const authResult = authenticateRequest(req.headers);

    if (!authResult.authenticated) {
      return new Response(
        JSON.stringify({
          success: false,
          error: authResult.error || 'Authentication failed',
          code: 'UNAUTHORIZED'
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return handler(req);
  };
}

/**
 * 获取认证状态（用于健康检查）
 */
export function getAuthStatus(): {
  enabled: boolean;
  keysCount: number;
} {
  return {
    enabled: DEFAULT_API_KEYS.length > 0,
    keysCount: DEFAULT_API_KEYS.length
  };
}
