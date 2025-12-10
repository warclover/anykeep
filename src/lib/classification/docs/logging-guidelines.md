# 日志级别规范

## 级别定义

| 级别    | 使用场景             | 示例                         |
| ------- | -------------------- | ---------------------------- |
| `error` | 需要人工干预的错误   | 数据库连接失败、API 密钥无效 |
| `warn`  | 预期外但可恢复的情况 | 降级到备用策略、重试成功     |
| `info`  | 业务流程关键点       | 分类完成、文件夹创建         |
| `debug` | 开发调试信息         | 匹配器得分、缓存命中         |

## 上下文字段规范

### 必须包含的字段

```typescript
// 用户相关操作
logger.info({ userId, bookmarkId }, "Classification completed");

// 任务相关操作
logger.error({ jobId, userId, jobType }, "Job failed");

// 文件夹操作
logger.info({ folderId, folderName, userId }, "Folder created");
```

### 错误日志规范

```typescript
// ✅ 正确
logger.error(
  {
    error: error instanceof Error ? error.message : String(error),
    userId,
    bookmarkId,
    duration: Date.now() - startTime,
  },
  "Classification failed",
);

// ❌ 错误
logger.error({ error: error.message }, "Failed");
```

## 待优化项

### 冷启动日志（应从 info 改为 debug）

- `integration.ts:146` - 冷启动信息
- `integration.ts:164` - 初始化信息

### 降级路径（应从 warn 改为 info）

- `classification.service.ts:106` - 降级到简单分类
- `classification.service.ts:276` - 回退策略

## 实施计划

1. 新代码遵循此规范
2. 逐步重构现有日志
3. 添加 ESLint 规则检查日志格式
