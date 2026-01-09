# 知识工坊 Beta 优化 - 开发任务清单

> **文档版本**: v1.0.0
> **创建日期**: 2026-01-07
> **基于方案**: knowledge-studio-beta-optimization-plan.md v1.1.0
> **总预估工时**: 10-14 人日

---

## Week 1: P0 修复 + V1 移除 (1/8 - 1/14)

### Day 1: P0-5 移除 V1 工坊 ⏱️ 0.5天

#### Task 1.1: 创建 feature 分支

```bash
git checkout -b feature/knowledge-studio-v2-optimization
```

- [ ] 从 `feature/classification-v4.2` 创建分支
- [ ] 推送到远程

#### Task 1.2: 删除 V1 页面文件

```
删除清单:
src/app/(main)/knowledge-studio/
├── knowledge-studio-page-client.tsx  # 删除
├── learning/                         # 删除整个目录
└── templates/                        # 删除整个目录
```

- [ ] 删除 `knowledge-studio-page-client.tsx`
- [ ] 删除 `learning/` 目录
- [ ] 删除 `templates/` 目录
- [ ] 保留 `billing/` 目录（API 仍需使用）
- [ ] 保留 `v2/` 目录（V2 主入口）
- [ ] 保留 `history/` 目录（历史报告页）

#### Task 1.3: 删除 V1 专用组件

```
删除清单:
src/components/knowledge-studio/
├── blueprint-selector.tsx            # 删除
├── enhanced-blueprint-selector.tsx   # 删除
├── generation-progress.tsx           # 删除
├── outline-editor.tsx                # 删除（V2 用 outline-editor-v2.tsx）
├── outline-confirmation-panel.tsx    # 删除
├── outline-version-history.tsx       # 删除
├── outline-tree-item.tsx             # 删除
├── chat-edit-panel.tsx               # 删除
├── briefing-dialog.tsx               # 删除
├── citation-card.tsx                 # 删除
└── report-editor.tsx                 # 删除
```

- [ ] 删除上述 11 个组件文件
- [ ] 运行 `npm run type-check` 确认无类型错误
- [ ] 如有依赖错误，检查并修复

#### Task 1.4: 更新路由重定向

```typescript
// 修改文件: src/app/(main)/knowledge-studio/page.tsx
import { redirect } from "next/navigation";

export default function KnowledgeStudioPage() {
  redirect("/knowledge-studio/v2");
}
```

- [ ] 修改 `page.tsx` 实现重定向
- [ ] 测试 `/knowledge-studio` 自动跳转到 `/knowledge-studio/v2`

#### Task 1.5: 更新侧边栏导航

```typescript
// 修改文件: src/components/layout/app-sidebar.tsx (line 133-144)
const learningCenterItems: NavItem[] = [
  {
    name: "知识工坊",
    href: "/knowledge-studio/v2",
    icon: Sparkles,
    isPro: true,
  },
  // 删除原 V1 入口
];
```

- [ ] 修改 `app-sidebar.tsx`
- [ ] 修改移动端菜单（如有）
- [ ] 验证导航只显示一个「知识工坊」入口

#### Task 1.6: 验证与测试

- [ ] `npm run type-check` 通过
- [ ] `npm run lint` 无错误
- [ ] `npm run test` 相关测试通过
- [ ] 手动测试 V2 全流程正常
- [ ] 提交代码：`git commit -m "feat(knowledge-studio): remove V1 and unify to V2"`

---

### Day 2: P0-1 素材选择器优化 + P0-6 交互动画 ⏱️ 1天

#### Task 2.1: 修改素材加载上限

```typescript
// 修改文件: src/app/(main)/knowledge-studio/v2/knowledge-studio-v2-page-client.tsx (line 92)
const { data: bookmarksData, isLoading: isLoadingBookmarks } = useBookmarks({
  limit: 50, // 原为 100
});
```

- [ ] 修改 `limit` 为 50
- [ ] 测试素材列表加载

#### Task 2.2: 添加平台筛选器

```typescript
// 修改文件: knowledge-studio-v2-page-client.tsx
// 新增状态
const [platformFilter, setPlatformFilter] = useState<string | null>(null);

// 修改 useBookmarks 调用
const { data: bookmarksData, isLoading: isLoadingBookmarks } = useBookmarks({
  limit: 50,
  platform: platformFilter || undefined,
});
```

- [ ] 添加 `platformFilter` 状态
- [ ] 修改 `useBookmarks` 参数
- [ ] 添加平台筛选 UI 组件

#### Task 2.3: 平台筛选 UI 实现

```tsx
// 在素材选择步骤中添加筛选器
<div className="flex items-center gap-2 mb-3">
  <Select
    value={platformFilter ?? ""}
    onValueChange={(v) => setPlatformFilter(v || null)}
  >
    <SelectTrigger className="w-[140px]">
      <SelectValue placeholder="全部平台" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">全部平台</SelectItem>
      <SelectItem value="wechat">微信公众号</SelectItem>
      <SelectItem value="bilibili">B站</SelectItem>
      <SelectItem value="zhihu">知乎</SelectItem>
      <SelectItem value="xiaohongshu">小红书</SelectItem>
      <SelectItem value="browser">浏览器书签</SelectItem>
    </SelectContent>
  </Select>
</div>
```

- [ ] 实现筛选器 UI
- [ ] 确保选择后列表实时更新
- [ ] 测试各平台筛选

#### Task 2.4: 安装 Framer Motion（如未安装）

```bash
npm install framer-motion
```

- [ ] 安装依赖
- [ ] 确认版本兼容

#### Task 2.5: 步骤切换动画

```tsx
// 修改文件: knowledge-studio-v2-page-client.tsx
import { motion, AnimatePresence } from "framer-motion";

// 包裹步骤内容
<AnimatePresence mode="wait">
  <motion.div
    key={step}
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.2 }}
  >
    {step === "blueprint" && <BlueprintStep ... />}
    {step === "materials" && <MaterialStep ... />}
  </motion.div>
</AnimatePresence>
```

- [ ] 添加 AnimatePresence 包裹
- [ ] 配置进入/退出动画
- [ ] 测试步骤切换效果

#### Task 2.6: 按钮微动效

```tsx
// 更新按钮样式
<Button className="transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
  下一步
</Button>
```

- [ ] 更新「下一步」按钮
- [ ] 更新「开始生成」按钮
- [ ] 更新其他主要按钮

#### Task 2.7: 验证与测试

- [ ] 测试素材筛选功能
- [ ] 测试动画效果流畅
- [ ] 测试移动端响应
- [ ] 提交代码

---

### Day 3: P0-2 导出功能整合 ⏱️ 1天

#### Task 3.1: 创建导出结果对话框组件

```
新增文件: src/components/knowledge-studio/v2/export-result-dialog.tsx
```

- [ ] 创建组件文件
- [ ] 复用 ExportDialogV2 逻辑

#### Task 3.2: 实现导出对话框

```tsx
// export-result-dialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";

interface ExportResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  blueprintName: string;
}

type ExportFormat = "markdown" | "text" | "html";

export function ExportResultDialog({
  open,
  onOpenChange,
  content,
  blueprintName,
}: ExportResultDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const timestamp = new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[:-]/g, "");
      const filename = `${blueprintName}_${timestamp}`;

      let blob: Blob;
      let extension: string;

      switch (format) {
        case "markdown":
          blob = new Blob([content], { type: "text/markdown" });
          extension = "md";
          break;
        case "text":
          // 移除 Markdown 格式
          const plainText = content.replace(/[#*_`]/g, "");
          blob = new Blob([plainText], { type: "text/plain" });
          extension = "txt";
          break;
        case "html":
          // 简单转换
          const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${blueprintName}</title></head>
<body><pre>${content}</pre></body></html>`;
          blob = new Blob([html], { type: "text/html" });
          extension = "html";
          break;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);

      onOpenChange(false);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导出内容</DialogTitle>
        </DialogHeader>

        <RadioGroup
          value={format}
          onValueChange={(v) => setFormat(v as ExportFormat)}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="markdown" id="markdown" />
            <Label htmlFor="markdown">Markdown (.md)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="text" id="text" />
            <Label htmlFor="text">纯文本 (.txt)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="html" id="html" />
            <Label htmlFor="html">HTML (.html)</Label>
          </div>
        </RadioGroup>

        <Button onClick={handleExport} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "导出中..." : "导出"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] 实现完整组件
- [ ] 支持三种格式
- [ ] 文件名包含蓝图名和时间戳

#### Task 3.3: 集成到结果页

```typescript
// 修改文件: blueprint-workflow-client.tsx
import { ExportResultDialog } from "./export-result-dialog";

// 添加状态
const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

// 在结果页操作栏添加按钮
<Button
  variant="outline"
  size="sm"
  onClick={() => setIsExportDialogOpen(true)}
>
  <Download className="mr-1.5 h-4 w-4" />
  导出
</Button>

// 添加对话框
<ExportResultDialog
  open={isExportDialogOpen}
  onOpenChange={setIsExportDialogOpen}
  content={generatedContent}
  blueprintName={blueprint?.displayName || "内容"}
/>
```

- [ ] 导入组件
- [ ] 添加状态
- [ ] 添加按钮到操作栏
- [ ] 添加对话框组件
- [ ] 测试导出功能

#### Task 3.4: 添加导出成功提示

```typescript
import { toast } from "sonner";

// 在导出成功后
toast.success("导出成功！", {
  description: `已保存为 ${filename}.${extension}`,
});
```

- [ ] 添加 toast 提示
- [ ] 测试完整流程

---

### Day 4: P0-3 TTS 集成 + P0-4 平台风格增强 ⏱️ 1天

#### Task 4.1: 集成 TTS 按钮

```typescript
// 修改文件: blueprint-workflow-client.tsx
import { useTTSPlayer } from "@/hooks/domain/ai/use-tts-player";

// 使用 hook
const { play, pause, isPlaying, isLoading: isTTSLoading } = useTTSPlayer();

// 添加朗读按钮
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    if (isPlaying) {
      pause();
    } else {
      // 截取前 2000 字
      const textToRead = generatedContent.slice(0, 2000);
      play(textToRead);
    }
  }}
  disabled={isTTSLoading || !generatedContent}
>
  {isTTSLoading ? (
    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
  ) : isPlaying ? (
    <Pause className="mr-1.5 h-4 w-4" />
  ) : (
    <Volume2 className="mr-1.5 h-4 w-4" />
  )}
  {isPlaying ? "暂停" : "朗读"}
</Button>
```

- [ ] 导入 TTS hook
- [ ] 添加朗读按钮
- [ ] 实现播放/暂停切换
- [ ] 测试 TTS 功能

#### Task 4.2: 增强公众号风格 Prompt

```typescript
// 修改文件: src/lib/knowledge-studio/blueprint/prompts/content.prompt.ts

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
  // ...
};
```

- [ ] 更新公众号 Prompt
- [ ] 添加具体示例和格式要求

#### Task 4.3: 增强小红书风格 Prompt

```typescript
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
```

- [ ] 更新小红书 Prompt
- [ ] 添加热门表达词库
- [ ] 添加 emoji 使用规则

#### Task 4.4: 验证风格差异

- [ ] 使用相同素材生成公众号风格
- [ ] 使用相同素材生成小红书风格
- [ ] 使用相同素材生成通用风格
- [ ] 对比确认差异明显

---

### Day 5: P0-6 交互体验优化 + 测试 ⏱️ 1天

#### Task 5.1: 生成等待文案轮播

```typescript
// 修改文件: blueprint-workflow-client.tsx

const WAITING_MESSAGES = [
  "正在分析素材内容...",
  "正在构建文章结构...",
  "正在生成精彩内容...",
  "AI 正在思考最佳表达...",
  "即将完成，请稍候...",
];

const [waitingMessageIndex, setWaitingMessageIndex] = useState(0);

useEffect(() => {
  if (isGenerating) {
    const interval = setInterval(() => {
      setWaitingMessageIndex(i => (i + 1) % WAITING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  } else {
    setWaitingMessageIndex(0);
  }
}, [isGenerating]);

// 在生成进度区域使用
<p className="text-muted-foreground animate-pulse">
  {WAITING_MESSAGES[waitingMessageIndex]}
</p>
```

- [ ] 添加等待文案数组
- [ ] 添加轮播逻辑
- [ ] 集成到 UI
- [ ] 测试动态切换效果

#### Task 5.2: 增强成功/失败反馈

```typescript
import { toast } from "sonner";

// 生成成功时
const wordCount = generatedContent.length;
toast.success("生成完成！🎉", {
  description: `共 ${wordCount} 字，可以开始编辑了`,
  duration: 5000,
});

// 生成失败时
toast.error("生成失败", {
  description: error.message || "请稍后重试",
  duration: 5000,
});
```

- [ ] 增强成功 toast
- [ ] 增强失败 toast
- [ ] 添加字数统计

#### Task 5.3: 添加 reduced-motion 支持

```tsx
// 检测用户偏好
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 条件性应用动画
<motion.div
  initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
>
```

- [ ] 添加 reduced-motion 检测
- [ ] 条件性禁用动画
- [ ] 测试无障碍支持

#### Task 5.4: Week 1 完整测试

```bash
npm run type-check
npm run lint
npm run test
npm run build
```

- [ ] 类型检查通过
- [ ] Lint 检查通过
- [ ] 单元测试通过
- [ ] 生产构建成功

#### Task 5.5: 手动回归测试

- [ ] `/knowledge-studio` 重定向正常
- [ ] 侧边栏导航正确
- [ ] 素材选择流程正常
- [ ] 平台筛选功能正常
- [ ] Briefing 流程正常
- [ ] 大纲编辑正常
- [ ] 内容生成正常
- [ ] 导出功能正常
- [ ] TTS 功能正常
- [ ] 历史报告可查看

#### Task 5.6: 提交 Week 1 代码

```bash
git add .
git commit -m "feat(knowledge-studio): Week 1 - P0 optimizations and V1 removal

- Remove V1 pages and components (~25 files)
- Add route redirect /knowledge-studio → /knowledge-studio/v2
- Update sidebar navigation
- Reduce material loading limit to 50
- Add platform filter for materials
- Integrate export functionality
- Integrate TTS playback
- Enhance platform style prompts
- Add step transition animations
- Add waiting message carousel
- Improve success/error feedback"
```

- [ ] 提交代码
- [ ] 推送到远程

---

## Week 2: P1 功能 (1/15 - 1/21)

### Day 1-2: P1-1 一稿多发 ⏱️ 2天

#### Task 6.1: 创建适配风格 API

```
新增文件: src/app/api/knowledge-studio/v2/adapt-style/route.ts
```

- [ ] 创建 API 路由
- [ ] 实现风格转换逻辑
- [ ] 配额消耗 1 点

#### Task 6.2: 创建多平台对话框

```
新增文件: src/components/knowledge-studio/v2/multi-platform-dialog.tsx
```

- [ ] 创建对话框组件
- [ ] 平台选择 UI
- [ ] 预览功能

#### Task 6.3: 集成到结果页

- [ ] 添加「适配其他平台」按钮
- [ ] 连接 API
- [ ] 测试完整流程

### Day 3: P1-2 Briefing 快速模式 ⏱️ 1天

#### Task 7.1: 修改 Briefing 组件

```
修改文件: src/components/knowledge-studio/v2/briefing-wizard.tsx
```

- [ ] 添加模式切换 UI
- [ ] 实现快速模式（2-3 问题）
- [ ] 保留详细模式完整问题
- [ ] 切换时保留已填内容

#### Task 7.2: 更新蓝图模板

```
修改文件: src/lib/knowledge-studio/blueprint/briefing-templates.ts
```

- [ ] 为每个蓝图定义快速问题
- [ ] 标记必填问题

### Day 4: P1-3 智能蓝图推荐 ⏱️ 1.5天

#### Task 8.1: 创建推荐服务

```
新增文件: src/lib/knowledge-studio/v2/blueprint-recommender.ts
```

- [ ] 基于素材内容分析
- [ ] 返回推荐蓝图和理由

#### Task 8.2: 集成到选择流程

- [ ] 在素材选择后显示推荐
- [ ] 推荐卡片 UI
- [ ] 点击推荐自动选择

### Day 5: P1-4 素材限制统一 + P1-5 反馈优化 ⏱️ 1天

#### Task 9.1: 更新素材限制文案

```typescript
// 修改文件: src/lib/knowledge-studio/v2/constants.ts
export const MATERIAL_SELECTOR_TEXT = {
  LABEL: "精选 2-3 篇核心素材（最多 5 篇）",
  HINT: "素材越精准，生成质量越高，速度越快",
  WARNING_TOO_MANY: "素材过多会导致生成速度变慢，建议精选 2-3 篇",
};
```

- [ ] 更新文案
- [ ] 测试警告提示

#### Task 9.2: 反馈优化 Diff 功能

- [ ] 添加「查看修改」按钮
- [ ] 实现简单 Diff 视图
- [ ] 高亮变更内容

---

## Week 3: P2 + 测试 (1/22 - 1/28)

### Day 1-2: P2 功能 ⏱️ 2天

#### Task 10.1: P2-2 自定义精简字数

- [ ] 将固定按钮改为滑块
- [ ] 支持 500-3000 字范围

#### Task 10.2: P2-4 生成时间预估

- [ ] 基于历史数据计算
- [ ] 显示「约需 X 分钟」

#### Task 10.3: P2-5 风格预览示例

- [ ] 添加示例文本
- [ ] 选择时显示预览

### Day 3-4: 全量回归测试 ⏱️ 2天

#### Task 11.1: 自动化测试

- [ ] 运行所有单元测试
- [ ] 运行 E2E 测试
- [ ] 修复失败用例

#### Task 11.2: 手动测试清单

- [ ] 14 个蓝图全部测试
- [ ] 三种平台风格测试
- [ ] 导出/TTS/精简功能
- [ ] 一稿多发功能
- [ ] 快速 Briefing
- [ ] 智能推荐

### Day 5: 发布准备 ⏱️ 1天

#### Task 12.1: 代码审查

- [ ] PR 创建
- [ ] 代码审查
- [ ] 修复反馈

#### Task 12.2: 发布

- [ ] 合并到主分支
- [ ] 部署到生产环境
- [ ] 验证线上功能

---

## 验收清单

### 代码质量

- [ ] `npm run type-check` 通过
- [ ] `npm run lint` 无错误
- [ ] `npm run test` 全部通过
- [ ] `npm run build` 成功

### 功能验收

- [ ] V1 已完全移除
- [ ] 路由重定向正常
- [ ] 侧边栏导航正确
- [ ] 素材选择优化完成
- [ ] 导出功能可用
- [ ] TTS 功能可用
- [ ] 平台风格差异明显
- [ ] 交互动画流畅
- [ ] 一稿多发可用
- [ ] 快速 Briefing 可用
- [ ] 智能推荐可用

### 用户体验

- [ ] 步骤切换有动画
- [ ] 等待有动态文案
- [ ] 成功/失败有反馈
- [ ] 整体操作流畅

---

## 注意事项

1. **每日提交**: 每天至少提交一次代码，保持增量进度
2. **及时测试**: 每个功能完成后立即测试
3. **文档同步**: 更新相关注释和文档
4. **问题记录**: 遇到问题及时记录，不要积压

---

**文档结束**

_此任务清单由 PM John 于 2026-01-07 生成_
