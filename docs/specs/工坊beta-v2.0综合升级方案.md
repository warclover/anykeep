# 工坊 Beta v2.0 综合升级方案

> **版本**: v1.3
> **日期**: 2026-01-06
> **状态**: Phase 2 全部完成 ✅，Phase 4 部分完成 ✅
> **整合文档**:
>
> - [数据一致性修复方案](./工坊beta优化-数据一致性修复方案.md)
> - [用户体验增强方案](./工坊beta优化-用户体验增强方案.md)
> - [智能引导系统实施方案](./工坊beta优化-智能引导系统实施方案.md)

---

## 一、升级目标

### 1.1 核心目标

| 目标         | 描述                 | 量化指标                             |
| ------------ | -------------------- | ------------------------------------ |
| **降低门槛** | 让用户"不用想就能用" | 蓝图选择时间 -67%，素材选择时间 -58% |
| **提升体验** | 让用户"随时掌控"     | 生成放弃率从 20% 降至 8%             |
| **支持迭代** | 让用户"越用越好"     | 平均生成次数/周从 3 次提升至 8 次    |
| **修复缺陷** | 消除数据不一致风险   | 0 个 P0/P1 级别缺陷                  |

### 1.2 目标用户画像

| 用户类型     | 痛点                               | 期望                  |
| ------------ | ---------------------------------- | --------------------- |
| **新用户**   | 不知道选哪个蓝图，不知道选哪些素材 | 场景化入口 + 智能推荐 |
| **轻度用户** | 每次都要重新选择配置               | 用户偏好 + 模板收藏   |
| **重度用户** | 无法快速迭代，无法批量操作         | 历史记录 + 批量生成   |

---

## 二、升级内容总览

### 2.1 功能矩阵

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         工坊 Beta v2.0 功能矩阵                              │
├──────────────────┬──────────────────┬──────────────────┬────────────────────┤
│    Phase 1       │    Phase 2       │    Phase 3       │    Phase 4         │
│   (本周必做)      │   (下周完成)      │   (第3周完成)     │   (后续迭代)        │
├──────────────────┼──────────────────┼──────────────────┼────────────────────┤
│ ✅ P0 Bug修复    │ ✅ 场景快速入口   │ 📊 素材组合评分   │ ✅ 生成历史记录     │
│   - platformStyle│ ✅ 智能蓝图推荐   │ ⭐ 质量评分反馈   │ 💾 模板收藏系统     │
│     缓存修复     │ ✅ 素材智能推荐   │ ⚙️ 用户偏好设置   │ 📦 批量生成模式     │
│                  │                  │                  │                    │
│ ✅ P1 Bug修复    │ ✅ 生成取消按钮   │                  │ 🔗 协作分享功能     │
│   - 报告记录     │ ✅ 分段复制功能   │                  │ 📊 版本对比功能     │
│     platformStyle│ ✅ 生成完成音效   │                  │                    │
└──────────────────┴──────────────────┴──────────────────┴────────────────────┘
```

### 2.2 优先级排序

| 优先级 | 功能                   | 类型    | 用户价值 | 工作量 | Phase |
| ------ | ---------------------- | ------- | -------- | ------ | ----- |
| **P0** | platformStyle 会话缓存 | Bug修复 | 高       | 15行   | 1     |
| **P0** | 报告记录 platformStyle | Bug修复 | 中       | 5行    | 1     |
| **P0** | 场景快速入口           | 新功能  | 高       | 中     | 2     |
| **P0** | 智能蓝图推荐           | 新功能  | 高       | 中     | 2     |
| **P0** | 素材智能推荐           | 新功能  | 高       | 中     | 2     |
| **P1** | 生成取消按钮           | 增强    | 中       | 10行   | 2     |
| **P1** | 分段复制功能           | 增强    | 中       | 30行   | 2     |
| **P1** | 素材组合评分           | 新功能  | 中       | 中     | 3     |
| **P1** | 质量评分反馈           | 新功能  | 中       | 中     | 3     |
| **P2** | 用户偏好设置           | 新功能  | 中       | 高     | 3     |
| **P2** | 生成历史记录           | 新功能  | 中       | 高     | 4     |
| **P2** | 模板收藏系统           | 新功能  | 中       | 高     | 4     |
| **P3** | 批量生成模式           | 新功能  | 低       | 高     | 4+    |
| **P3** | 协作分享功能           | 新功能  | 低       | 高     | 4+    |

---

## 三、Phase 1：Bug 修复（本周 Day 1-2）

### 3.1 P0：platformStyle 会话缓存

**问题**：用户选择平台风格后刷新页面，选择会丢失

**修复文件**：`src/app/(main)/knowledge-studio/v2/[blueprintId]/blueprint-workflow-client.tsx`

**代码变更**：

```typescript
// 变更 1: 添加缓存 Key (约第 73 行)
const CACHE_KEYS = {
  // ...existing keys
  PLATFORM_STYLE: "ks-v2-platform-style",  // 🆕 新增
} as const;

// 变更 2: 修改初始化 (约第 200 行)
const [platformStyle, setPlatformStyle] = useState<PlatformStyle>(() => {
  const cached = loadFromCache<PlatformStyle>(CACHE_KEYS.PLATFORM_STYLE);
  return cached ?? "general";
});

// 变更 3: 添加变更处理器
const handlePlatformStyleChange = useCallback((style: PlatformStyle) => {
  setPlatformStyle(style);
  saveToCache(CACHE_KEYS.PLATFORM_STYLE, style);
}, []);

// 变更 4: 更新组件调用 (约第 792 行)
<PlatformStyleSelector
  value={platformStyle}
  onChange={handlePlatformStyleChange}
/>
```

**验收标准**：

- [ ] 选择平台风格后刷新页面，选择应保持
- [ ] 生成完成后清理缓存，platformStyle 应被清理

---

### 3.2 P0：报告记录 platformStyle

**问题**：生成的报告无法追溯使用了哪种平台风格

**修复文件**：`src/app/api/knowledge-studio/v2/generate/route.ts`

**代码变更**：

```typescript
// 约第 359 行，在 generation_metadata 中添加
generation_metadata: {
  blueprint_version: "v2",
  blueprint_id: blueprintId,
  source_bookmark_ids: materials.map((m) => m.bookmarkId),
  has_briefing: !!briefingContext,
  has_outline: !!outline,
  target_length: targetLength,
  platform_style: platformStyle ?? "general",  // 🆕 新增
},
```

**验收标准**：

- [ ] 新生成报告的 `generation_metadata` 包含 `platform_style`
- [ ] 旧报告（无 platform_style）不会报错

---

## 四、Phase 2：智能引导系统（下周 Day 1-5）

### 4.1 数据库迁移

**新建表**：`ks_usage_stats`（用户蓝图使用统计）

```sql
-- supabase/migrations/YYYYMMDD_create_ks_usage_stats.sql

CREATE TABLE IF NOT EXISTS ks_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  blueprint_id TEXT NOT NULL,
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  cancel_count INTEGER DEFAULT 0,
  preferred_platform_style TEXT,
  preferred_length_mode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_blueprint UNIQUE(user_id, blueprint_id)
);

-- 全局热度统计
CREATE TABLE IF NOT EXISTS ks_blueprint_popularity (
  blueprint_id TEXT PRIMARY KEY,
  total_uses INTEGER DEFAULT 0,
  weekly_uses INTEGER DEFAULT 0,
  daily_uses INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RPC 函数
CREATE OR REPLACE FUNCTION record_blueprint_usage(
  p_user_id UUID,
  p_blueprint_id TEXT,
  p_success BOOLEAN DEFAULT true,
  p_platform_style TEXT DEFAULT NULL,
  p_length_mode TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO ks_usage_stats (user_id, blueprint_id, use_count, last_used_at, success_count, preferred_platform_style, preferred_length_mode)
  VALUES (p_user_id, p_blueprint_id, 1, NOW(), CASE WHEN p_success THEN 1 ELSE 0 END, p_platform_style, p_length_mode)
  ON CONFLICT (user_id, blueprint_id) DO UPDATE SET
    use_count = ks_usage_stats.use_count + 1,
    last_used_at = NOW(),
    success_count = ks_usage_stats.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    preferred_platform_style = COALESCE(p_platform_style, ks_usage_stats.preferred_platform_style),
    updated_at = NOW();

  INSERT INTO ks_blueprint_popularity (blueprint_id, total_uses, weekly_uses, daily_uses, updated_at)
  VALUES (p_blueprint_id, 1, 1, 1, NOW())
  ON CONFLICT (blueprint_id) DO UPDATE SET
    total_uses = ks_blueprint_popularity.total_uses + 1,
    weekly_uses = ks_blueprint_popularity.weekly_uses + 1,
    daily_uses = ks_blueprint_popularity.daily_uses + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 4.2 新增 API 端点

| 端点                                                  | 方法 | 功能     |
| ----------------------------------------------------- | ---- | -------- |
| `/api/knowledge-studio/v2/recommendations/blueprints` | GET  | 蓝图推荐 |
| `/api/knowledge-studio/v2/recommendations/materials`  | POST | 素材推荐 |
| `/api/knowledge-studio/v2/usage/record`               | POST | 记录使用 |

---

### 4.3 新增前端组件

| 组件                       | 功能         | 位置           |
| -------------------------- | ------------ | -------------- |
| `ScenarioQuickEntry`       | 场景快速入口 | 蓝图选择页顶部 |
| `BlueprintRecommendations` | 智能蓝图推荐 | 蓝图选择页左侧 |
| `MaterialRecommendations`  | 素材智能推荐 | 素材选择页左侧 |

---

### 4.4 快速改进

| 改进项       | 工作量 | 文件                          |
| ------------ | ------ | ----------------------------- |
| 生成取消按钮 | 10行   | blueprint-workflow-client.tsx |
| 分段复制功能 | 30行   | report-editor.tsx             |
| 素材悬停预览 | 20行   | material-selector             |
| 生成完成音效 | 5行    | blueprint-workflow-client.tsx |

---

### 4.5 页面布局变化

**现有布局**：

```
┌─────────────────────────────────────────┐
│              蓝图/素材网格 (全宽)         │
└─────────────────────────────────────────┘
```

**优化后布局**：

```
┌─────────────────────────────────────────────────────┐
│  🎯 你想做什么？（场景快速入口）                      │
│  📱 写公众号  📕 小红书  📊 竞品分析  📝 学习笔记     │
└─────────────────────────────────────────────────────┘
┌────────────┬────────────────────────────────────────┐
│ ✨ 为你推荐 │           蓝图/素材网格                 │
│            │                                        │
│ 📌 最近使用│                                        │
│ 🔥 热门蓝图│                                        │
│            │                                        │
│ 📊 素材评分│                                        │
│ (素材步骤) │                                        │
└────────────┴────────────────────────────────────────┘
```

---

## 五、Phase 3：体验增强（第3周）

### 5.1 素材组合评分

**新增 API**：`POST /api/knowledge-studio/v2/materials/score`

**新增组件**：`MaterialCombinationScore`

**评分维度**：

- 内容相关度 (30%)
- 主题聚焦度 (30%)
- 信息丰富度 (25%)
- 时效性 (15%)

---

### 5.2 质量评分反馈

**新增组件**：`QualityScorePanel`

**评估维度**：

- 结构完整度
- 内容丰富度
- 逻辑连贯性
- 原创表达度

---

### 5.3 用户偏好设置

**数据库迁移**：

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS ks_preferences JSONB DEFAULT '{
  "defaultPlatformStyle": "general",
  "defaultLengthMode": "medium",
  "rememberLastSelection": true
}'::jsonb;
```

**设置项**：

- 默认平台风格
- 默认输出长度
- 是否记住上次选择

---

## 六、Phase 4：迭代支持（后续）

### 6.1 生成历史记录 ✅

- ✅ 新增页面：`/knowledge-studio/v2/history`
- ✅ 配置快照存储
- ✅ 一键复用配置
- ✅ 生成完成音效

**新增文件**:

- `src/app/(main)/knowledge-studio/v2/history/page.tsx`
- `src/components/knowledge-studio/v2/history-page-client.tsx`
- `src/hooks/use-sound-effect.ts`

### 6.2 模板收藏系统

- 新增表：`ks_templates`
- 模板保存/编辑/删除
- 模板选择器入口

### 6.3 高级功能（按需）

- 批量生成模式
- 协作分享功能
- 版本对比功能

---

## 七、文件清单

### 7.1 数据库迁移（2 个）

| 文件                                 | Phase | 说明         |
| ------------------------------------ | ----- | ------------ |
| `YYYYMMDD_create_ks_usage_stats.sql` | 2     | 使用统计表   |
| `YYYYMMDD_add_ks_preferences.sql`    | 3     | 用户偏好字段 |

### 7.2 API 路由（5 个新建 + 2 个修改）

| 文件                                  | 类型 | Phase |
| ------------------------------------- | ---- | ----- |
| `recommendations/blueprints/route.ts` | 新建 | 2     |
| `recommendations/materials/route.ts`  | 新建 | 2     |
| `materials/score/route.ts`            | 新建 | 3     |
| `usage/record/route.ts`               | 新建 | 2     |
| `generate/route.ts`                   | 修改 | 1     |
| `blueprints/route.ts`                 | 修改 | 2     |

### 7.3 前端组件（8 个新建 + 3 个修改）

| 文件                                  | 类型 | Phase |
| ------------------------------------- | ---- | ----- |
| `scenario-quick-entry.tsx`            | 新建 | 2     |
| `blueprint-recommendations.tsx`       | 新建 | 2     |
| `material-recommendations.tsx`        | 新建 | 2     |
| `material-combination-score.tsx`      | 新建 | 3     |
| `quality-score-panel.tsx`             | 新建 | 3     |
| `copy-section-button.tsx`             | 新建 | 2     |
| `history-page-client.tsx`             | 新建 | 4 ✅  |
| `use-sound-effect.ts`                 | 新建 | 4 ✅  |
| `blueprint-workflow-client.tsx`       | 修改 | 1     |
| `knowledge-studio-v2-page-client.tsx` | 修改 | 2     |
| `report-editor.tsx`                   | 修改 | 2     |

---

## 八、实施计划

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              实施时间线                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Week 1 (本周)                                                              │
│  ├─ Day 1-2: Phase 1 Bug修复                                                │
│  │   ├─ platformStyle 会话缓存                                              │
│  │   └─ 报告记录 platformStyle                                              │
│  └─ Day 3-5: Phase 2 准备                                                   │
│      ├─ 数据库迁移脚本                                                       │
│      └─ API 框架搭建                                                        │
│                                                                             │
│  Week 2 (下周)                                                              │
│  ├─ Day 1-2: 智能推荐 API                                                   │
│  │   ├─ 蓝图推荐 API                                                        │
│  │   └─ 素材推荐 API                                                        │
│  ├─ Day 3-4: 前端组件                                                       │
│  │   ├─ 场景快速入口                                                        │
│  │   ├─ 蓝图推荐组件                                                        │
│  │   └─ 素材推荐组件                                                        │
│  └─ Day 5: 快速改进                                                         │
│      ├─ 生成取消按钮                                                        │
│      └─ 分段复制功能                                                        │
│                                                                             │
│  Week 3 (第3周)                                                             │
│  ├─ Day 1-2: 素材组合评分                                                   │
│  ├─ Day 3-4: 质量评分反馈                                                   │
│  └─ Day 5: 用户偏好设置                                                     │
│                                                                             │
│  Week 4+ (后续)                                                             │
│  ├─ 生成历史记录                                                            │
│  ├─ 模板收藏系统                                                            │
│  └─ 高级功能（按需）                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 九、风险评估

| 风险                        | 影响       | 概率 | 缓解措施                     |
| --------------------------- | ---------- | ---- | ---------------------------- |
| 推荐算法效果不佳            | 用户体验差 | 中   | 先上线简单规则，后续迭代优化 |
| 向量搜索性能问题            | 素材推荐慢 | 低   | 添加缓存，限制搜索范围       |
| 页面布局变化影响体验        | 用户困惑   | 低   | 渐进式发布，收集反馈         |
| sessionStorage 隐私模式受限 | 缓存失效   | 低   | try-catch 包裹，静默降级     |

---

## 十、预期效果

| 指标         | 当前  | Phase 2 后 | Phase 3 后 | 提升      |
| ------------ | ----- | ---------- | ---------- | --------- |
| 蓝图选择时间 | ~30秒 | ~15秒      | ~10秒      | **-67%**  |
| 素材选择时间 | ~60秒 | ~35秒      | ~25秒      | **-58%**  |
| 新用户完成率 | ~60%  | ~75%       | ~85%       | **+42%**  |
| 生成放弃率   | ~20%  | ~12%       | ~8%        | **-60%**  |
| 周均生成次数 | ~3次  | ~5次       | ~8次       | **+167%** |

---

## 十一、审核确认

### Phase 1（本周必做）✅ 已完成

- [x] **P0 Bug修复**：platformStyle 会话缓存方案
- [x] **P0 Bug修复**：报告记录 platformStyle 方案

**完成日期**: 2026-01-06
**修改文件**:

- `src/app/(main)/knowledge-studio/v2/[blueprintId]/blueprint-workflow-client.tsx`
  - 添加 `PLATFORM_STYLE` 到 `CACHE_KEYS`
  - 修改 `platformStyle` 初始化逻辑使用缓存
  - 添加 `handlePlatformStyleChange` 回调函数
  - 更新 `PlatformStyleSelector` 组件调用
- `src/app/api/knowledge-studio/v2/generate/route.ts`
  - 在 `generation_metadata` 中添加 `platform_style` 字段

### Phase 2（下周完成）✅ 全部完成

- [x] **数据库设计**：`ks_usage_stats` 和 `ks_blueprint_popularity` 表结构
- [x] **API 设计**：3 个推荐相关 API 接口
- [x] **组件设计**：场景入口 + 蓝图推荐 + 素材推荐 3 个核心组件
- [x] **页面布局**：左侧推荐区 + 右侧主内容区布局
- [x] **数据库迁移**：已应用到远程数据库
- [x] **TypeScript 类型**：已生成
- [x] **分段复制功能**：已在 StructuredOutputViewer 中实现

**完成日期**: 2026-01-06
**创建文件**:

- `supabase/migrations/20260106000001_create_ks_usage_stats.sql` - 数据库迁移
- `src/app/api/knowledge-studio/v2/recommendations/blueprints/route.ts` - 蓝图推荐 API
- `src/app/api/knowledge-studio/v2/recommendations/materials/route.ts` - 素材推荐 API
- `src/app/api/knowledge-studio/v2/usage/record/route.ts` - 使用记录 API
- `src/components/knowledge-studio/v2/scenario-quick-entry.tsx` - 场景快速入口
- `src/components/knowledge-studio/v2/blueprint-recommendations.tsx` - 蓝图推荐组件
- `src/components/knowledge-studio/v2/material-recommendations.tsx` - 素材推荐组件

**修改文件**:

- `src/components/knowledge-studio/v2/index.ts` - 导出新组件
- `src/app/(main)/knowledge-studio/v2/knowledge-studio-v2-page-client.tsx` - 集成推荐组件

### Phase 3（第3周完成）

- [ ] **素材评分**：组合评分 API 和组件
- [ ] **质量反馈**：生成质量评分面板
- [ ] **用户偏好**：数据库字段 + 设置面板

### 实施周期

- [ ] **整体周期**：3 周核心功能 + 后续迭代

---

## 十二、下一步行动

**审核通过后，BMad Master 将按以下顺序执行：**

1. **立即执行**（Day 1）：Phase 1 的 2 个 P0 Bug 修复
2. **本周完成**（Day 2-5）：Phase 2 数据库迁移 + API 框架
3. **下周完成**（Week 2）：Phase 2 全部组件和快速改进
4. **第3周完成**（Week 3）：Phase 3 体验增强功能

---

**请审核以上综合升级方案。审核通过后，BMad Master 将立即开始 Phase 1 Bug 修复。**
