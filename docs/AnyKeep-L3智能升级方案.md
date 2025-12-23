# AnyKeep L3 级智能升级方案

> 分析日期：2025-12-23
> 基于：YouMind-AI助手能力分析报告 + AI-Skills架构设计
> 目标：AnyKeep 达到 L3 级智能（有条件自动化）

---

## 一、智能等级定义

参照自动驾驶分级标准，定义知识管理工具的智能等级：

| 等级   | 名称       | 描述                           | 用户参与度 |
| ------ | ---------- | ------------------------------ | ---------- |
| **L0** | 无智能     | 纯工具，用户完全手动操作       | 100%       |
| **L1** | 辅助智能   | 提供建议，用户决策执行         | 80%        |
| **L2** | 部分自动   | 简单任务自动化，复杂任务需确认 | 50%        |
| **L3** | 有条件自动 | 大部分任务自动化，特殊情况介入 | 20%        |
| **L4** | 高度自动   | 几乎完全自动化                 | 5%         |
| **L5** | 完全自动   | 无需用户干预                   | 0%         |

---

## 二、现状对比分析

### 2.1 YouMind 能力评估

| 能力维度     | 实现状态                  | 智能等级 |
| ------------ | ------------------------- | -------- |
| 数据感知     | ✅ 可统计、查询项目数据   | L2       |
| 内容理解     | ✅ 可阅读并理解全文       | L2       |
| 格式转化     | ✅ 待办清单、摘要、结构化 | L2       |
| 操作执行     | ✅ 可创建页面、添加笔记   | L2       |
| 上下文记忆   | ✅ 项目级上下文           | L2       |
| **综合评估** |                           | **L2**   |

### 2.2 AnyKeep 当前能力评估

| 能力维度     | 实现状态      | 智能等级 |
| ------------ | ------------- | -------- |
| 数据感知     | ❌ 仅向量检索 | L0       |
| 内容理解     | ⚠️ 仅返回片段 | L1       |
| 格式转化     | ❌ 无         | L0       |
| 操作执行     | ❌ 无         | L0       |
| 上下文记忆   | ❌ 无持久化   | L0       |
| **综合评估** |               | **L0.5** |

### 2.3 差距矩阵

```
                    YouMind         AnyKeep当前        差距
数据感知            ████████░░       ██░░░░░░░░        🔴 6级
内容理解            ████████░░       ████░░░░░░        🟡 4级
格式转化            ████████░░       ░░░░░░░░░░        🔴 8级
操作执行            ████████░░       ░░░░░░░░░░        🔴 8级
上下文记忆          ████████░░       ░░░░░░░░░░        🔴 8级
```

---

## 三、AnyKeep AI-Skills 架构优势分析

### 3.1 与 YouMind 架构对比

| 对比项       | YouMind Agent+Tools | AnyKeep Agent+Skills |
| ------------ | ------------------- | -------------------- |
| **设计理念** | 功能导向            | 能力原子化           |
| **扩展性**   | 内置固定            | 插件式生态           |
| **可组合性** | 单一调用            | Skill 链式编排       |
| **标准化**   | 私有接口            | Zod Schema 标准化    |
| **监控能力** | 未知                | 内置指标收集         |
| **版本管理** | 未知                | 灰度发布支持         |

### 3.2 AnyKeep Skills 架构的差异化优势

```
┌─────────────────────────────────────────────────────────────────┐
│                    AnyKeep Skills 创新点                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Skill 建议机制（SkillSuggestion）                            │
│     └── 每个 Skill 输出后可建议下一步操作                         │
│     └── Agent 可根据建议自动编排多步骤流程                        │
│                                                                 │
│  2. 前置输出传递（previousOutputs）                               │
│     └── Skill 链式执行时共享上下文                                │
│     └── 实现复杂工作流的信息传递                                  │
│                                                                 │
│  3. 生态化设计                                                   │
│     └── 第三方 Skill 开发 SDK                                    │
│     └── Skill 市场                                               │
│     └── 私有 Skill（ToB 场景）                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 四、达到 L3 级智能的关键建议

### 4.1 L3 的核心特征

**有条件自动化**意味着：

- 80% 的日常任务无需用户干预
- 系统主动感知、主动行动
- 仅在「不确定」或「高风险」时请求确认

### 4.2 实现 L3 的六大关键能力

#### 能力 1：主动感知（Proactive Awareness）

| 能力           | YouMind     | AnyKeep 当前 | L3 目标                  |
| -------------- | ----------- | ------------ | ------------------------ |
| 新收藏自动处理 | ⚠️ 手动触发 | ❌ 无        | ✅ 自动摘要+分类+标签    |
| 内容变化检测   | ❌ 无       | ❌ 无        | ✅ 链接失效/内容更新通知 |
| 学习提醒       | ❌ 无       | ❌ 无        | ✅ 基于遗忘曲线推送复习  |

**实现方案**：

```typescript
// 后台任务 Skill：新收藏自动处理
export class AutoProcessSkill extends BaseSkill<
  AutoProcessInput,
  AutoProcessOutput
> {
  readonly metadata: SkillMetadata = {
    id: "auto-process",
    name: "新收藏自动处理",
    category: "utility",
    // 关键：可配置自动触发
    trigger: {
      event: "bookmark:created",
      conditions: ['platform === "WECHAT_OFFICIAL_ACCOUNT"'],
    },
  };

  async execute(input: AutoProcessInput, context: SkillContext) {
    // 1. 自动生成摘要
    const summary = await summarySkill.execute(
      { bookmarkId: input.bookmarkId },
      context,
    );

    // 2. 自动分类（高置信度直接应用）
    const classify = await classifySkill.execute(
      {
        bookmarkId: input.bookmarkId,
        autoApply: classify.data.suggestedFolder?.confidence > 0.9,
      },
      context,
    );

    // 3. 低置信度时创建待确认任务
    if (!classify.data.applied) {
      await this.createPendingTask(input.bookmarkId, classify.data);
    }
  }
}
```

#### 能力 2：意图推断（Intent Inference）

| 能力       | YouMind         | AnyKeep L3 目标                   |
| ---------- | --------------- | --------------------------------- |
| 简单指令   | ✅ "有多少收藏" | ✅ 基础                           |
| 模糊指令   | ⚠️ 有限         | ✅ "帮我整理一下" → 推断具体意图  |
| 上下文指令 | ✅ "把这个"     | ✅ 结合历史理解指代               |
| 复合指令   | ❌              | ✅ "总结这篇文章并保存到学习笔记" |

**实现方案**：

```typescript
// Agent 系统提示词增强
const L3_SYSTEM_PROMPT = `
你是 AnyKeep 智能助手，具备 L3 级自动化能力。

## 意图推断原则

1. 模糊指令处理：
   - 用户说"帮我整理一下" → 分析未分类收藏，生成整理建议
   - 用户说"最近有什么好内容" → 基于阅读历史推荐

2. 指代消解：
   - "这个"/"这篇" → 最近操作的书签
   - "它们" → 上下文提到的多个书签

3. 复合指令拆解：
   - 识别多个意图
   - 按依赖关系编排 Skills
   - 流式反馈每一步进度

## 自动化决策

- 置信度 > 90%：自动执行，事后通知
- 置信度 70-90%：执行后提供撤销选项
- 置信度 < 70%：请求用户确认
`;
```

#### 能力 3：自主决策（Autonomous Decision）

**关键：置信度分层决策**

```
┌─────────────────────────────────────────────────────────────────┐
│                    L3 自主决策流程                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户输入                                                        │
│     │                                                           │
│     ▼                                                           │
│  ┌─────────────────┐                                            │
│  │  Agent 意图理解  │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │  Skill 执行     │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────────────────────────┐                    │
│  │            置信度评估                     │                    │
│  │  ┌─────────┬─────────┬─────────┐        │                    │
│  │  │ > 90%   │ 70-90%  │ < 70%   │        │                    │
│  │  │ 自动执行 │ 执行+撤销│ 请求确认 │        │                    │
│  │  └────┬────┴────┬────┴────┬────┘        │                    │
│  └───────┼─────────┼─────────┼─────────────┘                    │
│          ▼         ▼         ▼                                  │
│       ┌──────┐  ┌──────┐  ┌──────┐                              │
│       │ 执行 │  │ 执行 │  │ 等待 │                              │
│       │ 通知 │  │ 撤销UI│  │ 确认 │                              │
│       └──────┘  └──────┘  └──────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**代码实现**：

```typescript
// src/lib/ai-skills/agent/decision.ts

export interface DecisionResult {
  action: "auto_execute" | "execute_with_undo" | "request_confirm";
  reason: string;
  confidence: number;
}

export class AutonomousDecisionMaker {
  /**
   * 基于置信度和操作风险评估自动化决策
   */
  evaluate(
    skillOutput: SkillOutput<unknown>,
    operationType: OperationType,
  ): DecisionResult {
    const confidence = skillOutput.data?.confidence ?? 0.5;
    const risk = this.assessRisk(operationType);

    // 高风险操作（删除、批量修改）降低自动化阈值
    const autoThreshold = risk === "high" ? 0.95 : 0.9;
    const undoThreshold = risk === "high" ? 0.85 : 0.7;

    if (confidence >= autoThreshold) {
      return {
        action: "auto_execute",
        reason: `置信度 ${(confidence * 100).toFixed(0)}%，自动执行`,
        confidence,
      };
    }

    if (confidence >= undoThreshold) {
      return {
        action: "execute_with_undo",
        reason: `置信度 ${(confidence * 100).toFixed(0)}%，执行并提供撤销`,
        confidence,
      };
    }

    return {
      action: "request_confirm",
      reason: `置信度 ${(confidence * 100).toFixed(0)}%，需要确认`,
      confidence,
    };
  }

  private assessRisk(type: OperationType): "low" | "medium" | "high" {
    const riskMap: Record<OperationType, "low" | "medium" | "high"> = {
      read: "low",
      create: "low",
      update: "medium",
      move: "medium",
      delete: "high",
      batch_update: "high",
      batch_delete: "high",
    };
    return riskMap[type] ?? "medium";
  }
}
```

#### 能力 4：持续学习（Continuous Learning）

| 能力         | 说明               | 实现方式                    |
| ------------ | ------------------ | --------------------------- |
| 用户偏好学习 | 记住用户的分类习惯 | 纠错反馈 → 更新分类模型权重 |
| 标签体系学习 | 理解用户的标签逻辑 | 分析标签共现模式            |
| 操作模式学习 | 预测用户下一步操作 | 序列建模                    |

**实现方案**：

```typescript
// src/lib/ai-skills/learning/correction-learning.ts

export class CorrectionLearningService {
  /**
   * 用户纠正分类后的学习
   */
  async learnFromCorrection(
    bookmarkId: number,
    originalFolderId: number,
    correctedFolderId: number,
    userId: string,
  ): Promise<void> {
    // 1. 记录纠错
    await this.recordCorrection(
      bookmarkId,
      originalFolderId,
      correctedFolderId,
      userId,
    );

    // 2. 分析纠错模式
    const patterns = await this.analyzePatterns(userId);

    // 3. 更新用户偏好缓存
    await this.updateUserPreferences(userId, patterns);

    // 4. 如果相同错误出现 3 次以上，调整分类模型参数
    const similarErrors = await this.getSimilarErrors(
      userId,
      originalFolderId,
      correctedFolderId,
    );
    if (similarErrors >= 3) {
      await this.adjustClassificationWeights(
        userId,
        originalFolderId,
        correctedFolderId,
      );
      logger.info(
        { userId, originalFolderId, correctedFolderId },
        "Classification weights adjusted",
      );
    }
  }
}
```

#### 能力 5：工作流编排（Workflow Orchestration）

**超越 YouMind 的关键能力**：

```
YouMind: 单个 Tool 调用 → 返回结果

AnyKeep L3:
  用户: "帮我整理这周收藏的技术文章"
    │
    ▼
  Agent 规划:
    1. list_bookmarks(filter: { date: 'this_week', tags: ['技术'] })
    2. for each bookmark:
       - summary(style: 'brief')
       - classify(autoApply: false)
    3. batch_operation(operation: 'move', suggestions: [...])
    4. 生成整理报告
    │
    ▼
  流式执行 + 实时反馈
```

**实现方案**：

```typescript
// src/lib/ai-skills/workflow/workflow.skill.ts

export class WorkflowSkill extends BaseSkill<WorkflowInput, WorkflowOutput> {
  readonly metadata: SkillMetadata = {
    id: "workflow",
    name: "工作流执行",
    description: "执行多步骤自动化工作流",
    category: "utility",
  };

  async *executeStream(
    input: WorkflowInput,
    context: SkillContext,
  ): AsyncGenerator<WorkflowStep> {
    const { steps, parallel } = input;

    if (parallel) {
      // 并行执行
      const promises = steps.map((step) => this.executeStep(step, context));
      const results = await Promise.all(promises);
      for (const result of results) {
        yield result;
      }
    } else {
      // 串行执行（支持上下文传递）
      let previousOutput: SkillOutput<unknown> | null = null;

      for (const step of steps) {
        const enhancedContext = {
          ...context,
          previousOutputs: previousOutput
            ? { [step.dependsOn ?? ""]: previousOutput }
            : undefined,
        };

        const result = await this.executeStep(step, enhancedContext);
        yield result;

        previousOutput = result.output;
      }
    }
  }
}
```

#### 能力 6：多模态理解（Multimodal Understanding）

| 能力     | YouMind | AnyKeep L3 目标           |
| -------- | ------- | ------------------------- |
| 图片理解 | ⚠️ 有限 | ✅ 识别图片内容，提取文字 |
| 视频理解 | ❌      | ✅ 视频摘要（未来）       |
| 文件理解 | ⚠️ PDF  | ✅ PDF/Word/PPT 解析      |

---

## 五、实施路线图

### 5.1 三阶段实施

```
┌─────────────────────────────────────────────────────────────────┐
│                    L3 智能升级路线图                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: L1→L2 基础能力建设（4周）                               │
│  ├── Week 1-2: 数据感知 Skills                                  │
│  │   ├── count_bookmarks                                        │
│  │   ├── list_bookmarks                                         │
│  │   └── get_stats                                              │
│  ├── Week 3: 内容理解 Skills                                     │
│  │   ├── read_bookmark_content                                  │
│  │   └── batch_read_content                                     │
│  └── Week 4: 操作执行 Skills                                     │
│      ├── create_bookmark                                        │
│      ├── update_bookmark                                        │
│      └── batch_operation                                        │
│                                                                 │
│  Phase 2: L2→L2.5 智能增强（4周）                                 │
│  ├── Week 5-6: Agent 意图理解优化                                 │
│  │   ├── 模糊指令处理                                            │
│  │   ├── 指代消解                                                │
│  │   └── 复合指令拆解                                            │
│  ├── Week 7: 置信度决策系统                                       │
│  │   ├── AutonomousDecisionMaker                                │
│  │   └── 撤销/确认 UI 组件                                       │
│  └── Week 8: 上下文记忆                                          │
│      ├── 会话级记忆                                              │
│      └── 项目级上下文                                            │
│                                                                 │
│  Phase 3: L2.5→L3 自动化升级（4周）                               │
│  ├── Week 9-10: 主动感知                                         │
│  │   ├── 新收藏自动处理                                          │
│  │   ├── 事件触发机制                                            │
│  │   └── 后台任务调度                                            │
│  ├── Week 11: 持续学习                                           │
│  │   ├── 纠错反馈学习                                            │
│  │   └── 用户偏好模型                                            │
│  └── Week 12: 工作流编排                                         │
│      ├── 多 Skill 链式执行                                       │
│      └── 自动化工作流模板                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 关键里程碑

| 里程碑           | 时间    | 验收标准                                    |
| ---------------- | ------- | ------------------------------------------- |
| M1: 追平 YouMind | Week 4  | 完成 8 个核心 Skills，通过 YouMind 对照测试 |
| M2: 超越 YouMind | Week 8  | 意图理解准确率 > 85%，复合指令支持          |
| M3: L3 达标      | Week 12 | 80% 日常任务无需用户干预                    |

### 5.3 成功指标

| 指标            | L2 基准 | L3 目标 |
| --------------- | ------- | ------- |
| 任务自动化率    | 30%     | 80%     |
| 用户干预次数/天 | 10+     | < 3     |
| 意图理解准确率  | 70%     | 90%     |
| 分类自动应用率  | 40%     | 85%     |
| 用户满意度      | 3.5/5   | 4.5/5   |

---

## 六、风险与缓解

| 风险           | 影响         | 缓解措施                     |
| -------------- | ------------ | ---------------------------- |
| 自动化误操作   | 用户信任受损 | 渐进式放权 + 撤销机制        |
| LLM 成本过高   | 运营压力     | 分级模型 + 缓存 + 本地小模型 |
| 意图理解偏差   | 用户体验差   | 纠错学习 + 确认机制          |
| 复杂工作流超时 | 用户等待     | 流式反馈 + 后台执行          |

---

## 七、总结

### 7.1 核心结论

1. **YouMind 达到 L2，AnyKeep 当前 L0.5**：差距主要在操作执行和上下文记忆

2. **AnyKeep AI-Skills 架构具备 L3 潜力**：
   - Skill 建议机制支持自主决策
   - 上下文传递支持工作流编排
   - 生态化设计支持持续扩展

3. **L3 的关键是「置信度驱动的自主决策」**：
   - 不是更多的功能，而是更智能的决策
   - 高置信度自动执行，低置信度请求确认

### 7.2 差异化竞争点

| 对比     | YouMind   | AnyKeep L3          |
| -------- | --------- | ------------------- |
| 智能等级 | L2        | L3                  |
| 核心特点 | 功能丰富  | 自动化程度高        |
| 用户感知 | "AI 工具" | "AI 助理"           |
| 独特能力 | 思维导图  | 主动感知 + 持续学习 |

### 7.3 行动建议

**立即开始**：

1. 完成 Phase 1 的 8 个核心 Skills
2. 实现基础 Agent 调度循环
3. 搭建置信度评估框架

**建议优先级**：

- P0: 数据感知 Skills（追平 YouMind 基础能力）
- P1: 置信度决策系统（L3 核心差异点）
- P2: 主动感知机制（超越竞品的独特能力）

---

_文档版本: 1.0.0_
_编写日期: 2025-12-23_
_状态: 待审核_
