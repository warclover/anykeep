# 实施说明

## 已完成的工作

✅ **核心框架已实现**

1. **用户画像生成器** (`generators/user-profile-generator.ts`)
   - 支持 12 种用户类型
   - 自动生成领域权重分布
   - 支持自定义用户数量

2. **书签生成器** (`generators/bookmark-generator.ts`)
   - 基于领域模板生成真实书签
   - 支持标题、摘要、标签生成
   - 自动分配预期文件夹

3. **测试执行器** (`executors/test-executor.ts`)
   - 调用真实分类 API
   - 支持批量执行
   - 自动识别分类策略

4. **指标计算器** (`evaluators/metrics-calculator.ts`)
   - 多维度指标计算
   - 错误分析
   - 改进建议生成

5. **报告生成器** (`evaluators/report-generator.ts`)
   - Markdown 报告
   - JSON 报告（程序化分析）
   - 详细的错误分析

## 需要调整的部分

⚠️ **集成点需要根据实际实现调整**

### 1. API 端点配置

在 `index.ts` 中的 `ClassificationServiceClient` 类需要根据实际 API 调整：

```typescript
// 当前实现（需要调整）
const response = await fetch(
  "http://localhost:3000/api/classification/v5/classify",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  },
);
```

**建议**：

- 检查实际的分类 API 端点
- 确认请求/响应格式
- 添加认证头（如果需要）

### 2. 文件夹创建逻辑

当前 `generateFoldersForProfile` 方法简化实现，实际需要：

- 在数据库中创建真实文件夹
- 为文件夹生成向量嵌入
- 建立文件夹与用户的关联

**建议**：

- 使用 Supabase 客户端创建文件夹
- 调用文件夹画像生成服务
- 确保文件夹 ID 正确映射

### 3. 书签创建逻辑

当前只生成书签对象，实际需要：

- 在数据库中创建真实书签
- 生成书签向量嵌入
- 建立书签与预期文件夹的关联

**建议**：

- 使用 Supabase 客户端创建书签
- 调用分类服务进行分类
- 记录分类结果

### 4. 正确性判断逻辑

当前 `isCorrect` 方法简化实现，实际需要：

- 支持语义相似度匹配
- 支持文件夹名相似度匹配
- 支持领域匹配

**建议**：

- 实现向量相似度计算
- 实现文件夹名语义匹配
- 支持多级匹配策略

## 使用建议

### 第一次运行

1. **使用快速模式验证**：

   ```bash
   npm run test:classification:realistic:quick
   ```

2. **检查报告**：
   - 查看 `reports/classification-realistic-test/report-*.md`
   - 确认数据生成正确
   - 确认 API 调用成功

3. **逐步扩大规模**：
   - 先测试单个用户类型
   - 再测试多个用户类型
   - 最后运行完整测试

### 集成到 CI/CD

```yaml
# .github/workflows/classification-test.yml
name: Classification Realistic Test

on:
  schedule:
    - cron: "0 2 * * *" # 每天凌晨 2 点
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:classification:realistic:quick
      - uses: actions/upload-artifact@v3
        with:
          name: classification-test-report
          path: reports/classification-realistic-test/
```

## 扩展建议

### 1. 添加真实数据源

可以集成真实数据源（需要用户同意）：

- GitHub Trending
- Medium 技术文章
- B站教程视频

### 2. 添加 A/B 测试支持

对比不同分类策略的效果：

```typescript
// 支持多版本对比
const results = await Promise.all([
  testExecutor.execute(userId, bookmark, { version: "v5.0" }),
  testExecutor.execute(userId, bookmark, { version: "v6.0" }),
]);
```

### 3. 添加性能监控

集成性能监控工具：

- 记录每次分类的详细指标
- 生成性能报告
- 识别性能瓶颈

## 问题反馈

如遇到问题，请检查：

1. 环境变量配置
2. API 端点可访问性
3. 数据库连接
4. 类型定义是否正确
