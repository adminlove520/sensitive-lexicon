/**
 * API 本地测试脚本
 * 用于在 Node.js 环境中测试文本审核功能
 */

const fs = require('fs');
const path = require('path');

// 加载词库
function loadLexicon() {
  const lexiconPath = path.join(__dirname, 'dist', 'lexicon-full.json');
  const content = fs.readFileSync(lexiconPath, 'utf-8');
  return JSON.parse(content);
}

// 简单的匹配器
class SimpleMatcher {
  constructor(lexicon) {
    this.lexicon = new Map();
    for (const [length, words] of Object.entries(lexicon.index)) {
      this.lexicon.set(parseInt(length), words);
    }
  }

  match(text) {
    const results = [];
    const lengths = Array.from(this.lexicon.keys()).sort((a, b) => b - a);

    for (const length of lengths) {
      const words = this.lexicon.get(length);
      if (!words) continue;

      for (let i = 0; i <= text.length - length; i++) {
        const substring = text.slice(i, i + length);

        for (const word of words) {
          if (this.fuzzyMatch(substring, word)) {
            // 检查是否已被覆盖
            const overlapped = results.some(r =>
              r.position[0] <= i && r.position[1] >= i + length
            );
            if (!overlapped) {
              results.push({
                word,
                position: [i, i + length]
              });
              break;
            }
          }
        }
      }
    }

    return results;
  }

  fuzzyMatch(text, pattern) {
    // 处理 + 号 (匹配空格或无)
    const normalizedPattern = pattern.replace(/\+/g, ' *?');
    // 处理 * 号 (匹配任意字符)
    const regexStr = '^' + normalizedPattern.replace(/\*/g, '.') + '$';
    try {
      const regex = new RegExp(regexStr);
      return regex.test(text);
    } catch {
      return false;
    }
  }
}

// 测试用例
const testCases = [
  {
    name: '正常文本',
    text: '这是一段正常的文本内容',
    expectedPassed: true
  },
  {
    name: '包含敏感词',
    text: '这里有一些敏感内容',
    expectedPassed: false
  },
  {
    name: '空文本',
    text: '',
    expectedPassed: true
  },
  {
    name: '长文本',
    text: 'A'.repeat(100),
    expectedPassed: true
  }
];

// 运行测试
function runTests() {
  console.log('=== 加载词库 ===\n');
  const lexicon = loadLexicon();
  console.log(`版本: ${lexicon.version}`);
  console.log(`总词数: ${lexicon.stats.totalWords}\n`);

  console.log('=== 初始化匹配器 ===\n');
  const matcher = new SimpleMatcher(lexicon);

  console.log('=== 运行测试 ===\n');
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`测试: ${testCase.name}`);
    console.log(`文本: "${testCase.text.substring(0, 50)}${testCase.text.length > 50 ? '...' : ''}"`);

    const matches = matcher.match(testCase.text);
    const actualPassed = matches.length === 0;

    console.log(`匹配数: ${matches.length}`);
    if (matches.length > 0) {
      console.log('匹配的词:', matches.map(m => m.word).join(', '));
    }

    const testPassed = actualPassed === testCase.expectedPassed;
    if (testPassed) {
      console.log('✅ 通过');
      passed++;
    } else {
      console.log(`❌ 失败 (期望通过: ${testCase.expectedPassed}, 实际: ${actualPassed})`);
      failed++;
    }
    console.log();
  }

  console.log('=== 测试结果 ===');
  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  console.log(`总计: ${testCases.length}`);

  // 测试一些实际存在的敏感词
  console.log('\n=== 测试已知敏感词 ===');
  const sampleWords = lexicon.words.slice(0, 10);
  for (const word of sampleWords) {
    const testText = `测试${word}内容`;
    const matches = matcher.match(testText);
    console.log(`"${word}" -> 匹配: ${matches.length > 0 ? '✅' : '❌'}`);
  }
}

// 运行
try {
  runTests();
} catch (error) {
  console.error('测试失败:', error);
  process.exit(1);
}
