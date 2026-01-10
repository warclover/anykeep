# 意图-槽位定义表 (Intent-Slot Schema)

> **版本**: v1.0.0
> **创建日期**: 2026-01-10
> **状态**: 待审核
> **关联文档**: [intent-mapping-enhancement-plan.md](./intent-mapping-enhancement-plan.md)

---

## 一、概述

### 1.1 目的

本文档定义了 AnyKeep AI 助手中每个意图类型所需提取的槽位（参数），确保：

1. **意图分类**与**参数提取**同步进行，避免 LLM 多次调用
2. 明确每个意图的必填/可选参数
3. 指导 Tool 的参数验证逻辑
4. 支持槽位缺失时的追问策略

### 1.2 核心概念

| 概念              | 说明               | 示例                    |
| ----------------- | ------------------ | ----------------------- |
| **意图 (Intent)** | 用户想做什么       | `action:move`           |
| **槽位 (Slot)**   | 执行意图所需的参数 | `target`, `destination` |
| **必填槽位**      | 缺失时必须追问     | `destination` for move  |
| **可选槽位**      | 缺失时使用默认值   | `count` (默认全部)      |
| **上下文槽位**    | 从上下文自动填充   | `target` ← 选中的书签   |

---

## 二、通用槽位定义

### 2.1 目标对象槽位 (Target Slots)

```typescript
interface TargetSlots {
  // 目标书签
  target?: {
    type: "selected" | "search_result" | "explicit_ids" | "all" | "filtered";
    ids?: string[]; // 明确指定的书签 ID
    filter?: FilterSlots; // 筛选条件
  };

  // 目标数量
  count?: number | "all"; // 默认 "all"
}
```

### 2.2 筛选条件槽位 (Filter Slots)

```typescript
interface FilterSlots {
  keyword?: string; // 关键词搜索
  platform?: Platform[]; // 平台筛选
  tags?: string[]; // 标签筛选
  folder?: string; // 文件夹筛选
  timeRange?: {
    type: "relative" | "absolute";
    // 相对时间
    relative?: "today" | "yesterday" | "week" | "month" | "recent";
    // 绝对时间
    start?: string; // ISO 日期
    end?: string;
  };
  isRead?: boolean; // 已读/未读
  isStarred?: boolean; // 星标状态
  hasTag?: boolean; // 是否有标签
}
```

### 2.3 位置槽位 (Location Slots)

```typescript
interface LocationSlots {
  destination?: {
    type: "folder" | "root" | "inbox";
    folderId?: string;
    folderName?: string; // 用于模糊匹配或新建
  };
}
```

### 2.4 格式槽位 (Format Slots)

```typescript
interface FormatSlots {
  format?: "csv" | "markdown" | "json" | "html" | "obsidian" | "obsidian_zip";
  fields?: string[]; // 导出字段选择
  groupBy?: "date" | "platform" | "folder" | "tag";
}
```

---

## 三、意图槽位详细定义

### 3.1 查询类 (query:\*)

#### query:search

| 槽位         | 类型                    | 必填 | 默认值     | 说明       |
| ------------ | ----------------------- | ---- | ---------- | ---------- |
| `keyword`    | string                  | ✅   | -          | 搜索关键词 |
| `platform`   | Platform[]              | ❌   | all        | 平台筛选   |
| `folder`     | string                  | ❌   | all        | 文件夹筛选 |
| `timeRange`  | TimeRange               | ❌   | all        | 时间范围   |
| `tags`       | string[]                | ❌   | -          | 标签筛选   |
| `limit`      | number                  | ❌   | 20         | 返回数量   |
| `searchMode` | "semantic" \| "keyword" | ❌   | "semantic" | 搜索模式   |

**示例输入与槽位提取**：

```
用户: "找一下上周关于 React 的文章"
→ {
    type: "query",
    subType: "search",
    slots: {
      keyword: "React",
      timeRange: { type: "relative", relative: "week" }
    }
  }
```

#### query:list

| 槽位        | 类型            | 必填 | 默认值       | 说明     |
| ----------- | --------------- | ---- | ------------ | -------- |
| `folder`    | string          | ❌   | current      | 文件夹   |
| `platform`  | Platform        | ❌   | all          | 平台     |
| `sortBy`    | string          | ❌   | "created_at" | 排序字段 |
| `sortOrder` | "asc" \| "desc" | ❌   | "desc"       | 排序方向 |
| `limit`     | number          | ❌   | 20           | 返回数量 |

#### query:count

| 槽位      | 类型        | 必填 | 默认值 | 说明         |
| --------- | ----------- | ---- | ------ | ------------ |
| `filter`  | FilterSlots | ❌   | -      | 统计筛选条件 |
| `groupBy` | string      | ❌   | -      | 分组统计维度 |

#### query:get

| 槽位     | 类型        | 必填 | 默认值 | 说明     |
| -------- | ----------- | ---- | ------ | -------- |
| `target` | TargetSlots | ✅   | -      | 目标书签 |
| `fields` | string[]    | ❌   | all    | 返回字段 |

---

### 3.2 操作类 (action:\*)

#### action:move

| 槽位          | 类型          | 必填 | 默认值   | 说明       |
| ------------- | ------------- | ---- | -------- | ---------- |
| `target`      | TargetSlots   | ✅   | selected | 目标书签   |
| `destination` | LocationSlots | ✅   | -        | 目标文件夹 |

**追问策略**：

- `target` 缺失：检查是否有选中项，否则追问"您想移动哪些书签？"
- `destination` 缺失：追问"您想移动到哪个文件夹？"并提供文件夹列表

**示例**：

```
用户: "把这些移到工作文件夹"
→ {
    type: "action",
    subType: "move",
    slots: {
      target: { type: "selected" },
      destination: { type: "folder", folderName: "工作" }
    }
  }
```

#### action:delete

| 槽位        | 类型        | 必填 | 默认值 | 说明     |
| ----------- | ----------- | ---- | ------ | -------- |
| `target`    | TargetSlots | ✅   | -      | 目标书签 |
| `confirmed` | boolean     | ✅   | false  | 用户确认 |

**追问策略**：

- 必须展示影响范围："将删除 N 条书签，确定吗？"
- 高风险操作，`confirmed` 必须由用户明确确认

#### action:tag

| 槽位     | 类型                           | 必填 | 默认值   | 说明         |
| -------- | ------------------------------ | ---- | -------- | ------------ |
| `target` | TargetSlots                    | ✅   | selected | 目标书签     |
| `tags`   | string[]                       | ✅   | -        | 要添加的标签 |
| `mode`   | "add" \| "remove" \| "replace" | ❌   | "add"    | 操作模式     |

#### action:archive

| 槽位     | 类型        | 必填 | 默认值   | 说明     |
| -------- | ----------- | ---- | -------- | -------- |
| `target` | TargetSlots | ✅   | selected | 目标书签 |

#### action:star

| 槽位      | 类型        | 必填 | 默认值   | 说明          |
| --------- | ----------- | ---- | -------- | ------------- |
| `target`  | TargetSlots | ✅   | selected | 目标书签      |
| `starred` | boolean     | ❌   | true     | 星标/取消星标 |

#### action:mark_read

| 槽位     | 类型        | 必填 | 默认值   | 说明          |
| -------- | ----------- | ---- | -------- | ------------- |
| `target` | TargetSlots | ✅   | selected | 目标书签      |
| `isRead` | boolean     | ❌   | true     | 标记已读/未读 |

---

### 3.3 整理类 (organize:\*)

#### organize:cleanup

| 槽位      | 类型                            | 必填 | 默认值              | 说明       |
| --------- | ------------------------------- | ---- | ------------------- | ---------- |
| `scope`   | "all" \| "folder" \| "platform" | ❌   | "all"               | 整理范围   |
| `folder`  | string                          | ❌   | -                   | 指定文件夹 |
| `actions` | CleanupAction[]                 | ❌   | ["classify", "tag"] | 整理动作   |

```typescript
type CleanupAction =
  | "classify" // 自动分类到文件夹
  | "tag" // 自动打标签
  | "dedupe" // 去重
  | "archive_old"; // 归档旧内容
```

#### organize:dedupe

| 槽位        | 类型                          | 必填 | 默认值 | 说明         |
| ----------- | ----------------------------- | ---- | ------ | ------------ |
| `scope`     | "all" \| "folder"             | ❌   | "all"  | 检测范围     |
| `strategy`  | "url" \| "title" \| "content" | ❌   | "url"  | 重复判定策略 |
| `autoMerge` | boolean                       | ❌   | false  | 自动合并     |

#### organize:classify

| 槽位     | 类型                | 必填 | 默认值       | 说明     |
| -------- | ------------------- | ---- | ------------ | -------- |
| `target` | TargetSlots         | ❌   | unclassified | 分类目标 |
| `mode`   | "auto" \| "suggest" | ❌   | "suggest"    | 分类模式 |

#### organize:tag

| 槽位     | 类型                | 必填 | 默认值    | 说明       |
| -------- | ------------------- | ---- | --------- | ---------- |
| `target` | TargetSlots         | ❌   | untagged  | 打标签目标 |
| `mode`   | "auto" \| "suggest" | ❌   | "suggest" | 标签模式   |

---

### 3.4 创建类 (create:\*)

#### create:digest

| 槽位     | 类型                                         | 必填 | 默认值    | 说明     |
| -------- | -------------------------------------------- | ---- | --------- | -------- |
| `target` | TargetSlots                                  | ✅   | -         | 目标书签 |
| `style`  | "tldr" \| "summary" \| "keypoints" \| "full" | ❌   | "summary" | 摘要风格 |
| `length` | "short" \| "medium" \| "long"                | ❌   | "medium"  | 摘要长度 |

#### create:export

| 槽位      | 类型         | 必填 | 默认值  | 说明     |
| --------- | ------------ | ---- | ------- | -------- |
| `target`  | TargetSlots  | ❌   | all     | 导出目标 |
| `format`  | ExportFormat | ✅   | -       | 导出格式 |
| `fields`  | string[]     | ❌   | default | 导出字段 |
| `groupBy` | string       | ❌   | -       | 分组方式 |

**追问策略**：

- `format` 缺失：提供格式选项 "您想导出为什么格式？CSV / Markdown / JSON / HTML"

#### create:md_collection

| 槽位          | 类型                              | 必填 | 默认值 | 说明          |
| ------------- | --------------------------------- | ---- | ------ | ------------- |
| `title`       | string                            | ✅   | -      | 收藏标题      |
| `content`     | string                            | ✅   | -      | Markdown 内容 |
| `contentType` | "note" \| "summary" \| "clipping" | ❌   | "note" | 内容类型      |
| `folderId`    | string                            | ❌   | -      | 目标文件夹    |
| `userTags`    | string[]                          | ❌   | []     | 用户标签      |

#### create:tts

| 槽位          | 类型                                         | 必填 | 默认值    | 说明           |
| ------------- | -------------------------------------------- | ---- | --------- | -------------- |
| `target`      | TargetSlots                                  | ✅   | -         | 朗读目标       |
| `contentType` | "tldr" \| "summary" \| "keypoints" \| "full" | ❌   | "summary" | 朗读内容       |
| `voice`       | "male" \| "female"                           | ❌   | "female"  | 语音类型       |
| `speed`       | number                                       | ❌   | 1.0       | 语速 (0.5-2.0) |

#### create:smart_list

| 槽位     | 类型        | 必填 | 默认值 | 说明         |
| -------- | ----------- | ---- | ------ | ------------ |
| `name`   | string      | ✅   | -      | 智能列表名称 |
| `filter` | FilterSlots | ✅   | -      | 筛选条件     |
| `icon`   | string      | ❌   | "📋"   | 图标         |

#### create:import

| 槽位       | 类型                                                  | 必填 | 默认值 | 说明                        |
| ---------- | ----------------------------------------------------- | ---- | ------ | --------------------------- |
| `source`   | "chrome" \| "edge" \| "firefox" \| "safari" \| "file" | ✅   | -      | 导入来源                    |
| `filePath` | string                                                | ❌   | -      | 文件路径（file 类型时必填） |

---

### 3.5 分析类 (analyze:\*)

#### analyze:report

| 槽位      | 类型                                     | 必填 | 默认值 | 说明     |
| --------- | ---------------------------------------- | ---- | ------ | -------- |
| `period`  | "week" \| "month" \| "quarter" \| "year" | ❌   | "week" | 报告周期 |
| `metrics` | string[]                                 | ❌   | all    | 包含指标 |

#### analyze:insight

| 槽位    | 类型                       | 必填 | 默认值  | 说明     |
| ------- | -------------------------- | ---- | ------- | -------- |
| `scope` | "all" \| "folder" \| "tag" | ❌   | "all"   | 分析范围 |
| `depth` | "quick" \| "deep"          | ❌   | "quick" | 分析深度 |

#### analyze:discover

| 槽位     | 类型                               | 必填 | 默认值     | 说明               |
| -------- | ---------------------------------- | ---- | ---------- | ------------------ |
| `target` | TargetSlots                        | ✅   | -          | 发现相关内容的目标 |
| `scope`  | "internal" \| "external" \| "both" | ❌   | "internal" | 发现范围           |

---

### 3.6 学习类 (learn:\*)

#### learn:active_recall_start

| 槽位    | 类型                                | 必填 | 默认值 | 说明         |
| ------- | ----------------------------------- | ---- | ------ | ------------ |
| `scope` | "due" \| "all" \| "folder" \| "tag" | ❌   | "due"  | 复习范围     |
| `limit` | number                              | ❌   | 10     | 每次复习数量 |

#### learn:review

| 槽位     | 类型                               | 必填 | 默认值      | 说明     |
| -------- | ---------------------------------- | ---- | ----------- | -------- |
| `target` | TargetSlots                        | ❌   | random      | 复习目标 |
| `mode`   | "flashcard" \| "quiz" \| "summary" | ❌   | "flashcard" | 复习模式 |

#### learn:path

| 槽位    | 类型                                       | 必填 | 默认值     | 说明     |
| ------- | ------------------------------------------ | ---- | ---------- | -------- |
| `topic` | string                                     | ✅   | -          | 学习主题 |
| `level` | "beginner" \| "intermediate" \| "advanced" | ❌   | "beginner" | 难度级别 |

---

### 3.7 闲聊类 (chitchat:\*)

#### chitchat:greeting

| 槽位 | 类型 | 必填 | 默认值 | 说明     |
| ---- | ---- | ---- | ------ | -------- |
| -    | -    | -    | -      | 无需槽位 |

#### chitchat:help

| 槽位    | 类型   | 必填 | 默认值    | 说明     |
| ------- | ------ | ---- | --------- | -------- |
| `topic` | string | ❌   | "general" | 帮助主题 |

#### chitchat:thanks

| 槽位 | 类型 | 必填 | 默认值 | 说明     |
| ---- | ---- | ---- | ------ | -------- |
| -    | -    | -    | -      | 无需槽位 |

---

## 四、槽位提取策略

### 4.1 LLM Prompt 输出格式

```typescript
interface IntentWithSlots {
  type: string;
  subType: string;
  confidence: number;
  slots: Record<string, unknown>;
  missingRequiredSlots: string[]; // 缺失的必填槽位
  ambiguousSlots: {
    // 需要澄清的槽位
    slot: string;
    candidates: string[];
    question: string;
  }[];
  reasoning?: string; // 推理过程（调试用）
}
```

### 4.2 LLM Prompt 模板

```
你是一个意图分类和槽位提取专家。根据用户输入，完成以下任务：

## 用户输入
"{input}"

## 上下文
{context}

## 任务
1. 识别用户意图（type:subType）
2. 提取相关槽位参数
3. 标记缺失的必填槽位
4. 对模糊槽位提供候选值

## 意图类型参考
{INTENT_TYPES_WITH_SLOTS}

## 输出格式（JSON）
{
  "type": "意图类型",
  "subType": "子类型",
  "confidence": 0.0-1.0,
  "slots": {
    "slot1": "value1",
    "slot2": "value2"
  },
  "missingRequiredSlots": ["slot3"],
  "ambiguousSlots": [
    {
      "slot": "destination",
      "candidates": ["工作资料", "工作笔记"],
      "question": "您是指「工作资料」还是「工作笔记」文件夹？"
    }
  ],
  "reasoning": "简短推理过程"
}
```

### 4.3 上下文自动填充规则

| 上下文条件                     | 自动填充槽位       | 填充值             |
| ------------------------------ | ------------------ | ------------------ |
| `selectedBookmarks.length > 0` | `target.type`      | `"selected"`       |
| `lastSearchResults` 存在       | `target.type` 候选 | `"search_result"`  |
| `currentFolder` 存在           | `folder` 默认值    | currentFolder.name |
| `lastMentionedBookmark` 存在   | `target.ids`       | [lastMentionedId]  |

### 4.4 槽位追问优先级

```typescript
const SLOT_PRIORITY = {
  // 高优先级：缺失时立即追问
  high: ["target", "destination", "format", "keyword"],

  // 中优先级：尝试使用默认值，不确定时追问
  medium: ["timeRange", "platform", "tags"],

  // 低优先级：总是使用默认值
  low: ["limit", "sortBy", "mode"],
};
```

---

## 五、验证规则

### 5.1 槽位验证函数

```typescript
// 位置: src/lib/ai-skills/validation/slot-validator.ts

export function validateSlots(
  intent: IntentType,
  slots: Record<string, unknown>,
): ValidationResult {
  const schema = SLOT_SCHEMAS[`${intent.type}:${intent.subType}`];
  if (!schema) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 检查必填槽位
  for (const requiredSlot of schema.required) {
    if (slots[requiredSlot] === undefined) {
      errors.push({
        slot: requiredSlot,
        message: `缺少必填槽位: ${requiredSlot}`,
        suggestedQuestion: schema.questions[requiredSlot],
      });
    }
  }

  // 类型验证
  for (const [slot, value] of Object.entries(slots)) {
    const slotSchema = schema.slots[slot];
    if (slotSchema && !slotSchema.validate(value)) {
      errors.push({
        slot,
        message: `槽位 ${slot} 类型错误`,
        expected: slotSchema.type,
        actual: typeof value,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

---

## 六、版本历史

| 版本   | 日期       | 变更                         |
| ------ | ---------- | ---------------------------- |
| v1.0.0 | 2026-01-10 | 初始版本，覆盖 37 个意图类型 |

---

**下一步**: 与 [regression-test-suite-standard.md](./regression-test-suite-standard.md) 配合使用
