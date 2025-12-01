## 智能评级功能设计方案（基于阿里百炼 & DeepSeek）

**文档日期**：2025-11-29  
**文档版本**：V1.0

本方案是在《评级功能设计说明-1129》的基础上，为 AnyKeep 增加 **AI 智能评级建议** 能力，使用现有的 **阿里百炼（通义千问）** 与 **DeepSeek API**，实现「AI 给出评级建议，用户拍板确认」的工作流。

---

## 1. 设计目标与原则

### 1.1 目标

在已有手动评级（L0–L3）的基础上，引入 AI 能力，达成：

1. **降低打分负担**：新收藏进来时，AI 先给一个合理建议，你只需「接受/微调」。
2. **优先发现高价值内容**：自动识别潜在高价值/深度学习内容，帮助你优先整理和复盘。
3. **保留用户控制权**：AI 只负责建议，不会自动覆盖你已设定的评级。

### 1.2 设计原则

- **建议优先，人工最终**：AI 输出的是 `importance_ai_suggested`，真实 `importance` 只由用户操作改变。
- **透明可解释**：AI 必须给出简短中文理由，便于用户判断可信度。
- **渐进增强**：先做「新建时建议」，后续再增加「基于行为的事后建议」。

---

## 2. 评级模型与 AI 输出协议

### 2.1 评级档位（与基础评级模型保持一致）

- `0`：未评级（L0）—— 默认状态，不需要 AI 输出。
- `1`：一般/可参考（L1）。
- `2`：高价值（L2）。
- `3`：深度学习（L3，需要多次复盘）。

### 2.2 AI 输出结构（统一协议）

无论使用 DeepSeek 还是阿里百炼，AI 都需返回统一 JSON 结构：

```json
{
  "importance_suggested": 2,
  "reason": "该内容是系统性教程的一部分，信息密度高，且用户写了较长笔记，建议标记为高价值（L2）。",
  "confidence": 0.82
}
```

- `importance_suggested`：AI 推荐评级，取值 1/2/3。
- `reason`：简短中文理由，可直接展示给用户。
- `confidence`：0–1 之间的置信度，用于决定是否展示/强调该建议。

> 若 AI 输出无法被正确解析为 JSON，则本次建议作废，不影响主流程。

---

## 3. AI 输入特征设计

### 3.1 内容特征（必选）

对每条收藏，构造一个「特征摘要」发给模型，包含：

- 标题：`bookmark.title`
- 平台类型：如 WECHAT_OFFICIAL_ACCOUNT / BILIBILI / XIAOHONGSHU / BROWSER / DOUYIN 等。
- AI 摘要：`bookmark.ai_summary`（若有）。
- AI 标签：`bookmark.ai_tags`。
- 用户标签：`bookmark.user_tags`。
- 文件夹层级/路径（可选）：帮助判断是否是某个专题/项目的一部分。

### 3.2 行为特征（Phase 2 使用）

后续可在事后推荐阶段加入：

- 打开次数：`view_count`。
- 最近访问时间：`last_viewed_at`。
- 用户笔记长度：如 `notes_length`（字数）。
- 是否在专题/项目中被引用：如 `in_projects_count`。
- 当前人工评级：`importance`（避免 AI 覆盖已有评级）。

### 3.3 特征摘要示例

发给模型的文本可以形如：

> 标题：如何用 Obsidian 构建个人知识管理系统  
> 平台：B站视频  
> AI 摘要：视频介绍了 Obsidian 的核心概念、双向链接、每日笔记和标签系统，用于构建个人知识库……  
> AI 标签：["知识管理","Obsidian","教程"]  
> 用户标签：["工作","必须掌握"]  
> 用户行为：打开次数 5 次，最近一周有访问，用户写了约 300 字的笔记。
>
> 请根据上述信息，为这条收藏推荐一个重要程度评级：1=一般，2=高价值，3=深度学习……

---

## 4. DeepSeek 智能评级方案

### 4.1 建议模型

- 使用 `deepseek-chat` 或你当前已接入的对话模型。
- 强项：中文理解好、价格友好，适合作为主力智能评级模型。

### 4.2 Prompt 模板（示例）

```text
你是一个个人知识管理助手，帮用户为收藏内容打重要程度等级。

重要程度定义：
- 1：一般/可参考 —— 有一定价值，但用户不一定会多次复习，更多是“需要时搜得到就好”。
- 2：高价值 —— 质量较高、近期可能会用到，用户希望优先看到。
- 3：深度学习 —— 系统性知识或长期有用的技能/方法，用户愿意投入时间多次复盘和实践。

下面是该收藏的相关信息（可能不全）：
{{特征摘要}}

要求：
1. 只考虑对“用户长期知识和工作/生活价值”的贡献，不考虑纯娱乐价值。
2. 如果信息不足以判断高价值或深度学习，则偏向给 1。
3. 输出 JSON，格式如下：
{
  "importance_suggested": 2,
  "reason": "这里填写中文理由",
  "confidence": 0.85
}
不要输出任何多余文字。
```

### 4.3 调用流程（伪代码）

```ts
const summary = buildFeatureSummary(bookmark);
const prompt = renderTemplate(DEEPSEEK_PROMPT, { summary });

const resp = await deepseek.chat({
  model: "deepseek-chat",
  messages: [{ role: "user", content: prompt }],
});

const raw = resp.choices[0]?.message?.content ?? "";
const suggestion = safeJsonParse(raw); // importance_suggested, reason, confidence
```

- 若解析失败 → 忽略此次 AI 建议。
- 若 `confidence < 0.6` → 可选择不在 UI 中高亮显示。

---

## 5. 阿里百炼（通义千问）智能评级方案

### 5.1 建议模型

- 使用百炼上的通义千问对话模型（如 `qwen-plus` 等）。
- 适合作为：
  - DeepSeek 故障时的 fallback。
  - 或需要完全走国内云时的主力方案。

### 5.2 Prompt 模板（示例）

可以与 DeepSeek 共用核心内容，仅略微强调 JSON 输出：

```text
你是一个个人知识管理助手，帮用户为收藏内容打重要程度等级。

重要程度定义：
- 1：一般/可参考
- 2：高价值
- 3：深度学习（需要多次复盘）

下面是该收藏的相关信息：
{{特征摘要}}

请根据上述信息，输出一个 JSON 对象：
{
  "importance_suggested": 2,
  "reason": "简要说明为什么给这个等级",
  "confidence": 0.8
}

注意：
- 只能输出 JSON，不要输出任何解释文字。
```

### 5.3 调用流程（抽象）

```ts
const summary = buildFeatureSummary(bookmark);
const prompt = renderTemplate(QWEN_PROMPT, { summary });

const resp = await bailian.chat({
  model: "qwen-plus",
  input: prompt,
});

const raw = resp.output?.text ?? "";
const suggestion = safeJsonParse(raw);
```

逻辑同 DeepSeek：解析失败则丢弃，成功时写入 AI 建议字段。

---

## 6. 数据结构与字段扩展

在《评级功能设计说明-1129》的基础上，新增 AI 相关字段：

```sql
ALTER TABLE public.bookmarks
ADD COLUMN importance_ai_suggested SMALLINT,
ADD COLUMN importance_ai_reason TEXT,
ADD COLUMN importance_ai_confidence REAL;

COMMENT ON COLUMN public.bookmarks.importance_ai_suggested IS 'AI 推荐的重要程度评级: 1-一般, 2-高价值, 3-深度学习';
COMMENT ON COLUMN public.bookmarks.importance_ai_reason IS 'AI 给出该评级的中文理由';
COMMENT ON COLUMN public.bookmarks.importance_ai_confidence IS 'AI 推荐置信度 (0-1)';
```

- **真实生效的评级**：`importance` 字段（仍由用户操作决定）。
- **AI 推荐的评级**：`importance_ai_suggested` + `reason` + `confidence`，用于 UI 展示和交互。

---

## 7. 触发时机与前后端流程

### 7.1 新建收藏时的智能评级（Phase 1 MVP）

**后端流程：**

1. 用户创建收藏 → `POST /api/bookmarks` 成功写入数据库。
2. 后端异步任务（队列/后台 Job）：
   - 获取 bookmark 基础数据（标题、摘要、标签、平台等）。
   - 调用 DeepSeek（失败则尝试阿里百炼作为 fallback）。
   - 成功解析 JSON 后：
     - 更新 `importance_ai_suggested` / `importance_ai_reason` / `importance_ai_confidence`。

**前端展示：**

- 在详情页：
  - 显示一块「AI 推荐评级」模块（仅当有推荐时）：
    - 示例：
      > AI 推荐：**高价值（L2）**  
      > 理由：该内容是系统性教程的一部分，且你为其写了较长的学习笔记。  
      > [接受] [改为一般] [改为深度学习]
- 用户点击：
  - 「接受」→ 将 `importance` 设置为 `importance_ai_suggested`。
  - 其他选项 → 按选择值更新 `importance`。

> 注意：**AI 不直接修改 `importance`**，只在你点击后才生效。

### 7.2 事后智能建议（Phase 2）

**规则层（可不依赖大模型）：**

- 示例规则：
  - 若 `view_count >= 5` 且 `notes_length > 200` 且 `importance IN (0,1)`：
    - 推断为高价值候选 → 推荐 L2。
  - 若内容在多个专题/项目中被引用 → 推荐 L2 或 L3。

**用大模型生成更自然的推荐说明（可选）：**

- 将规则结论 + 行为特征发给 DeepSeek/百炼，生成一段更自然的提示文案。
- 存入 `importance_ai_reason`，配合建议等级展示。

前端可以在首页或 analytics 页展示：

- 「你最近频繁使用的内容，是否要标记为高价值？」列表。

---

## 8. 安全性与使用策略

1. **不自动覆盖人工评级**：
   - 若 `importance > 0`（已人工设定），则：
     - 不再基于 AI 自动更改 `importance`。
     - AI 仅可更新建议字段，不直接生效。

2. **用户隐私与内容范围**：
   - 发送给模型的数据应仅限于必要字段（标题/摘要/标签/简化内容），避免传输敏感内容。
   - 可以通过配置开关控制「哪些平台/哪些内容类型参与 AI 评级」。

3. **可关闭的智能评级功能**：
   - 在设置中提供「关闭 AI 推荐评级」选项：
     - 关闭后不再展示 AI 建议模块。
     - 后端可以继续记录字段，但前端不展现。

---

## 9. 实施优先级与里程碑

### 9.1 Phase 1（MVP）

- 集成 DeepSeek / 百炼，完成：
  - `importance_ai_*` 字段。
  - 新建收藏后的异步智能建议。
  - 详情页的「AI 推荐评级」模块 + 接受/修改按钮。

### 9.2 Phase 2

- 增加行为信号分析（打开次数、笔记长度等）。
- 实现简单规则驱动的事后建议视图：
  - 「最近值得升为高价值的收藏」。

### 9.3 Phase 3（可选）

- 个性化模型：基于用户历史评级训练轻量分类器，减少对大模型的调用频率。
- 将 `importance`/`importance_ai_suggested` 纳入语义搜索权重。

---

**文档结束**

## 智能评级功能设计（基于 DeepSeek 与阿里百炼）

**文档日期**：2025-11-29  
**文档版本**：V1.0  
**相关文档**：`评级功能设计说明-1129.md`

---

## 1. 目标与范围

### 1.1 设计目标

在已有「手动评级」能力的基础上，引入 AI 能力，为用户提供：

1. **新收藏的智能评级建议**
   - 用户创建收藏后，AI 根据内容与上下文自动给出推荐等级（L1/L2/L3），用户一键接受或调整。

2. **基于行为的事后评级建议（后续阶段）**
   - 通过分析打开次数、笔记长度、专题引用等行为，为长期使用中的收藏提供「升/降级建议」。

3. **始终保持用户主导权**
   - AI 只提供 `importance_ai_suggested`，真实 `importance` 由用户确认写入，不自动覆盖用户已有选择。

### 1.2 不在本阶段范围内

- 不做完全自动的「静默改分」，所有变更都需要用户确认。
- 不做复杂的间隔重复算法，复盘节奏使用简单规则即可。
- 不训练自建大模型，只使用 DeepSeek 与阿里百炼（通义千问）提供的 API。

---

## 2. 与基础评级模型的关系

基础评级模型定义见《评级功能设计说明-1129》：

- `importance`（真实评级）：
  - `0`：未评级（L0）
  - `1`：一般/可参考（L1）
  - `2`：高价值（L2）
  - `3`：深度学习（L3）

在此基础上增加 AI 相关字段：

- `importance_ai_suggested`：AI 推荐评级（1/2/3）
- `importance_ai_reason`：AI 推荐理由（中文，自然语言）
- `importance_ai_confidence`：AI 置信度（0–1，可选）
- `importance_ai_source`：使用的模型来源（`deepseek` / `bailian` 等）
- `importance_ai_updated_at`：最近一次 AI 建议时间

> **原则**：
>
> - `importance` 始终由用户最终决定。
> - `importance_ai_*` 仅作为建议与说明存储，不直接参与权限判断。

---

## 3. 数据结构与数据库设计

### 3.1 字段扩展

在 `public.bookmarks` 表中新增字段（示例）：

```sql
ALTER TABLE public.bookmarks
ADD COLUMN importance_ai_suggested SMALLINT,
ADD COLUMN importance_ai_reason TEXT,
ADD COLUMN importance_ai_confidence REAL,
ADD COLUMN importance_ai_source VARCHAR(50),
ADD COLUMN importance_ai_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookmarks.importance_ai_suggested IS 'AI 推荐的重要程度评级: 1-一般, 2-高价值, 3-深度学习';
COMMENT ON COLUMN public.bookmarks.importance_ai_reason IS 'AI 推荐评级的中文解释';
COMMENT ON COLUMN public.bookmarks.importance_ai_confidence IS 'AI 推荐置信度(0-1)';
COMMENT ON COLUMN public.bookmarks.importance_ai_source IS '产生该推荐的模型来源: deepseek/bailian/...';
COMMENT ON COLUMN public.bookmarks.importance_ai_updated_at IS '最近一次AI评级建议时间';
```

> 可选：为 `importance_ai_suggested` 增加 CHECK 约束限制为 1–3 或 NULL。

### 3.2 索引与查询建议

目前 AI 字段主要用于展示，不建议一开始为其建立索引。  
后续如有需要，可为以下场景加索引：

- 「尚未处理 AI 建议」：`importance_ai_suggested IS NOT NULL AND importance = 0`

---

## 4. AI 输入输出协议

### 4.1 评级档位（重申）

- `1`：一般/可参考 —— 内容有一定价值，但不需要多次复盘。
- `2`：高价值 —— 内容质量较高，近期可能应用，用户希望优先看到。
- `3`：深度学习 —— 系统性知识或长期有用技能，值得多次学习和实践。

### 4.2 输入特征（Feature）设计

为避免成本过高与延迟过大，**不传全文**，而是传「提炼后的特征信息」：

```text
标题: {{title}}
平台: {{platform}}  // 如 WECHAT_OFFICIAL_ACCOUNT / BILIBILI / XIAOHONGSHU / BROWSER / ...
AI 摘要: {{ai_summary}}
AI 标签: {{ai_tags}}
用户标签: {{user_tags}}
文件夹路径: {{folder_path}}  // 如: 工作 / 设计 / 交互
用户笔记（截断前 N 字）: {{user_notes_preview}}
用户行为概要: 打开次数={{open_count}}, 最近访问={{last_open_at}}, 是否有长笔记={{has_long_notes}}
```

> Phase 1 可以先不接入行为特征，只基于内容特征做推荐，后续再逐步补充。

### 4.3 统一输出格式（JSON）

无论 DeepSeek 还是阿里百炼，均要求输出：

```json
{
  "importance_suggested": 2,
  "reason": "该内容是系统性教程中一节，信息密度高且与用户工作高度相关，建议标为高价值（L2）。",
  "confidence": 0.82
}
```

字段含义：

- `importance_suggested`：1/2/3
- `reason`：简短中文理由，可直接展示给用户
- `confidence`：0–1 浮点数，失败时可缺省或返回 0.5

解析失败时，整个 AI 评级流程视为失败，不影响主流程。

---

## 5. DeepSeek 智能评级方案

### 5.1 模型选择

- 推荐使用 `deepseek-chat` 或同级通用对话模型。
- 任务本质是中文语义理解 + 分类 + 解释，DeepSeek 对此较擅长，成本也友好。

### 5.2 Prompt 设计（示例）

```text
你是一个个人知识管理助手，帮用户为收藏内容打重要程度等级。

重要程度定义：
- 1：一般/可参考 —— 有一定价值，但用户不一定会多次复习，更多是“需要时搜得到就好”。
- 2：高价值 —— 质量较高、近期可能会用到，用户希望在列表和搜索结果中优先看到。
- 3：深度学习 —— 系统性知识或长期有用的技能、方法，用户愿意投入时间多次复盘和实践。

请根据以下信息，为这条收藏推荐一个等级（1/2/3），并说明理由：

{{特征摘要}}

要求：
1. 只考虑对“用户长期知识和工作/生活价值”的贡献，不考虑纯娱乐/搞笑价值。
2. 如果信息不足以判断为 2 或 3，可以推荐为 1。
3. 输出 JSON，格式如下：
{
  "importance_suggested": 2,
  "reason": "这里填写中文理由",
  "confidence": 0.85
}
不要输出任何多余文字。
```

### 5.3 伪代码示例

```ts
const prompt = buildPromptFromBookmark(bookmark);

const resp = await deepseek.chat({
  model: "deepseek-chat",
  messages: [{ role: "user", content: prompt }],
});

const raw = resp.choices[0]?.message?.content ?? "";
const parsed = safeJsonParse(raw); // 需要做容错

if (parsed && [1, 2, 3].includes(parsed.importance_suggested)) {
  await db.updateBookmarkAIFields({
    id: bookmark.id,
    importance_ai_suggested: parsed.importance_suggested,
    importance_ai_reason: parsed.reason,
    importance_ai_confidence: parsed.confidence ?? null,
    importance_ai_source: "deepseek",
    importance_ai_updated_at: new Date(),
  });
}
```

---

## 6. 阿里百炼（通义千问）智能评级方案

### 6.1 模型选择

- 推荐使用 `qwen-plus` 或同级通用中文模型（具体以你账户可用模型为准）。
- 与 DeepSeek 共用同一套输入/输出协议，便于切换与 A/B。

### 6.2 Prompt 设计（示例）

可与 DeepSeek 的 Prompt 几乎一致，仅更强调「只输出 JSON」：

```text
你是一个个人知识管理助手，帮用户为收藏内容打重要程度等级。

重要程度定义：
- 1：一般/可参考
- 2：高价值
- 3：深度学习（需要多次复盘）

下面是该收藏的相关信息：
{{特征摘要}}

请根据上述信息，输出一个 JSON 对象：
{
  "importance_suggested": 2,
  "reason": "简要说明为什么给这个等级",
  "confidence": 0.8
}

注意：
- 只能输出 JSON，不要输出任何解释文字。
```

### 6.3 伪代码示例

```ts
const prompt = buildPromptFromBookmark(bookmark);

const resp = await bailian.chat({
  model: "qwen-plus",
  input: prompt,
});

const raw = resp.output?.text ?? "";
const parsed = safeJsonParse(raw);

if (parsed && [1, 2, 3].includes(parsed.importance_suggested)) {
  await db.updateBookmarkAIFields({
    id: bookmark.id,
    importance_ai_suggested: parsed.importance_suggested,
    importance_ai_reason: parsed.reason,
    importance_ai_confidence: parsed.confidence ?? null,
    importance_ai_source: "bailian",
    importance_ai_updated_at: new Date(),
  });
}
```

---

## 7. 调用时机与后台任务设计

### 7.1 新建收藏时的异步智能评级

**流程：**

1. 用户创建收藏（POST `/api/bookmarks`）：
   - 同步返回成功结果，不等待 AI。
2. 后端触发异步任务（队列/后台 Job）：
   - 从数据库取出该 bookmark 的摘要、标签等特征。
   - 构建 Prompt，调用 DeepSeek（优先）或百炼。
   - 成功解析后，写入 `importance_ai_*` 字段。
3. 前端在详情页或列表中：
   - 看到有 AI 建议时展示推荐模块。

> 注意：AI 调用必须是「非阻塞」，避免影响创建收藏的体验。

### 7.2 批量回填（旧数据智能评级）

可设计一个一次性/周期性任务：

- 选出一批满足条件的旧收藏（例如最近 3 个月、无 AI 建议的条目）；
- 每次批量调用 N 条（控制成本与速率）；
- 为每条生成 AI 建议，写入 `importance_ai_*` 字段。

### 7.3 失败与重试策略

- 调用失败或解析失败：
  - 不重试，后续可以人工触发或定期任务再跑。
- 可为 `importance_ai_source` 写入错误标记（如 `deepseek_error`）用于统计与诊断。

---

## 8. 前端交互设计（与基础评级集成）

### 8.1 详情页：AI 推荐评级组件

在已有评级组件附近，增加一块 AI 推荐区域（仅当存在 `importance_ai_suggested` 且 `importance` 与其不一致时显示）：

- 文案示例：
  - 「AI 推荐：高价值（L2）  
    理由：该内容是系统性教程中一节，信息密度高且与你的标签“工作/学习”相关。」
- 操作按钮：
  - `接受推荐` → 将 `importance` 设为 `importance_ai_suggested`。
  - `设为一般` / `设为深度学习` → 快捷覆盖为 L1/L3。
  - `忽略本次推荐` → 隐藏该建议（可选字段记录为已处理）。

### 8.2 列表卡片：轻量提示

- 在卡片上增加一个小 AI 标记（例如「AI」角标）：
  - 仅在 `importance=0` 且 `importance_ai_suggested` >= 2 时显示（提示“这里可能是高价值内容”）。
  - 点击卡片进入详情页可看到完整理由和操作。

### 8.3 设置项

- 在用户设置中提供开关：
  - 「启用 AI 推荐评级」：关闭后不再调用 AI，也不展示相关提示。

---

## 9. 分阶段实施建议

### Phase 1：新建收藏的 AI 推荐评级（P0）

- 实现内容：
  - 数据库字段：`importance_ai_*`。
  - DeepSeek 调用流程（主模型）。
  - 详情页展示 AI 推荐模块 + 一键接受/覆盖。
  - 新建收藏后的异步评级任务。
- 目标：
  - 让用户在不增加太多操作负担的前提下，获得有用的评级建议。

### Phase 2：行为驱动的事后建议（P1）

- 利用行为数据（打开次数、笔记长度、专题引用等）做规则 + AI 文案：
  - 例：对频繁使用但未评级的收藏，建议升为 L2/L3。
  - 不必每次调用大模型，可先规则筛选，再用 AI 生产简短说明。

### Phase 3：个性化与权重融合（P2）

- 结合用户历史评级，逐步学习其偏好：
  - 可以在本地训练简单分类模型，或在 Prompt 中加入「用户偏好摘要」。
- 在搜索排序、推荐、复盘列表中，引入：
  - `importance` + 行为权重 + AI 置信度 → 综合排序分。

---

## 10. 与《评级功能设计说明-1129》的集成关系

1. 本文档扩展了基础评级设计，增加了 AI 相关字段与调用流程。
2. 真实评级字段 `importance` 的语义与使用方式保持不变。
3. 推荐在实现时：
   - 先完成基础评级（手动 L0–L3），再按本文档引入 AI 推荐，避免一次性耦合过多复杂度。

---

**文档结束**
