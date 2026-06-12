# 文本审核 API 文档

> 基于 sensitive-lexicon 词库的文本内容审核服务

---

## 🚀 快速开始

### 部署到 Vercel

```bash
# 1. 安装依赖
npm install

# 2. 构建项目
npm run build:all

# 3. 部署到 Vercel
vercel
```

### 本地开发

```bash
# 启动开发服务器
npm run dev
```

API 将在 `http://localhost:3000` 上运行。

---

## 📡 API 端点

### 1. 健康检查

检查服务状态和词库信息。

```http
GET /api/health
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "2026-06-12",
    "stats": {
      "totalWords": 51360,
      "categories": 17
    },
    "timestamp": "2026-06-12T10:30:00.000Z"
  }
}
```

---

### 2. 文本审核

审核单条文本是否包含敏感词。

```http
POST /api/moderate/text
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY  # 可选
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | string | ✅ | 待审核的文本 |
| `options` | object | ❌ | 审核选项 |
| `options.categories` | string[] | ❌ | 指定分类，空表示全部 |
| `options.strictness` | string | ❌ | 严格度: low/medium/high |
| `options.returnMatches` | boolean | ❌ | 是否返回匹配的词 |
| `options.aiEnhanced` | boolean | ❌ | 是否启用 AI 增强（未实现） |

**请求示例：**

```json
{
  "text": "这是一段待审核的文本内容",
  "options": {
    "categories": ["政治", "暴恐"],
    "strictness": "medium",
    "returnMatches": true
  }
}
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "passed": false,
    "riskLevel": "high",
    "confidence": 0.95,
    "matchedWords": [
      {
        "word": "***",
        "category": "政治",
        "position": [5, 8]
      }
    ],
    "suggestion": "block"
  }
}
```

**响应头：**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

### 3. 批量审核

批量审核多条文本。

```http
POST /api/moderate/batch
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY  # 可选
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `texts` | string[] | ✅ | 待审核文本数组（最多100条） |
| `options` | object | ❌ | 审核选项（同单条审核） |

**请求示例：**

```json
{
  "texts": ["文本1", "文本2", "文本3"],
  "options": {
    "strictness": "high",
    "returnMatches": true
  }
}
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "passed": true,
        "riskLevel": "none",
        "confidence": 1.0,
        "matchedWords": [],
        "suggestion": "allow"
      },
      {
        "passed": false,
        "riskLevel": "high",
        "confidence": 0.85,
        "matchedWords": [
          {
            "word": "***",
            "category": "政治",
            "position": [10, 13]
          }
        ],
        "suggestion": "block"
      }
    ],
    "summary": {
      "total": 2,
      "passed": 1,
      "blocked": 1,
      "review": 0
    }
  }
}
```

---

## 🔧 功能说明

### 严格度配置

| 严格度 | 高风险阈值 | 中风险阈值 | 需要高风险分类 |
|--------|-----------|-----------|---------------|
| `low` | 5 个匹配 | 3 个匹配 | 否 |
| `medium` | 3 个匹配 | 2 个匹配 | 否 |
| `high` | 1 个匹配 | 1 个匹配 | 是 |

**使用示例：**

```json
{
  "text": "测试文本",
  "options": {
    "strictness": "high"
  }
}
```

### 分类过滤

支持的分类（动态从词库加载）：
- COVID-19词库
- 政治类型
- 暴恐词库
- 色情词库
- 广告词库
- 辱骂词库
- 违禁词库
- 等等...

**使用示例：**

```json
{
  "text": "测试文本",
  "options": {
    "categories": ["政治类型", "暴恐词库"]
  }
}
```

---

## 🔐 认证

API 密钥认证是可选的，通过环境变量配置。

### 配置 API 密钥

在 Vercel 项目设置中添加环境变量：

```env
API_KEYS=key1,key2,key3
```

### 使用 API 密钥

**方式 1: Authorization Header**

```http
POST /api/moderate/text
Authorization: Bearer YOUR_API_KEY
```

**方式 2: x-api-key Header**

```http
POST /api/moderate/text
x-api-key: YOUR_API_KEY
```

---

## ⚡ 速率限制

默认配置：
- **时间窗口**: 1 分钟
- **最大请求数**: 100 次

**响应头：**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

**超过限制时：**

```json
{
  "success": false,
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "data": {
    "resetTime": 1234567890
  }
}
```

---

## 🔧 风险等级说明

| 等级 | 条件 | 建议 |
|------|------|------|
| `none` | 无匹配 | 允许 (allow) |
| `low` | 1个匹配，非高风险分类 | 允许 (allow) |
| `medium` | 2个匹配 | 人工审核 (review) |
| `high` | 3+个匹配 或 高风险分类 | 拦截 (block) |

**高风险分类：** 政治、暴恐、COVID-19词库、政治类型、涉政

---

## 📊 响应字段说明

| 字段 | 说明 |
|------|------|
| `success` | 请求是否成功 |
| `data.passed` | 是否通过审核 |
| `data.riskLevel` | 风险等级 |
| `data.confidence` | 置信度 (0-1) |
| `data.matchedWords` | 匹配的敏感词列表 |
| `data.suggestion` | 建议操作 |

---

## 🌍 cURL 示例

### 健康检查

```bash
curl https://your-project.vercel.app/api/health
```

### 文本审核（无认证）

```bash
curl -X POST https://your-project.vercel.app/api/moderate/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "待审核的文本内容",
    "options": {
      "returnMatches": true
    }
  }'
```

### 文本审核（带认证）

```bash
curl -X POST https://your-project.vercel.app/api/moderate/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "text": "待审核的文本内容",
    "options": {
      "strictness": "high",
      "categories": ["政治类型"]
    }
  }'
```

### 批量审核

```bash
curl -X POST https://your-project.vercel.app/api/moderate/batch \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["文本1", "文本2", "文本3"],
    "options": {
      "returnMatches": false
    }
  }'
```

---

## 📝 JavaScript/TypeScript 示例

```typescript
interface ModerationResult {
  passed: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  confidence: number;
  matchedWords: Array<{
    word: string;
    category: string;
    position?: [number, number];
  }>;
  suggestion: 'allow' | 'review' | 'block';
}

async function moderateText(text: string, apiKey?: string): Promise<ModerationResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch('/api/moderate/text', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      options: {
        returnMatches: true,
        strictness: 'medium'
      }
    })
  });

  const data = await response.json();
  return data.data;
}

// 使用
const result = await moderateText('这是一段待审核的文本');
if (result.passed) {
  console.log('审核通过');
} else {
  console.log(`审核未通过: ${result.riskLevel}`);
  console.log('匹配的词:', result.matchedWords);
}
```

---

## ⚡ 性能特性

- **低延迟**: 边缘计算，全球部署
- **缓存**: 5分钟结果缓存
- **高效匹配**: 按长度分组的倒排索引
- **并发**: 支持高并发请求
- **速率限制**: 防止滥用

---

## 🔒 环境变量

在 Vercel 项目设置中配置以下环境变量（可选）：

```env
API_KEYS=key1,key2,key3  # API 密钥列表，逗号分隔
```

---

## 🛠️ 开发

### 类型检查

```bash
npm run build:api
```

### 本地测试

```bash
# 1. 构建项目
npm run build:all

# 2. 启动开发服务器
npm run dev

# 3. 测试健康检查
curl http://localhost:3000/api/health

# 4. 测试文本审核
curl -X POST http://localhost:3000/api/moderate/text \
  -H "Content-Type: application/json" \
  -d '{"text":"测试文本"}'
```

---

## 🚨 错误码

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|------------|
| `METHOD_NOT_ALLOWED` | 请求方法不允许 | 405 |
| `UNAUTHORIZED` | 未授权或 API 密钥无效 | 401 |
| `RATE_LIMIT_EXCEEDED` | 超过速率限制 | 429 |
| `INVALID_JSON` | JSON 格式错误 | 400 |
| `INVALID_INPUT` | 输入参数无效 | 400 |
| `TEXT_TOO_LONG` | 文本超过最大长度 | 400 |
| `TOO_MANY_TEXTS` | 批量文本数量过多 | 400 |
| `INTERNAL_ERROR` | 服务器内部错误 | 500 |

---

## 📈 后续计划

- [ ] AI 增强审核（集成 Claude/GPT）
- [ ] 第三方 API 集成（百度/阿里云）
- [ ] 用户统计仪表板
- [ ] 自定义词库上传
- [ ] Webhook 通知
- [ ] SDK 包（Python、Go、PHP）

---

## 📦 词库更新

词库由 GitHub Actions 自动更新。更新流程：

1. 每天凌晨 2 点自动运行
2. 生成新词变体
3. AI 审核
4. 构建索引
5. 自动提交到仓库

词库更新后，Vercel 会自动重新部署。

---

**Powered by Vercel Edge Functions 🚀**
