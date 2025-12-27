# AnyKeep 适合 Skills/Tools 化的功能分析

> 分析日期: 2025-12-27
> 分析版本: v2.7.x

## 一、AI 能力现状总结

| 类别          | 已实现数量 | 说明                                     |
| ------------- | ---------- | ---------------------------------------- |
| **AI Tools**  | 75 个      | 覆盖查询、搜索、CRUD、高级操作、消息管理 |
| **AI Skills** | 19 个      | 知识管理、数据处理、分析报告、消息摘要   |
| **API 端点**  | 179 个     | 全面的后端服务                           |

> **最近更新** (2025-12-27): 新增消息系统 3 个 Tools + 1 个 Skill

---

## 二、适合转化为 Tools/Skills 的功能

### 1. 🔐 浏览器插件授权管理 (P0 - 高优先级)

基于 `supabase/migrations/20251228000001_add_plugin_authorization.sql`

| 建议类型                                     | 功能             | 说明                                   |
| -------------------------------------------- | ---------------- | -------------------------------------- |
| **Tool: `list-plugin-authorizations`**       | 列出所有插件授权 | 显示浏览器类型、最后使用时间、过期时间 |
| **Tool: `revoke-plugin-authorization`**      | 撤销单个授权     | 按 ID 撤销                             |
| **Tool: `revoke-all-plugin-authorizations`** | 撤销所有授权     | 安全退出所有插件                       |
| **Tool: `get-plugin-auth-stats`**            | 授权统计         | 活跃设备数、平台分布                   |

---

### 2. 📬 消息系统智能化 (P1 - 中优先级) ✅ 已实现

> **实现日期**: 2025-12-27
> **文件位置**: `src/lib/ai-agent/tools/messages/`, `src/lib/ai-skills/skills/inbox-digest/`

| 类型                                  | 名称         | 状态 | 说明                         |
| ------------------------------------- | ------------ | ---- | ---------------------------- |
| **Tool: `list_messages`**             | 列出用户消息 | ✅   | 支持状态/级别/类型筛选、分页 |
| **Tool: `summarize_unread_messages`** | 摘要未读消息 | ✅   | 生成统计、分组、建议         |
| **Tool: `batch_mark_read`**           | 批量标记已读 | ✅   | 按 ID/类型/级别/时间/全部    |
| **Skill: `InboxDigestSkill`**         | 收件箱摘要   | ✅   | 每日/每周消息摘要报告        |

**用户场景**：

- "帮我看看今天有什么消息" → InboxDigestSkill
- "有多少条未读消息" → summarize_unread_messages
- "把静默通知都标为已读" → batch_mark_read

---

### 3. 🔗 知识链接增强 (P1 - 中优先级)

现有模块：`src/lib/knowledge-link` 但未完全 AI 化

| 建议类型                          | 功能         | 说明                 |
| --------------------------------- | ------------ | -------------------- |
| **Tool: `get-knowledge-graph`**   | 获取知识图谱 | 书签间的关系网络     |
| **Tool: `find-related-by-topic`** | 主题关联发现 | 基于语义的关联推荐   |
| **Skill: `KnowledgeMapSkill`**    | 知识地图生成 | 生成可视化知识关系图 |
| **Skill: `TopicClusterSkill`**    | 主题聚类     | 自动发现知识主题群落 |

---

### 4. 📦 微信文章导入增强 (P2 - 中优先级)

现有模块：`src/lib/wechat-article`

| 建议类型                          | 功能         | 说明                  |
| --------------------------------- | ------------ | --------------------- |
| **Tool: `import-wechat-article`** | 导入微信文章 | 通过链接导入          |
| **Tool: `list-wechat-articles`**  | 列出微信文章 | 按公众号分组          |
| **Skill: `WechatDigestSkill`**    | 微信阅读摘要 | 按公众号/话题生成摘要 |

---

### 5. 📸 快照系统增强 (P2 - 中优先级)

现有 API：`/api/snapshots/*`

| 建议类型                               | 功能         | 说明             |
| -------------------------------------- | ------------ | ---------------- |
| **Tool: `compare-snapshots`**          | 快照对比     | 检测内容变化     |
| **Skill: `ContentChangeMonitorSkill`** | 内容变更监控 | 监控重要页面变化 |

---

### 6. 🎚️ 信任模式智能化 (P3 - 低优先级)

现有模块：`src/lib/trust-mode`

| 建议类型                         | 功能             | 说明             |
| -------------------------------- | ---------------- | ---------------- |
| **Tool: `get-trust-mode`**       | 获取当前信任模式 |                  |
| **Tool: `recommend-trust-mode`** | 智能推荐信任等级 | 基于使用习惯推荐 |

---

### 7. 📊 用户兴趣档案增强 (P3 - 低优先级)

现有模块：`src/lib/interest-profile`

| 建议类型                            | 功能         | 说明               |
| ----------------------------------- | ------------ | ------------------ |
| **Tool: `analyze-interest-trend`**  | 兴趣趋势分析 | 兴趣随时间变化     |
| **Skill: `InterestEvolutionSkill`** | 兴趣演变报告 | 生成兴趣演变可视化 |

---

### 8. 🗂️ 源档案管理 (P3 - 低优先级)

现有模块：`src/lib/source-profile`

| 建议类型                           | 功能         | 说明             |
| ---------------------------------- | ------------ | ---------------- |
| **Tool: `list-content-sources`**   | 列出内容来源 | 按平台/域名分组  |
| **Tool: `analyze-source-quality`** | 来源质量分析 | 阅读率、收藏率等 |
| **Skill: `SourceInsightSkill`**    | 来源洞察报告 | 哪些来源值得关注 |

---

## 三、实施建议矩阵

| 优先级 | 功能模块     | 建议新增 Tools | 建议新增 Skills | 复杂度 | 状态      |
| ------ | ------------ | -------------- | --------------- | ------ | --------- |
| **P0** | 插件授权管理 | 4 个           | 0 个            | 低     | 待实现    |
| **P1** | 消息系统     | 3 个           | 1 个            | 中     | ✅ 已完成 |
| **P1** | 知识链接     | 2 个           | 2 个            | 高     | 待实现    |
| **P2** | 微信文章     | 2 个           | 1 个            | 中     | 待实现    |
| **P2** | 快照系统     | 1 个           | 1 个            | 中     | 待实现    |
| **P3** | 信任模式     | 2 个           | 0 个            | 低     | ✅ 已完成 |
| **P3** | 兴趣档案     | 1 个           | 1 个            | 中     | 待实现    |
| **P3** | 源档案       | 2 个           | 1 个            | 中     | 待实现    |

**合计建议新增**: 17 个 Tools + 7 个 Skills
**已完成**: 5 个 Tools + 1 个 Skill (消息系统 3 + 信任模式 2)

---

## 四、Quick Win 推荐

### 立即实施（低复杂度、高价值）

#### 插件授权管理 Tools (4个)

```
src/lib/ai-agent/tools/plugin-auth/
├── list-plugin-authorizations.tool.ts
├── revoke-plugin-authorization.tool.ts
├── revoke-all-plugin-authorizations.tool.ts
└── get-plugin-auth-stats.tool.ts
```

**用户场景**：

- "我有多少个设备登录了插件？"
- "帮我退出所有浏览器插件"
- "Chrome 插件最后是什么时候用的？"

---

## 五、已实现 Skills/Tools 详细文档

### 📬 消息系统 (2025-12-27 实现)

#### Tool: `list_messages`

**功能**: 列出用户消息，支持多维度筛选

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | `"unread" \| "read" \| "archived"` | 否 | 消息状态筛选 |
| `level` | `"silent" \| "normal" \| "important"` | 否 | 消息级别筛选 |
| `type` | `MessageType` | 否 | 消息类型筛选 |
| `limit` | `number` (1-100) | 否 | 返回数量，默认 20 |
| `offset` | `number` | 否 | 分页偏移 |

**返回值**:

```typescript
{
  messages: Message[];      // 消息列表
  totalCount: number;       // 总数
  hasMore: boolean;         // 是否有更多
}
```

---

#### Tool: `summarize_unread_messages`

**功能**: 生成未读消息的智能摘要

**参数**: 无

**返回值**:

```typescript
{
  summary: string;                    // 文字摘要
  totalUnread: number;                // 未读总数
  byLevel: { level, count, label }[]; // 按级别统计
  byType: { type, count, label }[];   // 按类型统计
  suggestions: string[];              // 建议动作
  generatedAt: string;                // 生成时间
}
```

---

#### Tool: `batch_mark_read`

**功能**: 批量标记消息为已读

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `messageIds` | `number[]` | 否 | 指定消息 ID 列表 |
| `types` | `MessageType[]` | 否 | 按类型筛选 |
| `levels` | `MessageLevel[]` | 否 | 按级别筛选 |
| `olderThanDays` | `number` (1-365) | 否 | N 天前的消息 |
| `markAll` | `boolean` | 否 | 标记全部已读 |

**返回值**:

```typescript
{
  markedCount: number; // 标记数量
  previousUnreadCount: number; // 操作前未读数
  remainingUnreadCount: number; // 操作后未读数
  description: string; // 操作描述
}
```

---

#### Skill: `InboxDigestSkill`

**功能**: 生成收件箱摘要报告

**Skill ID**: `inbox_digest`
**类别**: `understanding`
**交付物类型**: `report`

**输入参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `period` | `"daily" \| "weekly" \| "monthly"` | `"daily"` | 统计周期 |
| `includeRead` | `boolean` | `false` | 是否包含已读消息 |
| `autoMarkRead` | `boolean` | `false` | 查看后自动标记已读 |
| `messageTypes` | `MessageType[]` | 全部 | 指定消息类型 |

**执行步骤**:
| 步骤 | 名称 | 权重 | 说明 |
|------|------|------|------|
| 1 | `fetch` | 15% | 获取消息数据 |
| 2 | `analyze` | 25% | 分析消息分布 |
| 3 | `trends` | 20% | 识别趋势变化 |
| 4 | `suggestions` | 20% | 生成建议 |
| 5 | `deliver` | 20% | 编译报告 |

**输出格式**:

```typescript
{
  report: string;       // Markdown 格式报告
  data: {
    overview: {
      totalMessages: number;
      unreadCount: number;
      readCount: number;
      importantCount: number;
      normalCount: number;
      silentCount: number;
    };
    byLevel: { level, count, percentage }[];
    byType: { type, count, label }[];
    suggestions: string[];
  };
  generatedAt: string;
}
```

**意图路由规则**:

```typescript
// intent-classifier.ts
{
  pattern: /消息.{0,3}(摘要|总结|概览|统计)/,
  intent: { type: "analyze", subType: "inbox_digest" }
}

// mode-selector.ts
"analyze:inbox_digest" → InboxDigestSkill
```

**用户触发示例**:

- "帮我看看今天有什么消息"
- "生成本周消息摘要"
- "总结一下我的未读消息"
- "消息概览"

---

## 六、前端集成说明

### AIGenericReportContent 组件

**位置**: `src/components/ai/ai-generic-report-content.tsx`

**功能**: 通用报告渲染器，支持 InboxDigestSkill 输出格式

**支持的数据结构**:

```typescript
interface GenericReportData {
  // 标准字段
  summary?: string;
  report?: string; // InboxDigestSkill 使用
  suggestions?: string[];
  stats?: Record<string, unknown>;

  // 嵌套结构（InboxDigestSkill）
  data?: {
    overview?: Record<string, unknown>;
    suggestions?: string[];
  };

  generatedAt?: string;
}
```

**消息统计图标映射**:
| 字段 | 图标 | 颜色 |
|------|------|------|
| `totalMessages` | Inbox | 紫色 |
| `unreadCount` | Mail | 蓝色 |
| `readCount` | CheckCircle2 | 绿色 |
| `importantCount` | Bell | 红色 |
| `normalCount` | Mail | 灰色 |
| `silentCount` | Bell | 浅灰色 |

---

### 🎚️ 信任模式智能化 (2025-12-27 实现)

#### Tool: `get_trust_mode`

**功能**: 获取当前信任模式配置和核心行为

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `includeStats` | `boolean` | 否 | 是否包含统计数据，默认 false |

**返回值**:

```typescript
{
  mode: TrustMode;              // 当前模式: full_auto | semi_auto | manual
  label: string;                // 显示名称: 完全托管 | 半托管 | 不托管
  description: string;          // 模式描述
  behavior: {
    autoClassify: boolean;      // 是否自动分类
    requireConfirmation: boolean; // 是否需要确认
    showReasons: boolean;       // 是否显示决策理由
    allowAutoCorrect: boolean;  // 是否允许自动纠正
  };
  stats?: {                     // 可选统计数据
    autoDecisions: number;
    userCorrections: number;
    correctionRate: number;
    pendingConfirmations: number;
  };
}
```

---

#### Tool: `recommend_trust_mode`

**功能**: 基于用户使用习惯智能推荐最适合的信任模式

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `considerHistory` | `boolean` | 否 | 是否考虑模式切换历史，默认 true |

**分析指标**:

- 纠正率：用户纠正 AI 决策的频率
- 待确认积压：未处理的确认消息数量
- 决策样本：累计自动决策次数
- 模式稳定性：最近一次切换距今时间

**推荐逻辑**:

- 纠正率 > 30%: 建议降低自动化程度
- 纠正率 < 5% 且样本充足: 建议提升自动化程度
- 待确认积压 > 20: 建议调整以减少干扰
- 刚切换不久 (<7天): 建议保持观察

**返回值**:

```typescript
{
  current: {
    mode: TrustMode;
    label: string;
  };
  recommendation: {
    mode: TrustMode;
    label: string;
    confidence: number;         // 置信度 0-100
    isChange: boolean;          // 是否建议切换
  };
  reasoning: {
    primary: string;            // 主要原因
    factors: {
      name: string;
      value: string | number;
      impact: "positive" | "negative" | "neutral";
      weight: number;
      description: string;
    }[];
  };
  metrics: {
    correctionRate: number;
    autoDecisions: number;
    userCorrections: number;
    pendingConfirmations: number;
    daysSinceLastChange?: number;
    hasSufficientData: boolean;
  };
  message: string;              // 人类可读的推荐消息
}
```

**意图路由规则**:

```typescript
// intent-classifier.ts
{
  pattern: /推荐.{0,5}(模式|信任|托管)|适合.{0,5}(模式|信任)|哪个模式.{0,3}(好|适合)|优化.{0,5}(AI|设置)/,
  intent: { type: "query", subType: "trust_mode_recommend" }
},
{
  pattern: /(信任|托管).{0,5}模式.{0,5}(是|什么)|当前.{0,5}(模式|托管|信任)|我的.{0,5}(模式|托管|信任)/,
  intent: { type: "query", subType: "trust_mode" }
}
```

**用户触发示例**:

- "当前是什么模式？"
- "我用的是哪个托管模式？"
- "推荐一个适合我的模式"
- "帮我优化 AI 设置"
- "哪个模式更适合我？"

---

## 七、测试覆盖

| 模块             | 测试文件                     | 用例数 | 状态    |
| ---------------- | ---------------------------- | ------ | ------- |
| Message Tools    | `message-tools.test.ts`      | 19     | ✅ 通过 |
| InboxDigestSkill | `inbox-digest.skill.test.ts` | 38     | ✅ 通过 |
| Trust Mode Tools | `trust-mode/*.test.ts`       | 32     | ✅ 通过 |

**总计**: 89 个测试用例全部通过
