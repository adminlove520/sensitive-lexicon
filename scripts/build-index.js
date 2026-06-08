/**
 * 构建高效索引
 * 
 * 功能：
 * 1. 合并所有词库
 * 2. 构建倒排索引
 * 3. 生成预处理文件
 */

const fs = require('fs');
const path = require('path');

const VOCABULARY_DIR = path.join(__dirname, '../Vocabulary');
const APPROVED_DIR = path.join(__dirname, '../.approved');
const OUTPUT_DIR = path.join(__dirname, '../dist');

/**
 * 读取所有词库
 */
function readAllLexicons() {
  const words = new Set();
  const categoryMap = new Map();
  
  // 读取现有词库
  const files = fs.readdirSync(VOCABULARY_DIR).filter(f => f.endsWith('.txt'));
  
  for (const file of files) {
    const category = file.replace('.txt', '');
    const filePath = path.join(VOCABULARY_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    for (let word of lines) {
      words.add(word);
      
      if (!categoryMap.has(word)) {
        categoryMap.set(word, []);
      }
      categoryMap.get(word).push(category);
    }
  }
  
  // 读取新审核通过的词
  if (fs.existsSync(APPROVED_DIR)) {
    const approvedFiles = fs.readdirSync(APPROVED_DIR).filter(f => f.endsWith('-approved.json'));
    
    for (const file of approvedFiles) {
      const data = JSON.parse(fs.readFileSync(path.join(APPROVED_DIR, file), 'utf-8'));
      const category = data.category;
      
      for (let word of data.approvedWords) {
        words.add(word);
        
        if (!categoryMap.has(word)) {
          categoryMap.set(word, []);
        }
        categoryMap.get(word).push(category);
      }
    }
  }
  
  return { words: Array.from(words), categoryMap };
}

/**
 * 构建倒排索引（按长度分组）
 */
function buildIndex(words) {
  const index = {};
  
  for (let word of words) {
    const len = word.length;
    
    if (!index[len]) {
      index[len] = [];
    }
    
    index[len].push(word);
  }
  
  return index;
}

/**
 * 主函数
 */
function main() {
  console.log('构建索引...\n');
  
  // 创建输出目录
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // 读取所有词库
  const { words, categoryMap } = readAllLexicons();
  console.log(`总词数: ${words.length}`);
  
  // 构建索引
  const index = buildIndex(words);
  console.log(`索引分组: ${Object.keys(index).length}`);
  
  // 输出完整词库
  const fullLexicon = {
    version: new Date().toISOString().split('T')[0],
    stats: {
      totalWords: words.length,
      categories: Object.keys(categoryMap).length
    },
    words,
    index
  };
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'lexicon-full.json'),
    JSON.stringify(fullLexicon, null, 2)
  );
  
  // 输出分类词库
  const categorizedLexicon = {
    version: new Date().toISOString().split('T')[0],
    categories: {}
  };
  
  for (let [word, categories] of categoryMap) {
    for (let category of categories) {
      if (!categorizedLexicon.categories[category]) {
        categorizedLexicon.categories[category] = [];
      }
      categorizedLexicon.categories[category].push(word);
    }
  }
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'lexicon-by-category.json'),
    JSON.stringify(categorizedLexicon, null, 2)
  );
  
  // 输出压缩版（仅词语，无结构）
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'lexicon-words-only.txt'),
    words.join('\n')
  );
  
  console.log('\n✅ 索引构建完成！');
  console.log(`- 完整词库: dist/lexicon-full.json`);
  console.log(`- 分类词库: dist/lexicon-by-category.json`);
  console.log(`- 纯词版: dist/lexicon-words-only.txt`);
}

// 运行
main();
