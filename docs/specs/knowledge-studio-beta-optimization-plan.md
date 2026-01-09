# 知识工坊 Beta 优化实施方案

> **文档版本**: v1.1.0
> **创建日期**: 2026-01-07
> **更新日期**: 2026-01-07
> **负责人**: PM John
> **状态**: ✅ 已审核通过

---

## 〇、审核反馈与确认

| 问题         | 审核结果                     | 备注               |
| ------------ | ---------------------------- | ------------------ |
| 素材加载上限 | **50 条**                    | 避免用户选择困难症 |
| 一稿多发配额 | **1 点**（允许后期调整）     | PM 决定，随时可调  |
| 蓝图素材限制 | **统一最多 5 个，建议 3 个** | 生成速度优先       |
| 时间表       | **3 周可行**                 | 无资源约束         |

**新增考虑事项**：

1. ✅ 功能与现有系统无缝集成
2. ✅ 同步更新前端组件和页面设计
3. ✅ 移除 V1 版本（已完成依赖分析）
4. ✅ 提升用户交互体验（减少生硬感）

---

## 一、执行摘要

基于 5 类用户画像体验分析，识别出 **17 项优化需求**（原 14 项 + 3 项新增），分为 P0/P1/P2 三个优先级。

**核心发现**：

- MaterialSelector 组件**已有搜索功能**，问题在于主页面只加载 100 条
- 导出模块**已完整实现**（`src/lib/export/`），只需接入工坊结果页
- TTS 组件**已完整实现**（`src/components/tts/`），只需集成
- 平台风格 Prompt **已有差异化设计**，需验证实际输出效果
- V1 可安全移除，**约 25 个文件可删除**，零依赖风险

**预估总工时**: 10-14 人日（含 V1 移除和 UX 优化）

---

## 二、P0 优化方案（关键体验 - 必须做）

### P0-1: 素材选择器优化

**问题描述**:
用户收藏超过 100 条时，无法在工坊中找到较早的收藏内容。

**根因分析**:
`knowledge-studio-v2-page-client.tsx:92` 硬编码 `limit: 100`，但 MaterialSelector 组件本身已支持搜索。

**实施方案**:

```
修改文件: src/app/(main)/knowledge-studio/v2/knowledge-studio-v2-page-client.tsx
```

| 步骤 | 任务             | 详细描述                                                         |
| ---- | ---------------- | ---------------------------------------------------------------- |
| 1    | 调整 limit 为 50 | 将 `useBookmarks({ limit: 100 })` 改为 `limit: 50`，避免选择困难 |
| 2    | 添加平台筛选器   | 在 MaterialSelector 上方添加平台 Filter（微信/B站/知乎等）       |
| 3    | 优化搜索交互     | 搜索框自动聚焦，支持快捷键                                       |

**代码变更**:

```typescript
// 修改前 (line 92-93)
const { data: bookmarksData, isLoading: isLoadingBookmarks } = useBookmarks({
  limit: 100,
});

// 修改后
const [platformFilter, setPlatformFilter] = useState<string | null>(null);

const { data: bookmarksData, isLoading: isLoadingBookmarks } = useBookmarks({
  limit: 50, // 避免选择困难
  platform: platformFilter || undefined,
});
```

**新增 UI 组件**:

```tsx
// 在 MaterialSelector 上方添加筛选栏
<div className="flex items-center gap-2 mb-3">
  <Select value={platformFilter ?? ""} onValueChange={setPlatformFilter}>
    <SelectTrigger className="w-[140px]">
      <SelectValue placeholder="全部平台" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">全部平台</SelectItem>
      <SelectItem value="wechat">微信公众号</SelectItem>
      <SelectItem value="bilibili">B站</SelectItem>
      <SelectItem value="zhihu">知乎</SelectItem>
      <SelectItem value="xiaohongshu">小红书</SelectItem>
    </SelectContent>
  </Select>
</div>
```

**验收标准**:

- [ ] 素材列表默认加载 50 条
- [ ] 支持按平台筛选
- [ ] 搜索框响应迅速
- [ ] 滚动流畅

**预估工时**: 0.5 天

---

### P0-2: 整合导出功能到结果页

**问题描述**:
生成内容后只能复制，无法直接下载文件。

**现有资源**:

- 导出服务: `src/lib/export/services/export.service.ts`
- 格式化器: `src/lib/export/formatters/` (CSV, Markdown, Obsidian, JSON)
- 导出对话框: `src/components/export/export-dialog-v2.tsx`

**实施方案**:

```
修改文件: src/app/(main)/knowledge-studio/v2/[blueprintId]/blueprint-workflow-client.tsx
新增文件: src/components/knowledge-studio/v2/export-result-dialog.tsx
```

| 步骤 | 任务           | 详细描述                                   |
| ---- | -------------- | ------------------------------------------ |
| 1    | 创建导出对话框 | 复用 ExportDialogV2 逻辑，适配工坊输出格式 |
| 2    | 添加导出按钮   | 在结果页操作栏添加「导出」按钮             |
| 3    | 支持格式选择   | Markdown / 纯文本 / HTML                   |
| 4    | 文件命名规则   | `{蓝图名称}_{日期}_{时间}.{格式}`          |

**代码变更**:

```tsx
// blueprint-workflow-client.tsx 结果页区域 (约 line 1265)

// 操作栏添加导出按钮
<Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(true)}>
  <Download className="mr-1.5 h-4 w-4" />
  导出
</Button>
```

**验收标准**:

- [ ] 结果页显示「导出」按钮
- [ ] 支持导出为 Markdown、纯文本、HTML 格式
- [ ] 文件名包含蓝图名称和时间戳
- [ ] 导出成功显示 toast 提示

**预估工时**: 1 天

---

### P0-3: TTS 朗读功能集成

**问题描述**:
TTS 功能已实现但未在工坊结果页提供入口。

**现有资源**:

- TTS 按钮: `src/components/tts/tts-player-button.tsx`
- TTS 上下文: `src/components/tts/tts-player-context.tsx`
- TTS 服务: `src/lib/tts/`

**实施方案**:

```
修改文件: src/app/(main)/knowledge-studio/v2/[blueprintId]/blueprint-workflow-client.tsx
```

**代码变更**:

```tsx
// 新增朗读按钮 (结果页操作栏)
<Button
  variant="outline"
  size="sm"
  onClick={() => handleTTSPlay(generatedContent.slice(0, 2000))}
  disabled={isTTSLoading || !generatedContent}
>
  {isTTSLoading ? (
    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
  ) : (
    <Volume2 className="mr-1.5 h-4 w-4" />
  )}
  {isTTSPlaying ? "暂停" : "朗读"}
</Button>
```

**验收标准**:

- [ ] 结果页显示「朗读」按钮
- [ ] 点击后开始 TTS 播放
- [ ] 支持暂停/继续
- [ ] 长内容自动截断（前 2000 字）

**预估工时**: 0.5 天

---

### P0-4: 平台风格差异化增强

**问题描述**:
用户反馈公众号和通用风格生成结果差异不明显。

**现有资源**:

- 平台风格 Prompt: `src/lib/knowledge-studio/blueprint/prompts/content.prompt.ts:80-101`

**实施方案**:

| 步骤 | 任务                 | 详细描述                                 |
| ---- | -------------------- | ---------------------------------------- |
| 1    | 验证现有 Prompt 效果 | 使用相同素材生成三种风格，对比差异       |
| 2    | 增强公众号 Prompt    | 添加更具体的格式要求（分隔线、引用框等） |
| 3    | 增强小红书 Prompt    | 添加热门表达词库、emoji 位置指导         |

**增强后的 Prompt**:

```typescript
const PLATFORM_STYLE_INSTRUCTIONS = {
  wechat: `【公众号风格要求 - 必须严格遵循】

## 标题要求
- 必须使用吸引眼球的标题技巧：数字开头、疑问句、对比冲突
- 示例："3个让我效率翻倍的秘密"、"为什么90%的人都错了？"

## 格式要求
- 每段 3-5 行，段落间留一行空白
- 使用分隔线 --- 分隔大章节
- 重点用「」或【】框起
- 适当使用引用块 > 突出金句

## 语言风格
- 专业但不晦涩，像"懂行的朋友"在分享
- 避免学术腔和官方话术
- 结尾必须引导互动："你觉得呢？欢迎留言讨论"`,

  xiaohongshu: `【小红书风格要求 - 必须严格遵循】

## 格式要求
- 每段只能 1-3 行！绝对不能超过 3 行！
- 每个段落开头或结尾必须有 emoji
- 重点用【】框起来

## 必须使用的表达
- 开头用: "宝子们"、"姐妹们"、"朋友们"
- 转折用: "但是！"、"重点来了"、"划重点"
- 强调用: "真的很绝"、"太可了"、"直接封神"
- 结尾用: "码住"、"冲冲冲"、"感谢观看"

## Emoji 使用规则
- 标题: 🌟✨💡 等突出
- 列表: 1️⃣2️⃣3️⃣ 或 ✅❌
- 强调: 💪🔥👏

## 结尾格式
必须以话题标签结尾:
#话题1 #话题2 #话题3`,

  general: `【通用风格要求】
- 使用正式、规范的书面语言
- 结构完整，逻辑清晰
- 适合多平台发布
- 不使用过于口语化或平台特色的表达`,
};
```

**验收标准**:

- [ ] 公众号风格：有明显的分隔线、引用框、互动引导
- [ ] 小红书风格：短段落、emoji、口语化、话题标签
- [ ] 通用风格：正式书面语、结构完整
- [ ] 三种风格生成结果肉眼可辨

**预估工时**: 1 天

---

### P0-5: 移除 V1 工坊（新增）

**问题描述**:
V1 和 V2 并存增加维护成本，用户入口分散造成困惑。

**依赖分析结果**:

| 类型                 | 文件数 | 状态      |
| -------------------- | ------ | --------- |
| 可安全删除的 V1 页面 | 10     | ✅ 零风险 |
| 可安全删除的 V1 组件 | 11     | ✅ 零风险 |
| 必须保留的共用库     | 6      | 🔒 保留   |
| 必须保留的共用组件   | 3      | 🔒 保留   |

**可安全删除的文件清单**:

```
# V1 页面（10 个）
src/app/(main)/knowledge-studio/
├── knowledge-studio-page-client.tsx  # V1 主页
├── page.tsx                          # V1 主页路由
├── learning/                         # 存根页面
├── billing/                          # 账单页面（保留 API）
└── templates/                        # 存根页面

# V1 专用组件（11 个）
src/components/knowledge-studio/
├── blueprint-selector.tsx            # V1 蓝图选择器
├── enhanced-blueprint-selector.tsx
├── generation-progress.tsx
├── outline-editor.tsx                # V1 大纲编辑器
├── outline-confirmation-panel.tsx
├── outline-version-history.tsx
├── outline-tree-item.tsx
├── chat-edit-panel.tsx
├── briefing-dialog.tsx
├── citation-card.tsx
└── report-editor.tsx
```

**必须保留的共用模块**:

| 模块                                  | 原因            |
| ------------------------------------- | --------------- |
| `MaterialSelector`                    | V2 主页面使用   |
| `structured-output/`                  | V2 结果页使用   |
| `quota/`                              | V2 配额显示使用 |
| `src/lib/knowledge-studio/blueprint/` | 14 个蓝图定义   |
| `src/lib/knowledge-studio/v2/`        | V2 常量和工具   |
| `src/lib/knowledge-studio/iteration/` | 内容迭代        |

**导航更新**:

```typescript
// src/components/layout/app-sidebar.tsx (line 133-144)
// 修改前
const learningCenterItems: NavItem[] = [
  { name: "知识工坊", href: "/knowledge-studio", ... },     // ❌ 删除
  { name: "工坊 Beta", href: "/knowledge-studio/v2", ... }, // ✅ 保留
];

// 修改后
const learningCenterItems: NavItem[] = [
  { name: "知识工坊", href: "/knowledge-studio/v2", icon: Sparkles, isPro: true },
];
```

**实施步骤**:

| 步骤 | 任务                 | 验证                                         |
| ---- | -------------------- | -------------------------------------------- |
| 1    | 创建 feature 分支    | -                                            |
| 2    | 删除 V1 页面和组件   | `npm run type-check` 通过                    |
| 3    | 更新侧边栏和移动菜单 | 导航正确                                     |
| 4    | 设置路由重定向       | `/knowledge-studio` → `/knowledge-studio/v2` |
| 5    | 运行完整测试         | 所有测试通过                                 |
| 6    | 代码审查并合并       | -                                            |

**路由重定向**:

```typescript
// src/app/(main)/knowledge-studio/page.tsx (修改后)
import { redirect } from "next/navigation";

export default function KnowledgeStudioPage() {
  redirect("/knowledge-studio/v2");
}
```

**验收标准**:

- [ ] V1 页面和组件已删除
- [ ] `/knowledge-studio` 自动跳转到 `/knowledge-studio/v2`
- [ ] 侧边栏只显示一个「知识工坊」入口
- [ ] V2 所有功能正常
- [ ] 历史报告仍可查看
- [ ] 类型检查、Lint、测试全部通过

**预估工时**: 0.5 天

---

### P0-6: 用户交互体验优化（新增）

**问题描述**:
当前操作交互生硬，缺少流畅的过渡和反馈。

**优化项目**:

| #   | 问题            | 优化方案                    | 文件                                  |
| --- | --------------- | --------------------------- | ------------------------------------- |
| 1   | 步骤切换无动画  | 添加 Framer Motion 过渡动画 | `knowledge-studio-v2-page-client.tsx` |
| 2   | 生成等待无趣    | 添加有趣的等待文案轮播      | `blueprint-workflow-client.tsx`       |
| 3   | 成功/失败反馈弱 | 增强 toast 样式，添加音效   | 全局                                  |
| 4   | 按钮状态不明显  | 添加 hover/active 微动效    | UI 组件                               |
| 5   | 大纲拖拽生硬    | 优化拖拽动画和视觉反馈      | `outline-editor.tsx`                  |

**具体实施**:

#### 1. 步骤切换动画

```tsx
// 使用 Framer Motion 添加页面过渡
import { motion, AnimatePresence } from "framer-motion";

<AnimatePresence mode="wait">
  <motion.div
    key={step}
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.2 }}
  >
    {step === "blueprint" && <BlueprintSelector ... />}
    {step === "materials" && <MaterialSelector ... />}
  </motion.div>
</AnimatePresence>
```

#### 2. 生成等待文案

```typescript
const WAITING_MESSAGES = [
  "正在分析素材内容...",
  "正在构建文章结构...",
  "正在生成精彩内容...",
  "AI 正在思考最佳表达...",
  "即将完成，请稍候...",
];

// 每 3 秒切换一条
useEffect(() => {
  if (isGenerating) {
    const interval = setInterval(() => {
      setWaitingMessageIndex((i) => (i + 1) % WAITING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }
}, [isGenerating]);
```

#### 3. 增强反馈

```tsx
// 成功时播放音效 + 动画 toast
toast.success("生成完成！", {
  description: `共 ${wordCount} 字`,
  icon: "🎉",
  duration: 5000,
});

// 使用 confetti 庆祝效果（可选）
import confetti from "canvas-confetti";
confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
```

#### 4. 按钮微动效

```tsx
// Tailwind 添加过渡类
<Button className="transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
  开始生成
</Button>
```

**验收标准**:

- [ ] 步骤切换有平滑过渡动画
- [ ] 生成等待时文案动态切换
- [ ] 成功/失败有明显的视觉和听觉反馈
- [ ] 按钮交互有微动效
- [ ] 整体操作感流畅自然

**预估工时**: 1 天

---

## 三、P1 优化方案（提升竞争力 - 应该做）

### P1-1: 一稿多发功能

**功能描述**:
生成一份内容后，可一键转换为其他平台风格版本。

**实施方案**:

```
新增文件:
- src/components/knowledge-studio/v2/multi-platform-dialog.tsx
- src/app/api/knowledge-studio/v2/adapt-style/route.ts
```

**API 设计**:

```typescript
// POST /api/knowledge-studio/v2/adapt-style
interface AdaptStyleRequest {
  originalContent: string;
  sourcePlatform: PlatformStyle;
  targetPlatform: PlatformStyle;
}

interface AdaptStyleResponse {
  adaptedContent: string;
  quotaCost: number; // 1 点（可后期调整）
  wordCount: number;
}
```

**验收标准**:

- [ ] 结果页显示「适配其他平台」按钮
- [ ] 支持选择目标平台（公众号/小红书/通用）
- [ ] 适配后可预览、编辑、导出
- [ ] 配额消耗 1 点（后期可调）

**预估工时**: 2 天

---

### P1-2: Briefing 快速模式

**功能描述**:
提供 2-3 个核心问题的精简 Briefing 模式。

**实施方案**:

```
修改文件:
- src/components/knowledge-studio/v2/briefing-wizard.tsx
- src/lib/knowledge-studio/blueprint/briefing-templates.ts
```

**验收标准**:

- [ ] Briefing 页面显示「快速/详细」模式切换
- [ ] 快速模式只显示 2-3 个问题
- [ ] 切换模式不丢失已填内容

**预估工时**: 1 天

---

### P1-3: 智能蓝图推荐

**功能描述**:
基于已选素材内容，自动推荐最合适的蓝图。

**验收标准**:

- [ ] 选择素材后显示推荐蓝图
- [ ] 推荐包含理由说明
- [ ] 推荐准确率 > 70%

**预估工时**: 1.5 天

---

### P1-4: 统一素材数量限制（更新）

**功能描述**:
所有蓝图统一素材限制：最多 5 个，建议 3 个。

**实施方案**:

```
修改文件: src/lib/knowledge-studio/v2/constants.ts
```

**代码变更**:

```typescript
// 修改前
export const MATERIAL_LIMITS = {
  MIN: 2,
  RECOMMENDED_MAX: 3,
  HARD_MAX: 5,
  WARNING_THRESHOLD: 4,
};

// 修改后（保持不变，仅更新文案）
export const MATERIAL_LIMITS = {
  MIN: 2,
  RECOMMENDED_MAX: 3, // 建议 3 个
  HARD_MAX: 5, // 最多 5 个
  WARNING_THRESHOLD: 4,
};

export const MATERIAL_SELECTOR_TEXT = {
  LABEL: "精选 2-3 篇核心素材（最多 5 篇）",
  HINT: "素材越精准，生成质量越高，速度越快",
  WARNING_TOO_MANY: "素材过多会导致生成速度变慢，建议精选 2-3 篇",
};
```

**验收标准**:

- [ ] 所有蓝图统一使用相同限制
- [ ] 文案清晰说明推荐和最大值
- [ ] 超过 3 个时显示温和提示

**预估工时**: 0.5 天

---

### P1-5: 反馈优化效果增强

**功能描述**:
改进反馈迭代后的内容变化效果，增加修改对比功能。

**验收标准**:

- [ ] 反馈优化后显示「查看修改」按钮
- [ ] Diff 视图清晰显示变更内容
- [ ] 迭代效果明显可感知

**预估工时**: 1.5 天

---

## 四、P2 优化方案（锦上添花 - 可以做）

### P2-1: 版本对比 Diff 功能

**预估工时**: 1 天

### P2-2: 自定义精简字数

将固定的 800/1500/2000 按钮改为滑块输入。

**预估工时**: 0.5 天

### P2-3: 大纲模板保存与复用

**预估工时**: 1 天

### P2-4: 生成时间预估

基于历史数据预估「约需 2 分钟」。

**预估工时**: 0.5 天

### P2-5: 风格预览示例

在选择平台风格时显示示例片段。

**预估工时**: 0.5 天

---

## 五、集成与迁移考虑（新增）

### 5.1 与现有功能的集成点

| 功能     | 集成方式                    | 注意事项           |
| -------- | --------------------------- | ------------------ |
| 导出功能 | 复用 `src/lib/export/`      | 需适配工坊输出格式 |
| TTS 功能 | 使用现有 `useTTS` hook      | 需处理长文本截断   |
| 配额管理 | 复用 `quota-manager.ts`     | 一稿多发消耗 1 点  |
| 报告存储 | 使用 `synthesis_reports` 表 | V1/V2 报告统一存储 |

### 5.2 前端组件更新清单

| 组件                     | 更新内容              | 优先级 |
| ------------------------ | --------------------- | ------ |
| `BlueprintSelectorV2`    | 添加智能推荐标识      | P1     |
| `MaterialSelector`       | 添加平台筛选器        | P0     |
| `BriefingWizard`         | 添加快速/详细模式切换 | P1     |
| `StructuredOutputViewer` | 添加导出和 TTS 按钮   | P0     |
| `PlatformStyleSelector`  | 添加风格预览          | P2     |
| `OutlineEditorV2`        | 优化拖拽动画          | P0     |

### 5.3 API 路由影响

| 路由                                        | 操作 | 说明       |
| ------------------------------------------- | ---- | ---------- |
| `GET /api/knowledge-studio/v2/blueprints`   | 保留 | V2 使用    |
| `POST /api/knowledge-studio/v2/generate`    | 保留 | V2 使用    |
| `POST /api/knowledge-studio/v2/adapt-style` | 新增 | 一稿多发   |
| `GET /api/knowledge-studio/reports`         | 保留 | V1+V2 通用 |
| `POST /api/knowledge-studio/generate`       | 删除 | V1 专用    |

---

## 六、执行路线图（更新）

```
Week 1 (1/8 - 1/14): P0 修复 + V1 移除
├── Day 1: P0-5 移除 V1 工坊
│   ├── 删除 V1 页面和组件
│   ├── 更新导航
│   └── 添加路由重定向
├── Day 2: P0-1 素材选择器优化 + P0-6 交互动画
├── Day 3: P0-2 导出功能整合
├── Day 4: P0-3 TTS 集成 + P0-4 平台风格增强
└── Day 5: P0-6 交互体验优化 + 测试

Week 2 (1/15 - 1/21): P1 功能
├── Day 1-2: P1-1 一稿多发
├── Day 3: P1-2 Briefing 快速模式
├── Day 4: P1-3 智能蓝图推荐
└── Day 5: P1-4 素材限制统一 + P1-5 反馈优化

Week 3 (1/22 - 1/28): P2 + 收尾
├── Day 1-2: P2 功能
├── Day 3-4: 全量回归测试
└── Day 5: 发布准备
```

---

## 七、风险与依赖

| 风险             | 影响         | 缓解措施                           |
| ---------------- | ------------ | ---------------------------------- |
| V1 移除遗漏依赖  | 编译失败     | 完整类型检查 + 测试覆盖            |
| TTS API 配额限制 | 高频使用超限 | 添加使用频率限制                   |
| 平台风格效果主观 | 用户期望不一 | 提供风格预览                       |
| 动画性能         | 低端设备卡顿 | 添加 `prefers-reduced-motion` 支持 |

---

## 八、验证清单

### 发布前必须完成

```
代码验证:
- [ ] npm run type-check 通过
- [ ] npm run lint 无错误
- [ ] npm test 全部通过
- [ ] npm run build 成功

功能验证:
- [ ] /knowledge-studio 重定向到 /knowledge-studio/v2
- [ ] 侧边栏只有一个「知识工坊」入口
- [ ] 14 个蓝图全部可用
- [ ] 素材选择、Briefing、大纲编辑、生成流程正常
- [ ] 导出、TTS、精简功能正常
- [ ] 历史报告可查看
- [ ] 平台风格差异明显

体验验证:
- [ ] 步骤切换有过渡动画
- [ ] 生成等待有动态文案
- [ ] 成功/失败有明确反馈
- [ ] 整体操作流畅
```

---

## 九、度量指标

| 指标             | 当前值 | 目标值  | 衡量方法        |
| ---------------- | ------ | ------- | --------------- |
| 工坊使用率       | -      | +30%    | DAU/WAU         |
| 导出功能使用率   | 0      | 20%     | 导出按钮点击率  |
| TTS 使用率       | -      | 15%     | TTS 按钮点击率  |
| 平台风格选择分布 | -      | 均衡    | 各风格选择比例  |
| 生成完成率       | -      | 85%     | 开始生成 → 完成 |
| 用户满意度       | -      | 4.0/5.0 | 反馈对话框评分  |

---

## 十、总结

本方案共 17 项优化，分 3 周执行：

| 周次   | 重点         | 交付物                         |
| ------ | ------------ | ------------------------------ |
| Week 1 | P0 + V1 移除 | 核心体验修复，V2 成为唯一入口  |
| Week 2 | P1 功能      | 差异化功能：一稿多发、智能推荐 |
| Week 3 | P2 + 测试    | 锦上添花 + 发布准备            |

**关键成果**：

- 移除 V1，减少 ~25 个文件的维护负担
- 整合导出、TTS 等现有功能
- 提升交互流畅度
- 建立差异化竞争优势（一稿多发）

---

**文档结束**

_此方案由 PM John 于 2026-01-07 生成并通过审核_
