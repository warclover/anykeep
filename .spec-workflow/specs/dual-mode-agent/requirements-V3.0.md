# 双模式智能体系统 - 需求文档 (V3.0 独立开发者版)

## 概述

### 项目背景

AnyKeep 需要升级为支持**流体升级 (Fluid Escalation)** 的智能体系统。本版本采用**独立开发者友好**的精简策略：用规则引擎冒充 AI，用覆盖式恢复替代复杂事务，3 周内交付可用版本。

### 核心设计哲学

> **"Agent 的智能，80% 来自于对场景的预判，20% 来自于 LLM 的推理。"**
>
> 用户不在乎背后是 GPT-4 还是 `if (lang === 'en')`，他们只在乎**结果对不对**。

### 独立开发者版策略

| 原方案        | 独立开发者版     | 收益                       |
| ------------- | ---------------- | -------------------------- |
| LLM 推理      | 规则引擎冒充     | 零 Token 成本，10ms 响应   |
| Undo Log 事务 | 覆盖式恢复       | 减少 80% 后端开发量        |
| 复杂乐观动画  | React Query 原生 | 砍掉前端状态机噩梦         |
| 精确能量数值  | 电池图标三档     | 降低用户焦虑，提高付费转化 |

### 核心价值

| 用户类型 | 痛点           | 解决方案                   |
| -------- | -------------- | -------------------------- |
| 新用户   | 不知道能做什么 | 规则引擎主动推荐操作       |
| 熟练用户 | 重复操作效率低 | 一键执行推荐操作           |
| 高级用户 | 想要更多自动化 | Cmd+K 入口（规则引擎后端） |

---

## 功能需求

### REQ-1: 预测性操作 (核心功能)

**用户故事:** 作为用户，我想要在选中内容后看到 AI 推荐的智能操作，以便在最需要时获得工具支持。

#### 验收标准

1. WHEN 用户选中多个收藏 THEN 系统 SHALL 在 Action Bar ���示推荐按钮（桌面端）
2. WHEN 用户在移动端选中多个收藏 THEN 系统 SHALL 将 FAB 从 "+" 变形为 "✨"
3. WHEN 推荐按钮生成 THEN 系统 SHALL 在 10ms 内完成（纯规则引擎）
4. WHEN 用户点击推荐按钮 THEN 系统 SHALL 显示 "✨ AI 正在思考..." 后执行
5. WHEN 用户连续忽略某类推荐 3 次 THEN 系统 SHALL 降低该类推荐权重

#### 规则引擎 (20 条高频规则)

```typescript
// 核心规则集 - 硬编码，零 LLM 调用
const PREDICTION_RULES: PredictionRule[] = [
  // 语言相关
  { condition: "all_english", action: "翻译", icon: "🌐", priority: 95 },
  { condition: "all_chinese", action: "生成摘要", icon: "📝", priority: 80 },
  { condition: "mixed_language", action: "统一翻译", icon: "🌐", priority: 85 },

  // 文件类型
  { condition: "all_pdf", action: "提取文本", icon: "📄", priority: 90 },
  { condition: "all_video", action: "提取字幕", icon: "🎬", priority: 88 },
  { condition: "all_article", action: "生成摘要", icon: "📝", priority: 85 },

  // 来源相关
  {
    condition: "same_domain",
    action: "归档到来源文件夹",
    icon: "🗂️",
    priority: 82,
  },
  {
    condition: "same_author",
    action: "创建作者合集",
    icon: "👤",
    priority: 78,
  },
  {
    condition: "same_platform",
    action: "按平台整理",
    icon: "📱",
    priority: 75,
  },

  // ���量相关
  { condition: "count_gt_10", action: "批量整理", icon: "📦", priority: 70 },
  { condition: "count_gt_50", action: "智能分类", icon: "🏷️", priority: 72 },

  // 时间相关
  {
    condition: "unread_gt_7days",
    action: "生成摘要",
    icon: "📝",
    priority: 65,
  },
  { condition: "all_this_week", action: "生成周报", icon: "📊", priority: 68 },
  { condition: "all_today", action: "今日回顾", icon: "📅", priority: 60 },

  // 内容相关
  { condition: "has_duplicates", action: "去重", icon: "🧹", priority: 88 },
  {
    condition: "all_tech_articles",
    action: "技术摘要",
    icon: "💻",
    priority: 75,
  },
  { condition: "all_news", action: "新闻简报", icon: "📰", priority: 72 },

  // 标签相关
  { condition: "no_tags", action: "智能标签", icon: "🏷️", priority: 78 },
  { condition: "same_tags", action: "合并到文件夹", icon: "🗂️", priority: 70 },

  // 文件夹相关
  { condition: "no_folder", action: "智能归档", icon: "📁", priority: 80 },
];

// 规则匹配器
interface RuleMatch {
  action: string;
  icon: string;
  confidence: number; // 0-100
  affectedCount: number;
}

function matchRules(selection: Bookmark[]): RuleMatch[] {
  // 返回匹配的前 3 个规则
}
```

#### 桌面端 UI

```
┌──────────────────────────��──────────────────────────────────────┐
│ Action Bar                                                       │
│ [删除] [移动] [标签]              [✨ 翻译并提取摘要] ← 规则推荐  │
└─────────────────────────────────────────────────────────────────┘
```

#### 移动端 UI - 动态 FAB

```
默认状态:                      选中内容后:
┌─────────────────────┐        ┌─────────────────────┐
│                     │        │                     │
│   [书签列表...]     │        │   [书签列表...]     │
│                     │        │                     │
│              ┌───┐  │        │              ┌───┐  │
│              │ + │  │   →    │              │✨3│  │
│              └───┘  │        │              └───┘  │
└─────────────────────┘        └─────────────────────┘

点击 FAB 后弹出 Bottom Sheet:
┌─────────────────────────────────────────────────────────────────┐
│ ✨ AI 推荐操作                                            [✕]  │
├─────────────────────────────────────────────────────────────────┤
│ 🌐 翻译并提取摘要                                   5 篇英文   │
│ 🗂️ 归档到「前端开发」                              同一来源   │
│ 🏷️ 添加「React」标签                              内容匹配   │
└─────────────────────────────────────────────────────────────────┘
```

#### "假 AI" 体验设计

```
用户点击推荐按钮
        ↓
显示: "✨ AI 正在分析..." (延迟 300-500ms)
        ↓
实际执行: 规则引擎预设的 Tool 串联
        ↓
显示: 执行进度条
        ↓
完成: "✅ 已完成"

用户感知: "这 AI 真懂我！"
实际成本: 0 Token
```

---

### REQ-2: 执行监控与高亮

**用户故事:** 作为用户，我想要看到操作正在执行的进度，以便了解发生了什么。

#### 验��标准

1. WHEN 推荐操作开始执行 THEN 系统 SHALL 显示状态栏进度
2. WHEN 操作影响某个书签 THEN 系统 SHALL 高亮该书签行 1.5 秒
3. WHEN 操作完成 THEN 系统 SHALL 显示完成 Toast 和撤销入口
4. WHEN 操作失败 THEN 系统 SHALL 显示错误 Toast 并刷新列表

#### 状态栏设计

```
┌─────────────────────────────────────────────────────────────────┐
│ [✨] 翻译中: 处理第 3/5 篇...                          [✕ 取消] │
└─────────────────────────────────────────────────────────────────┘
```

- 平时隐藏，执行时自动显示
- 显示当前步骤和进度
- 支持取消

#### 简单高亮效果

```typescript
// 高亮机制：简单的 CSS 动画，无复杂状态机
interface HighlightEvent {
  entityId: string;
  type: 'processing' | 'completed';
  duration: 1500;  // ms
}

// 前端订阅
useAgentHighlight(entityId: string): {
  isHighlighted: boolean;
  highlightType: 'processing' | 'completed' | null;
}
```

#### 极简乐观更新 (React Query 原生)

```typescript
// 不自己写状态机，用 React Query 原���能力
const mutation = useMutation({
  mutationFn: moveBookmark,
  onMutate: async (newData) => {
    // 乐观更新：立即更新缓存
    await queryClient.cancelQueries(['bookmarks'])
    const previous = queryClient.getQueryData(['bookmarks'])
    queryClient.setQueryData(['bookmarks'], old => /* 更新逻辑 */)
    return { previous }
  },
  onError: (err, newData, context) => {
    // 失败：Toast + 回滚缓存
    toast.error('操作失败，已恢复')
    queryClient.setQueryData(['bookmarks'], context.previous)
  },
  onSettled: () => {
    // 确保数据一致
    queryClient.invalidateQueries(['bookmarks'])
  },
})
```

**砍掉的复杂功能**：

- ❌ Bounce/Shake/Fade 回滚动画
- ❌ 自定义状态机
- ❌ pending/success/error/rollback 四态转换

**保留的简单功能**：

- ✅ React Query optimisticUpdate
- ✅ 失败时 Toast 提示
- ✅ 失败后自动刷新列表

---

### REQ-3: 简易回滚 (覆盖式恢复)

**用户故事:** 作为用户，我想要在操作完成后能够撤销，以便放心尝试 AI 功能。

#### 验收标准

1. WHEN 操作开始 THEN 系统 SHALL 将受影响实体的 JSON 存入快照表
2. WHEN 操作完成 THEN 系统 SHALL 显示 Toast "已完成 [撤销]"，持续 10 秒
3. WHEN 用户点击撤销 THEN 系统 SHALL 用快照 JSON 覆盖当前数据
4. WHEN 快照超过 24 小时 THEN 系统 SHALL 自动清理

#### 覆盖式恢复策略

```typescript
// 数据库表: operation_snapshots
interface OperationSnapshot {
  id: string;
  user_id: string;
  operation_id: string; // 本次操作的唯一 ID
  entity_type: "bookmark" | "folder" | "tag";
  entity_id: string;
  original_data: JsonB; // 操作前的完整 JSON
  created_at: Date;
  expires_at: Date; // 24 小时后
}

// 回滚逻辑：直接覆盖，不执行反向指令
async function rollback(operationId: string): Promise<void> {
  const snapshots = await db.operationSnapshots
    .where({ operation_id: operationId })
    .get();

  for (const snapshot of snapshots) {
    if (snapshot.entity_type === "bookmark") {
      // 直接用旧 JSON 覆盖
      await db.bookmarks.upsert(snapshot.original_data);
    }
    // ... 其他实体类型
  }

  // 恢复软删除的实体
  await db.bookmarks
    .where({ operation_id: operationId, deleted_at: { not: null } })
    .update({ deleted_at: null });
}
```

#### 简化的设计决策

| 原方案              | 新方案         | 理由                       |
| ------------------- | -------------- | -------------------------- |
| Undo Log (反向指令) | JSON 快照覆盖  | 100% 可靠，无指令依赖问题  |
| 部分回滚            | 仅支持整单撤销 | 简化 80% 代码              |
| 复杂冲突检测        | 直接覆盖       | 用户刚操作完，冲突概率极低 |

#### 撤销 UI

```
操作完成后 Toast (持续 10 秒):
┌─────────────────────────────────────────────────────────────────┐
│ ✅ 已翻译 5 篇文章                              [撤销] [✕]      │
└─────────────────────────────────────────────────────────────────┘

点击撤销后:
┌─────────────────────────────────────────────────────────────────┐
│ ↩️ 正在撤销...                                                  │
└─────────────────────────────────────────────────────────────────┘

撤销完成:
┌─────────────────────────────────────────────────────────────────┐
│ ✅ 已撤销，恢复到操作前状态                                      │
└────────────────────────��────────────────────────────────────────┘
```

---

### REQ-4: 全能指令框 (规则引擎后端)

**用户故事:** 作为高级用户，我想要通过快捷键输入目标，以便快速执行操作。

#### 验收标准

1. WHEN 用户按 `Cmd/Ctrl + K` THEN 系统 SHALL 显示指令框
2. WHEN 用户输入关键词 THEN 系统 SHALL 匹配预设命令（规则引擎）
3. WHEN 用户选择命令 THEN 系统 SHALL 执行对应的 Tool 串联
4. WHEN 用户按 `Esc` THEN 系统 SHALL 关闭指令框

#### 指令框设计

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 输入命令...                                             ⌘K   │
├─────────────────────────────────────────────────────────────────┤
│ 快捷命令                                                        │
│   🗂️ 整理收件箱         整理未分类的收藏                        │
│   📝 生成周报           本周收藏内容摘要                         │
│   🧹 清理重复           查找���删除重复书签                       │
│   🌐 翻译选中           翻译选中的英文内容                       │
│   📊 阅读统计           生成阅读数据报告                         │
└─────────────────────────────────────────────────────────────────┘
```

#### 预设命令集 (规则引擎)

```typescript
// 预设命令 - 关键词匹配，无 LLM
const PRESET_COMMANDS: PresetCommand[] = [
  {
    keywords: ["整理", "收件箱", "inbox", "organize"],
    name: "整理收件箱",
    description: "整理未分类的收藏",
    icon: "🗂️",
    tools: ["filter_uncategorized", "auto_categorize", "move_to_folders"],
  },
  {
    keywords: ["周报", "weekly", "report"],
    name: "生成周报",
    description: "本周收藏内容摘要",
    icon: "📝",
    tools: ["filter_this_week", "generate_summary"],
  },
  {
    keywords: ["重复", "duplicate", "去重", "clean"],
    name: "清理重复",
    description: "查找并删除重复书签",
    icon: "🧹",
    tools: ["find_duplicates", "confirm_delete", "soft_delete"],
  },
  {
    keywords: ["翻译", "translate"],
    name: "翻译选中",
    description: "翻译选中的英文内容",
    icon: "🌐",
    tools: ["detect_language", "translate_content"],
  },
  {
    keywords: ["统计", "stats", "analytics"],
    name: "阅读统计",
    description: "生成阅读数据报告",
    icon: "📊",
    tools: ["collect_stats", "generate_report"],
  },
  // ... 更多预设命令
];

// 匹配逻辑
function matchCommand(input: string): PresetCommand[] {
  const normalized = input.toLowerCase().trim();
  return PRESET_COMMANDS.filter((cmd) =>
    cmd.keywords.some((kw) => normalized.includes(kw)),
  ).slice(0, 5);
}
```

**砍掉的复杂功能**：

- ❌ LLM 意图理解
- ❌ 动态生成执行计划
- ❌ 复杂的步骤预览

**保留的简单功能**：

- ✅ 关键词匹配
- ✅ 预设命令列表
- ✅ 直接执行 Tool 串联

---

### REQ-5: 电池系统 (模糊化成本)

**用户故事:** 作为用户，我想要了解 AI 功能的使用限制，但不想每次都算账。

#### 验收标准

1. WHEN L1/L2 操作执行 THEN 系统 SHALL NOT 显示任何成本信息
2. WHEN 用户剩余次数 >50% THEN 系统 SHALL 显示满电图标 🔋
3. WHEN 用户剩余次数 20-50% THEN 系统 SHALL 显示中电图标 🔋
4. WHEN 用户剩余次数 <20% THEN 系统 SHALL 显示低电图标 🪫
5. WHEN 用户次数耗尽 THEN 系统 SHALL 阻断并提示升级

#### 电池系统设计

```typescript
interface BatterySystem {
  // 配额
  quota: {
    free: {
      dailyOperations: 5; // 每日 5 次 AI 操作
      resetTime: "00:00";
    };
    pro: {
      dailyOperations: -1; // 无限
    };
  };

  // 电量显示
  getBatteryLevel(
    remaining: number,
    total: number,
  ): "full" | "medium" | "low" | "empty";

  // UI 显示规则
  display: {
    full: { icon: "🔋"; show: false }; // 不显示，用户无感
    medium: { icon: "🔋"; show: false }; // 不显示
    low: { icon: "🪫"; show: true; message: "今日 AI 次数即将用完" };
    empty: { icon: "⚡"; show: true; block: true };
  };
}
```

#### 配额耗尽 UI

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ 今日 AI 次数已用完                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 您今日的 5 次 AI 操作已全部使用。                                │
│                                                                 │
│ • 明日 00:00 将重置                                             │
│ • 升级 Pro 版解锁无限次数                                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│              [明天再试]  [升级 Pro 版]                           │
└─────────────────────────────────────────────────────────────────┘
```

**砍掉的复杂功能**：

- ❌ 精确能量数值显示
- ❌ 实时消耗追踪
- ❌ 预估成本计算

**保留的简单功能**：

- ✅ 简单计数器
- ✅ 电池图标三档
- ✅ 用完才阻断

---

### REQ-6: 检查点 (仅删除确认)

**用户故事:** 作为用户，我想要在执行删除操作前获得确认，以便防止误删。

#### 验收标准

1. WHEN 操作涉及删除 THEN 系统 SHALL 显示确认对话框
2. WHEN 用户确认删除 THEN 系统 SHALL 执行软删除
3. WHEN 用户取消 THEN 系统 SHALL 跳过该步骤继续执行

#### 删除确认 UI

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ 确认删除                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 即将删除 3 个书签:                                               │
│                                                                 │
│   📄 React 教程 (重复)                                          │
│   📄 Vue 入门 (重复)                                            │
│   📄 Angular 指南 (重复)                                        │
│                                                                 │
│ 删除后可在 30 天内从回收站恢复。                                  │
├─────────────────────────────────────────────────────────────────┤
│                              [取消]  [确认删除]                  │
└─────────────────────────────────────────────────────────────────┘
```

**砍掉的复杂功能**：

- ❌ 多级检查点
- ❌ 批量阈值检查点
- ❌ 可配置检查点规则

**保留的简单功能**：

- ✅ 删除操作必确认
- ✅ 显示将删除的内容
- ✅ 提示可恢复

---

## 非功能需求

### 性能要求

| 指标         | 目标值      | 测量方式             |
| ------------ | ----------- | -------------------- |
| 规则引擎匹配 | <10ms       | 选中到按钮显示       |
| 假 AI 延迟   | 300-500ms   | 故意延迟，增加智能感 |
| 操作执行     | <2s（平均） | 不含网络请求         |
| 高亮动画     | 60fps       | 简单 CSS 动画        |
| 快照恢复     | <1s         | 点击撤销到恢复       |

### 安全要求

1. **软删除**: 所有删除操作使用软删除，保留 30 天
2. **快照隔离**: 快照数据按用户隔离
3. **权限边界**: 规则引擎只能触发用户有权限的操作

### 可靠性要求

1. **快照持久化**: 操作前必须完成快照写入
2. **失败恢复**: 操作失败时自动刷新列表
3. **数据一致性**: React Query 确保缓存与数据库一致

### 可用性要求

1. **零学习成本**: 推荐按钮自动出现，用户无需学习
2. **移动端友好**: FAB 变形 + Bottom Sheet
3. **快捷键**: Cmd+K 快速入口

---

## 约束与假设

### 技术约束

1. 基于现有 Next.js 14 + React 架构
2. 复用现有 Tool Registry
3. 使用 React Query 管理状态
4. 快照存储在 Supabase PostgreSQL

### 业务约束

1. MVP 仅支持收藏管理操作
2. Free 用户每日 5 次 AI 操作
3. 快照保留 24 小时

### 假设

1. 规则引擎覆盖 80% 用户场景
2. 用户接受"假 AI"（只要结果对）
3. 网络延迟 <500ms（Supabase 云端）

---

## 词汇表

| 术语       | 定义                                   |
| ---------- | -------------------------------------- |
| 规则引擎   | 基于条件匹配的推荐系统，无 LLM 调用    |
| 预测性操作 | 根据选中内容推荐的操作按钮             |
| 覆盖式恢复 | 用 JSON 快照直接覆盖当前数据的回滚方式 |
| 电池系统   | 用满/中/低三档显示使用配额的机制       |
| 假 AI      | 用规则引擎冒充 AI 推理的策略           |

---

## 优先级矩阵

| 需求                 | 优先级 | 开发周期 | 复杂度 |
| -------------------- | ------ | -------- | ------ |
| REQ-1 预测性操作     | P0     | Week 1   | 中     |
| REQ-2 执行监控与高亮 | P0     | Week 2   | 低     |
| REQ-3 简易回滚       | P0     | Week 3   | 中     |
| REQ-4 全能指令框     | P1     | Week 2   | 低     |
| REQ-5 电池系统       | P1     | Week 3   | 低     |
| REQ-6 检查点         | P0     | Week 3   | 低     |

---

## 3 周开发路线图

```
Week 1: "看起来很聪明" (The Smart Facade)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
目标: 用户选中书签 → 看到魔法按钮 → 点击执行

开发任务:
├── 规则引擎核心
│   ├── 20 条高频规则实现
│   ├── 规则匹配器
│   └── 规则优先级排序
│
├── UI 组件
│   ├── 桌面端 Action Bar 推荐按钮
│   ├── 移动端 FAB 变形动画
│   └── Bottom Sheet 推荐列表
│
└── 假 AI 体验
    ├── "AI 正在思考..." 延迟
    └── 执行现有 Tools

交付物:
✅ 用户能看到智能推荐
✅ 点击后能执行操作
✅ 零 Token 成本

Week 2: "自动化流水线" (The Automation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
目标: 点击推荐 → 看到进度条 → 列表自动更新

开发任务:
├── 执行监控
│   ├── 状态栏组件
│   ├── 进度显示
│   └── 取消功能
│
├── 简单高亮
│   ├── CSS 高亮动画
│   ├── useAgentHighlight Hook
│   └── 虚拟列表适配
│
├── 极简乐观更新
│   ├── React Query 配置
│   └── 失败处理
│
└── 全能指令框
    ├── Cmd+K 入口
    ├── 关键词匹配
    └── 预设命令执行

交付物:
✅ 操作过程可视化
✅ 列表实时更新
✅ 快捷键入口

Week 3: "安��感与商业化" (Safety & Money)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
目标: 用户敢试错（有撤销），有付费动力（有限制）

开发任务:
├── 简易回滚
│   ├── operation_snapshots 表
│   ├── 快照写入逻辑
│   ├── 覆盖式恢复
│   └── 10 秒撤销 Toast
│
├── 电池系统
│   ├── 使用计数器
│   ├── 电池图标显示
│   └── 配额耗尽阻断
│
└── 检查点
    ├── 删除确认对话框
    └── 软删除逻辑

交付物:
✅ 操作可撤销
✅ Free 用户有限制
✅ 付费入口

正式上线 🚀
```

---

## 成功指标

| 指标           | 目标   | 测量方式       |
| -------------- | ------ | -------------- |
| 推荐按钮点击率 | >20%   | 点击/展示      |
| 操作完成率     | >95%   | 完成/发起      |
| 撤销使用率     | <3%    | 撤销/完成      |
| 规则覆盖率     | >80%   | 匹配/选中      |
| Pro 转化率     | >5%    | 配额耗尽后升级 |
| 用户满意度     | >4.5/5 | 操作后评分     |

---

## V2 规划 (后续迭代)

以下功能延后到 V2：

| 功能              | 优先级 | 说明                     |
| ----------------- | ------ | ------------------------ |
| L3 目标驱动 (LLM) | P2     | 真正的自然语言理解       |
| 偏好学习          | P2     | 根据用户行为调整规则权重 |
| 部分回滚          | P2     | 支持撤销单个步骤         |
| 复杂乐观动画      | P3     | Bounce/Shake 回滚动画    |
| 上下文桥接        | P2     | Agent 与 UI 深度集成     |

---

## 与 V2.1 的差异对比

| 模块     | V2.1                     | V3.0 独立开发者版   |
| -------- | ------------------------ | ------------------- |
| AI 后端  | LLM + 规则引擎           | 纯规则引擎          |
| 回滚机制 | Undo Log + 快照 + 软删除 | 覆盖式恢复 + 软删除 |
| 乐观更新 | 分层策略 + 复杂动画      | React Query 原生    |
| 成本显示 | 精确能量数值             | 电池图标三档        |
| 开发周期 | 6 周                     | 3 周                |
| 复杂度   | ★★★★★                    | ★★☆☆☆               |
