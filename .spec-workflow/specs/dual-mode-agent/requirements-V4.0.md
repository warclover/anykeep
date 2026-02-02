# 双模式智能体系统 - 需求文档 (V4.0 增强版)

## 概述

### 项目背景

AnyKeep 需要升级为支持**流体升级 (Fluid Escalation)** 的智能体系统。本版本基于 V3.0 独立开发者版，整合架构评审会的专家建议，增强可扩展性、可观测性和用户体验。

### 核心设计哲学

> **"用户不在乎背后是 GPT-4 还是 `if (lang === 'en')`，他们只在乎结果对不对。"**
>
> 用规则引擎实现"智能推荐"，用埋点验证假设，用数据驱动迭代。

### V4.0 增强策略

| 原 V3.0 方案    | V4.0 增强               | 收益                              |
| --------------- | ----------------------- | --------------------------------- |
| 20 条硬编码规则 | 可扩展 RuleRegistry     | 支持动态添加规则，无需改代码      |
| 无埋点          | 规则遥测系统            | 验证"80%覆盖率"假设，数据驱动迭代 |
| "AI 推荐"文案   | "智能推荐"文案          | 避免用户期望过高，降低认知风险    |
| 应用层清理快照  | Cron Job 自动清理       | 数据库层稳定可靠                  |
| 固定高亮动画    | 边框发光 + 减少动效选项 | 减少视觉干扰                      |

### 核心价值

| 用户类型 | 痛点           | 解决方案                   |
| -------- | -------------- | -------------------------- |
| 新用户   | 不知道能做什么 | 规则引擎主动推荐操作       |
| 熟练用户 | 重复操作效率低 | 一键执行推荐操作           |
| 高级用户 | 想要更多自动化 | Cmd+K 入口（规则引擎后端） |

---

## 功能需求

### REQ-1: 预测性操作 (核心功能)

**用户故事:** 作为用户，我想要在选中内容后看到智能推荐的操作，以便在最需要时获得工具支持。

#### 验收标准

1. WHEN 用户选中多个收藏 THEN 系统 SHALL 在 Action Bar 显示推荐按钮（桌面端）
2. WHEN 用户在移动端选中多个收藏 THEN 系统 SHALL 将 FAB 从 "+" 变形为 "✨"
3. WHEN 推荐按钮生成 THEN 系统 SHALL 在 10ms 内完成（纯规则引擎）
4. WHEN 用户点击推荐按钮 THEN 系统 SHALL 显示 "✨ 正在分析..." 后执行
5. WHEN 用户连续忽略某类推荐 3 次 THEN 系统 SHALL 降低该类推荐权重
6. **[V4.0 新增]** WHEN 规则匹配发生 THEN 系统 SHALL 记录遥测事件

#### 可扩展规则引擎 (V4.0 增强)

```typescript
// 规则注册表 - 支持动态注册
interface RuleRegistry {
  // 注册单条规则
  register(rule: PredictionRule): void;

  // 批量注册
  registerMany(rules: PredictionRule[]): void;

  // 从配置文件加载（未来扩展）
  loadFromConfig(configPath: string): Promise<void>;

  // 获取所有规则
  getAll(): PredictionRule[];

  // 按 ID 获取规则
  getById(ruleId: string): PredictionRule | null;
}

// 核心规则集 - 初始 20 条高频规则
const INITIAL_RULES: PredictionRule[] = [
  // 语言相关
  {
    id: "lang_all_english",
    condition: "all_english",
    action: "翻译",
    icon: "🌐",
    priority: 95,
  },
  {
    id: "lang_all_chinese",
    condition: "all_chinese",
    action: "生成摘要",
    icon: "📝",
    priority: 80,
  },
  {
    id: "lang_mixed",
    condition: "mixed_language",
    action: "统一翻译",
    icon: "🌐",
    priority: 85,
  },

  // 文件类型
  {
    id: "type_pdf",
    condition: "all_pdf",
    action: "提取文本",
    icon: "📄",
    priority: 90,
  },
  {
    id: "type_video",
    condition: "all_video",
    action: "提取字幕",
    icon: "🎬",
    priority: 88,
  },
  {
    id: "type_article",
    condition: "all_article",
    action: "生成摘要",
    icon: "📝",
    priority: 85,
  },

  // 来源相关
  {
    id: "source_same_domain",
    condition: "same_domain",
    action: "归档到来源文件夹",
    icon: "🗂️",
    priority: 82,
  },
  {
    id: "source_same_author",
    condition: "same_author",
    action: "创建作者合集",
    icon: "👤",
    priority: 78,
  },
  {
    id: "source_same_platform",
    condition: "same_platform",
    action: "按平台整理",
    icon: "📱",
    priority: 75,
  },

  // 数量相关
  {
    id: "qty_gt_10",
    condition: "count_gt_10",
    action: "批量整理",
    icon: "📦",
    priority: 70,
  },
  {
    id: "qty_gt_50",
    condition: "count_gt_50",
    action: "智能分类",
    icon: "🏷️",
    priority: 72,
  },

  // 时间相关
  {
    id: "time_unread_7d",
    condition: "unread_gt_7days",
    action: "生成摘要",
    icon: "📝",
    priority: 65,
  },
  {
    id: "time_this_week",
    condition: "all_this_week",
    action: "生成周报",
    icon: "📊",
    priority: 68,
  },
  {
    id: "time_today",
    condition: "all_today",
    action: "今日回顾",
    icon: "📅",
    priority: 60,
  },

  // 内容相关
  {
    id: "content_duplicates",
    condition: "has_duplicates",
    action: "去重",
    icon: "🧹",
    priority: 88,
  },
  {
    id: "content_tech",
    condition: "all_tech_articles",
    action: "技术摘要",
    icon: "💻",
    priority: 75,
  },
  {
    id: "content_news",
    condition: "all_news",
    action: "新闻简报",
    icon: "📰",
    priority: 72,
  },

  // 标签相关
  {
    id: "tag_none",
    condition: "no_tags",
    action: "智能标签",
    icon: "🏷️",
    priority: 78,
  },
  {
    id: "tag_same",
    condition: "same_tags",
    action: "合并到文件夹",
    icon: "🗂️",
    priority: 70,
  },

  // 文件夹相关
  {
    id: "folder_none",
    condition: "no_folder",
    action: "智能归档",
    icon: "📁",
    priority: 80,
  },
];
```

#### 桌面端 UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Action Bar                                                       │
│ [删除] [移动] [标签]           [✨ 翻译并提取摘要] ← 智能推荐     │
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
┌────────────────────────────────────────────���────────────────────┐
│ ✨ 智能推荐                                               [✕]  │
├─────────────────────────────────────────────────────────────────┤
│ 🌐 翻译并提取摘要                                   5 篇英文   │
│ 🗂️ 归档到「前端开发」                              同一来源   │
│ 🏷️ 添加「React」标签                              内容匹配   │
├─────────────────────────────────────────────────────────────────┤
│                        [展开更多推荐 ▼]                         │
└─────────────────────────────────────────────────────────────────┘
```

#### "智能推荐"体验设计 (V4.0 文案调整)

```
用户点击推荐按钮
        ↓
显示: "✨ 正在分析..." (延迟 300-500ms)
        ↓
[遥测] 记录规则匹配事件
        ↓
实际执行: 规则引擎预设的 Tool 串联
        ↓
显示: 执行进度条
        ↓
���成: "✅ 已完成"
        ↓
[遥测] 记录操作完成事件

用户感知: "推荐很准！"
实际成本: 0 Token
```

---

### REQ-2: 执行监控与高亮

**用户故事:** 作为用户，我想要看到操作正在执行的进度，以便了解发生了什么。

#### 验收标准

1. WHEN 推荐操作开始执行 THEN 系统 SHALL 显示状态栏进度
2. WHEN 操作影响某个书签 THEN 系统 SHALL 用边框发光高亮该书签行 1.5 秒
3. WHEN 操作完成 THEN 系统 SHALL 显示完成 Toast 和撤销入口
4. WHEN 操作失败 THEN 系统 SHALL 显示错误 Toast 并刷新列表
5. **[V4.0 新增]** WHEN 状态栏显示 THEN 移动端 FAB SHALL 向上位移避免遮挡

#### 状态栏设计 (V4.0 增强)

```
┌─────────────────────────────────────────────────────────────────┐
│ [✨] 翻译中: 处理第 3/5 篇...                          [✕ 取消] │
└─────────────────────────────────────────────────────────────────┘
```

- 平时隐藏，执行时自动显示
- 显示当前步骤和进度
- 支持取消
- **[V4.0]** 移动端显示时 FAB 自动上移 60px

#### 边框发光高亮 (V4.0 优化)

```typescript
// 高亮机制：边框发光动画，减少视觉干扰
interface HighlightEvent {
  entityId: string;
  type: "processing" | "completed";
  duration: 1500; // ms
}

// 高亮样式
const highlightStyles = {
  processing: "ring-2 ring-blue-400 ring-opacity-75 animate-pulse",
  completed: "ring-2 ring-green-400 ring-opacity-75",
};

// 用户偏好：减少动效
interface UserPreferences {
  reduceMotion: boolean; // 如果为 true，禁用 animate-pulse
}
```

#### 极简乐观更新 (React Query 原生)

```typescript
const mutation = useMutation({
  mutationFn: moveBookmark,
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['bookmarks'])
    const previous = queryClient.getQueryData(['bookmarks'])
    queryClient.setQueryData(['bookmarks'], old => /* 更新逻辑 */)
    return { previous }
  },
  onError: (err, newData, context) => {
    toast.error('操作失败，已恢复')
    queryClient.setQueryData(['bookmarks'], context.previous)
  },
  onSettled: () => {
    // [V4.0] 强制 invalidate 确保最终一致性
    queryClient.invalidateQueries(['bookmarks'])
  },
})
```

---

### REQ-3: 简易回滚 (覆盖式恢复)

**用户故事:** 作为用户，我想要在操作完成后能够撤销，以便放心尝试智能推荐功能。

#### 验收标准

1. WHEN 操作开始 THEN 系统 SHALL 将受影响实体的 JSON 存入快照表
2. WHEN 操作完成 THEN 系统 SHALL 显示 Toast "已完成 [撤销]"，持续 10 秒
3. WHEN 用户点击撤销 THEN 系统 SHALL 用快照 JSON 覆盖当前数据
4. **[V4.0 新增]** WHEN 快照超过 24 小时 THEN 系统 SHALL 通过 Cron Job 自动清理
5. **[V4.0 新增]** WHEN 用户取消正在执行的操作 THEN 系统 SHALL 用快照回滚已执行部分

#### 覆盖式恢复策略

```typescript
// 数据库表: operation_snapshots
interface OperationSnapshot {
  id: string;
  user_id: string;
  operation_id: string;
  entity_type: "bookmark" | "folder" | "tag";
  entity_id: string;
  original_data: JsonB;
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
      await db.bookmarks.upsert(snapshot.original_data);
    }
  }

  // 恢复软删除的实体
  await db.bookmarks
    .where({ operation_id: operationId, deleted_at: { not: null } })
    .update({ deleted_at: null });
}
```

#### Cron Job 自动清理 (V4.0 新增)

```sql
-- Supabase pg_cron 定时任务
SELECT cron.schedule(
  'cleanup-expired-snapshots',
  '0 * * * *',  -- 每小时执行一次
  $$DELETE FROM operation_snapshots WHERE expires_at < now()$$
);
```

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
└─────────────────────────────────────────────────────────────────┘
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
│   🧹 清理重复           查找并删除重复书签                       │
│   🌐 翻译选中           翻译选中的英文内容                       │
│   📊 阅读统计           生成阅读数据报告                         │
└─────────────────────────────────────────────────────────────────┘
```

#### 预设命令集 (规则引擎)

```typescript
const PRESET_COMMANDS: PresetCommand[] = [
  {
    id: "cmd_organize_inbox",
    keywords: ["整理", "收件箱", "inbox", "organize"],
    name: "整理收件箱",
    description: "整理未分类的收藏",
    icon: "🗂️",
    tools: ["filter_uncategorized", "auto_categorize", "move_to_folders"],
  },
  {
    id: "cmd_weekly_report",
    keywords: ["周报", "weekly", "report"],
    name: "生成周报",
    description: "本周收藏内容摘要",
    icon: "📝",
    tools: ["filter_this_week", "generate_summary"],
  },
  {
    id: "cmd_clean_duplicates",
    keywords: ["重复", "duplicate", "去重", "clean"],
    name: "清理重复",
    description: "查找并删除重复书签",
    icon: "🧹",
    tools: ["find_duplicates", "confirm_delete", "soft_delete"],
  },
  {
    id: "cmd_translate",
    keywords: ["翻译", "translate"],
    name: "翻译选中",
    description: "翻译选中的英文内容",
    icon: "🌐",
    tools: ["detect_language", "translate_content"],
  },
  {
    id: "cmd_stats",
    keywords: ["统计", "stats", "analytics"],
    name: "阅读统计",
    description: "生成阅读数据报告",
    icon: "📊",
    tools: ["collect_stats", "generate_report"],
  },
];
```

---

### REQ-5: 电池系统 (模糊化成本)

**用户故事:** 作为用户，我想要了解智能推荐功能的使用限制，但不想每次都算账。

#### 验收标准

1. WHEN L1/L2 操作执行 THEN 系统 SHALL NOT 显示任何成本信息
2. WHEN 用户剩余次数 >50% THEN 系统 SHALL 显示满电图标 🔋
3. WHEN 用户剩余次数 20-50% THEN 系统 SHALL 显示中电图标 🔋
4. WHEN 用户剩余次数 <20% THEN 系统 SHALL 显示低电图标 🪫
5. WHEN 用户次数耗尽 THEN 系统 SHALL 阻断并提示升级
6. **[V4.0 新增]** 配额重置时间使用用户本地时区 00:00

#### 电池系统设计

```typescript
interface BatterySystem {
  quota: {
    free: {
      dailyOperations: 5;
      resetTime: "00:00"; // 用户本地时区
    };
    pro: {
      dailyOperations: -1; // 无限
    };
  };

  getBatteryLevel(
    remaining: number,
    total: number,
  ): "full" | "medium" | "low" | "empty";

  display: {
    full: { icon: "🔋"; show: false };
    medium: { icon: "🔋"; show: false };
    low: { icon: "🪫"; show: true; message: "今日智能推荐次数即将用完" };
    empty: { icon: "⚡"; show: true; block: true };
  };
}
```

#### 配额耗尽 UI

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ 今日智能推荐次数已用完                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 您今日的 5 次智能推荐已全部使用。                                 │
│                                                                 │
│ • 明日 00:00 将重置                                             │
│ • 升级 Pro 版解锁无限次数                                        │
│                                                                 ���
├─────────────────────────────────────────────────────────────────┤
│              [明天再试]  [升级 Pro 版]                           │
└─────────────────────────────────────────────────────────────────┘
```

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

---

### REQ-7: 规则遥测系统 (V4.0 新增)

**用户故事:** 作为开发者，我想要收集规则匹配和用户行为数据，以便验证假设并优化规则。

#### 验收标准

1. WHEN 规则匹配发生 THEN 系统 SHALL 记录匹配事件到遥测表
2. WHEN 用户点击推荐 THEN 系统 SHALL 记录 accepted=true
3. WHEN 用户忽略推荐 THEN 系统 SHALL 记录 accepted=false
4. WHEN 开发者查询 THEN 系统 SHALL 能按规则 ID 聚合统计

#### 遥测数据模型

```typescript
interface RuleTelemetry {
  id: string;
  user_id: string;
  rule_id: string;
  selection_count: number; // 选中了多少项
  matched_at: Date;
  accepted: boolean | null; // null=未决定, true=点击, false=忽略
  decided_at: Date | null;
  session_id: string; // 会话追踪
}

// 聚合查询
interface RuleStats {
  ruleId: string;
  matchCount: number;
  acceptCount: number;
  ignoreCount: number;
  acceptRate: number; // acceptCount / (acceptCount + ignoreCount)
}
```

#### 遥测埋点位置

```
用户选中书签
        ↓
PredictionEngine.predict()
        ↓
[埋点] rule_matched: { rule_id, selection_count }
        ↓
显示推荐按钮
        ↓
用户点击 / 忽略 / 选择其他
        ↓
[埋点] rule_decided: { rule_id, accepted }
```

---

## 非功能需求

### 性能要求

| 指标                    | 目标值      | 测量方式             |
| ----------------------- | ----------- | -------------------- |
| 规则引擎匹配            | <10ms       | 选中到按钮显示       |
| 智能推荐延迟            | 300-500ms   | 故意延迟，增加智能感 |
| 操作执行                | <2s（平均） | 不含网络请求         |
| 高亮动画                | 60fps       | 边框发光 CSS 动画    |
| 快照恢复                | <1s         | 点击撤销到恢复       |
| **[V4.0]** 规则数量上限 | 100 ��      | 性能回归测试         |

### 安全要求

1. **软删除**: 所有删除操作使用软删除，保留 30 天
2. **快照隔离**: 快照数据按用户隔离（RLS）
3. **权限边界**: 规则引擎只能触发用户有权限的操作

### 可靠性要求

1. **快照持久化**: 操作前必须完成快照写入
2. **失败恢复**: 操作失败时自动刷新列表
3. **数据一致性**: React Query invalidate 确保缓存与数据库一致
4. **[V4.0] 取消回滚**: 取消操作时自动回滚已执行部分

### 可用性要求

1. **零学习成本**: 推荐按钮自动出现，用户无需学习
2. **移动端友好**: FAB 变形 + Bottom Sheet
3. **快捷键**: Cmd+K 快速入口
4. **[V4.0] 减少动效**: 支持用户偏好设置

---

## 约束与假设

### 技术约束

1. 基于现有 Next.js 14 + React 架构
2. 复用现有 Tool Registry
3. 使用 React Query 管理状态
4. 快照存储在 Supabase PostgreSQL
5. **[V4.0]** 语言检测使用 franc-min 库（3KB）

### 业务约束

1. MVP 仅支持收藏管理操作
2. Free 用户每日 5 次智能推荐操作
3. 快照保留 24 小时

### 假设

1. 规则引擎覆盖 80% 用户场景 → **[V4.0] 通过遥测验证**
2. 用户接受"智能推荐"（只要结果对）
3. 网络延迟 <500ms（Supabase 云端）

---

## 词汇表

| 术语       | 定义                                        |
| ---------- | ------------------------------------------- |
| 规则引擎   | 基于条件匹配的推荐系统，无 LLM 调用         |
| 预测性操作 | 根据选中内容推荐的操作按钮                  |
| 覆盖式恢复 | 用 JSON 快照直接覆盖当前数据的回滚方式      |
| 电池系统   | 用满/中/低三档显示使用配额的机制            |
| 智能推荐   | 规则引擎驱动的推荐系统（V4.0 替代"AI推荐"） |
| 规则遥测   | 记录规则匹配和用户决策的数据收集系统        |

---

## 优先级矩阵

| 需求                 | 优先级 | 开发周期 | 复杂度 |
| -------------------- | ------ | -------- | ------ |
| REQ-1 预测性操作     | P0     | Week 1   | 中     |
| REQ-7 规则遥测系统   | P0     | Week 1   | 低     |
| REQ-2 执行监控与高亮 | P0     | Week 2   | 低     |
| REQ-4 全能指令框     | P1     | Week 2   | 低     |
| REQ-3 简易回滚       | P0     | Week 3   | 中     |
| REQ-5 电池系统       | P1     | Week 3   | 低     |
| REQ-6 检查点         | P0     | Week 3   | 低     |

---

## 3 周开发路线图 (V4.0 更新)

```
Week 1: "看起来很聪明" + 埋点 (The Smart Facade)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
目标: 用户选中书签 → 看到魔法按钮 → 点击执行 → 数据回流

开发任务:
├── 可扩展规则引擎
│   ├── RuleRegistry 实现
│   ├── 20 条初始规则
│   ├── 规则匹��器
│   └── franc-min 语言检测集成
│
├── UI 组件
│   ├── 桌面端 Action Bar 推荐按钮
│   ├── 移动端 FAB 变形动画
│   └── Bottom Sheet 推荐列表（支持展开更多）
│
├── 智能推荐体验
│   ├── "正在分析..." 延迟
│   └── 执行现有 Tools
│
└── 遥测系统 [V4.0 新增]
    ├── rule_telemetry 表
    ├── 埋点 Hook
    └── 基础聚合查询

交付物:
✅ 用户能看到智能推荐
✅ 点击后能执行操作
✅ 遥测数据开始收集

Week 2: "自动化流水线" (The Automation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
目标: 点击推荐 → 看到进度条 → 列表自动更新

开发任务:
├── 执行监控
│   ├── 状态栏组件
│   ├── 进度显示
│   ├── 取消功能 + 回滚已执行部分
│   └── FAB 自动位移 [V4.0]
│
├── 边框发光高亮 [V4.0 优化]
│   ├── CSS 边框发光动画
│   ├── useAgentHighlight Hook
│   ├── 虚拟列表适配
│   └── 减少动效用户偏好
│
├── 极简乐观更新
│   ├── React Query 配置
│   └── 强制 invalidate 确保一致性
│
��── 全能指令框
    ├── Cmd+K 入口
    ├── 关键词匹配
    └── 预设命令执行

交付物:
✅ 操作过程可视化
✅ 列表实时更新
✅ 快捷键入口

Week 3: "安全感与商业化" (Safety & Money)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
目标: 用户敢试错（有撤销），有付费动力（有限制）

开发任务:
├── 简易回滚
│   ├── operation_snapshots 表
│   ├── 快照写入逻辑
│   ├── 覆盖式恢复
│   ├── 10 秒撤销 Toast
│   └── Cron Job 自动清理 [V4.0]
│
├── 电池系统
│   ├── 使用计数器（本地时区重置）[V4.0]
│   ├── 电池图标显示
│   └── 配额耗尽阻断
│
├── 检查点
│   ├── 删除确认对话框
│   └── 软删除逻辑
│
└── 测试与修复
    ├── 规则匹配测试（40+ 用例）
    ├── 回滚测试
    └── 性能回归测试 [V4.0]

交付物:
✅ 操作可撤销
✅ Free 用户有限制
✅ 付费入口

正式上线 🚀
```

---

## 成功指标

| 指标           | 目标   | 测量方式                   |
| -------------- | ------ | -------------------------- |
| 推荐按钮点击率 | >20%   | 遥测: accepted / matched   |
| 操作完成率     | >95%   | 完成 / 发起                |
| 撤销使用率     | <3%    | 撤销 / 完成                |
| 规则覆盖率     | >80%   | 遥测: matched / selections |
| Pro 转化率     | >5%    | 配额耗尽后升级             |
| 用户满意度     | >4.5/5 | 操作后评分                 |

---

## V2 规划 (后续迭代)

| 功能              | 优先级 | 说明                          |
| ----------------- | ------ | ----------------------------- |
| 规则权重自动学习  | P2     | 根据遥测数据自动调整 priority |
| L3 目标驱动 (LLM) | P2     | 真正的自然语言理解            |
| A/B 测试框架      | P2     | 对比不同规则集的效果          |
| 部分回滚          | P2     | 支持撤销单个步骤              |
| 规则配置化        | P2     | 从 YAML/JSON 加载规则         |
| 复杂乐观动画      | P3     | Bounce/Shake 回滚动画         |

---

## 与 V3.0 的差异对比

| 模块     | V3.0         | V4.0 增强版             |
| -------- | ------------ | ----------------------- |
| 规则引擎 | 硬编码 20 条 | RuleRegistry 可扩展     |
| 文案     | "AI 推荐"    | "智能推荐"              |
| 高亮效果 | 背景色变化   | 边框发光 + 减少动效选项 |
| 快照清理 | 应用层清理   | Cron Job 自动清理       |
| 遥测     | 无           | 完整规则遥测系统        |
| 配额时区 | 未定义       | 用户本地时区            |
| 取消操作 | 仅停止       | 停止 + 回滚已执行部分   |
| 性能测试 | 无           | 性能回归测试            |
