# 敏感词库自动更新系统

> 基于 AI 的自动生成、审核、索引构建系统

---

## 🎯 系统特性

- ✅ **AI 自动生成变体**：基于现有词库生成新变体
- ✅ **AI 自动审核**：防止误伤，过滤不合理词汇
- ✅ **三级分类**：高/中/低风险词库分级管理
- ✅ **高效索引**：按长度分组，支持快速匹配
- ✅ **自动化 Release**：每次更新自动发布新版本

---

## 📊 工作流程

```
每天凌晨 2 点 (GitHub Actions)
    ↓
1. 读取现有词库
    ↓
2. MiniMax M2.7 AI 生成新词变体
    ↓
3. AI 自动审核 (防误伤 + 语义分析)
    ↓
4. 构建高效索引
    ↓
5. 自动 Commit + Push
    ↓
6. 创建 GitHub Release
    ↓
7. 生成更新报告
```

---

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/YOUR_USERNAME/Sensitive-lexicon.git
cd Sensitive-lexicon
```

### 2. 配置 GitHub Secrets

在仓库 **Settings → Secrets and variables → Actions** 中添加：

```
MINIMAX_API_KEY: sk-cp-... （你的 MiniMax M2.7 API Key）
```

⚠️ **重要安全提示**: 永远不要在代码、文档或公开仓库中明文写入 API Key！

详细配置步骤见 [SETUP.md](SETUP.md)

### 3. 启用 GitHub Actions

- 仓库已包含 `.github/workflows/auto-update-lexicon.yml`
- 每天凌晨 2 点自动运行
- 或手动触发

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
├── .generated/                     # 待审核词 (自动生成)
├── .approved/                      # 审核通过词 (自动生成)
├── dist/                           # 最终输出 (自动生成)
│   ├── lexicon-full.json
│   ├── lexicon-by-category.json
│   └── lexicon-words-only.txt
└── reports/                        # 更新报告 (自动生成)
```

---

## 🛡️ 安全机制

### 三级防护

| 层级 | 检查项 | 说明 |
|------|--------|------|
| **规则层** | 长度 (2-20 字符) | 防止过短/过长 |
| **规则层** | 常用词对比 | 防止误伤正常词 |
| **规则层** | 模糊度限制 | 星号不超过 70% |
| **AI 层** | 语义分析 | MiniMax M2.7 判断合理性 |

### 分级审核

| 风险等级 | 审核方式 | 人工抽查 |
|----------|----------|----------|
| **高风险** | AI 审核 | ✅ 建议抽查 |
| **中风险** | AI 审核 | ⚠️ 可选 |
| **低风险** | 自动通过 | ❌ 无需 |

---

## 📊 输出说明

每次更新会生成 3 个文件：

1. **lexicon-full.json** - 完整词库（含索引）
2. **lexicon-by-category.json** - 分类词库
3. **lexicon-words-only.txt** - 纯词版

---

## 🔄 版本历史

查看 Releases 标签获取历史版本：

```
v2026.06.08 - 系统初始化
```

---

## 🧪 本地测试

```bash
# 安装依赖
npm install axios

# 设置环境变量
export MINIMAX_API_KEY="your-key-here"

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

## 📝 优化记录

### 第一轮 Review：架构优化
- ✅ 引入 MiniMax M2.7 API
- ✅ 添加降级方案（API 失败时用规则生成）
- ✅ 完善错误处理

### 第二轮 Review：功能增强
- ✅ 添加版本控制
- ✅ 自动 Release 机制
- ✅ 生成 Markdown 报告

### 第三轮 Review：安全和性能
- ✅ 防误伤机制
- ✅ 分级审核策略
- ✅ 高效索引构建

---

**Powered by MiniMax M2.7 + GitHub Actions 🤖**
