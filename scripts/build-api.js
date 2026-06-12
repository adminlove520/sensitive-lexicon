/**
 * API 构建脚本
 * 将词库数据转换为 TypeScript 模块，以便在 Edge Functions 中使用
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '../dist');
const OUTPUT_DIR = path.join(__dirname, '../api/lib/bundle');

console.log('=== 构建 API Bundle ===\n');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 读取词库
const lexiconPath = path.join(DIST_DIR, 'lexicon-full.json');
if (!fs.existsSync(lexiconPath)) {
  console.error('❌ 词库文件不存在，请先运行 npm run build');
  process.exit(1);
}

const lexicon = JSON.parse(fs.readFileSync(lexiconPath, 'utf-8'));
console.log(`✅ 加载词库: ${lexicon.stats.totalWords} 词`);

// 读取分类词库
const categoryPath = path.join(DIST_DIR, 'lexicon-by-category.json');
let categoryData = null;
let wordCategoryMap = {};

if (fs.existsSync(categoryPath)) {
  categoryData = JSON.parse(fs.readFileSync(categoryPath, 'utf-8'));
  console.log(`✅ 加载分类词库: ${Object.keys(categoryData.categories).length} 分类`);

  // 构建词到分类的映射
  for (const [category, words] of Object.entries(categoryData.categories)) {
    for (const word of words) {
      if (!wordCategoryMap[word]) {
        wordCategoryMap[word] = [];
      }
      wordCategoryMap[word].push(category);
    }
  }
  console.log(`✅ 构建分类映射: ${Object.keys(wordCategoryMap).length} 词有分类`);
}

// 生成 TypeScript 模块
const moduleContent = `/**
 * 自动生成的词库数据模块
 * 生成时间: ${new Date().toISOString()}
 * 请勿手动编辑
 */

import { LexiconData } from '../types';

export const lexiconData: LexiconData = ${JSON.stringify(lexicon, null, 2)};

export const categoryData = ${categoryData ? JSON.stringify(categoryData, null, 2) : 'null'};

// 词到分类的映射
export const wordCategoryMap: Record<string, string[]> = ${JSON.stringify(wordCategoryMap, null, 2)};

// 便捷导出
export const version = lexiconData.version;
export const totalWords = lexiconData.stats.totalWords;
export const categoryCount = categoryData ? Object.keys(categoryData.categories).length : 0;
`;

const outputPath = path.join(OUTPUT_DIR, 'lexicon-data.ts');
fs.writeFileSync(outputPath, moduleContent);
console.log(`✅ 写入: ${outputPath}`);

// 更新 loader.ts 使用预编译数据
const loaderPath = path.join(__dirname, '../api/lib/loader.ts');
let loaderContent = fs.readFileSync(loaderPath, 'utf-8');

// 检查是否已更新
if (loaderContent.includes("import { lexiconData } from './bundle/lexicon-data'")) {
  console.log('✅ loader.ts 已配置');
} else {
  // 更新导入
  loaderContent = loaderContent.replace(
    "import { LexiconData } from '../types';",
    "import { LexiconData } from '../types';\nimport { lexiconData } from './bundle/lexicon-data';"
  );

  // 更新 loadFromBundle 方法
  loaderContent = loaderContent.replace(
    /private async loadFromBundle\(\): Promise<LexiconData> \{[\s\S]*?\n  \}/,
    `private async loadFromBundle(): Promise<LexiconData> {
    // 直接返回预编译的词库数据
    return lexiconData;
  }`
  );

  fs.writeFileSync(loaderPath, loaderContent);
  console.log('✅ 更新 loader.ts');
}

console.log('\n=== 构建完成 ===');
console.log('现在可以部署到 Vercel 或运行 npm run dev');
