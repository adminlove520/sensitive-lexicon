/**
 * 统一 API 客户端 - 解决 422 错误
 * 
 * 支持:
 * - MiniMax
 * - DeepSeek
 * - OpenAI
 * 
 * 特性:
 * - 自动模型检测
 * - 重试机制
 * - 完整错误处理
 */

const axios = require('axios');

// API 配置
const PROVIDERS = {
  minimax: {
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    // 有效的模型列表
    models: ['abab6.5s-chat', 'abab6.5-chat', 'abab5.5-chat'],
    defaultModel: 'abab6.5s-chat',
    keyEnv: 'MINIMAX_API_KEY',
    // API 特定参数
    extraParams: {}
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder'],
    defaultModel: 'deepseek-chat',
    keyEnv: 'DEEPSEEK_API_KEY',
    extraParams: {}
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-3.5-turbo', 'gpt-4'],
    defaultModel: 'gpt-3.5-turbo',
    keyEnv: 'OPENAI_API_KEY',
    extraParams: {}
  }
};

// 错误码映射
const ERROR_CODES = {
  400: '请求格式错误',
  401: 'API Key 无效',
  403: '权限不足',
  422: '参数错误（检查模型名）',
  429: '请求过于频繁',
  500: '服务器内部错误',
  503: '服务不可用'
};

class APIClient {
  constructor() {
    this.providers = PROVIDERS;
    this.currentProvider = null;
    this.currentModel = null;
    this.retryCount = 0;
    this.maxRetries = 2;
  }

  /**
   * 获取可用的 provider
   */
  getAvailableProvider() {
    for (const [key, provider] of Object.entries(this.providers)) {
      const apiKey = process.env[provider.keyEnv];
      if (apiKey && apiKey.startsWith('sk-')) {
        return { key, ...provider, apiKey };
      }
    }
    return null;
  }

  /**
   * 测试连接
   */
  async testConnection(provider) {
    try {
      const resp = await axios.post(
        provider.baseUrl + '/chat/completions',
        {
          model: provider.defaultModel,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 10
        },
        {
          headers: {
            'Authorization': 'Bearer ' + provider.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      return { success: true, provider: provider.name };
    } catch (error) {
      const status = error.response?.status;
      const message = ERROR_CODES[status] || error.message;
      return { success: false, provider: provider.name, error: message, status };
    }
  }

  /**
   * 调用 API（带重试）
   */
  async chat(prompt, options = {}) {
    const { forceProvider, forceModel, temperature = 0.7, max_tokens = 2000 } = options;

    // 获取 provider
    let provider;
    if (forceProvider) {
      provider = { ...PROVIDERS[forceProvider], apiKey: process.env[PROVIDERS[forceProvider].keyEnv] };
    } else {
      provider = this.getAvailableProvider();
    }

    if (!provider || !provider.apiKey) {
      return { success: false, error: 'No API key available', fallback: 'local' };
    }

    // 确定模型
    const model = forceModel || provider.defaultModel;

    // 构建请求
    const requestBody = {
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: temperature,
      max_tokens: max_tokens
    };

    try {
      const resp = await axios.post(
        provider.baseUrl + '/chat/completions',
        requestBody,
        {
          headers: {
            'Authorization': 'Bearer ' + provider.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      this.retryCount = 0;
      return {
        success: true,
        provider: provider.name,
        model: model,
        content: resp.data.choices[0].message.content,
        usage: resp.data.usage
      };

    } catch (error) {
      const status = error.response?.status;
      const errorData = error.response?.data;

      // 尝试备用模型
      if (status === 422 && this.retryCount < this.maxRetries) {
        this.retryCount++;
        
        // 尝试其他模型
        for (const altModel of provider.models) {
          if (altModel !== model) {
            console.log(`  Trying model: ${altModel}`);
            return await this.chat(prompt, { ...options, forceModel: altModel });
          }
        }
      }

      // 记录错误
      const errorMessage = ERROR_CODES[status] || error.message;
      console.log(`  API Error [${status}]: ${errorMessage}`);

      // 如果是 MiniMax 1027 或 422，降级到本地
      if (status === 422 || errorData?.error?.code === 1027) {
        return { success: false, error: errorMessage, fallback: 'local' };
      }

      return { success: false, error: errorMessage, status };
    }
  }

  /**
   * 批量调用
   */
  async batchChat(prompts, options = {}) {
    const results = [];
    for (const prompt of prompts) {
      const result = await this.chat(prompt, options);
      results.push(result);
      
      // 限流
      if (prompts.indexOf(prompt) < prompts.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    return results;
  }
}

// 测试
async function test() {
  const client = new APIClient();
  
  console.log('Testing API Client...\n');
  
  // 测试连接
  const provider = client.getAvailableProvider();
  if (provider) {
    console.log('Available provider:', provider.name);
    const testResult = await client.testConnection(provider);
    console.log('Connection test:', testResult);
  } else {
    console.log('No API key configured, using local fallback');
  }
  
  // 测试调用
  console.log('\nTesting chat...');
  const result = await client.chat('你好，请简单回复');
  console.log('Result:', JSON.stringify(result, null, 2));
}

// 运行测试
if (require.main === module) {
  test().catch(console.error);
}

module.exports = { APIClient, PROVIDERS, ERROR_CODES };
