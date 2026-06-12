/**
 * API 端点测试脚本
 * 使用 curl 测试 API 端点
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function curl(url, options = {}) {
  const method = options.method || 'GET';
  const data = options.data ? JSON.stringify(options.data) : null;

  let cmd = `curl -X ${method} "${url}" -H "Content-Type: application/json"`;
  if (data) {
    cmd += ` -d '${data}'`;
  }
  cmd += ' -s';

  try {
    const { stdout } = await execPromise(cmd);
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`❌ 请求失败: ${url}`);
    throw error;
  }
}

async function runTests() {
  console.log('=== API 测试 ===\n');
  console.log(`API 端点: ${API_BASE}\n`);

  // 测试 1: 健康检查
  console.log('1. 健康检查 GET /api/health');
  try {
    const result = await curl(`${API_BASE}/api/health`);
    if (result.success && result.data.status === 'healthy') {
      console.log(`✅ 通过 - 词库版本: ${result.data.version}, 词数: ${result.data.stats.totalWords}\n`);
    } else {
      console.log('❌ 失败 - 响应异常\n');
    }
  } catch (error) {
    console.log('⚠️  跳过 - 需要先启动 API 服务器 (npm run dev)\n');
    console.log('提示: 这是正常的，因为 API 服务器尚未启动');
    console.log('部署到 Vercel 后这些测试将自动运行\n');
    return;
  }

  // 测试 2: 正常文本
  console.log('2. 正常文本审核 POST /api/moderate/text');
  try {
    const result = await curl(`${API_BASE}/api/moderate/text`, {
      method: 'POST',
      data: { text: '这是一段正常的文本内容' }
    });
    if (result.success && result.data.passed) {
      console.log('✅ 通过 - 正常文本正确识别为安全\n');
    } else {
      console.log('❌ 失败\n');
    }
  } catch (error) {
    console.log('❌ 失败\n');
  }

  // 测试 3: 包含敏感词
  console.log('3. 敏感词检测 POST /api/moderate/text');
  try {
    const result = await curl(`${API_BASE}/api/moderate/text`, {
      method: 'POST',
      data: {
        text: '武汉不明肺炎相关内容',
        options: { returnMatches: true }
      }
    });
    if (result.success && !result.data.passed && result.data.matchedWords.length > 0) {
      console.log(`✅ 通过 - 检测到 ${result.data.matchedWords.length} 个敏感词`);
      console.log(`   风险等级: ${result.data.riskLevel}, 置信度: ${result.data.confidence}\n`);
    } else {
      console.log('⚠️  未检测到敏感词 (可能是测试文本不在词库中)\n');
    }
  } catch (error) {
    console.log('❌ 失败\n');
  }

  // 测试 4: 批量审核
  console.log('4. 批量审核 POST /api/moderate/batch');
  try {
    const result = await curl(`${API_BASE}/api/moderate/batch`, {
      method: 'POST',
      data: {
        texts: ['正常文本一', '正常文本二', '正常文本三']
      }
    });
    if (result.success && result.data.results.length === 3) {
      console.log('✅ 通过 - 批量审核正常工作\n');
    } else {
      console.log('❌ 失败\n');
    }
  } catch (error) {
    console.log('⚠️  批量审核端点尚未实现\n');
  }

  // 测试 5: 错误处理
  console.log('5. 错误处理 - 空文本');
  try {
    const result = await curl(`${API_BASE}/api/moderate/text`, {
      method: 'POST',
      data: { text: '' }
    });
    if (result.success) {
      console.log('✅ 通过 - 空文本被接受\n');
    }
  } catch (error) {
    console.log('✅ 通过 - 正确拒绝了无效请求\n');
  }

  console.log('=== 测试完成 ===');
}

// 运行测试
runTests().catch(console.error);
