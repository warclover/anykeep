# Skills 架构升级成本评估报告

> **版本**: 1.0.0
> **日期**: 2025-12-23
> **状态**: 架构评估完成

---

## 🎉 重大发现：现有架构已相当完善

经过深入代码分析，发现 **AnyKeep 已经具备完整的 Skills 基础架构**：

```
现有架构覆盖度: ████████████████░░░░ 80%
```

### 已实现的核心组件

| 组件                    | 文件位置                                   | 状态    | 说明                          |
| ----------------------- | ------------------------------------------ | ------- | ----------------------------- |
| **BaseSkill 基类**      | `src/lib/ai-skills/core/base-skill.ts`     | ✅ 完善 | 输入/输出验证、超时、错误处理 |
| **SkillRegistry**       | `src/lib/ai-skills/core/skill-registry.ts` | ✅ 完善 | 注册、查询、统计              |
| **SkillContext**        | `src/lib/ai-skills/core/types.ts`          | ✅ 完善 | userId、conversationId、偏好  |
| **toTool() 转换**       | `base-skill.ts:215`                        | ✅ 完善 | 自动转为 Vercel AI SDK        |
| **KnowledgeAgent 集成** | `src/lib/ai-agent/core/knowledge-agent.ts` | ✅ 完善 | Skills + Tools 合并使用       |
| **执行日志记录**        | `skill-execution-logger.ts`                | ✅ 完善 | 异步记录执行历史              |

### 现有 Skills (3 个)

| Skill      | 文件                                | 功能               |
| ---------- | ----------------------------------- | ------------------ |
| `classify` | `skills/classify/classify.skill.ts` | 智能推荐分类文件夹 |
| `search`   | `skills/search/search.skill.ts`     | 语义搜索书签       |
| `summary`  | `skills/summary/summary.skill.ts`   | 生成摘要和标签     |

---

## 📊 架构改动范围评估

### 不需要改动的部分 (70%)

```typescript
// ✅ 已完善，无需修改
- BaseSkill 抽象类
- SkillRegistry 注册表
- SkillContext 上下文
- toTool() 转换方法
- KnowledgeAgent 集成
- 确认流程 (PendingConfirmation)
- Tool 执行框架
```

### 需要扩展的部分 (25%)

```typescript
// ⚡ 需要新增，但基于现有架构扩展
- 新的 Skills 实现 (6 个 MVP)
- 意图理解层 (可选，LLM 原生能力足够)
- Skills 执行进度报告
- 交付物格式化
```

### 需要新增的部分 (5%)

```typescript
// 🆕 真正新增
- UI 组件：进度可视化、交付物展示
- Skill 执行进度事件流
```

---

## 💰 升级成本详细评估

### 成本对比 (原计划 vs 实际)

| 工作项            | 原计划 | 实际需要             | 节省    |
| ----------------- | ------ | -------------------- | ------- |
| **基础架构**      | 2 周   | ~~不需要~~           | 100%    |
| **意图理解层**    | 1 周   | 可选（LLM 原生能力） | 80%     |
| **Skills 编排层** | 1 周   | 已有 KnowledgeAgent  | 100%    |
| **MVP Skills**    | 3 周   | 3 周（实际工作）     | 0%      |
| **UI 升级**       | 1 周   | 0.5 周               | 50%     |
| **总计**          | 8 周   | **3.5 周**           | **56%** |

### 实际工作量分解

#### Phase 1: MVP Skills 开发 (3 周)

| 周次   | Skills                | 工作量 | 说明                   |
| ------ | --------------------- | ------ | ---------------------- |
| Week 1 | `smart_organize`      | 3-4 天 | 复用现有 folder Tools  |
|        | `folder_health_check` | 2-3 天 | 复用 folder 统计逻辑   |
| Week 2 | `topic_research`      | 3-4 天 | 复用 search Skill      |
|        | `content_digest`      | 2-3 天 | 复用 summary Skill     |
| Week 3 | `interview_prep`      | 3 天   | 组合 search + classify |
|        | `collection_insights` | 2 天   | 复用 get_stats Tool    |

#### Phase 2: UI 增强 (0.5 周)

| 任务           | 工作量 | 说明                   |
| -------------- | ------ | ---------------------- |
| 进度可视化组件 | 1 天   | 复用现有 Progress 组件 |
| 交付物展示卡片 | 1 天   | 复用现有 Card 组件     |
| Skill 快捷入口 | 0.5 天 | 在 AI 面板添加按钮     |

---

## 🛡️ 现有功能保护方案

### 零破坏性原则

```
┌─────────────────────────────────────────────────────────────┐
│                    架构分层隔离                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   新增 Skills (smart_organize, topic_research, ...)        │
│   ─────────────────────────────────────────────────────     │
│                     ↓ 调用                                  │
│   现有 Skills (classify, search, summary)  ← 不修改         │
│   ─────────────────────────────────────────────────────     │
│                     ↓ 调用                                  │
│   现有 Tools (40+ folder/query/action)     ← 不修改         │
│   ─────────────────────────────────────────────────────     │
│                     ↓ 调用                                  │
│   数据库层 (Supabase)                       ← 不修改         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

关键点：新 Skills 是在现有基础上的"组合"，不修改底层
```

### 具体保护措施

#### 1. 代码隔离

```
src/lib/ai-skills/
├── core/                    # ✅ 不修改
│   ├── base-skill.ts
│   ├── skill-registry.ts
│   └── types.ts
├── skills/
│   ├── classify/           # ✅ 不修改
│   ├── search/             # ✅ 不修改
│   ├── summary/            # ✅ 不修改
│   │
│   │  ↓↓↓ 新增目录 ↓↓↓
│   │
│   ├── organize/           # 🆕 新增
│   │   └── smart-organize.skill.ts
│   ├── research/           # 🆕 新增
│   │   └── topic-research.skill.ts
│   ├── learning/           # 🆕 新增
│   │   └── interview-prep.skill.ts
│   └── insights/           # 🆕 新增
│       └── collection-insights.skill.ts
```

#### 2. 测试保护

```typescript
// 现有测试不变
src/lib/ai-skills/__tests__/
├── skill-registry.test.ts  # ✅ 保持
├── base-skill.test.ts      # ✅ 保持
│
│  ↓↓↓ 新增测试 ↓↓↓
│
├── smart-organize.test.ts  # 🆕 新增
├── topic-research.test.ts  # 🆕 新增
└── ...
```

#### 3. 渐进式发布

```
Step 1: 新 Skills 默认禁用
        └── registerDefaultSkills() 不包含新 Skills

Step 2: Feature Flag 控制
        └── 只对测试用户开放

Step 3: 灰度发布
        └── 逐步扩大范围

Step 4: 全量发布
        └── 添加到 registerDefaultSkills()
```

#### 4. 回滚机制

```typescript
// skill-registry.ts 已支持
class SkillRegistry {
  // 可以单独禁用某个 Skill
  disable(skillId: string): void;

  // 可以查看启用状态
  isEnabled(skillId: string): boolean;
}
```

---

## 📐 新 Skill 实现示例

基于现有 `BaseSkill`，新 Skill 的实现非常简洁：

```typescript
// src/lib/ai-skills/skills/organize/smart-organize.skill.ts

import { z } from "zod";
import { BaseSkill } from "../../core/base-skill";
import type { SkillContext, SkillMetadata } from "../../core/types";
import { toolRegistry } from "@/lib/ai-agent/tools";

// 输入 Schema
const inputSchema = z.object({
  scope: z.enum(["all", "unclassified", "folder"]).default("unclassified"),
  folderId: z.number().optional(),
  dryRun: z.boolean().default(true).describe("是否仅预览不执行"),
});

// 输出 Schema
const outputSchema = z.object({
  summary: z.string(),
  suggestions: z.array(
    z.object({
      action: z.enum(["move", "merge", "delete", "tag"]),
      description: z.string(),
      affectedCount: z.number(),
    }),
  ),
  executed: z.boolean(),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export class SmartOrganizeSkill extends BaseSkill<Input, Output> {
  readonly metadata: SkillMetadata = {
    id: "smart_organize",
    name: "智能整理助手",
    description: "分析收藏现状，提供整理建议，可执行批量整理操作",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["analyze", "suggest", "batch-organize"],
    requiresConfirmation: true,
    estimatedDurationMs: 5000,
  };

  readonly inputSchema = inputSchema;
  readonly outputSchema = outputSchema;

  protected async executeInternal(
    input: Input,
    context: SkillContext,
  ): Promise<Output> {
    // Step 1: 分析现状（复用现有 Tools）
    const stats = await toolRegistry.execute(
      "get_stats",
      {},
      {
        userId: context.userId,
      },
    );

    const folders = await toolRegistry.execute(
      "list_folders",
      {
        includeArchived: false,
      },
      {
        userId: context.userId,
      },
    );

    // Step 2: 生成建议（基于分析结果）
    const suggestions = this.generateSuggestions(stats.data, folders.data);

    // Step 3: 如果不是 dryRun，执行操作
    if (!input.dryRun) {
      // 执行批量操作...
    }

    return {
      summary: `分析了 ${folders.data?.length || 0} 个文件夹，发现 ${suggestions.length} 个优化建议`,
      suggestions,
      executed: !input.dryRun,
    };
  }

  private generateSuggestions(stats: unknown, folders: unknown) {
    // 基于 LLM 或规则生成建议
    return [];
  }
}

export const smartOrganizeSkill = new SmartOrganizeSkill();
```

**关键点**：

- 继承 `BaseSkill`，自动获得验证、超时、日志能力
- 通过 `toolRegistry.execute()` 复用现有 Tools
- 不修改任何现有代码

---

## 🔄 集成方式

### 注册新 Skills

```typescript
// src/lib/ai-skills/register.ts

import { smartOrganizeSkill } from "./skills/organize/smart-organize.skill";
import { topicResearchSkill } from "./skills/research/topic-research.skill";
// ... 其他新 Skills

export function registerDefaultSkills(): void {
  // 现有 Skills（不变）
  skillRegistry.register(classifySkill);
  skillRegistry.register(searchSkill);
  skillRegistry.register(summarySkill);

  // 新增 Skills（渐进添加）
  skillRegistry.register(smartOrganizeSkill);
  skillRegistry.register(topicResearchSkill);
  // ...
}
```

### KnowledgeAgent 自动支持

```typescript
// knowledge-agent.ts 已有的代码，无需修改

const skillTools = getSkillsAsTools(() => ({
  userId: context.userId,
  conversationId: context.conversationId,
}));

const dataTools = getToolsAsVercelTools({...});

// 新注册的 Skills 自动被包含
const tools = mergeToolSets(skillTools, dataTools);
```

---

## ✅ 结论与建议

### 升级成本总结

| 维度           | 评估                          |
| -------------- | ----------------------------- |
| **代码改动量** | 🟢 低（新增为主，不修改现有） |
| **架构风险**   | 🟢 低（基于现有架构扩展）     |
| **测试覆盖**   | 🟢 新 Skills 独立测试         |
| **回滚难度**   | 🟢 低（可单独禁用）           |
| **时间成本**   | 🟢 3.5 周（原计划 8 周）      |

### 建议执行顺序

```
Week 1: smart_organize + folder_health_check
        └── 验证架构可行性，建立模式

Week 2: topic_research + content_digest
        └── 复用 search/summary，验证组合能力

Week 3: interview_prep + collection_insights
        └── 完成 MVP，开始 UI 优化

Week 3.5: UI 增强 + 测试完善
          └── 进度可视化、快捷入口
```

### 风险控制

1. **每完成 1 个 Skill**：立即部署到测试环境
2. **每完成 2 个 Skills**：进行集成测试
3. **全部完成后**：灰度发布 10% 用户
4. **无问题**：全量发布

---

**总结**：现有架构设计优秀，升级是**低成本、低风险**的扩展，而非重建。
