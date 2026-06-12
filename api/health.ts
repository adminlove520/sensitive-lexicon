/**
 * 健康检查 API
 * GET /api/health
 */

import { getLexicon, warmupLexicon } from './lib/loader';

/**
 * Edge Request 类型
 */
interface EdgeRequest {
  method: string;
}

/**
 * 处理 GET 请求
 */
export default async function handler(req: EdgeRequest): Promise<Response> {
  // 只允许 GET
  if (req.method !== 'GET') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 }
    );
  }

  try {
    // 预热词库
    await warmupLexicon();

    // 获取词库信息
    const lexicon = await getLexicon();

    return Response.json({
      success: true,
      data: {
        status: 'healthy',
        version: lexicon.version,
        stats: {
          totalWords: lexicon.stats.totalWords,
          categories: lexicon.stats.categories
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    return Response.json(
      {
        success: false,
        error: 'Service unavailable',
        status: 'unhealthy'
      },
      { status: 503 }
    );
  }
}

/**
 * 配置 Edge 路由
 */
export const config = {
  runtime: 'edge'
};
