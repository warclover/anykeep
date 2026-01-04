---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - "project-planning-artifacts/blueprints-enhancement-prd.md"
  - "architecture-knowledge-studio.md"
  - "ux-design-specification.md"
project_name: "智能蓝图系统增强 (Blueprints Enhancement)"
user_name: "Xiafe"
date: "2026-01-04"
status: "completed"
---

# 智能蓝图系统增强 - Epic 拆解

## 概述

本文档将智能蓝图系统增强方案 PRD 拆解为可执行的 Epic 和 User Story，整合架构决策和前端功能需求。

---

## 需求清单

### 功能需求 (Functional Requirements)

#### 基础架构 (FR1-FR4)

```
FR1: 创建 EnhancedBlueprintEngine 基类，扩展现有 OrchestrationSkill
FR2: 定义蓝图元数据结构（blueprintId, displayName, description, icon, tier, targetUsers）
FR3: 实现蓝图注册表和发现机制
FR4: 支持蓝图权限分层（free/pro/enterprise）
```

#### Briefing 机制 (FR5-FR9)

```
FR5: 实现 Briefing 问题配置系统（每个蓝图最多 3 个问题）
FR6: 支持动态问题生成（基于素材分析条件）
FR7: 创建 Briefing 对话框 UI 组件
FR8: 实现 Briefing 响应注入到生成 Prompt
FR9: 支持快速模式跳过 Briefing
```

#### 大纲优先模式 (FR10-FR14)

```
FR10: 实现大纲生成器（H1/H2/H3 层级 + 预计内容摘要）
FR11: 创建大纲编辑器 UI（拖拽排序、删除章节、编辑标题）
FR12: 支持大纲确认/跳过机制（可选自动继续）
FR13: 实现基于确认大纲的内容生成
FR14: 支持大纲版本管理
```

#### 结构化输出 (FR15-FR17)

```
FR15: 定义各蓝图输出 Schema 并实现验证器
FR16: 创建结构化输出渲染器（表格、卡片、时间线等）
FR17: 实现降级机制（Schema 验证失败时降级为纯文本）
```

#### 极客蓝图 - P0 优先级 (FR18-FR21)

```
FR18: 实现 arxiv_decoder 蓝图（论文+代码→实战评测）
FR19: 实现 tutorial_architect 蓝图（文档+问答→MDX教程）
FR20: 实现 prd_master 蓝图（反馈/会议→PRD文档）
FR21: 实现 system_design_review 蓝图（技术博客→ADR决策文档）
```

#### 创作者蓝图 (FR22-FR24)

```
FR22: 实现 scriptwriter 蓝图（素材→分镜脚本）
FR23: 实现 newsletter 蓝图（碎片→结构化周刊）
FR24: 实现 interview_prep 蓝图（嘉宾资料→深度提纲）
```

#### 商业蓝图 (FR25-FR27)

```
FR25: 实现 competitor_scout 蓝图（竞品资料→SWOT分析）
FR26: 实现 due_diligence 蓝图（财报/新闻→风险备忘录）
FR27: 实现 pitch_narrative 蓝图（碎片想法→BP逐字稿）
```

#### 技术与学术蓝图 (FR28-FR29)

```
FR28: 实现 tech_decider 蓝图（技术文章→ADR文档）
FR29: 实现 literature_matrix 蓝图（论文→综述矩阵）
```

#### 营销与教育蓝图 (FR30-FR31)

```
FR30: 实现 seo_pillar 蓝图（碎片→长青内容大纲）
FR31: 实现 workshop_designer 蓝图（资料→工作坊流程表）
```

#### 前端组件 (FR32-FR36)

```
FR32: 升级蓝图选择器（支持分类展示、优先级标记）
FR33: 创建功能对比表格组件（FeatureMatrixTable）
FR34: 创建 SWOT 分析卡片组件（SwotCard）
FR35: 创建脚本时间线组件（ScriptTimeline）
FR36: 集成 dnd-kit 实现大纲拖拽排序
```

#### 配额策略 (FR37-FR38)

```
FR37: 实现增强蓝图差异化配额消耗（2-3 credits）
FR38: 实现 Free 用户试用限制（每月 3 次增强蓝图）
```

### 非功能需求 (Non-Functional Requirements)

```
NFR1: 首 Token 延迟 < 3s (P95)
NFR2: 大纲生成时间 < 5s (P95)
NFR3: 完整生成时间 < 60s（20 书签，P95）
NFR4: 结构化输出 Schema 验证通过率 > 98%
NFR5: Briefing 完成率（开始→生成完成）> 85%
NFR6: 大纲生成使用轻量模型（DeepSeek）降低成本
NFR7: Token 消耗增加控制在 30% 以内（相比单阶段生成）
```

### 架构附加需求

从 `architecture-knowledge-studio.md` 提取的技术要求：

```
- EnhancedBlueprintEngine 必须继承 OrchestrationSkill 基类
- 复用现有 SSE 流式输出机制（5 阶段进度）
- 遵循现有命名规范（kebab-case 文件名、PascalCase 组件名）
- 新增蓝图类型需扩展 synthesis_reports 表的 blueprint_type 约束
- 数据库新增字段：briefing_responses, outline_document, structured_output, generation_mode
- Briefing 配置存储在代码中（非数据库），便于版本管理
- 输出 Schema 使用 JSON Mode 而非 Function Calling
```

### UX 附加需求

从 `ux-design-specification.md` 提取的设计要求：

```
- 流式输出保持打字机效果
- 大纲编辑器支持折叠/展开
- Briefing 对话框设计简洁，30秒内可完成
- 结构化输出渲染需视觉区分（表格、卡片、时间线）
- 进度反馈需显示当前阶段和预估剩余时间
```

---

### 需求覆盖映射

| FR   | Epic   | 描述                         |
| ---- | ------ | ---------------------------- |
| FR1  | Epic 1 | EnhancedBlueprintEngine 基类 |
| FR2  | Epic 1 | 蓝图元数据结构               |
| FR3  | Epic 1 | 蓝图注册表和发现机制         |
| FR4  | Epic 1 | 蓝图权限分层                 |
| FR5  | Epic 1 | Briefing 问题配置系统        |
| FR6  | Epic 1 | 动态问题生成                 |
| FR7  | Epic 1 | Briefing 对话框 UI 组件      |
| FR8  | Epic 1 | Briefing 响应注入 Prompt     |
| FR9  | Epic 1 | 快速模式跳过 Briefing        |
| FR10 | Epic 2 | 大纲生成器                   |
| FR11 | Epic 2 | 大纲编辑器 UI                |
| FR12 | Epic 2 | 大纲确认/跳过机制            |
| FR13 | Epic 2 | 基于大纲的内容生成           |
| FR14 | Epic 2 | 大纲版本管理                 |
| FR15 | Epic 3 | 输出 Schema 定义与验证       |
| FR16 | Epic 3 | 结构化输出渲染器             |
| FR17 | Epic 3 | 降级机制                     |
| FR18 | Epic 4 | arxiv_decoder 蓝图           |
| FR19 | Epic 4 | tutorial_architect 蓝图      |
| FR20 | Epic 4 | prd_master 蓝图              |
| FR21 | Epic 4 | system_design_review 蓝图    |
| FR22 | Epic 5 | scriptwriter 蓝图            |
| FR23 | Epic 5 | newsletter 蓝图              |
| FR24 | Epic 5 | interview_prep 蓝图          |
| FR25 | Epic 6 | competitor_scout 蓝图        |
| FR26 | Epic 6 | due_diligence 蓝图           |
| FR27 | Epic 6 | pitch_narrative 蓝图         |
| FR28 | Epic 7 | tech_decider 蓝图            |
| FR29 | Epic 7 | literature_matrix 蓝图       |
| FR30 | Epic 7 | seo_pillar 蓝图              |
| FR31 | Epic 7 | workshop_designer 蓝图       |
| FR32 | Epic 1 | 升级蓝图选择器               |
| FR33 | Epic 3 | FeatureMatrixTable 组件      |
| FR34 | Epic 3 | SwotCard 组件                |
| FR35 | Epic 3 | ScriptTimeline 组件          |
| FR36 | Epic 2 | dnd-kit 拖拽排序             |
| FR37 | Epic 8 | 差异化配额消耗               |
| FR38 | Epic 8 | Free 用户试用限制            |

---

## Epic 列表

### Epic 1: 增强蓝图引擎基础

用户可以使用新的增强蓝图框架，通过 Briefing 对话获得更精准的生成结果。

**FRs 覆盖**: FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR32

**交付物**:

- `EnhancedBlueprintEngine` 基类
- Briefing 对话框组件
- 升级版蓝图选择器

---

### Epic 2: 大纲优先生成模式

用户可以先审核和编辑大纲，确认后再生成完整内容，获得更可控的生成体验。

**FRs 覆盖**: FR10, FR11, FR12, FR13, FR14, FR36

**交付物**:

- 大纲生成器（DeepSeek 模型）
- 大纲编辑器（dnd-kit 拖拽排序、折叠展开）
- 大纲版本历史

---

### Epic 3: 结构化输出与可视化

用户可以获得专业的结构化输出格式，通过表格、卡片、时间线等可视化组件更好地理解生成内容。

**FRs 覆盖**: FR15, FR16, FR17, FR33, FR34, FR35

**交付物**:

- JSON Schema 验证系统
- FeatureMatrixTable 功能对比表格组件
- SwotCard SWOT 分析卡片组件
- ScriptTimeline 脚本时间线组件
- 降级处理机制

---

### Epic 4: 极客蓝图（🔥 P0 最高优先级）

开发者可以使用 4 个核心极客蓝图 —— 解析论文、生成教程、编写 PRD、技术决策评审。

**FRs 覆盖**: FR18, FR19, FR20, FR21

| 蓝图 ID                | 名称           | 功能                 |
| ---------------------- | -------------- | -------------------- |
| `arxiv_decoder`        | 论文实战解码器 | 论文+代码→实战评测   |
| `tutorial_architect`   | 技术教程架构师 | 文档+问答→MDX教程    |
| `prd_master`           | PRD大师        | 反馈/会议→PRD文档    |
| `system_design_review` | 系统架构评审官 | 技术博客→ADR决策文档 |

**交付物**:

- 4 个完整可用的极客蓝图
- 对应的 Briefing 配置和输出 Schema

---

### Epic 5: 创作者蓝图

内容创作者可以使用视频脚本、Newsletter、访谈提纲等专业创作工具。

**FRs 覆盖**: FR22, FR23, FR24

| 蓝图 ID          | 名称       | 功能              |
| ---------------- | ---------- | ----------------- |
| `scriptwriter`   | 视频编剧   | 素材→分镜脚本     |
| `newsletter`     | 周刊策展人 | 碎片→结构化周刊   |
| `interview_prep` | 访谈准备官 | 嘉宾资料→深度提纲 |

**交付物**:

- 3 个完整可用的创作者蓝图
- ScriptTimeline 时间线渲染器集成

---

### Epic 6: 商业蓝图

商业用户可以生成竞品分析、尽职调查报告、BP 逐字稿等专业商业文档。

**FRs 覆盖**: FR25, FR26, FR27

| 蓝图 ID            | 名称       | 功能                 |
| ------------------ | ---------- | -------------------- |
| `competitor_scout` | 竞品侦察兵 | 竞品资料→SWOT分析    |
| `due_diligence`    | 尽调专家   | 财报/新闻→风险备忘录 |
| `pitch_narrative`  | 故事线专家 | 碎片想法→BP逐字稿    |

**交付物**:

- 3 个完整可用的商业蓝图
- SwotCard 和 FeatureMatrixTable 渲染器集成

---

### Epic 7: 技术与营销蓝图

用户可以使用技术决策助手、文献综述、SEO 内容规划、工作坊设计等多样化蓝图。

**FRs 覆盖**: FR28, FR29, FR30, FR31

| 蓝图 ID             | 名称         | 功能              |
| ------------------- | ------------ | ----------------- |
| `tech_decider`      | 技术决策助手 | 技术文章→ADR文档  |
| `literature_matrix` | 文献矩阵     | 论文→综述矩阵     |
| `seo_pillar`        | SEO霸屏专家  | 碎片→长青内容大纲 |
| `workshop_designer` | 课程设计师   | 资料→工作坊流程表 |

**交付物**:

- 4 个完整可用的蓝图
- 矩阵表格渲染器集成

---

### Epic 8: 配额策略与商业化

用户根据会员等级获得差异化的蓝图使用额度，Free 用户可试用增强蓝图。

**FRs 覆盖**: FR37, FR38

**交付物**:

- 增强蓝图差异化配额消耗（2-3 credits）
- Free 用户试用限制（每月 3 次）
- 配额用尽提示 UI

---

## Epic 依赖关系

```
Epic 1 (引擎基础) ──┬──▶ Epic 4 (极客蓝图 P0)
                   │
Epic 2 (大纲模式) ──┼──▶ Epic 5 (创作者蓝图)
                   │
Epic 3 (结构化输出)─┼──▶ Epic 6 (商业蓝图)
                   │
                   └──▶ Epic 7 (技术营销蓝图)

Epic 8 (配额策略) ──▶ 可在任何蓝图 Epic 后集成
```

**建议实施顺序**:

1. **Phase 1**: Epic 1 + Epic 2 + Epic 3（基础设施，可并行）
2. **Phase 2**: Epic 4（极客蓝图 P0 最高优先级）
3. **Phase 3**: Epic 5 + Epic 6（创作者 + 商业蓝图，可并行）
4. **Phase 4**: Epic 7 + Epic 8（技术营销蓝图 + 配额策略）

---

## 统计

- **总 Epic 数**: 8
- **总 FR 覆盖**: 38/38 (100%)
- **P0 极客蓝图**: Epic 4（4 个蓝图）
- **依赖**: Epic 4-7 依赖 Epic 1-3 的基础设施

---

## Epic 1: 增强蓝图引擎基础

用户可以使用新的增强蓝图框架，通过 Briefing 对话获得更精准的生成结果。

### Story 1.1: 创建 EnhancedBlueprintEngine 基类

As a 开发者,
I want 一个继承 OrchestrationSkill 的 EnhancedBlueprintEngine 基类,
So that 新的增强蓝图可以复用现有的 SSE 流式输出和进度报告机制。

**Acceptance Criteria:**

**Given** 现有 OrchestrationSkill 基类
**When** 创建 EnhancedBlueprintEngine 类
**Then** 该类继承 OrchestrationSkill 的所有方法
**And** 新增 `getBriefingQuestions()` 抽象方法
**And** 新增 `generateOutline()` 抽象方法
**And** 新增 `getOutputSchema()` 抽象方法
**And** 文件位于 `src/lib/knowledge-studio/blueprint/enhanced-blueprint-engine.ts`

---

### Story 1.2: 定义蓝图元数据结构

As a 开发者,
I want 标准化的蓝图元数据类型定义,
So that 每个蓝图都有一致的描述信息用于展示和过滤。

**Acceptance Criteria:**

**Given** EnhancedBlueprintEngine 基类存在
**When** 定义 BlueprintMetadata 接口
**Then** 包含必需字段: blueprintId, displayName, description, icon
**And** 包含必需字段: tier (free/pro/enterprise), targetUsers (用户群体)
**And** 包含可选字段: category, priority, isNew
**And** 类型定义位于 `src/lib/knowledge-studio/blueprint/types.ts`

---

### Story 1.3: 实现蓝图注册表

As a 开发者,
I want 一个蓝图注册表来管理所有可用蓝图,
So that 可以动态发现和获取蓝图实例。

**Acceptance Criteria:**

**Given** BlueprintMetadata 类型已定义
**When** 创建 BlueprintRegistry 类
**Then** 提供 `register(blueprint)` 方法注册蓝图
**And** 提供 `getAll()` 方法获取所有蓝图
**And** 提供 `getById(id)` 方法按 ID 获取蓝图
**And** 提供 `getByTier(tier)` 方法按权限层级过滤
**And** 提供 `getByCategory(category)` 方法按分类过滤
**And** 使用单例模式确保全局唯一

---

### Story 1.4: 实现蓝图权限分层

As a 用户,
I want 根据我的会员等级看到不同的蓝图,
So that 我可以了解升级会员后解锁的功能。

**Acceptance Criteria:**

**Given** 用户已登录且有 membership_type (free/pro/enterprise)
**When** 调用 BlueprintRegistry.getAccessibleBlueprints(userTier)
**Then** free 用户只能使用 tier=free 的蓝图
**And** pro 用户可以使用 tier=free 和 tier=pro 的蓝图
**And** enterprise 用户可以使用所有蓝图
**And** 锁定的蓝图显示升级提示而非隐藏

---

### Story 1.5: 实现 Briefing 问题配置系统

As a 开发者,
I want 在代码中配置每个蓝图的 Briefing 问题,
So that 问题配置可以版本管理且无需数据库存储。

**Acceptance Criteria:**

**Given** EnhancedBlueprintEngine 基类存在
**When** 定义 BriefingQuestion 接口和配置结构
**Then** 支持问题类型: audience, objective, tone, constraint, context
**And** 每个蓝图最多 3 个问题
**And** 每个问题包含: id, type, question, options (可选), required
**And** 提供 `getBriefingQuestions()` 默认实现返回蓝图配置的问题

---

### Story 1.6: 支持动态问题生成

As a 用户,
I want AI 根据我的素材智能生成补充问题,
So that 我可以提供对生成结果有关键影响的信息。

**Acceptance Criteria:**

**Given** 用户已选择素材并选择增强蓝图
**When** 蓝图配置了 conditionalQuestion 规则
**Then** 系统分析素材内容判断是否满足条件
**And** 满足条件时动态添加问题（如"素材缺少X，需要补充吗？"）
**And** 动态问题 + 静态问题总数不超过 3 个
**And** 动态问题标记为 isConditional: true

---

### Story 1.7: 创建 Briefing 对话框 UI 组件

As a 用户,
I want 一个简洁的 Briefing 对话框,
So that 我可以在 30 秒内完成问答流程。

**Acceptance Criteria:**

**Given** 用户选择了增强蓝图并点击生成
**When** 蓝图有 Briefing 问题配置
**Then** 显示 BriefingDialog 组件
**And** 问题以卡片形式逐个或一次性展示
**And** 支持单选、多选、文本输入类型
**And** 显示跳过按钮（快速模式）
**And** 完成后自动关闭并触发生成

---

### Story 1.8: 实现 Briefing 响应注入

As a 系统,
I want 将用户的 Briefing 响应注入到生成 Prompt 中,
So that 生成内容能够符合用户的具体需求。

**Acceptance Criteria:**

**Given** 用户完成 Briefing 问答
**When** 系统构建生成 Prompt
**Then** 将 Briefing 响应格式化为结构化上下文
**And** 注入到 Prompt 的专用区域（如 `<user_preferences>` 标签内）
**And** 保存 Briefing 响应到 synthesis_reports.briefing_responses 字段
**And** Briefing 响应使用 JSON 格式存储

---

### Story 1.9: 支持快速模式跳过 Briefing

As a 高级用户,
I want 直接跳过 Briefing 快速生成内容,
So that 我可以在已熟悉流程时节省时间。

**Acceptance Criteria:**

**Given** 用户选择了增强蓝图
**When** 用户点击"快速生成"或跳过 Briefing
**Then** 使用默认/空值作为 Briefing 响应
**And** 直接进入生成流程
**And** 记录 generation_mode = 'quick' 到数据库
**And** 正常模式记录 generation_mode = 'guided'

---

### Story 1.10: 升级蓝图选择器

As a 用户,
I want 在蓝图选择器中清晰看到分类和优先级,
So that 我可以快速找到适合我的增强蓝图。

**Acceptance Criteria:**

**Given** 用户进入知识工坊蓝图选择界面
**When** 渲染蓝图选择器
**Then** 按分类（极客/创作者/商业/技术/营销）分组展示
**And** P0 蓝图显示🔥标记
**And** 新蓝图显示 NEW 标签
**And** Pro/Enterprise 专属蓝图显示锁定图标
**And** 点击锁定蓝图显示升级提示

---

## Epic 2: 大纲优先生成模式

用户可以先审核和编辑大纲，确认后再生成完整内容，获得更可控的生成体验。

### Story 2.1: 实现大纲生成器

As a 用户,
I want 系统先生成内容大纲,
So that 我可以在生成完整内容前审核和调整结构。

**Acceptance Criteria:**

**Given** 用户完成 Briefing（或跳过）
**When** 蓝图开启大纲模式 (outlineEnabled: true)
**Then** 使用 DeepSeek 模型生成大纲
**And** 大纲包含 H1/H2/H3 层级结构
**And** 每个章节包含预计内容摘要（1-2 句）
**And** 大纲生成时间 < 5 秒
**And** 生成过程显示 SSE 流式进度

---

### Story 2.2: 创建大纲编辑器 UI

As a 用户,
I want 可视化编辑生成的大纲,
So that 我可以调整结构、删除或重新排序章节。

**Acceptance Criteria:**

**Given** 大纲已生成
**When** 显示大纲编辑器
**Then** 以树形结构展示 H1/H2/H3 层级
**And** 支持折叠/展开章节
**And** 支持编辑章节标题（双击或编辑按钮）
**And** 支持删除章节（带确认）
**And** 使用 dnd-kit 实现拖拽排序
**And** 实时更新预览

---

### Story 2.3: 支持大纲确认/跳过机制

As a 用户,
I want 确认或自动继续大纲生成,
So that 我可以根据需要控制生成流程的粒度。

**Acceptance Criteria:**

**Given** 大纲编辑器显示
**When** 用户点击"确认并生成"
**Then** 使用确认后的大纲作为内容生成依据
**When** 用户开启"自动继续"偏好
**Then** 大纲生成后自动开始内容生成（无需手动确认）
**And** 偏好保存到用户设置中

---

### Story 2.4: 实现基于大纲的内容生成

As a 系统,
I want 按照确认的大纲逐章节生成内容,
So that 生成结果严格遵循用户确认的结构。

**Acceptance Criteria:**

**Given** 用户确认了大纲
**When** 开始内容生成
**Then** Prompt 包含完整大纲结构作为约束
**And** 生成内容的标题层级与大纲一致
**And** 保存大纲到 synthesis_reports.outline_document 字段
**And** 支持 SSE 流式输出内容

---

### Story 2.5: 支持大纲版本管理

As a 用户,
I want 保存大纲的编辑历史,
So that 我可以回退到之前的版本重新生成。

**Acceptance Criteria:**

**Given** 用户在编辑大纲
**When** 用户保存修改
**Then** 创建新的大纲版本快照
**And** 最多保留 5 个版本
**And** 提供版本历史列表（显示时间戳）
**And** 支持恢复到历史版本

---

## Epic 3: 结构化输出与可视化

用户可以获得专业的结构化输出格式，通过表格、卡片、时间线等可视化组件更好地理解生成内容。

### Story 3.1: 定义输出 Schema 并实现验证器

As a 开发者,
I want 为每个蓝图定义 JSON Schema 输出格式,
So that 生成内容可以被程序化解析和渲染。

**Acceptance Criteria:**

**Given** EnhancedBlueprintEngine 定义了 getOutputSchema() 方法
**When** 蓝图返回 Schema 定义
**Then** Schema 使用 JSON Schema Draft 7 格式
**And** 实现 validateOutput(content, schema) 验证函数
**And** 验证通过率目标 > 98%
**And** Schema 存储在蓝图代码中，随代码版本管理

---

### Story 3.2: 创建结构化输出渲染器基础

As a 用户,
I want 结构化内容以可视化方式展示,
So that 我可以更直观地理解和使用生成结果。

**Acceptance Criteria:**

**Given** 生成内容通过 Schema 验证
**When** 渲染结构化输出
**Then** 根据 outputType 选择对应渲染器
**And** 支持渲染器类型: table, card, timeline, matrix
**And** 未匹配的类型使用默认 Markdown 渲染
**And** 保存结构化数据到 synthesis_reports.structured_output 字段

---

### Story 3.3: 实现降级机制

As a 系统,
I want Schema 验证失败时优雅降级,
So that 用户始终能获得可用的输出结果。

**Acceptance Criteria:**

**Given** 生成内容未通过 Schema 验证
**When** 验证失败次数 <= 2
**Then** 自动重试生成
**When** 重试仍失败
**Then** 降级为纯 Markdown 文本输出
**And** 显示提示"已降级为文本格式"
**And** 记录降级事件到日志

---

### Story 3.4: 创建 FeatureMatrixTable 组件

As a 用户,
I want 以表格形式查看功能对比分析,
So that 我可以直观比较不同选项的优劣。

**Acceptance Criteria:**

**Given** 结构化输出类型为 feature_matrix
**When** 渲染 FeatureMatrixTable 组件
**Then** 显示功能名称列和对比对象列
**And** 支持 ✓/✗/△ 符号表示支持程度
**And** 支持排序和筛选
**And** 响应式设计（移动端横向滚动）

---

### Story 3.5: 创建 SwotCard 组件

As a 用户,
I want 以四象限卡片形式查看 SWOT 分析,
So that 我可以清晰理解优势/劣势/机会/威胁。

**Acceptance Criteria:**

**Given** 结构化输出类型为 swot
**When** 渲染 SwotCard 组件
**Then** 显示四个颜色区分的象限卡片
**And** 每个象限列表展示要点
**And** 支持展开/折叠详情
**And** 支持导出为图片

---

### Story 3.6: 创建 ScriptTimeline 组件

As a 用户,
I want 以时间线形式查看视频脚本,
So that 我可以直观看到每个镜头的时间分配和内容。

**Acceptance Criteria:**

**Given** 结构化输出类型为 script_timeline
**When** 渲染 ScriptTimeline 组件
**Then** 垂直时间线展示每个分镜
**And** 显示时间点、时长、画面描述、旁白/台词
**And** 支持点击跳转到对应文本位置
**And** 显示总时长统计

---

## Epic 4: 极客蓝图（🔥 P0 最高优先级）

开发者可以使用 4 个核心极客蓝图 —— 解析论文、生成教程、编写 PRD、技术决策评审。

### Story 4.1: 实现 arxiv_decoder 蓝图

As a AI博主/算法工程师,
I want 上传论文和代码生成实战评测报告,
So that 我可以快速产出高质量的技术内容。

**Acceptance Criteria:**

**Given** 用户选择 arxiv_decoder 蓝图并上传论文/代码素材
**When** 完成 Briefing（目标受众、评测重点）
**Then** 生成包含以下章节的评测报告:

- 论文核心贡献（1 段）
- 方法论解析（带代码片段引用）
- 实验复现难度评估
- 工程化建议
- 结论与推荐场景
  **And** 输出 Schema 包含 structured_sections 数组
  **And** 支持导出为 MDX 格式

---

### Story 4.2: 实现 tutorial_architect 蓝图

As a 科技博主/DevRel,
I want 根据技术文档和问答生成结构化教程,
So that 我可以高效产出入门级到进阶的技术教程。

**Acceptance Criteria:**

**Given** 用户选择 tutorial_architect 蓝图并上传文档/问答素材
**When** 完成 Briefing（目标读者技术水平、教程目标）
**Then** 生成 MDX 格式教程包含:

- 学习目标清单
- 前置知识要求
- 分步骤操作指南（含代码块）
- 常见问题解答
- 进阶资源链接
  **And** 支持生成配套的 meta 信息（title, description, keywords）

---

### Story 4.3: 实现 prd_master 蓝图

As a PM/独立开发者,
I want 根据用户反馈和会议记录生成 PRD 文档,
So that 我可以快速整理需求并与团队对齐。

**Acceptance Criteria:**

**Given** 用户选择 prd_master 蓝图并上传反馈/会议素材
**When** 完成 Briefing（产品阶段、目标用户）
**Then** 生成标准 PRD 格式包含:

- 背景与目标
- 用户故事列表
- 功能需求（FR）列表
- 非功能需求（NFR）
- 验收标准
- 时间线建议
  **And** 输出 Schema 支持需求追踪（每个 FR 有唯一 ID）

---

### Story 4.4: 实现 system_design_review 蓝图

As a 架构师,
I want 根据技术博客/设计文档生成 ADR 决策记录,
So that 我可以系统化记录和评审技术决策。

**Acceptance Criteria:**

**Given** 用户选择 system_design_review 蓝图并上传技术素材
**When** 完成 Briefing（决策场景、约束条件）
**Then** 生成 ADR 格式包含:

- 决策标题
- 状态（proposed/accepted/deprecated）
- 上下文
- 决策内容
- 替代方案对比（FeatureMatrixTable）
- 后果分析
  **And** 输出包含结构化的 alternatives 数组

---

## Epic 5: 创作者蓝图

内容创作者可以使用视频脚本、Newsletter、访谈提纲等专业创作工具。

### Story 5.1: 实现 scriptwriter 蓝图

As a 视频创作者,
I want 根据素材生成分镜脚本,
So that 我可以高效规划视频拍摄和剪辑。

**Acceptance Criteria:**

**Given** 用户选择 scriptwriter 蓝图并上传素材
**When** 完成 Briefing（视频类型、目标时长、风格）
**Then** 生成分镜脚本包含:

- 开场 hook（前 5 秒）
- 分镜列表（时间点、画面、旁白、B-roll 建议）
- 转场提示
- 结尾 CTA
  **And** 使用 ScriptTimeline 组件渲染
  **And** 支持导出为 Final Cut Pro / Premiere 兼容格式

---

### Story 5.2: 实现 newsletter 蓝图

As a Newsletter 作者,
I want 将碎片内容整理为结构化周刊,
So that 我可以保持周刊的一致性和专业性。

**Acceptance Criteria:**

**Given** 用户选择 newsletter 蓝图并上传碎片素材
**When** 完成 Briefing（周刊风格、目标读者）
**Then** 生成 Newsletter 结构包含:

- 本期主题摘要
- 精选内容（3-5 条，含点评）
- 延伸阅读
- 个人观点/编辑寄语
  **And** 支持自定义模板样式
  **And** 输出包含 HTML 邮件格式选项

---

### Story 5.3: 实现 interview_prep 蓝图

As a 播客主持人/记者,
I want 根据嘉宾资料生成深度访谈提纲,
So that 我可以准备有深度的访谈问题。

**Acceptance Criteria:**

**Given** 用户选择 interview_prep 蓝图并上传嘉宾资料
**When** 完成 Briefing（访谈目的、目标受众）
**Then** 生成访谈提纲包含:

- 嘉宾背景摘要
- 破冰问题（2-3 个）
- 核心问题（5-8 个，分主题）
- 追问提示（每个核心问题 1-2 个）
- 收尾问题
  **And** 问题按难度/深度递进排列

---

## Epic 6: 商业蓝图

商业用户可以生成竞品分析、尽职调查报告、BP 逐字稿等专业商业文档。

### Story 6.1: 实现 competitor_scout 蓝图

As a 产品经理/市场分析师,
I want 根据竞品资料生成 SWOT 分析报告,
So that 我可以系统评估竞争格局。

**Acceptance Criteria:**

**Given** 用户选择 competitor_scout 蓝图并上传竞品资料
**When** 完成 Briefing（分析维度、目标市场）
**Then** 生成竞品分析报告包含:

- 竞品概览表格
- SWOT 四象限分析（使用 SwotCard）
- 功能对比矩阵（使用 FeatureMatrixTable）
- 差异化机会
- 策略建议
  **And** 支持多竞品对比（最多 5 个）

---

### Story 6.2: 实现 due_diligence 蓝图

As a 投资人/分析师,
I want 根据财报和新闻生成风险评估备忘录,
So that 我可以快速评估投资标的的风险因素。

**Acceptance Criteria:**

**Given** 用户选择 due_diligence 蓝图并上传财报/新闻素材
**When** 完成 Briefing（投资类型、风险偏好）
**Then** 生成尽调备忘录包含:

- 公司概览
- 财务健康度评估
- 风险清单（红旗警示）
- 机会清单
- 待验证事项清单
  **And** 每个风险/机会标注来源引用

---

### Story 6.3: 实现 pitch_narrative 蓝图

As a 创业者,
I want 将碎片想法整理为 BP 逐字稿,
So that 我可以准备有说服力的融资路演。

**Acceptance Criteria:**

**Given** 用户选择 pitch_narrative 蓝图并上传碎片素材
**When** 完成 Briefing（融资阶段、目标投资人类型）
**Then** 生成 BP 逐字稿包含:

- 开场 Hook（30 秒版）
- 问题阐述
- 解决方案
- 商业模式
- 市场规模
- 竞争优势
- 团队介绍
- 融资需求与用途
- 收尾 CTA
  **And** 每段标注建议时长
  **And** 提供 10 分钟/5 分钟/3 分钟版本

---

## Epic 7: 技术与营销蓝图

用户可以使用技术决策助手、文献综述、SEO 内容规划、工作坊设计等多样化蓝图。

### Story 7.1: 实现 tech_decider 蓝图

As a 技术负责人,
I want 根据技术文章生成 ADR 格式的决策文档,
So that 团队可以结构化讨论技术选型。

**Acceptance Criteria:**

**Given** 用户选择 tech_decider 蓝图并上传技术文章
**When** 完成 Briefing（决策场景、评估维度）
**Then** 生成技术决策文档包含:

- 决策背景
- 候选方案列表
- 评估矩阵（使用 FeatureMatrixTable）
- 推荐方案及理由
- 实施风险
- 后续行动项
  **And** 支持导出为团队 Wiki 格式

---

### Story 7.2: 实现 literature_matrix 蓝图

As a 研究人员/学生,
I want 根据论文集生成文献综述矩阵,
So that 我可以系统梳理研究现状。

**Acceptance Criteria:**

**Given** 用户选择 literature_matrix 蓝图并上传论文素材
**When** 完成 Briefing（研究主题、分析维度）
**Then** 生成文献矩阵包含:

- 论文基本信息表格（作者、年份、期刊）
- 研究方法对比
- 主要发现汇总
- 研究空白识别
- 未来方向建议
  **And** 使用可排序表格组件渲染

---

### Story 7.3: 实现 seo_pillar 蓝图

As a 内容营销人员,
I want 根据碎片内容生成长青内容大纲,
So that 我可以规划 SEO 优化的内容矩阵。

**Acceptance Criteria:**

**Given** 用户选择 seo_pillar 蓝图并上传碎片素材
**When** 完成 Briefing（目标关键词、内容目标）
**Then** 生成 SEO 大纲包含:

- Pillar 页面结构
- Cluster 页面列表
- 每页关键词建议
- 内链策略
- 内容日历建议
  **And** 包含 meta title/description 模板

---

### Story 7.4: 实现 workshop_designer 蓝图

As a 培训师/讲师,
I want 根据资料生成工作坊流程表,
So that 我可以设计互动性强的培训活动。

**Acceptance Criteria:**

**Given** 用户选择 workshop_designer 蓝图并上传培训素材
**When** 完成 Briefing（工作坊时长、参与人数）
**Then** 生成流程表包含:

- 时间轴（每个环节起止时间）
- 环节内容描述
- 活动形式（讲授/讨论/练习/游戏）
- 所需材料清单
- Facilitator 提示
  **And** 使用时间线组件渲染
  **And** 支持导出为可打印 PDF

---

## Epic 8: 配额策略与商业化

用户根据会员等级获得差异化的蓝图使用额度，Free 用户可试用增强蓝图。

### Story 8.1: 实现增强蓝图差异化配额消耗

As a 系统管理员,
I want 增强蓝图消耗更多配额积分,
So that 可以体现增强蓝图的高价值并支撑商业模式。

**Acceptance Criteria:**

**Given** 用户使用增强蓝图生成内容
**When** 生成完成
**Then** 消耗 2-3 credits（取决于蓝图复杂度）
**And** 配额配置在蓝图元数据中定义
**And** 生成前检查用户配额是否足够
**And** 配额不足时显示充值/升级提示

---

### Story 8.2: 实现 Free 用户试用限制

As a Free 用户,
I want 每月试用增强蓝图 3 次,
So that 我可以体验高级功能并决定是否升级。

**Acceptance Criteria:**

**Given** 用户为 Free 会员
**When** 使用增强蓝图
**Then** 检查当月试用次数
**And** 试用次数未用完时允许使用并扣减次数
**And** 次数用完后显示升级提示
**And** 每月 1 日自动重置试用次数
**And** 试用次数显示在用户界面中

---

### Story 8.3: 实现配额用尽提示 UI

As a 用户,
I want 在配额不足时看到清晰的提示和选项,
So that 我知道如何继续使用功能。

**Acceptance Criteria:**

**Given** 用户配额不足无法生成
**When** 显示配额提示对话框
**Then** 显示当前配额状态
**And** 提供升级会员选项
**And** 提供购买配额包选项（如有）
**And** 对于 Free 用户显示试用次数剩余
**And** 提供切换到基础蓝图（免费）选项
