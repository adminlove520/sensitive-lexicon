/**
 * MiniMax API 客户端 - 官方文档配置
 * 
 * Endpoint: https://api.minimax.chat/v1/text/chatcompletion_v2
 * 或新版本: https://api.minimax.chat/v1/chat/completions
 */

const axios = require('axios');

// MiniMax API 配置
const CONFIG = {
  // 官方 endpoint (新版)
  endpoints: [
    'https://api.minimax.chat/v1/text/chatcompletion_v2',
    'https://api.minimax.chat/v1/chat/completions'
  ],
  // 有效模型
  models: [
    { name: 'abab6.5s-chat', desc: '快速版' },
    { name: 'abab6.5-chat', desc: '标准版' },
    { name: 'abab5.5-chat', desc: '备用版' }
  ],
  defaultModel: 'abab6.5s-chat',
  keyEnv: 'MINIMAX_API_KEY'
};

// 错误码
const ERRORS = {
  400: '参数格式错误',
  401: 'API Key 无效',
  403: '权限不足',
  422: '模型不存在或参数错误',
  1027: '内容安全拦截',
  429: '请求过于频繁',
  500: '服务器错误',
  503: '服务不可用'
};

class MiniMaxClient {
  constructor() {
    this.apiKey = process.env[CONFIG.keyEnv];
    this.currentEndpoint = CONFIG.endpoints[0];
    this.model = CONFIG.defaultModel;
    this.retryCount = 0;
    this.maxRetries = 2;
  }

  isConfigured() {
    return this.apiKey && this.apiKey.startsWith('sk-');
  }

  /**
   * 尝试不同的 endpoint
   */
  async tryEndpoints(requestBody) {
    for (const endpoint of CONFIG.endpoints) {
      try {
        const resp = await axios.post(
          endpoint,
          requestBody,
          {
            headers: {
              'Authorization': 'Bearer ' + this.apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
        this.currentEndpoint = endpoint;
        return { success: true, data: resp.data, endpoint };
      } catch (error) {
        const status = error.response?.status;
        if (status === 422) {
          console.log('  Endpoint ' + endpoint + ' 返回 422，尝试下一个...');
          continue;
        }
        throw error;
      }
    }
    throw new Error('所有 endpoint 都失败');
  }

  /**
   * 发送聊天请求
   */
  async chat(prompt, options = {}) {
    const { temperature = 0.7, max_tokens = 2000, model } = options;

    if (!this.isConfigured()) {
      return { success: false, error: 'API Key 未配置', fallback: true };
    }

    const useModel = model || CONFIG.defaultModel;
    const requestBody = {
      model: useModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: temperature,
      max_tokens: max_tokens
    };

    try {
      const resp = await this.tryEndpoints(requestBody);
      this.retryCount = 0;
      
      const content = resp.data.choices?.[0]?.message?.content 
                   || resp.data.choices?.[0]?.text;
      
      return {
        success: true,
        content: content,
        model: useModel,
        endpoint: resp.endpoint,
        usage: resp.data.usage
      };

    } catch (error) {
      const status = error.response?.status;
      const errorInfo = error.response?.data?.base_resp || error.response?.data?.error;
      const msg = errorInfo?.msg || errorInfo?.message || error.message;

      console.log('  API Error [' + status + ']: ' + (ERRORS[status] || msg));

      // 422 - 尝试其他模型
      if (status === 422 && this.retryCount < this.maxRetries) {
        this.retryCount++;
        for (const m of CONFIG.models) {
          if (m.name !== useModel) {
            console.log('  尝试模型: ' + m.name + ' (' + m.desc + ')');
            return await this.chat(prompt, { ...options, model: m.name });
          }
        }
      }

      // 1027 内容安全
      if (errorInfo?.code === 1027 || msg.includes('1027') || msg.includes('new_sensitive')) {
        return { success: false, error: '内容安全限制', code: 1027, fallback: true };
      }

      return { success: false, error: msg, code: status };
    }
  }
}

// 测试
async function test() {
  const client = new MiniMaxClient();
  
  console.log('MiniMax API Client\n');
  console.log('API Key 配置:', client.isConfigured() ? '是' : '否');
  console.log('可用模型:', CONFIG.models.map(m => m.name).join(', '));
  
  if (client.isConfigured()) {
    console.log('\n测试连接...');
    const result = await client.chat('请回复"OK"');
    console.log('结果:', JSON.stringify(result, null, 2));
  }
}

if (require.main === module) {
  test().catch(console.error);
}

module.exports = { MiniMaxClient, CONFIG, ERRORS };
