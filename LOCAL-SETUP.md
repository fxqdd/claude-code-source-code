# Claude Code - Ollama 本地化修改

## 修改概述

本项目已将 Claude Code 架构修改为支持本地 Ollama 模型（DeepSeek R1 等）和免费的 DuckDuckGo 搜索。

## 主要修改文件

### 1. 新增 Ollama 客户端
- **文件**: `src/services/api/ollamaClient.ts`
- **功能**: 
  - 支持 Ollama 的 `/api/chat` 端点
  - 提供流式和非流式响应
  - 适配 Anthropic 兼容格式
  - 支持 `deepseek-r1:8b`、`llama3.2:1b` 等模型

### 2. Provider 配置
- **文件**: `src/utils/model/providers.ts`
- **新增**: `ollama` 和 `openaiCompatible` provider 类型

### 3. API Client 集成
- **文件**: `src/services/api/client.ts`
- **新增**: Ollama 和 OpenAI-compatible 分支支持

### 4. WebSearchTool 重写
- **文件**: `src/tools/WebSearchTool/WebSearchTool.ts`
- **变更**: 使用 DuckDuckGo 替代 Anthropic API 内置搜索

### 5. DuckDuckGo 搜索服务
- **文件**: `src/services/search/ddgSearch.ts`
- **功能**:
  - DDG Instant Answer API
  - DDG Lite HTML 解析
  - 结果过滤（allowed_domains/blocked_domains）

### 6. 简化版 CLI
- **文件**: `src/simple-cli.tsx`
- **功能**: 交互式聊天 + 搜索命令

## 环境变量配置

```bash
# 启用 Ollama
CLAUDE_CODE_USE_OLLAMA=true

# Ollama 服务地址（默认: http://localhost:11434）
OLLAMA_BASE_URL=http://localhost:11434

# 模型名称（默认: deepseek-r1:8b）
OLLAMA_MODEL=deepseek-r1:8b

# 可选：Ollama API Key
OLLAMA_API_KEY=
```

## 使用方法

### 前置条件

1. **安装 Ollama**
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.com/install.sh | sh
   
   # Windows: 从 https://ollama.com 下载安装
   ```

2. **启动 Ollama 服务**
   ```bash
   ollama serve
   ```

3. **拉取模型**（选择其一）
   ```bash
   # DeepSeek R1 8B（推荐，需要 6GB+ 内存）
   ollama pull deepseek-r1:8b
   
   # Llama 3.2 1B（轻量级，需要 1.3GB 内存）
   ollama pull llama3.2:1b
   
   # Phi-3 Mini（需要 3.5GB 内存）
   ollama pull phi3:mini
   ```

### 运行

```bash
# 克隆项目
git clone https://github.com/fxqdd/claude-code-source-code.git
cd claude-code-source-code

# 安装依赖
bun install

# 配置环境变量
export CLAUDE_CODE_USE_OLLAMA=true
export OLLAMA_MODEL=deepseek-r1:8b

# 运行简化版 CLI
bun run src/simple-cli.tsx
```

### 命令

- `/search <query>` - 搜索互联网
- `/clear` - 清除对话历史
- `/history` - 查看对话历史
- `/quit` - 退出

## 系统要求

- **内存**: 至少 8GB RAM（推荐 16GB+）
- **磁盘**: 10GB+ 可用空间
- **系统**: macOS / Linux / Windows (WSL)

## 已知问题

1. **内存不足**: 当前测试环境内存被占用，无法运行模型。请在有足够内存的本地环境测试。

2. **网络限制**: 国外网站（如 DuckDuckGo）访问可能受限。可考虑：
   - 使用国内镜像源
   - 配置代理
   - 替换为其他搜索 API（如 SerpAPI、Bing Search）

## 下一步优化建议

1. **添加更多搜索源**: 支持 Bing、Google SerpAPI 等
2. **流式输出优化**: 改善大模型的流式响应体验
3. **对话历史持久化**: 保存对话到文件
4. **Markdown 文件生成**: 按用户需求自动生成 md 文件
5. **工具调用扩展**: 支持更多工具（如文件读写、代码执行）

## 测试脚本

```bash
# 直接测试 Ollama API
bun run test-direct.ts

# 测试搜索功能
bun run test-search.ts

# 完整集成测试
bun run test-ollama.ts
```
