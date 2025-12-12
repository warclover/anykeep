# 智能分类系统 V3 统一化实施计划

> **版本**: 3.1.0
> **日期**: 2025-12-07
> **状态**: ✅ 已完成

---

## 一、背景与目标

### 1.1 当前问题

系统中存在**两套并行的分类系统**，导致用户体验混乱：

```
用户保存书签
    │
    ├─► 【V1 旧系统 - 前端主动调用】
    │      └─► /api/ai/recommend-folder → 显示推荐 Toast
    │              例如："新建「内容分类与标签管理」70% 匹配"
    │
    └─► 【V3 新系统 - 后端自动执行】
           └─► classifyBookmarkV2 → 实际执行分类
                 例如：分类到"待整理"或"claude 学习"
```

**结果**：用户看到的推荐 ≠ 实际分类结果，造成混淆。

### 1.2 目标

- ✅ **统一使用 V3 分类系统**，废弃 V1 的前端调用
- ✅ **保持用户体验**：分类完成后正确通知用户
- ✅ **简化架构**：减少代码复杂度和维护成本

---

## 二、当前架构分析

### 2.1 V1 旧系统（前端主动调用）

| 组件         | 文件                                    | 说明                    |
| ------------ | --------------------------------------- | ----------------------- |
| 推荐 API     | `/api/ai/recommend-folder/route.ts`     | 调用 DeepSeek 获取推荐  |
| 自动分类 API | `/api/bookmarks/auto-classify/route.ts` | 根据置信度执行分类      |
| 前端 Hook    | `use-folder-recommendation.ts`          | 串联两个 API            |
| 推荐 Toast   | `folder-recommendation-toast.tsx`       | 显示推荐卡片            |
| 调用入口     | `home-page-client.tsx:540-553`          | `handleBookmarkCreated` |

**调用时机**：书签创建后，前端主动调用

### 2.2 V3 新系统（后端自动执行）

| 组件     | 文件                         | 说明                        |
| -------- | ---------------------------- | --------------------------- |
| 集成层   | `integration.ts`             | `classifyBookmarkV2()` 函数 |
| 分类服务 | `classification.service.ts`  | 5 层匹配策略                |
| 调用入口 | `bookmarks/route.ts:343-364` | AI 内容生成后异步调用       |

**调用时机**：AI 内容生成完成后，后端自动执行

### 2.3 问题：并行执行导致冲突

```
书签创建 → 返回响应
    │
    ├─► 前端调用 V1：显示 Toast "新建「xxx」"
    │
    └─► 后端执行 V3：实际分类到不同文件夹
```

---

## 三、统一后的架构设计

### 3.1 新分类流程

```
用户保存书签
    │
    └─► POST /api/bookmarks
           │
           ├─ 立即返回 { status: "PROCESSING" }
           │
           └─► 后台异步任务
                 │
                 ├─ 1. 获取标题（如需）
                 ├─ 2. 智能内容提取 (Jina Reader)
                 ├─ 3. 生成 AI 摘要 + 标签
                 ├─ 4. 生成向量嵌入
                 │
                 └─ 5. V3 智能分类 (classifyBookmarkV2)
                       │
                       ├─ 5 层匹配策略:
                       │   ├─ k-NN 直接锁定 (≥85% 相似度)
                       │   ├─ 指纹匹配
                       │   ├─ 标签匹配
                       │   ├─ 向量相似度
                       │   └─ 通用分类
                       │
                       └─► 分类完成 → 更新书签记录
                             │
                             └─► 前端轮询检测到变化
                                   │
                                   └─► 显示分类结果通知
```

### 3.2 数据模型增强

```sql
-- 书签表新增字段
ALTER TABLE bookmarks
ADD COLUMN classification_status TEXT DEFAULT 'pending'
  CHECK (classification_status IN ('pending', 'classified', 'suggested', 'inbox'));

ALTER TABLE bookmarks
ADD COLUMN classification_result JSONB;
```

```typescript
// TypeScript 类型
interface ClassificationResult {
  folderId: number | null;
  folderName: string;
  confidence: number;
  action: "classify" | "suggest_new" | "inbox";
  suggestionId?: number;
  timestamp: string;
}
```

---

## 四、实施阶段

### 阶段 1：后端增强（低风险）

**目标**：V3 分类完成后将结果写入书签记录

| #   | 任务                                            | 文件                    | 改动量 |
| --- | ----------------------------------------------- | ----------------------- | ------ |
| 1.1 | 创建数据库迁移：添加分类状态字段                | 新建 migration          | ~20 行 |
| 1.2 | 更新 `classifyBookmarkV2` 写入分类结果          | `integration.ts`        | ~30 行 |
| 1.3 | 增强 `/api/bookmarks/batch-status` 返回分类状态 | `batch-status/route.ts` | ~15 行 |

**迁移 SQL**：

```sql
-- supabase/migrations/20251207_add_classification_status.sql

-- 添加分类状态字段
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS classification_status TEXT DEFAULT 'pending';

-- 添加分类结果 JSON 字段
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS classification_result JSONB;

-- 添加约束
ALTER TABLE bookmarks
ADD CONSTRAINT chk_classification_status
CHECK (classification_status IN ('pending', 'classified', 'suggested', 'inbox'));

-- 更新现有记录
UPDATE bookmarks
SET classification_status = CASE
  WHEN folder_id IS NOT NULL THEN 'classified'
  ELSE 'pending'
END
WHERE classification_status IS NULL;

COMMENT ON COLUMN bookmarks.classification_status IS '分类状态: pending/classified/suggested/inbox';
COMMENT ON COLUMN bookmarks.classification_result IS '分类结果详情 JSON';
```

**代码改动 (integration.ts)**：

```typescript
// 在 classifyBookmarkV2 函数末尾添加
async function updateBookmarkClassificationStatus(
  supabase: SupabaseClient,
  bookmarkId: number,
  result: ClassificationResult,
) {
  await supabase
    .from("bookmarks")
    .update({
      classification_status:
        result.action === "classify"
          ? "classified"
          : result.action === "suggest_new"
            ? "suggested"
            : "inbox",
      classification_result: {
        folderId: result.folderId,
        folderName: result.folderName,
        confidence: result.confidence,
        action: result.action,
        suggestionId: result.suggestionId,
        timestamp: new Date().toISOString(),
      },
    })
    .eq("id", bookmarkId);
}
```

---

### 阶段 2：前端重构（中等风险）

**目标**：移除 V1 调用，改用轮询获取 V3 分类结果

| #   | 任务                  | 文件                                   | 改动量      |
| --- | --------------------- | -------------------------------------- | ----------- |
| 2.1 | 创建分类结果轮询 Hook | 新建 `use-classification-polling.ts`   | ~60 行      |
| 2.2 | 创建分类结果通知组件  | 新建 `classification-result-toast.tsx` | ~50 行      |
| 2.3 | 移除 V1 推荐调用      | `home-page-client.tsx`                 | 删除 ~20 行 |
| 2.4 | 集成新轮询逻辑        | `home-page-client.tsx`                 | ~15 行      |

**新 Hook (use-classification-polling.ts)**：

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ClassificationResult {
  folderId: number | null;
  folderName: string;
  confidence: number;
  action: "classify" | "suggest_new" | "inbox";
}

export function useClassificationPolling() {
  const router = useRouter();
  const [pendingBookmarks, setPendingBookmarks] = useState<number[]>([]);

  // 添加待轮询的书签
  const trackBookmark = useCallback((bookmarkId: number) => {
    setPendingBookmarks((prev) => [...prev, bookmarkId]);
  }, []);

  // 轮询检查分类状态
  useEffect(() => {
    if (pendingBookmarks.length === 0) return;

    const pollInterval = setInterval(async () => {
      const ids = pendingBookmarks.join(",");
      const response = await fetch(`/api/bookmarks/batch-status?ids=${ids}`);

      if (!response.ok) return;

      const { data } = await response.json();
      const completed: number[] = [];

      for (const bookmark of data || []) {
        if (bookmark.classificationStatus !== "pending") {
          completed.push(bookmark.id);
          showClassificationNotification(bookmark.classificationResult);
        }
      }

      if (completed.length > 0) {
        setPendingBookmarks((prev) =>
          prev.filter((id) => !completed.includes(id)),
        );
        router.refresh();
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [pendingBookmarks, router]);

  return { trackBookmark, pendingCount: pendingBookmarks.length };
}

function showClassificationNotification(result: ClassificationResult | null) {
  if (!result) return;

  switch (result.action) {
    case "classify":
      toast.success(`已自动归类到「${result.folderName}」`, {
        icon: "✨",
        description: `AI 智能分类 (${result.confidence}% 置信度)`,
      });
      break;
    case "suggest_new":
      toast.success(`已创建并归类到「${result.folderName}」`, {
        icon: "📁",
        description: "AI 建议的新文件夹",
      });
      break;
    case "inbox":
      toast.info("已放入「待整理」文件夹", {
        icon: "📥",
        description: "稍后可手动整理",
      });
      break;
  }
}
```

**前端集成改动 (home-page-client.tsx)**：

```typescript
// 移除这段代码:
// const { fetchRecommendation } = useFolderRecommendation();
// const handleBookmarkCreated = (bookmark) => {
//   fetchRecommendation(bookmark.id, ...);
// };

// 改为:
import { useClassificationPolling } from "@/hooks/use-classification-polling";

// 在组件内:
const { trackBookmark } = useClassificationPolling();

const handleBookmarkCreated = (bookmark: Bookmark) => {
  // 追踪书签，等待 V3 分类完成
  if (!bookmark.folder_id) {
    trackBookmark(bookmark.id);
  }
};
```

---

### 阶段 3：清理与优化（低风险）

| #   | 任务                   | 文件                        | 说明                               |
| --- | ---------------------- | --------------------------- | ---------------------------------- |
| 3.1 | 标记 V1 API 为废弃     | `recommend-folder/route.ts` | 添加 `@deprecated`                 |
| 3.2 | 移除 V1 开关检查       | `integration.ts`            | 删除 `shouldUseV2Classification()` |
| 3.3 | 更新 CLAUDE.md 文档    | `CLAUDE.md`                 | 记录新架构                         |
| 3.4 | 删除未使用代码（可选） | 多个文件                    | 清理旧组件                         |

**废弃文件清单**：

```
src/app/api/ai/recommend-folder/route.ts          # 标记 @deprecated
src/app/api/bookmarks/auto-classify/route.ts      # 标记 @deprecated
src/hooks/use-folder-recommendation.ts            # 重写或删除
src/components/bookmark/folder-recommendation-toast.tsx  # 删除
```

---

## 五、API 变更

### 5.1 增强 `/api/bookmarks/batch-status`

**当前响应**：

```json
{
  "data": [{ "id": 123, "status": "COMPLETED", "ai_summary": "..." }]
}
```

**新增字段**：

```json
{
  "data": [
    {
      "id": 123,
      "status": "COMPLETED",
      "ai_summary": "...",
      "classificationStatus": "classified",
      "classificationResult": {
        "folderId": 2,
        "folderName": "claude 学习",
        "confidence": 90,
        "action": "classify",
        "timestamp": "2025-12-07T13:55:08.000Z"
      }
    }
  ]
}
```

---

## 六、风险评估与缓解

| 风险               | 影响 | 缓解措施                      |
| ------------------ | ---- | ----------------------------- |
| 轮询增加服务器负载 | 中   | 设置 2 秒间隔，分类完成后停止 |
| 迁移期间兼容性     | 低   | 保留 V1 API 但标记废弃        |
| 用户体验变化       | 低   | 新通知更清晰，显示实际结果    |
| 数据库迁移失败     | 低   | 使用 `IF NOT EXISTS` 安全迁移 |

---

## 七、验收标准

### 功能验收

- [ ] 保存新书签后，V3 分类正确执行
- [ ] 分类完成后显示正确的结果通知
- [ ] 高置信度（≥80%）自动分类
- [ ] 中置信度（60-79%）显示建议
- [ ] 低置信度（<60%）自动放入待整理
- [ ] 系统文件夹不再被作为分类目标

### 技术验收

- [ ] 无 V1 API 前端调用
- [ ] 分类状态正确写入数据库
- [ ] 轮询在分类完成后停止
- [ ] 无内存泄漏

---

## 八、时间估算

| 阶段             | 预估时间       | 依赖   |
| ---------------- | -------------- | ------ |
| 阶段 1：后端增强 | 1-2 小时       | 无     |
| 阶段 2：前端重构 | 2-3 小时       | 阶段 1 |
| 阶段 3：清理优化 | 0.5-1 小时     | 阶段 2 |
| 测试验证         | 1 小时         | 阶段 2 |
| **总计**         | **4.5-7 小时** | -      |

---

## 九、文件变更清单

### 新增文件

- `supabase/migrations/20251207_add_classification_status.sql`
- `src/hooks/use-classification-polling.ts`

### 修改文件

- `src/lib/classification/integration.ts` - 更新分类结果写入
- `src/app/api/bookmarks/batch-status/route.ts` - 增强返回数据
- `src/components/home/home-page-client.tsx` - 移除 V1，集成轮询

### 废弃文件

- `src/app/api/ai/recommend-folder/route.ts` - 标记 @deprecated
- `src/app/api/bookmarks/auto-classify/route.ts` - 标记 @deprecated
- `src/hooks/use-folder-recommendation.ts` - 废弃
- `src/components/bookmark/folder-recommendation-toast.tsx` - 废弃

---

## 十、审批选项

请确认是否开始执行此计划：

1. ✅ **批准并开始执行**
2. 🔄 **需要修改后再审核**
3. ❌ **暂不执行**

---

## 附录：调用链对比

### 改动前

```
用户保存书签
    │
    ├─► POST /api/bookmarks (立即返回)
    │      └─► 后台: generateAIContent → classifyBookmarkV2 (V3)
    │
    └─► 前端: useFolderRecommendation.fetchRecommendation
           ├─► POST /api/ai/recommend-folder (V1)
           └─► POST /api/bookmarks/auto-classify (V1)
                  └─► 显示 Toast（可能与 V3 结果不一致！）
```

### 改动后

```
用户保存书签
    │
    └─► POST /api/bookmarks (立即返回)
           │
           ├─► 后台: generateAIContent
           │         → classifyBookmarkV2 (V3)
           │         → 更新 classification_status
           │
           └─► 前端: useClassificationPolling.trackBookmark
                  → 轮询 batch-status
                  → 检测到分类完成
                  → 显示正确的结果通知 ✅
```
