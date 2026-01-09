# Phase 1: 稳固根基 实施计划

**周期**: 2026-01-09 ~ 2026-01-22（2周）
**负责人**: AI 团队
**状态**: ✅ 已完成

---

## 执行摘要

| 任务                         | 优先级 | 状态      | 预计工时            |
| ---------------------------- | ------ | --------- | ------------------- |
| 修复 distributed-lock 测试   | P0     | ✅ 已通过 | 0h（已解决）        |
| 添加 Workflow/Skill 选择指南 | P0     | ✅ 已完成 | 0h（ADR-001）       |
| 增加高风险操作二次确认       | P1     | ✅ 已完成 | 8h                  |
| 意图路由规则覆盖率审计       | P1     | ✅ 已完成 | 0h（7条规则已添加） |

**Phase 1 完成度**: 100%

---

## 任务 1: distributed-lock 测试 ✅

### 状态: 已通过

```bash
# 测试结果 (2026-01-09)
PASS src/lib/workflow/triggers/__tests__/distributed-lock.test.ts
Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

### 后续行动

- [ ] 确认 CI 流水线绿灯
- [ ] 监控是否有间歇性失败

---

## 任务 2: Workflow/Skill 选择指南 ✅

### 状态: 已完成

**产出**: [ADR-001-workflow-vs-skill-boundary.md](architecture/ADR-001-workflow-vs-skill-boundary.md)

**核心决策**:

- Workflow = 多目标组合、用户可感知流程、需确认、定时/事件触发
- Skill = 单一意图、内部多步对用户透明、可被 Workflow 复用
- Tool = 原子操作、单一 API、< 2秒执行

### 后续行动

- [ ] 组织架构评审会 Review ADR-001
- [ ] 收集团队反馈并迭代

---

## 任务 3: 高风险操作二次确认增强

### 3.1 现状分析

**当前实现** ([response-templates.ts:33-51](../src/lib/ai-agent/core/prompts/response-templates.ts#L33-L51)):

```typescript
// 风险操作定义
export const RISK_OPERATIONS = {
  LOW: ["list", "search", "count", "get", "read", "preview"],
  MEDIUM: ["add_tag", "move", "classify", "export"],
  HIGH: ["delete", "remove", "batch_delete", "clear"],
};

// 批量确认阈值
export const BATCH_CONFIRMATION_THRESHOLD = 50;
```

**问题**:

1. 确认逻辑仅定义在常量中，未在执行层强制执行
2. 缺少 UI 层的确认对话框集成
3. 高风险操作未在 Tool 执行前拦截

### 3.2 实施方案

#### 3.2.1 创建确认拦截器

```typescript
// src/lib/ai-agent/safety/confirmation-interceptor.ts

export interface ConfirmationRequest {
  operationType: string;
  affectedCount: number;
  riskLevel: RiskLevel;
  description: string;
  affectedItems?: Array<{ id: string; title: string }>;
}

export interface ConfirmationResult {
  confirmed: boolean;
  modifiedScope?: string[]; // 用户可能缩小范围
}

export class ConfirmationInterceptor {
  /**
   * 检查操作是否需要确认
   */
  shouldConfirm(operation: string, affectedCount: number): boolean;

  /**
   * 生成确认请求
   */
  createConfirmationRequest(
    operation: string,
    affectedCount: number,
    affectedItems?: Array<{ id: string; title: string }>,
  ): ConfirmationRequest;

  /**
   * 等待用户确认（SSE 模式）
   */
  async waitForConfirmation(
    request: ConfirmationRequest,
    timeoutMs?: number,
  ): Promise<ConfirmationResult>;
}
```

#### 3.2.2 集成到 Tool 执行层

```typescript
// src/lib/ai-agent/tools/base-tool.ts (修改)

export abstract class BaseTool {
  async execute(params: unknown): Promise<ToolResult> {
    // 新增：确认拦截
    if (this.isHighRiskOperation()) {
      const affectedCount = await this.estimateAffectedCount(params);

      if (confirmationInterceptor.shouldConfirm(this.name, affectedCount)) {
        const request = confirmationInterceptor.createConfirmationRequest(
          this.name,
          affectedCount,
          await this.getAffectedItems(params),
        );

        const result =
          await confirmationInterceptor.waitForConfirmation(request);

        if (!result.confirmed) {
          return { success: false, message: "用户取消操作" };
        }
      }
    }

    return this.executeInternal(params);
  }
}
```

#### 3.2.3 前端确认对话框

```tsx
// src/components/ai/confirmation-dialog.tsx

interface ConfirmationDialogProps {
  open: boolean;
  request: ConfirmationRequest;
  onConfirm: (modifiedScope?: string[]) => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  open,
  request,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            确认操作
          </AlertDialogTitle>
          <AlertDialogDescription>
            即将{request.description}（影响 {request.affectedCount} 条内容）
          </AlertDialogDescription>
        </AlertDialogHeader>

        {request.affectedItems && request.affectedItems.length <= 10 && (
          <div className="max-h-40 overflow-y-auto">
            {request.affectedItems.map((item) => (
              <div key={item.id} className="text-sm text-muted-foreground">
                • {item.title}
              </div>
            ))}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm()}
            className="bg-destructive"
          >
            确认执行
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 3.3 实施步骤

| 步骤  | 任务                         | 预计工时 | 产出              |
| ----- | ---------------------------- | -------- | ----------------- |
| 3.3.1 | 创建 ConfirmationInterceptor | 2h       | 拦截器类          |
| 3.3.2 | 修改 BaseTool 集成拦截       | 2h       | Tool 执行流程更新 |
| 3.3.3 | 实现 SSE 确认等待机制        | 2h       | API 端点          |
| 3.3.4 | 前端 ConfirmationDialog      | 2h       | React 组件        |

### 3.4 测试用例

```typescript
describe("ConfirmationInterceptor", () => {
  it("should require confirmation for delete operations", () => {
    expect(interceptor.shouldConfirm("delete", 1)).toBe(true);
  });

  it("should require confirmation for batch operations > 50", () => {
    expect(interceptor.shouldConfirm("add_tag", 51)).toBe(true);
    expect(interceptor.shouldConfirm("add_tag", 50)).toBe(false);
  });

  it("should not require confirmation for read operations", () => {
    expect(interceptor.shouldConfirm("search", 1000)).toBe(false);
  });
});
```

---

## 任务 4: 意图路由规则覆盖率审计

### 4.1 现状分析

**当前规则统计** (基于 [intent-classifier.ts](../src/lib/ai-skills/router/intent-classifier.ts)):

| 意图类型 | 规则数 | 子类型覆盖                                                                          |
| -------- | ------ | ----------------------------------------------------------------------------------- |
| learn    | 5      | active_recall_start, mastery_stats, review_preferences, review, interview, path     |
| organize | 5      | cleanup, dedupe, expire, classify, monitor                                          |
| analyze  | 6      | wechat, inbox_digest, report, insight, knowledge_graph_explore, folder_health_check |
| create   | 9      | tts, bilibili*transcript, digest, note, share, synthesis, synthesis*\*              |
| query    | 11     | count, search, list, explain, trust_mode, folder_recommend, search_optimize, ...    |
| action   | 6      | inbox_triage, save, move, delete, tag, rename, revoke_plugin_auth                   |
| refine   | 4      | filter, check                                                                       |
| chitchat | 3      | greeting, help, thanks                                                              |

**总计**: 49 条规则

### 4.2 覆盖率缺口分析

#### 4.2.1 未覆盖的常见用户表达

| 用户表达           | 期望意图          | 当前结果        | 优先级 |
| ------------------ | ----------------- | --------------- | ------ |
| "把这几个放一起"   | organize:merge    | ❌ 未匹配       | P1     |
| "提醒我看这个"     | action:reminder   | ❌ 未匹配       | P2     |
| "这个链接还能用吗" | query:link_status | organize:expire | P1     |
| "帮我记住这个"     | action:save       | ❌ 未匹配       | P1     |
| "稍后阅读"         | action:read_later | ❌ 未匹配       | P1     |
| "标记为已读"       | action:mark_read  | ❌ 未匹配       | P2     |
| "收藏这个网址"     | action:save       | ✅ 匹配         | -      |
| "取消收藏"         | action:unsave     | action:delete   | P2     |
| "移到垃圾桶"       | action:trash      | action:delete   | P3     |

#### 4.2.2 Skill 映射缺口

**ModeSelector 已映射但无对应意图规则**:

- `learn:plan` → `reading_planner` (需添加意图规则)

**IntentClassifier 有规则但 ModeSelector 无映射**:

- `query:plugin_auth` → 无对应 Skill
- `action:revoke_plugin_auth` → 无对应 Skill
- `query:knowledge_graph` → 无对应 Skill
- `query:related_by_topic` → 无对应 Skill

### 4.3 实施方案

#### 4.3.1 新增意图规则

```typescript
// 新增规则 - 添加到 DEFAULT_RULES

// 合并/组合类
{
  pattern: /放(到)?一起|合并|组合|打包/,
  type: "organize",
  subType: "merge",
  complexity: "medium",
  weight: 75,
},

// 提醒类
{
  pattern: /提醒.{0,3}(我|看)|设置.{0,3}提醒|待办/,
  type: "action",
  subType: "reminder",
  complexity: "simple",
  weight: 70,
},

// 稍后阅读
{
  pattern: /稍后.{0,3}(看|读|阅读)|待阅|read.?later/i,
  type: "action",
  subType: "read_later",
  complexity: "simple",
  weight: 72,
},

// 标记已读
{
  pattern: /标记.{0,3}已读|设为.{0,3}已读|已经.{0,3}看过/,
  type: "action",
  subType: "mark_read",
  complexity: "simple",
  weight: 65,
},

// 取消收藏（与删除区分）
{
  pattern: /取消.{0,3}收藏|移出.{0,3}收藏|不再.{0,3}收藏/,
  type: "action",
  subType: "unsave",
  complexity: "simple",
  weight: 60,
},

// 阅读计划（补全 learn:plan 映射）
{
  pattern: /阅读.{0,3}(计划|安排|规划)|读书.{0,3}计划/,
  type: "learn",
  subType: "plan",
  complexity: "medium",
  weight: 78,
},

// 链接状态检查（精确匹配）
{
  pattern: /(这个|那个)?.{0,3}链接.{0,3}(还|能)?.{0,3}(用|有效|打开)|能.{0,3}访问.{0,3}(吗|不)/,
  type: "query",
  subType: "link_status",
  complexity: "simple",
  weight: 80,
},
```

#### 4.3.2 补全 ModeSelector 映射

```typescript
// 新增映射 - 添加到 DEFAULT_SKILL_MAPPINGS

// 合并操作
"organize:merge": {
  skillId: "batch_organize",  // 复用批量整理
  name: "合并整理助手",
  minComplexity: "medium",
  enabled: true,
},

// 阅读计划
"learn:plan": {
  skillId: "reading_planner",
  name: "阅读计划助手",
  minComplexity: "medium",
  enabled: true,
},

// 链接状态检查
"query:link_status": {
  skillId: "link_health_check",
  name: "链接状态检查",
  enabled: true,
},
```

### 4.4 实施步骤

| 步骤  | 任务                   | 预计工时 | 产出                      |
| ----- | ---------------------- | -------- | ------------------------- |
| 4.4.1 | 收集用户高频表达日志   | 2h       | 表达词库                  |
| 4.4.2 | 添加新意图规则 (7条)   | 3h       | intent-classifier.ts 更新 |
| 4.4.3 | 补全 ModeSelector 映射 | 2h       | mode-selector.ts 更新     |
| 4.4.4 | 编写测试用例           | 3h       | 测试文件                  |
| 4.4.5 | 意图覆盖率报告工具     | 2h       | 审计脚本                  |

### 4.5 测试用例

```typescript
describe("Intent Coverage", () => {
  const testCases = [
    { input: "把这几个放一起", expected: "organize:merge" },
    { input: "稍后阅读", expected: "action:read_later" },
    { input: "这个链接还能用吗", expected: "query:link_status" },
    { input: "帮我做个阅读计划", expected: "learn:plan" },
    { input: "标记为已读", expected: "action:mark_read" },
    { input: "取消收藏这个", expected: "action:unsave" },
    { input: "提醒我明天看这个", expected: "action:reminder" },
  ];

  testCases.forEach(({ input, expected }) => {
    it(`should classify "${input}" as ${expected}`, async () => {
      const result = await classifier.classify(input);
      expect(`${result.type}:${result.subType}`).toBe(expected);
    });
  });
});
```

---

## 时间线

```
Week 1 (01/09 - 01/15)
├── Day 1-2: 任务 3.3.1-3.3.2 (ConfirmationInterceptor + Tool 集成)
├── Day 3: 任务 3.3.3 (SSE 确认机制)
├── Day 4: 任务 3.3.4 (前端组件)
└── Day 5: 测试 + Code Review

Week 2 (01/16 - 01/22)
├── Day 1: 任务 4.4.1 (收集用户表达)
├── Day 2-3: 任务 4.4.2-4.4.3 (规则 + 映射)
├── Day 4: 任务 4.4.4-4.4.5 (测试 + 审计工具)
└── Day 5: 验收 + 文档更新
```

---

## 风险与缓解

| 风险             | 概率 | 影响 | 缓解措施                  |
| ---------------- | ---- | ---- | ------------------------- |
| 新规则冲突       | 中   | 中   | 消歧规则兜底 + 权重调优   |
| 确认弹窗影响体验 | 中   | 低   | 阈值可配置 + 信任模式绕过 |
| 测试覆盖不足     | 低   | 中   | 边界用例专项测试          |

---

## 验收标准

### 任务 3 验收

- [ ] 删除操作必须弹出确认对话框
- [ ] 批量操作 > 50 条显示确认
- [ ] 用户取消后操作中止
- [ ] 单元测试覆盖率 > 80%

### 任务 4 验收

- [ ] 新增 7+ 条意图规则
- [ ] 意图测试用例全部通过
- [ ] 覆盖率审计工具可用
- [ ] 无新增规则冲突

---

## 附录

### A. 意图类型完整列表

```typescript
type IntentType =
  | "query" // 查询
  | "action" // 操作
  | "organize" // 整理
  | "analyze" // 分析
  | "create" // 创建
  | "learn" // 学习
  | "refine" // 筛选
  | "chitchat"; // 闲聊
```

### B. 风险等级定义

| 等级   | 操作类型         | 影响   | 确认策略       |
| ------ | ---------------- | ------ | -------------- |
| LOW    | 读取、预览       | 无     | 无需确认       |
| MEDIUM | 标签、移动、导出 | 可逆   | 批量 > 50 确认 |
| HIGH   | 删除、清除       | 不可逆 | 始终确认       |

---

## 变更记录

| 日期       | 版本 | 变更     |
| ---------- | ---- | -------- |
| 2026-01-09 | 1.0  | 初始版本 |
