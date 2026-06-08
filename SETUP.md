# GitHub Secrets 配置说明

## 需要配置的 Secrets

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加以下 Secret：

### MINIMAX_API_KEY

- **名称**: `MINIMAX_API_KEY`
- **值**: `sk-cp-...` （你的 MiniMax M2.7 API Key）
- **说明**: MiniMax M2.7 API 密钥

⚠️ **重要安全提示**: 
- 永远不要在代码、文档或公开仓库中明文写入 API Key！
- API Key 应该只存储在 GitHub Secrets 中
- 如果不慎泄露，请立即在 MiniMax 控制台重新生成

---

## 配置步骤

1. 进入 GitHub 仓库
2. 点击 **Settings** 标签
3. 左侧菜单选择 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**
5. 填写：
   - Name: `MINIMAX_API_KEY`
   - Secret: 粘贴上面的 API Key
6. 点击 **Add secret**

---

## 验证配置

配置完成后，可以通过手动触发 Workflow 来验证：

1. 进入 **Actions** 标签
2. 选择 **Auto Update Sensitive Lexicon**
3. 点击 **Run workflow**
4. 查看运行日志，确认 API 调用成功
