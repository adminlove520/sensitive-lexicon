/**
 * AI 自动审核脚本
 * 
 * 功能：
 * 1. 读取待审核词库
 * 2. 调用 AI 模型进行审核
 * 3. 过滤误伤词汇
 * 4. 输出审核通过的词库
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const GENERATED_DIR = path.join(__dirname, '../.generated');
const APPROVED_DIR = path.join(__dirname, '../.approved');

/**
 * 检查是否误伤
 * 
 * 规则：
 * 1. 不与常用词相似
 * 2. 不包含无害字符组合
 * 3. 长度合理（2-20 字符）
 */
function checkFalsePositive(word, commonWords) {
  // 规则 1: 长度检查
  if (word.length < 2 || word.length > 20) {
    return true; // 可能误伤
  }
  
  // 规则 2: 检查是否包含常用词
  for (let common of commonWords) {
    if (word.includes(common) || common.includes(word)) {
      return true; // 可能误伤
    }
  }
  
  // 规则 3: 过度模糊
  const asteriskCount = (word.match(/\*/g) || []).length;
  if (asteriskCount > word.length * 0.7) {
    return true; // 太模糊，可能误伤
  }
  
  return false; // 通过检查
}

/**
 * AI 辅助审核（MiniMax M2.7）
 */
async function aiReview(word, category) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    // 降级到规则检查
    return ruleBasedReview(word);
  }
  
  const prompt = `你是一个敏感词审核专家。请判断以下词汇是否应该作为敏感词被屏蔽。

词汇：${word}
分类：${category}

判断标准：
1. 是否真实存在的敏感词？（是 → 通过）
2. 是否是常用词的子串？（是 → 拒绝）
3. 是否过度模糊导致无法识别？（是 → 拒绝）
4. 是否合理变体？（是 → 通过）

请以 JSON 格式输出：{"approved": true/false, "reason": "原因"}`;
  
  try {
    const response = await axios.post(
      'https://api.minimax.chat/v1/chat/completions',
      {
        model: 'abab6.5-chat',  // MiniMax M2.7 对应的模型
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const content = response.data.choices[0].message.content;
    
    // 解析 JSON
    try {
      return JSON.parse(content);
    } catch (e) {
      // 如果解析失败，尝试提取 JSON
      const match = content.match(/\{.*\}/s);
      if (match) {
        return JSON.parse(match[0]);
      }
    }
    
    // 降级到规则检查
    return ruleBasedReview(word);
  } catch (error) {
    console.error('AI API 调用失败:', error.message);
    return ruleBasedReview(word);
  }
}

/**
 * 规则审核（降级方案）
 */
function ruleBasedReview(word) {
  const suspiciousPatterns = [
    /the/, /and/, /for/, /are/, /but/, /not/, /you/, /all/, /can/, /had/
  ];
  
  for (let pattern of suspiciousPatterns) {
    if (pattern.test(word)) {
      return { approved: false, reason: 'Contains common English word' };
    }
  }
  
  return { approved: true, reason: 'Passed rule-based review' };
}

/**
 * 主函数
 */
async function main() {
  // 创建输出目录
  if (!fs.existsSync(APPROVED_DIR)) {
    fs.mkdirSync(APPROVED_DIR, { recursive: true });
  }
  
  // 读取所有待审核文件
  const files = fs.readdirSync(GENERATED_DIR).filter(f => f.endsWith('-pending.json'));
  
  console.log(`找到 ${files.length} 个待审核文件`);
  
  // 读取常用词库
  const commonWordsPath = path.join(__dirname, 'common-words.txt');
  let commonWords = ['的', '了', '和', '是', '在', '我', '有', '就', '不', '人'];
  
  if (fs.existsSync(commonWordsPath)) {
    const content = fs.readFileSync(commonWordsPath, 'utf-8');
    commonWords = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  }
  
  const stats = {
    total: 0,
    approved: 0,
    rejected: 0
  };
  
  for (const file of files) {
    console.log(`\n处理: ${file}`);
    
    const data = JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, file), 'utf-8'));
    const { category, riskLevel, newWords } = data;
    
    const approvedWords = [];
    const rejectedWords = [];
    
    for (let word of newWords) {
      stats.total++;
      
      // 检查误伤
      if (checkFalsePositive(word, commonWords)) {
        rejectedWords.push({ word, reason: 'False positive (common word)' });
        stats.rejected++;
        continue;
      }
      
      // AI 审核
      const review = await aiReview(word, category);
      if (review.approved) {
        approvedWords.push(word);
        stats.approved++;
      } else {
        rejectedWords.push({ word, reason: review.reason });
        stats.rejected++;
      }
    }
    
    // 输出审核结果
    const outputFile = path.join(APPROVED_DIR, `${category}-approved.json`);
    fs.writeFileSync(outputFile, JSON.stringify({
      category,
      riskLevel,
      approvedWords,
      rejectedWords,
      stats: {
        total: newWords.length,
        approved: approvedWords.length,
        rejected: rejectedWords.length,
        approvalRate: (approvedWords.length / newWords.length * 100).toFixed(2) + '%'
      },
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`审核通过: ${approvedWords.length}, 拒绝: ${rejectedWords.length}`);
  }
  
  // 输出总体统计
  console.log('\n=== 总体统计 ===');
  console.log(`总计: ${stats.total}`);
  console.log(`通过: ${stats.approved} (${(stats.approved / stats.total * 100).toFixed(2)}%)`);
  console.log(`拒绝: ${stats.rejected} (${(stats.rejected / stats.total * 100).toFixed(2)}%)`);
  
  console.log('\n✅ 审核完成！');
}

// 运行
main().catch(console.error);
