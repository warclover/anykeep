# AI 助手工具精简优化方案

> **目标**：在不影响功能精确度和灵活性的前提下，大幅提升 AI 助手响应速度
>
> **策略**：意图驱动的智能工具分层加载（Intent-Driven Tool Loading）

## 一、问题诊断

### 当前状况

| 指标 | 当前值 | 问题 |
|------|--------|------|
| 工具总数 | 82 个 | 每次请求全量发送给 LLM |
| Skills 总数 | 31 个 | - |
| 简单查询响应时间 | 38 秒 | 目标 < 5 秒 |
| LLM Token 消耗 | ~8,000 tokens/请求 | 工具定义占 70%+ |

### 性能瓶颈分析

```
用户输入: "我有哪些文件夹？"

当前流程:
┌─────────────────────────────────────────────────────────┐
│ 1. 意图分类 (2ms) ✅                                     │
│ 2. 构建 Prompt + 82 个工具定义 (~8000 tokens) ⚠️        │
│ 3. LLM 决策选择工具 (~26s) ⚠️                           │
│ 4. 执行 list_folders (2s)                               │
│ 5. LLM 生成响应 (~8s)                                   │
│ 总计: ~38s                                               │
└─────────────────────────────────────────────────────────┘

优化后流程:
┌─────────────────────────────────────────────────────────┐
│ 1. 意图分类 (2ms) ✅                                     │
│ 2. 根据意图选择 8 个相关工具 (~1500 tokens)              │
│ 3. LLM 决策选择工具 (~3s)                               │
│ 4. 执行 list_folders (2s)                               │
│ 5. LLM 生成响应 (~2s)                                   │
│ 总计: ~7s                                                │
└─────────────────────────────────────────────────────────┘
```

---

## 二、核心设计：意图驱动的工具分层

### 2.1 工具分层架构

```
┌───────────────────────────────────────────────────────────┐
│                    Tool Loading Strategy                   │
├───────────────────────────────────────────────────────────┤
│                                                           │
│   Layer 0: Core Tools (始终加载)                          │
│   ├── 8 个核心工具，所有场景都可能用到                      │
│   └── Token 消耗: ~800                                    │
│                                                           │
│   Layer 1: Intent-Specific Tools (按意图加载)              │
│   ├── query_tools: 12 个 → 查询意图                       │
│   ├── manage_tools: 18 个 → 管理意图                      │
│   ├── organize_tools: 15 个 → 整理意图                    │
│   ├── analyze_tools: 8 个 → 分析意图                      │
│   └── Token 消耗: ~1500-2500 (按需)                       │
│                                                           │
│   Layer 2: Extended Tools (显式请求时加载)                 │
│   ├── advanced_folder: 6 个 → 高级文件夹操作               │
│   ├── plugin_auth: 4 个 → 插件授权                        │
│   ├── messages: 3 个 → 消息系统                           │
│   └── Token 消耗: 按需加载                                │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 2.2 工具分层映射表

#### Layer 0: Core Tools (8 个 - 始终加载)

| 工具名称 | 分类 | 说明 |
|---------|------|------|
| `search_bookmarks` | search | 混合搜索，最常用 |
| `list_recent` | query | 快速查看最近 |
| `count_total` | query | 基础统计 |
| `get_stats` | query | 详细统计 |
| `list_folders` | query | 文件夹列表 |
| `list_tags` | query | 标签列表 |
| `get_bookmark` | read | 书签详情 |
| `read_bookmark` | read | 内容阅读 |

#### Layer 1: Intent-Specific Tools

##### 1.1 Query Intent Tools (12 个)

**触发意图**: `query:list`, `query:count`, `query:stats`, `query:search`

| 工具 | 说明 |
|------|------|
| `list_by_folder` | 按文件夹查询 |
| `list_by_platform` | 按平台查询 |
| `list_wechat_articles` | 微信文章列表 |
| `count_by_folder` | 文件夹统计 |
| `count_by_platform` | 平台统计 |
| `get_folder_detail` | 文件夹详情 |
| `get_folder_bookmarks` | 文件夹书签 |
| `list_smart_lists` | 智能列表 |
| `get_smart_list_items` | 智能列表内容 |
| `get_smart_list_count` | 智能列表统计 |
| `list_md_collections` | MD 收藏列表 |
| `get_md_collection` | MD 收藏详情 |

##### 1.2 Manage Intent Tools (18 个)

**触发意图**: `action:tag`, `action:move`, `action:delete`, `action:create`, `action:update`

| 工具 | 说明 |
|------|------|
| `toggle_bookmark_read` | 已读切换 |
| `toggle_bookmark_starred` | 星标切换 |
| `create_bookmark` | 新建书签 |
| `update_bookmark` | 更新书签 |
| `delete_bookmark` | 删除书签 |
| `batch_tags` | 批量标签 |
| `move_bookmarks` | 批量移动 |
| `move_bookmark_to_folder` | 单个移动 |
| `create_folder` | 创建文件夹 |
| `rename_folder` | 重命名文件夹 |
| `toggle_folder_archive` | 归档文件夹 |
| `toggle_smart_list_pin` | 置顶列表 |
| `create_smart_list` | 创建智能列表 |
| `update_smart_list` | 更新智能列表 |
| `delete_smart_list` | 删除智能列表 |
| `create_md_collection` | 创建 MD 收藏 |
| `update_md_collection` | 更新 MD 收藏 |
| `delete_md_collection` | 删除 MD 收藏 |

##### 1.3 Organize Intent Tools (15 个)

**触发意图**: `organize:cleanup`, `organize:classify`, `organize:dedupe`, `organize:merge`

| 工具 | 说明 |
|------|------|
| `batch_tags` | 批量标签 (复用) |
| `move_bookmarks` | 批量移动 (复用) |
| `batch_delete_bookmarks` | 批量删除 |
| `auto_classify_inbox` | 自动分类 |
| `merge_folders` | 合并文件夹 |
| `split_folder` | 拆分文件夹 |
| `delete_folder` | 删除文件夹 |
| `delete_folder_bookmarks` | 删除文件夹书签 |
| `toggle_folder_lock` | 锁定文件夹 |
| `reorder_folder` | 文件夹排序 |
| `move_folder_to_group` | 文件夹分组 |
| `create_snapshot` | 创建快照 |
| `compare_snapshots` | 对比快照 |
| `list_snapshots` | 快照列表 |
| `delete_snapshot` | 删除快照 |

##### 1.4 Analyze Intent Tools (8 个)

**触发意图**: `analyze:report`, `analyze:insight`, `query:mastery_stats`

| 工具 | 说明 |
|------|------|
| `get_stats` | 详细统计 (复用) |
| `get_wechat_article_stats` | 微信统计 |
| `get_md_stats` | MD 收藏统计 |
| `get_mastery_stats` | 掌握度统计 |
| `get_knowledge_graph` | 知识图谱 |
| `find_related_by_topic` | 主题关联 |
| `get_plugin_auth_stats` | 授权统计 |
| `get_review_queue` | 复习队列 |

##### 1.5 Export Intent Tools (4 个)

**触发意图**: `create:export`

| 工具 | 说明 |
|------|------|
| `export_bookmarks` | 导出书签 |
| `preview_export` | 预览导出 |
| `list_export_formats` | 格式列表 |
| `search_md_collections` | MD 收藏搜索 |

##### 1.6 Learn Intent Tools (6 个)

**触发意图**: `learn:review`, `learn:path`, `learn:active_recall_start`

| 工具 | 说明 |
|------|------|
| `generate_flashcards` | 生成卡片 |
| `get_review_queue` | 复习队列 |
| `submit_review_response` | 提交复习 |
| `get_mastery_stats` | 掌握统计 |
| `update_review_preferences` | 复习偏好 |
| `get_knowledge_graph` | 知识图谱 |

##### 1.7 Settings Intent Tools (8 个)

**触发意图**: `action:settings`, `query:trust_mode`

| 工具 | 说明 |
|------|------|
| `get_trust_mode` | 获取信任模式 |
| `recommend_trust_mode` | 推荐模式 |
| `update_trust_mode` | 更新模式 |
| `get_user_settings` | 用户设置 |
| `get_classification_settings` | 分类配置 |
| `update_classification_settings` | 更新分类 |
| `get_user_interests` | 用户兴趣 |
| `update_user_interests` | 更新兴趣 |

#### Layer 2: Extended Tools (按需加载)

##### 2.1 Import Tools (3 个)
**触发条件**: 用户明确提及"导入"

| 工具 | 说明 |
|------|------|
| `import_bookmarks` | URL 导入 |
| `import_browser_bookmarks` | 浏览器书签导入 |
| `import_wechat_article` | 微信文章导入 |

##### 2.2 Plugin Auth Tools (4 个)
**触发条件**: 用户提及"授权"、"插件"

| 工具 | 说明 |
|------|------|
| `list_plugin_authorizations` | 授权列表 |
| `revoke_plugin_authorization` | 撤销授权 |
| `revoke_all_plugin_authorizations` | 全部撤销 |
| `get_plugin_auth_stats` | 授权统计 |

##### 2.3 Messages Tools (3 个)
**触发条件**: 用户提及"消息"、"通知"

| 工具 | 说明 |
|------|------|
| `list_messages` | 消息列表 |
| `summarize_unread` | 未读摘要 |
| `batch_mark_read` | 批量已读 |

---

## 三、意图到工具的映射规则

### 3.1 映射配置

```typescript
export const INTENT_TOOL_MAPPING: Record<string, string[]> = {
  // 查询类
  "query:list": ["query_tools"],
  "query:count": ["query_tools"],
  "query:stats": ["query_tools", "analyze_tools"],
  "query:search": [], // 仅用 Core Tools
  "query:trust_mode": ["settings_tools"],
  "query:mastery_stats": ["learn_tools"],

  // 操作类
  "action:tag": ["manage_tools"],
  "action:move": ["manage_tools"],
  "action:delete": ["manage_tools", "organize_tools"],
  "action:create": ["manage_tools"],
  "action:update": ["manage_tools"],
  "action:settings": ["settings_tools"],
  "action:review_preferences": ["learn_tools"],

  // 整理类
  "organize:cleanup": ["organize_tools"],
  "organize:classify": ["organize_tools"],
  "organize:dedupe": ["organize_tools"],
  "organize:merge": ["organize_tools"],
  "organize:move": ["organize_tools", "manage_tools"],
  "organize:tag": ["organize_tools", "manage_tools"],

  // 分析类
  "analyze:report": ["analyze_tools"],
  "analyze:insight": ["analyze_tools"],
  "analyze:wechat": ["analyze_tools", "query_tools"],
  "analyze:inbox_digest": ["analyze_tools"],

  // 创建类
  "create:export": ["export_tools"],
  "create:tts": [], // 仅用 Core Tools + TTS Skill
  "create:synthesis": [], // 编排模式

  // 学习类
  "learn:review": ["learn_tools"],
  "learn:path": ["learn_tools"],
  "learn:active_recall_start": ["learn_tools"],

  // 闲聊类
  "chitchat:general": [], // 仅用 Core Tools
  "chitchat:greeting": [], // 仅用 Core Tools
};
```

### 3.2 工具加载逻辑

```typescript
function getToolsForIntent(
  intentType: string,
  subType: string | undefined
): Tool[] {
  // 1. 始终加载 Core Tools
  const tools = [...CORE_TOOLS];

  // 2. 获取意图对应的工具集
  const intentKey = subType ? `${intentType}:${subType}` : intentType;
  const toolSets = INTENT_TOOL_MAPPING[intentKey] ?? [];

  // 3. 加载对应的工具集（去重）
  for (const setName of toolSets) {
    const setTools = TOOL_SETS[setName] ?? [];
    for (const tool of setTools) {
      if (!tools.find(t => t.name === tool.name)) {
        tools.push(tool);
      }
    }
  }

  // 4. 检查 Extended Tools 触发条件
  if (shouldLoadExtendedTools(intentKey)) {
    tools.push(...getExtendedTools(intentKey));
  }

  return tools;
}
```

---

## 四、预期效果

### 4.1 工具数量对比

| 意图类型 | 当前 | 优化后 | 减少 |
|---------|------|--------|------|
| 简单查询 (我有哪些文件夹) | 82 | 8 | **90%** |
| 搜索 (搜一下...) | 82 | 8 | **90%** |
| 标签管理 (给这些加标签) | 82 | 26 | **68%** |
| 整理 (帮我整理一下) | 82 | 23 | **72%** |
| 分析报告 (生成周报) | 82 | 16 | **80%** |
| 导出 (导出 CSV) | 82 | 12 | **85%** |

### 4.2 响应时间预期

| 场景 | 当前 | 优化后 | 提升 |
|------|------|--------|------|
| 简单查询 | 38s | **5-7s** | 80%+ |
| 搜索 | 30s | **4-6s** | 80%+ |
| 标签管理 | 35s | **8-12s** | 65%+ |
| 整理操作 | 40s | **10-15s** | 60%+ |

### 4.3 Token 消耗预期

| 场景 | 当前 | 优化后 | 节省 |
|------|------|--------|------|
| 简单查询 | ~8000 | ~1500 | **81%** |
| 复杂操作 | ~8000 | ~3500 | **56%** |

---

## 五、实施计划

### Phase 1: 核心架构 (1-2 天)

1. **创建工具分层配置**
   - `src/lib/ai-agent/tools/tool-layers.ts` - 工具分层定义
   - `src/lib/ai-agent/tools/intent-tool-mapping.ts` - 意图映射

2. **修改工具加载逻辑**
   - 修改 `src/lib/ai-agent/tools/tool-registry.ts`
   - 添加 `getToolsForIntent()` 方法

3. **集成到 UnifiedEngine**
   - 修改 `src/lib/ai-skills/engine/unified-engine.ts`
   - 在意图分类后调用工具选择

### Phase 2: 测试验证 (1 天)

1. **单元测试**
   - 意图到工具映射测试
   - 工具加载逻辑测试

2. **集成测试**
   - 各种意图场景的响应时间测试
   - 功能完整性验证

### Phase 3: 监控优化 (持续)

1. **添加监控指标**
   - 每次请求的工具数量
   - 意图到工具的命中率
   - 响应时间分布

2. **迭代优化**
   - 根据实际使用数据调整分层
   - 优化边界情况

---

## 六、风险与缓解

### 6.1 潜在风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 工具遗漏 | 功能不可用 | 完善意图映射 + 回退到全量 |
| 意图误判 | 加载错误工具集 | 宽松匹配 + 多集合加载 |
| 复杂场景 | 需要多个工具集 | 支持多意图组合 |

### 6.2 安全回退机制

```typescript
// 回退策略
const FALLBACK_CONFIG = {
  // 意图置信度低于阈值时，加载更多工具
  lowConfidenceThreshold: 0.5,
  lowConfidenceToolSets: ["query_tools", "manage_tools"],

  // 如果 LLM 请求了不存在的工具，触发全量加载重试
  enableFullLoadRetry: true,

  // 调试模式下始终全量加载
  debugForceFullLoad: false,
};
```

---

## 七、文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/lib/ai-agent/tools/tool-layers.ts` | 新增 | 工具分层定义 |
| `src/lib/ai-agent/tools/intent-tool-mapping.ts` | 新增 | 意图到工具映射 |
| `src/lib/ai-agent/tools/tool-registry.ts` | 修改 | 添加按意图加载方法 |
| `src/lib/ai-skills/engine/unified-engine.ts` | 修改 | 集成工具选择逻辑 |
| `src/app/api/agent/unified/route.ts` | 修改 | 传递意图信息 |
| `src/lib/ai-agent/tools/__tests__/` | 新增 | 相关测试 |

---

## 八、成功指标

| 指标 | 当前基线 | 目标值 | 验收标准 |
|------|---------|--------|---------|
| 简单查询响应时间 | 38s | < 8s | P95 < 10s |
| 工具数量 (简单查询) | 82 | < 12 | - |
| 功能完整性 | 100% | 100% | 无功能回归 |
| 意图命中率 | - | > 95% | 监控数据 |

---

## 九、审批确认

- [ ] 技术方案审批
- [ ] 工具分层映射确认
- [ ] 实施计划确认
- [ ] 开始实施

---

**文档版本**: v1.0.0
**创建日期**: 2026-01-11
**作者**: AI Assistant
