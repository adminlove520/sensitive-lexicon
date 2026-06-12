# 部署指南

## Vercel 部署

### 第一步：构建项目

```bash
# 安装依赖
npm install

# 构建词库和 API
npm run build:all
```

### 第二步：连接 GitHub 仓库

1. 访问 [Vercel](https://vercel.com)
2. 点击 "Add New Project"
3. 导入你的 GitHub 仓库 `adminlove520/sensitive-lexicon`
4. 点击 "Import"

### 第三步：配置项目

在 Vercel 项目设置中：

**Build Settings:**
- Build Command: `npm run build:all`
- Output Directory: `dist`
- Install Command: `npm install`

**Environment Variables (可选):**
- `MINIMAX_API_KEY`: 用于 AI 增强审核（未实现）

### 第四步：部署

点击 "Deploy" 按钮，Vercel 将自动部署。

### 部署后测试

```bash
# 获取你的 Vercel 域名
curl https://your-project.vercel.app/api/health

# 测试文本审核
curl -X POST https://your-project.vercel.app/api/moderate/text \
  -H "Content-Type: application/json" \
  -d '{"text":"测试文本"}'
```

---

## 本地开发

```bash
# 启动开发服务器
npm run dev

# 测试
node test-api-endpoints.js
```

---

## 词库更新

词库由 GitHub Actions 自动更新。更新流程：

1. 每天凌晨 2 点自动运行
2. 生成新词变体
3. AI 审核
4. 构建索引
5. 自动提交到仓库

词库更新后，Vercel 会自动重新部署。

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `api/moderate/text.ts` | 文本审核 API |
| `api/health.ts` | 健康检查 API |
| `api/lib/matcher.ts` | 文本匹配引擎 |
| `api/lib/loader.ts` | 词库加载器 |
| `api/lib/bundle/lexicon-data.ts` | 预编译词库 |
| `vercel.json` | Vercel 配置 |

---

## 性能优化

- **Edge Functions**: 全球边缘部署，低延迟
- **预编译词库**: 构建时嵌入，无需运行时加载
- **结果缓存**: 5分钟 LRU 缓存
- **高效匹配**: 按长度分组的倒排索引

---

## 故障排查

### 词库未加载

检查 `api/lib/bundle/lexicon-data.ts` 是否存在：

```bash
npm run build:all
```

### TypeScript 错误

```bash
npm run build:api
```

### Vercel 部署失败

1. 检查 Build Output 日志
2. 确认 `dist/lexicon-full.json` 存在
3. 运行 `npm run build:all` 后重新提交

---

## 成本估算

Vercel 免费套餐：
- 100 GB 带宽/月
- 无限 Edge Function 请求
- 适合小型项目

超出后：
- Pro: $20/月
- 带宽按量计费

---

## 安全建议

1. **API 密钥**: 添加认证机制（未实现）
2. **速率限制**: 防止滥用（未实现）
3. **HTTPS**: Vercel 自动启用
4. **环境变量**: 不要在代码中硬编码密钥
