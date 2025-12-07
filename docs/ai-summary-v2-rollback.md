# AI 摘要 V2 优化 - 回滚指南

## 版本信息

- **版本**: 2.1.0
- **发布日期**: 2025-12-06
- **状态**: 已实现，默认关闭（需手动开启）

## 功能说明

### Phase 1: 结构化 JSON 输出

1. **结构化 JSON 输出**: 摘要包含 tldr、key_points、sentiment、reading_time、action_items
2. **丰富的前端渲染**: 情感倾向标签、阅读时间、行动步骤列表
3. **类型专用模板**: 文章/教程/视频/工具 四种类型专用 prompt

### Phase 2: Jina Reader 内容提取

1. **智能内容提取**: 使用 Jina Reader API 获取干净的 Markdown 内容
2. **多策略降级**: Jina Reader → 原生 HTML 爬虫 → 短描述
3. **平台适配**: 自动识别适合使用 Jina Reader 的 URL

### 数据兼容性

- **向前兼容**: V2 格式摘要可以被旧版前端正常显示（作为纯文本）
- **向后兼容**: V1 格式摘要可以被新版前端正常渲染（智能解析）

## 开启方法

### 方法 1: 环境变量（推荐）

在 `.env.local` 中添加：

```bash
# Phase 1: 开启 JSON 结构化输出
AI_SUMMARY_JSON_OUTPUT=true

# Phase 2: 开启 Jina Reader 内容提取
AI_SUMMARY_USE_JINA=true
```

### 方法 2: 代码修改

编辑 `src/lib/classification/config/ai-summary-config.ts`：

```typescript
const DEFAULT_CONFIG: AISummaryConfig = {
  useJsonOutput: true, // Phase 1: 结构化输出
  useJinaReader: true, // Phase 2: Jina Reader
  // ...
};
```

## 回滚方法

### 快速回滚（推荐）

1. 修改环境变量：

```bash
# .env.local

# 回滚 Phase 1 (JSON 输出)
AI_SUMMARY_JSON_OUTPUT=false

# 回滚 Phase 2 (Jina Reader)
AI_SUMMARY_USE_JINA=false
```

2. 重启服务：

```bash
npm run dev
```

### 代码回滚

如果需要完全回滚代码：

```bash
# 回滚相关文件
git checkout HEAD~1 -- src/lib/classification/config/ai-summary-config.ts
git checkout HEAD~1 -- src/lib/classification/prompts/summary-prompts-v2.ts
git checkout HEAD~1 -- src/lib/classification/types/ai-summary.ts
git checkout HEAD~1 -- src/components/bookmark/summary-renderer.tsx
git checkout HEAD~1 -- src/lib/utils/ai-generator.ts
```

## 验证方法

### 验证开关状态

在浏览器控制台或服务端日志中查找：

```
AI Generator: Config check { useJsonOutput: true/false, ... }
```

### 验证输出格式

1. **V2 开启**: 摘要以 `{` 开头（JSON 格式）
2. **V2 关闭**: 摘要为纯文本

## 故障排查

### 问题 1: 摘要显示为原始 JSON

**原因**: 前端未正确解析 JSON 格式

**解决**:

1. 确认 `SummaryRenderer` 组件已更新
2. 检查 `isStructuredSummary()` 函数是否正确导入

### 问题 2: 摘要生成失败

**原因**: AI 返回格式不符合预期

**解决**:

1. 查看服务端日志中的 `parse_v2_*` 相关条目
2. 系统会自动回退到 V1 解析

### 问题 3: 标签为空

**原因**: JSON 中 keywords 字段缺失

**解决**: 系统会自动使用默认标签 ["收藏", "阅读"]

## 文件清单

### Phase 1 文件

| 文件                                                   | 说明                  |
| ------------------------------------------------------ | --------------------- |
| `src/lib/classification/config/ai-summary-config.ts`   | 特性开关配置          |
| `src/lib/classification/types/ai-summary.ts`           | JSON 类型定义         |
| `src/lib/classification/prompts/summary-prompts-v2.ts` | V2 Prompt 模板        |
| `src/components/bookmark/summary-renderer.tsx`         | 双模式渲染组件        |
| `src/lib/utils/ai-generator.ts`                        | AI 生成器（集成开关） |

### Phase 2 文件

| 文件                                     | 说明                         |
| ---------------------------------------- | ---------------------------- |
| `src/lib/utils/jina-reader.ts`           | Jina Reader API 服务         |
| `src/lib/utils/smart-content-fetcher.ts` | 智能内容提取器（多策略降级） |
| `src/app/api/bookmarks/route.ts`         | 书签 API（集成内容提取）     |

## 监控指标

### Phase 1 日志关键词

- `parse_v2_success`: V2 解析成功
- `parse_v2_json_failed`: JSON 解析失败，回退 V1
- `parse_v2_invalid_structure`: 结构无效，回退 V1
- `parse_v2_error`: 解析异常，回退 V1

### Phase 2 日志关键词

- `smart_fetch_start`: 开始智能内容提取
- `smart_fetch_success`: 内容提取成功
- `smart_fetch_fallback`: 提取失败，使用描述
- `jina_reader_success`: Jina Reader 成功
- `jina_fallback_to_native`: Jina 失败，降级到原生爬虫
