# v5.0 分类测试指南

## ✅ 环境配置已完成

```bash
CLASSIFICATION_VERSION=v5.0
CLASSIFICATION_V5_ENABLED=true
CLASSIFICATION_V5_STAGE=full
```

## 🚀 服务器状态

- ✅ 开发服务器已启动: http://localhost:3001
- ✅ 日志监控已启动

## 📝 测试步骤

### 方法 1: 通过浏览器手动测试（推荐）

1. 打开浏览器访问: http://localhost:3001
2. 登录你的账号
3. 创建一个新书签，例如：
   - 标题: "Next.js 14 App Router 完整指南"
   - URL: https://example.com/test
   - 摘要: "关于 Next.js 14 新特性的技术文章"
   - 标签: Next.js, React, 前端开发

4. 提交后，立即运行以下命令查看日志：
   ```bash
   bash check-v5-logs.sh
   ```

### 方法 2: 查看实时日志

在另一个终端窗口运行：

```bash
tail -f dev-server.log | grep -i "classification"
```

## 🔍 预期日志输出

如果 v5.0 生效，你应该看到类似这样的日志：

```json
{
  "version": "v5.0",
  "bookmarkId": 123,
  "title": "Next.js 14 App Router...",
  "action": "classify",
  "confidence": 0.92,
  "usedT1": true,
  "totalLatencyMs": 1234,
  "t0LatencyMs": 456,
  "t1LatencyMs": 778
}
"Classification V5.0: Result received"
```

如果看到降级日志：

```
"Classification V5.0: Feature flag disabled, fallback to V4.1"
```

## 📊 验证命令

```bash
# 查看最新的分类日志
bash check-v5-logs.sh

# 实时监控日志
tail -f dev-server.log | grep -E "(Classification|v5\.0)"

# 检查环境变量
grep CLASSIFICATION .env.local
```
