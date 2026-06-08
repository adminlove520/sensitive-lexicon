/**
 * MiniMax Anthropic API 客户端
 * 
 * Endpoint: https://api.minimaxi.com/anthropic/v1/messages
 * Model: MiniMax-M2.7
 * 
 * Anthropic 兼容格式
 */

const axios = require('axios');

// MiniMax Anthropic API 配置
const CONFIG = {
  baseUrl: 'https://api.minimaxi.com/anthropic/v1',
  model: 'MiniMax-M2.7',
  keyEnv: 'MINIMAX_API_KEY'
};

// 错误码
const ERRORS = {
  400: '参数格式错误',
  401: 'API Key 无效',
  403: '权限不足',
  422: '参数错误或模型不存在',
  1027: '内容安全拦截',
  429: '请求过于频繁',
  500: '服务器错误',
  503: '服务不可用'
};

class MiniMaxClient {
  constructor() {
    this.apiKey = process.env[CONFIG.keyEnv];
    this.maxRetries = 2;
    this.retryCount = 0;
  }

  isConfigured() {
    return this.apiKey && this.apiKey.length > 10;
  }

  /**
   * 发送消息 (Anthropic 格式)
   */
  async chat(prompt, options = {}) {
    const { temperature = 0.7, max_tokens = 4096 } = options;

    if (!this.isConfigured()) {
      return { success: false, error: 'API Key 未配置', fallback: true };
    }

    try {
      const resp = await axios.post(
        CONFIG.baseUrl + '/messages',
        {
          model: CONFIG.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: max_tokens,
          temperature: temperature
        },
        {
          headers: {
            'Authorization': 'Bearer ' + this.apiKey,
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey
          },
          timeout: 60000  // M2.7 可能需要更长时间
        }
      );

      this.retryCount = 0;
      return {
        success: true,
        content: resp.data.content?.[0]?.text || resp.data.choices?.[0]?.message?.content,
        model: CONFIG.model,
        usage: resp.data.usage
      };

    } catch (error) {
      const status = error.response?.status;
      const errorInfo = error.response?.data?.error || error.response?.data?.base_resp;
      const msg = errorInfo?.msg || errorInfo?.message || error.message;

      console.log('  API Error [' + status + ']: ' + (ERRORS[status] || msg));

      // 1027 内容安全 - 本地降级
      if (errorInfo?.code === 1027 || msg.includes('1027') || msg.includes('new_sensitive')) {
        return { success: false, error: '内容安全限制', code: 1027, fallback: true };
      }

      // 422 - 重试
      if (status === 422 && this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log('  重试中...');
        return await this.chat(prompt, options);
      }

      return { success: false, error: msg, code: status, fallback: true };
    }
  }

  /**
   * 文本补全 (Streaming)
   */
  async completeStream(prompt, options = {}) {
    if (!this.isConfigured()) {
      return { success: false, error: 'API Key 未配置', fallback: true };
    }

    try {
      const resp = await axios.post(
        CONFIG.baseUrl + '/messages',
        {
          model: CONFIG.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          stream: true
        },
        {
          headers: {
            'Authorization': 'Bearer ' + this.apiKey,
            'Content-Type': 'application/json'
          },
          responseType: 'stream',
          timeout: 120000
        }
      );

      return { success: true, stream: resp.data };

    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.error?.msg || error.message;
      
      if (error.response?.data?.error?.code === 1027) {
        return { success: false, error: '内容安全限制', code: 1027, fallback: true };
      }

      return { success: false, error: msg, code: status, fallback: true };
    }
  }
}

// 测试
async function test() {
  const client = new MiniMaxClient();
  
  console.log('MiniMax M2.7 API Client\n');
  console.log('API Key 配置:', client.isConfigured() ? '是' : '否');
  console.log('Model:', CONFIG.model);
  console.log('Endpoint:', CONFIG.baseUrl + '/messages');
  
  if (client.isConfigured()) {
    console.log('\n测试连接...');
    const result = await client.chat('请简单回复"OK"');
    console.log('结果:', JSON.stringify(result, null, 2));
  }
}

if (require.main === module) {
  test().catch(console.error);
}

module.exports = { MiniMaxClient, CONFIG, ERRORS };
