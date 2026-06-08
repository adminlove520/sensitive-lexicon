# 敏感词库自动更新系统

> 基于 AI 的自动生成、审核、索引构建系统

---

## 🎯 系统架构

```
定时触发 (GitHub Actions)
    ↓
1. 读取现有词库
    ↓
2. AI 生成新词变体
    ↓
3. AI 自动审核
    ↓
4. 构建高效索引
    ↓
5. 自动合并到 main
    ↓
6. 创建 Release
```

---

## 📁 目录结构

```
Sensitive-lexicon/
├── .github/workflows/
│   └── auto-update-lexicon.yml    # GitHub Actions 配置
├── Vocabulary/                     # 现有词库 (TXT 格式)
│   ├── 政治类型.txt
│   ├── 暴恐词库.txt
│   └── ...
├── scripts/
│   ├── generate-words.js          # AI 生成新词
│   ├── ai-review.js               # AI 自动审核
│   ├── build-index.js             # 构建索引
│   └── create-report.js           # 生成报告
├── .generated/                     # 待审核词 (生成)
├── .approved/                      # 审核通过词 (生成)
├── dist/                           # 最终输出 (生成)
│   ├── lexicon-full.json
│   ├── lexicon-by-category.json
│   └── lexicon-words-only.txt
└── reports/                        # 更新报告 (生成)
```

---

## 🚀 使用方法

### 方式 1: 自动运行 (推荐)

GitHub Actions 每天凌晨 2 点自动运行，无需人工干预。

### 方式 2: 手动触发

1. 进入 GitHub 仓库
2. 点击 **Actions** 标签
3. 选择 **Auto Update Sensitive Lexicon**
4. 点击 **Run workflow**

---

## 🔧 配置说明

### GitHub Secrets 需要配置

在仓库 Settings → Secrets and variables → Actions 中添加：

| Secret 名称 | 说明 | 示例 |
|-------------|------|------|
| `AI_API_KEY` | AI 模型 API Key | `sk-...` |
| `AI_MODEL` | AI 模型名称 | `gpt-4` / `glm-4` |

### 词库分类配置

在 `scripts/generate-words.js` 中修改 `CATEGORIES`：

```javascript
const CATEGORIES = {
  HIGH_RISK: ['政治类型', '暴恐词库', '涉枪涉爆', '反动词库'],
  MEDIUM_RISK: ['广告类型', '民生词库', 'GFW补充词库'],
  LOW_RISK: ['COVID-19词库', '网易前端过滤敏感词库']
};
```

---

## 🛡️ 安全机制

### 1. 分级审核

| 风险等级 | 审核方式 | 合并方式 |
|----------|----------|----------|
| **高风险** | AI 审核 + 人工抽查 | 自动合并 |
| **中风险** | AI 审核 | 自动合并 |
| **低风险** | 自动通过 | 自动合并 |

### 2. 防误伤机制

- ✅ **长度检查**: 2-20 字符
- ✅ **常用词对比**: 不与常用词相似
- ✅ **模糊度限制**: 星号不超过 70%
- ✅ **AI 语义分析**: 判断词汇是否合理

### 3. 人工抽查

高风险分类建议定期人工抽查：

```bash
# 查看某分类的审核通过词
cat .approved/政治类型-approved.json | jq '.approvedWords'
```

---

## 📊 输出说明

### 最终产物

1. **lexicon-full.json**
   - 完整词库 + 索引
   - 包含所有分类
   - 按长度分组（用于快速匹配）

2. **lexicon-by-category.json**
   - 按分类组织的词库
   - 便于按类别加载

3. **lexicon-words-only.txt**
   - 纯文本词列表
   - 便于导入其他系统

---

## 🧪 测试

### 本地测试

```bash
# 安装依赖
npm install

# 运行生成
node scripts/generate-words.js

# 运行审核
node scripts/ai-review.js

# 构建索引
node scripts/build-index.js

# 生成报告
node scripts/create-report.js
```

---

## 🔄 版本历史

查看 Releases 标签获取历史版本：

```
v2026.06.08 - AI 自动更新系统上线
```

---

## 📝 TODO

- [ ] 接入真实 AI API (如 GLM-4)
- [ ] 添加语义相似度检测
- [ ] 实现人工抽查自动化报告
- [ ] 添加词库热度统计

---

**Powered by AI 自动更新系统 🤖**
