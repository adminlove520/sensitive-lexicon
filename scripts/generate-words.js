/**
 * AI 生成新词脚本
 * 
 * 功能：
 * 1. 读取现有词库
 * 2. 调用 MiniMax M2.7 API 生成变体
 * 3. 输出到待审核文件
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 配置
const CATEGORIES = {
  HIGH_RISK: ['政治类型', '暴恐词库', '涉枪涉爆', '反动词库'],
  MEDIUM_RISK: ['广告类型', '民生词库', 'GFW补充词库'],
  LOW_RISK: ['COVID-19词库', '网易前端过滤敏感词库']
};

const VOCABULARY_DIR = path.join(__dirname, '../Vocabulary');
const OUTPUT_DIR = path.join(__dirname, '../.generated');

/**
 * 读取词库文件
 */
function readLexicon(category) {
  const filePath = path.join(VOCABULARY_DIR, `${category}.txt`);
  if (!fs.existsSync(filePath)) {
    console.log(`文件不存在: ${filePath}`);
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').filter(line => line.trim());
}

/**
 * 调用 MiniMax M2.7 API 生成变体
 */
async function generateVariants(words, category) {
  console.log(`为 ${category} 生成变体...`);
  
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY not set');
  }
  
  // 取前 20 个词作为示例（避免 token 超限）
  const sampleWords = words.slice(0, 20);
  
  const prompt = `你是一个敏感词变体生成专家。给定以下敏感词列表，请生成它们的常见变体。

原始词：${sampleWords.join(', ')}

生成规则：
1. 拼音变体：如 "北京" → "beijing"
2. 形近字：如 "习近平" → "习近评"
3. 分散写法：如 "主席" → "主 席"
4. 符号插入：如 "中共" → "中*共"
5. 部分遮蔽：如 "江泽民" → "江*民"

请以 JSON 数组格式输出，只包含新词，不要重复原始词。`;
  
  try {
    const response = await axios.post(
      'https://api.minimax.chat/v1/chat/completions',
      {
        model: 'abab6.5s-chat',
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer *** apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const content = response.data.choices[0].message.content;
    
    // 解析 JSON
    let variants = [];
    try {
      variants = JSON.parse(content);
    } catch (e) {
      // 如果解析失败，尝试提取 JSON
      const match = content.match(/\[.*\]/s);
      if (match) {
        variants = JSON.parse(match[0]);
      }
    }
    
    return [...new Set(variants)]; // 去重
  } catch (error) {
    console.error('AI API 调用失败:', error.message);
    // 降级到规则生成
    return generateRuleBasedVariants(sampleWords);
  }
}

/**
 * 规则生成变体（降级方案）
 */
function generateRuleBasedVariants(words) {
  const variants = [];
  
  for (let word of words) {
    // 规则 1: 字母替换
    if (/[a-z]/i.test(word)) {
      variants.push(word.replace(/[a-z]/gi, '*'));
    }
    
    // 规则 2: 插入符号
    if (word.length > 2) {
      variants.push(word.split('').join('*'));
    }
    
    // 规则 3: 部分遮蔽
    if (word.length > 3) {
      variants.push(word.substring(0, 2) + '***');
    }
  }
  
  return [...new Set(variants)];
}

/**
 * 主函数
 */
async function main() {
  // 创建输出目录
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // 处理每个分类
  for (const [riskLevel, categories] of Object.entries(CATEGORIES)) {
    for (const category of categories) {
      console.log(`\n处理分类: ${category} (${riskLevel})`);
      
      // 读取现有词库
      const existingWords = readLexicon(category);
      console.log(`现有词数: ${existingWords.length}`);
      
      // 生成变体
      const newWords = await generateVariants(existingWords, category);
      console.log(`生成新词: ${newWords.length}`);
      
      // 输出到待审核文件
      const outputFile = path.join(OUTPUT_DIR, `${category}-pending.json`);
      fs.writeFileSync(outputFile, JSON.stringify({
        category,
        riskLevel,
        existingWordsCount: existingWords.length,
        newWords,
        timestamp: new Date().toISOString()
      }, null, 2));
      
      console.log(`已输出到: ${outputFile}`);
    }
  }
  
  console.log('\n✅ 生成完成！');
}

// 运行
main().catch(console.error);
