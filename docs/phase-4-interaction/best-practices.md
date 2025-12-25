# Phase 4 最佳实践参考

> **版本**: 2.0.0
> **日期**: 2025-12-25
> **用途**: 为 Phase 4 各任务提供业界最佳实践参考
> **整合**: V3 实施计划 (Batch 7 + 7B) 详细设计

---

## 目录

- [7.1 工具选择器](#71-工具选择器)
- [7.2 快速操作栏](#72-快速操作栏)
- [7.3 执行确认组件](#73-执行确认组件)
- [7.4 上下文面板](#74-上下文面板)
- [前后端整合架构](#前后端整合架构)
- [7B.1 数据库迁移](#7b1-数据库迁移)
- [7B.2 显式工具路由](#7b2-显式工具路由)
- [7B.3 反馈服务](#7b3-反馈服务)
- [7B.4 快照管理 (Event Sourcing)](#7b4-快照管理-event-sourcing)
- [7B.5 笔记服务](#7b5-笔记服务)
- [7B.6 上下文管理](#7b6-上下文管理)
- [API 端点汇总](#api-端点汇总)
- [并行开发策略](#并行开发策略)

---

## 7.1 工具选择器

### 业界参考

#### ChatGPT GPT Selector 设计模式

ChatGPT 的 GPT 选择器采用**下拉菜单 + 图标**的组合模式：

```
┌─────────────────────────────────────────────────┐
│  🤖 ChatGPT ▼    [输入消息...]           [发送] │
│  ├─ 🧠 GPT-4o (默认)                            │
│  ├─ 🎨 DALL·E                                   │
│  ├─ 🔍 Web Browsing                             │
│  └─ 📁 文件分析                                  │
└─────────────────────────────────────────────────┘
```

**设计要点**:

- 默认选项明显标注
- 图标辅助快速识别
- 下拉菜单紧凑，不占用输入空间

> 参考: [OpenAI Apps SDK - Build ChatGPT UI](https://developers.openai.com/apps-sdk/build/chatgpt-ui/)

#### LangUI 开源组件库

[LangUI](https://github.com/LangbaseInc/langui) 提供 60+ 专为 AI/GPT 项目设计的 Tailwind 组件。

```tsx
// LangUI 风格的工具选择器
<Select defaultValue="auto">
  <SelectTrigger className="w-[140px]">
    <SelectValue placeholder="选择工具" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="auto">
      <span className="flex items-center gap-2">
        <Bot className="h-4 w-4" /> 自动
      </span>
    </SelectItem>
    <SelectItem value="search">
      <span className="flex items-center gap-2">
        <Search className="h-4 w-4" /> 搜索
      </span>
    </SelectItem>
    {/* ... */}
  </SelectContent>
</Select>
```

### 应用到 AnyKeep: 工具选择器实现

#### 工具类型定义

```typescript
type ToolType =
  | "auto"
  | "search"
  | "organize"
  | "summarize"
  | "export"
  | "extract";

interface ToolOption {
  type: ToolType;
  label: string;
  icon: LucideIcon;
  description: string;
  shortcut?: string; // 快捷键
}

export const TOOL_OPTIONS: ToolOption[] = [
  {
    type: "auto",
    label: "自动",
    icon: Bot,
    description: "AI 自动判断意图",
    shortcut: "⌘A",
  },
  {
    type: "search",
    label: "搜索",
    icon: Search,
    description: "搜索收藏内容",
    shortcut: "⌘S",
  },
  {
    type: "organize",
    label: "整理",
    icon: FolderOpen,
    description: "整理和分类",
    shortcut: "⌘O",
  },
  {
    type: "summarize",
    label: "总结",
    icon: FileText,
    description: "生成摘要",
    shortcut: "⌘M",
  },
  {
    type: "export",
    label: "导出",
    icon: Download,
    description: "导出数据",
    shortcut: "⌘E",
  },
  {
    type: "extract",
    label: "萃取",
    icon: Lightbulb,
    description: "知识萃取",
    shortcut: "⌘K",
  },
];
```

#### 工具选择器组件

```tsx
interface ToolSelectorProps {
  value: ToolType;
  onChange: (tool: ToolType) => void;
  disabled?: boolean;
}

export function ToolSelector({ value, onChange, disabled }: ToolSelectorProps) {
  const selectedTool = TOOL_OPTIONS.find((t) => t.type === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant="outline" size="sm" className="gap-2 min-w-[100px]">
          {selectedTool && (
            <>
              <selectedTool.icon className="h-4 w-4" />
              <span>{selectedTool.label}</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[200px]">
        {TOOL_OPTIONS.map((tool) => (
          <DropdownMenuItem
            key={tool.type}
            onClick={() => onChange(tool.type)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <tool.icon className="h-4 w-4" />
              <div>
                <div className="font-medium">{tool.label}</div>
                <div className="text-xs text-muted-foreground">
                  {tool.description}
                </div>
              </div>
            </div>
            {tool.shortcut && (
              <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {tool.shortcut}
              </kbd>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### 键盘快捷键支持

```tsx
// hooks/use-tool-shortcuts.ts
export function useToolShortcuts(onToolChange: (tool: ToolType) => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;

      const shortcutMap: Record<string, ToolType> = {
        a: "auto",
        s: "search",
        o: "organize",
        m: "summarize",
        e: "export",
        k: "extract",
      };

      const tool = shortcutMap[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        onToolChange(tool);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToolChange]);
}
```

---

## 7.2 快速操作栏

### 业界参考

#### AWS Cloudscape 设计系统

[Cloudscape Design System](https://cloudscape.design/patterns/genai/generative-AI-chat/) 定义了 AI Chat 的标准操作模式：

**核心操作按钮组**:

- **复制**: 复制响应内容到剪贴板
- **再生成**: 重新生成响应
- **反馈**: 👍/👎 收集用户满意度

**设计原则**:

- 常用操作显示为独立图标按钮
- 次要操作收入下拉菜单
- 反馈按钮触发对话框收集详细反馈

#### Vercel AI SDK Message 组件

[AI SDK Elements](https://ai-sdk.dev/elements/components/message) 提供了完整的消息操作组件：

```tsx
// Vercel AI SDK 示例
<Message.Actions>
  <Message.ActionButton tooltip="Copy" onClick={handleCopy}>
    <ClipboardIcon />
  </Message.ActionButton>
  <Message.ActionButton tooltip="Regenerate" onClick={handleRegenerate}>
    <RefreshIcon />
  </Message.ActionButton>
  <Message.ActionButton tooltip="Like" onClick={() => handleFeedback("like")}>
    <ThumbsUpIcon />
  </Message.ActionButton>
  <Message.ActionButton
    tooltip="Dislike"
    onClick={() => handleFeedback("dislike")}
  >
    <ThumbsDownIcon />
  </Message.ActionButton>
</Message.Actions>
```

### 应用到 AnyKeep: 快速操作栏实现

#### 操作类型定义

```typescript
type MessageActionType =
  | "copy"
  | "regenerate"
  | "save"
  | "export"
  | "like"
  | "dislike";

interface MessageAction {
  type: MessageActionType;
  label: string;
  icon: LucideIcon;
  variant?: "default" | "ghost" | "destructive";
  requiresConfirm?: boolean;
}

export const MESSAGE_ACTIONS: MessageAction[] = [
  { type: "copy", label: "复制", icon: Copy },
  { type: "regenerate", label: "重新生成", icon: RefreshCw },
  { type: "save", label: "保存", icon: Bookmark },
  { type: "export", label: "导出", icon: Download },
];

export const FEEDBACK_ACTIONS: MessageAction[] = [
  { type: "like", label: "有帮助", icon: ThumbsUp },
  { type: "dislike", label: "无帮助", icon: ThumbsDown },
];
```

#### 快速操作栏组件

```tsx
interface MessageActionsBarProps {
  messageId: string;
  content: string;
  onRegenerate: () => void;
  onSave: (noteId: string) => void;
  onExport: () => void;
  onFeedback: (type: "like" | "dislike") => void;
  feedbackGiven?: "like" | "dislike" | null;
}

export function MessageActionsBar({
  messageId,
  content,
  onRegenerate,
  onSave,
  onExport,
  onFeedback,
  feedbackGiven,
}: MessageActionsBarProps) {
  const [copied, setCopied] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDislike = () => {
    setShowFeedbackDialog(true);
  };

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* 主操作按钮 */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>复制</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRegenerate}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>重新生成</TooltipContent>
        </Tooltip>

        {/* 更多操作下拉 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onSave(messageId)}>
              <Bookmark className="h-4 w-4 mr-2" />
              保存到笔记
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* 反馈按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                feedbackGiven === "like" && "text-green-500",
              )}
              onClick={() => onFeedback("like")}
              disabled={feedbackGiven !== null}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>有帮助</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                feedbackGiven === "dislike" && "text-red-500",
              )}
              onClick={handleDislike}
              disabled={feedbackGiven !== null}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>无帮助</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* 负反馈详情对话框 */}
      <FeedbackDialog
        open={showFeedbackDialog}
        onOpenChange={setShowFeedbackDialog}
        onSubmit={(details) => {
          onFeedback("dislike");
          // 提交详细反馈
        }}
      />
    </div>
  );
}
```

#### 负反馈详情对话框

```tsx
interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (details: FeedbackDetails) => void;
}

interface FeedbackDetails {
  reasons: string[];
  comment?: string;
}

const FEEDBACK_REASONS = [
  { id: "incorrect", label: "内容不正确" },
  { id: "irrelevant", label: "与问题无关" },
  { id: "incomplete", label: "回答不完整" },
  { id: "confusing", label: "表述混乱" },
  { id: "other", label: "其他问题" },
];

export function FeedbackDialog({
  open,
  onOpenChange,
  onSubmit,
}: FeedbackDialogProps) {
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    onSubmit({ reasons, comment });
    onOpenChange(false);
    setReasons([]);
    setComment("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>请告诉我们哪里不好</DialogTitle>
          <DialogDescription>
            您的反馈将帮助我们改进 AI 回答质量
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            {FEEDBACK_REASONS.map((reason) => (
              <div key={reason.id} className="flex items-center space-x-2">
                <Checkbox
                  id={reason.id}
                  checked={reasons.includes(reason.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setReasons([...reasons, reason.id]);
                    } else {
                      setReasons(reasons.filter((r) => r !== reason.id));
                    }
                  }}
                />
                <label htmlFor={reason.id} className="text-sm">
                  {reason.label}
                </label>
              </div>
            ))}
          </div>

          <Textarea
            placeholder="补充说明（可选）"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={reasons.length === 0}>
            提交反馈
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 7.3 执行确认组件

### 设计模式参考

#### GitHub Actions 确认模式

GitHub Actions 的确认对话框设计：

- **清晰的操作摘要**
- **受影响项目列表**
- **风险等级警告**
- **明确的确认/取消按钮**

#### 确认层级设计

```
风险等级        确认方式                    示例
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
低风险         无需确认，直接执行           搜索、查看
中风险         简单确认对话框               移动、添加标签
高风险         详细确认 + 输入验证          删除、批量修改
危险操作       输入确认词 + 二次确认        永久删除
```

### 应用到 AnyKeep: 执行确认组件

#### 操作风险评估

```typescript
type RiskLevel = "low" | "medium" | "high" | "critical";

interface ActionRisk {
  level: RiskLevel;
  message: string;
  requiresConfirmation: boolean;
  requiresInput?: string; // 需要输入的确认词
}

function assessActionRisk(action: OrganizeAction): ActionRisk {
  const { type, targets } = action;
  const count = targets.length;

  // 删除操作
  if (type === "delete") {
    if (action.params.permanent) {
      return {
        level: "critical",
        message: `将永久删除 ${count} 个项目，无法恢复`,
        requiresConfirmation: true,
        requiresInput: "删除",
      };
    }
    return {
      level: "high",
      message: `将删除 ${count} 个项目`,
      requiresConfirmation: true,
    };
  }

  // 批量操作
  if (count > 50) {
    return {
      level: "medium",
      message: `将影响 ${count} 个项目`,
      requiresConfirmation: true,
    };
  }

  // 移动/标签
  if (type === "move" || type === "tag") {
    return {
      level: "low",
      message: "",
      requiresConfirmation: false,
    };
  }

  return {
    level: "low",
    message: "",
    requiresConfirmation: false,
  };
}
```

#### 执行确认组件

```tsx
interface ActionConfirmationProps {
  title: string;
  actions: OrganizeAction[];
  onConfirm: () => void;
  onAdjust: () => void;
  onCancel: () => void;
}

export function ActionConfirmation({
  title,
  actions,
  onConfirm,
  onAdjust,
  onCancel,
}: ActionConfirmationProps) {
  const [confirmInput, setConfirmInput] = useState("");

  // 计算整体风险
  const risks = actions.map(assessActionRisk);
  const maxRisk = risks.reduce((max, r) =>
    RISK_ORDER[r.level] > RISK_ORDER[max.level] ? r : max,
  );

  const criticalAction = risks.find((r) => r.requiresInput);
  const needsInputConfirm = !!criticalAction;
  const canConfirm =
    !needsInputConfirm || confirmInput === criticalAction.requiresInput;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {maxRisk.level === "critical" && (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 操作列表 */}
        <div className="space-y-2">
          {actions.map((action, index) => (
            <ActionSummaryItem
              key={index}
              action={action}
              risk={risks[index]}
            />
          ))}
        </div>

        {/* 风险警告 */}
        {maxRisk.level !== "low" && (
          <Alert
            variant={maxRisk.level === "critical" ? "destructive" : "warning"}
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{maxRisk.message}</AlertDescription>
          </Alert>
        )}

        {/* 危险操作确认输入 */}
        {needsInputConfirm && (
          <div className="space-y-2">
            <Label htmlFor="confirm-input">
              请输入 <strong>{criticalAction.requiresInput}</strong> 以确认
            </Label>
            <Input
              id="confirm-input"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={`输入"${criticalAction.requiresInput}"`}
              className="max-w-[200px]"
            />
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onAdjust}>
            调整方案
          </Button>
          <Button
            variant={maxRisk.level === "critical" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            确认执行
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function ActionSummaryItem({
  action,
  risk,
}: {
  action: OrganizeAction;
  risk: ActionRisk;
}) {
  const icons: Record<OrganizeAction["type"], LucideIcon> = {
    move: FolderInput,
    tag: Tag,
    merge: GitMerge,
    archive: Archive,
    delete: Trash2,
  };

  const Icon = icons[action.type];

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        risk.level === "high" && "border-orange-200 bg-orange-50",
        risk.level === "critical" && "border-red-200 bg-red-50",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 mt-0.5",
          risk.level === "critical" && "text-destructive",
        )}
      />
      <div className="flex-1">
        <div className="font-medium">{getActionLabel(action)}</div>
        <div className="text-sm text-muted-foreground">
          影响 {action.targets.length} 个项目
        </div>
      </div>
      {risk.level !== "low" && (
        <Badge variant={risk.level === "critical" ? "destructive" : "outline"}>
          {risk.level === "critical" ? "危险" : "注意"}
        </Badge>
      )}
    </div>
  );
}
```

---

## 7.4 上下文面板

### 业界参考

#### RAG Citation UI 设计

[Shape of AI - Citations Pattern](https://www.shapeof.ai/patterns/citations) 总结了 AI 引用设计最佳实践：

- **内联引用**: 在文本中标注来源 [1][2]
- **边栏显示**: 引用的原始内容在侧边展示
- **可折叠**: 引用内容默认折叠，点击展开
- **可移除**: 用户可移除不需要的引用

### 应用到 AnyKeep: 上下文面板实现

#### 上下文类型定义

```typescript
interface ContextItem {
  id: string;
  type: "bookmark" | "folder" | "tag" | "search_results";
  data: Bookmark | Folder | string | Bookmark[];
  addedAt: Date;
  addedBy: "user" | "ai"; // 用户手动添加 or AI 自动引用
}

interface ContextPanelState {
  items: ContextItem[];
  expanded: boolean;
}
```

#### 上下文面板组件

```tsx
interface ContextPanelProps {
  items: ContextItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onAddMore: () => void;
}

export function ContextPanel({
  items,
  onRemove,
  onClear,
  onAddMore,
}: ContextPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="border-b bg-muted/30">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <FileStack className="h-4 w-4" />
          <span>引用的内容 ({items.length})</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              !expanded && "-rotate-90",
            )}
          />
        </button>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onAddMore}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            添加
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            清除全部
          </Button>
        </div>
      </div>

      {/* 内容列表 */}
      {expanded && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <ContextItemChip
              key={item.id}
              item={item}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContextItemChip({
  item,
  onRemove,
}: {
  item: ContextItem;
  onRemove: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);

  const getIcon = () => {
    switch (item.type) {
      case "bookmark":
        return FileText;
      case "folder":
        return Folder;
      case "tag":
        return Tag;
      case "search_results":
        return Search;
    }
  };

  const getLabel = () => {
    switch (item.type) {
      case "bookmark":
        return (item.data as Bookmark).title;
      case "folder":
        return (item.data as Folder).name;
      case "tag":
        return `#${item.data as string}`;
      case "search_results":
        return `${(item.data as Bookmark[]).length} 条搜索结果`;
    }
  };

  const Icon = getIcon();

  return (
    <HoverCard open={showPreview} onOpenChange={setShowPreview}>
      <HoverCardTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md",
            "bg-background border text-sm",
            "hover:bg-accent cursor-pointer group",
          )}
        >
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="max-w-[150px] truncate">{getLabel()}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </HoverCardTrigger>

      <HoverCardContent className="w-80">
        <ContextItemPreview item={item} />
      </HoverCardContent>
    </HoverCard>
  );
}

function ContextItemPreview({ item }: { item: ContextItem }) {
  if (item.type === "bookmark") {
    const bookmark = item.data as Bookmark;
    return (
      <div className="space-y-2">
        <h4 className="font-medium line-clamp-2">{bookmark.title}</h4>
        {bookmark.summary && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {bookmark.summary}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{bookmark.platform}</span>
          <span>•</span>
          <span>{formatDate(bookmark.createdAt)}</span>
        </div>
      </div>
    );
  }

  // 其他类型的预览...
  return null;
}
```

#### 添加上下文选择器

```tsx
interface AddContextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (items: ContextItem[]) => void;
}

export function AddContextDialog({
  open,
  onOpenChange,
  onSelect,
}: AddContextDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<
    "bookmarks" | "folders" | "tags"
  >("bookmarks");
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>添加引用内容</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 类型切换 */}
          <Tabs
            value={selectedTab}
            onValueChange={(v) => setSelectedTab(v as any)}
          >
            <TabsList>
              <TabsTrigger value="bookmarks">书签</TabsTrigger>
              <TabsTrigger value="folders">文件夹</TabsTrigger>
              <TabsTrigger value="tags">标签</TabsTrigger>
            </TabsList>

            <TabsContent
              value="bookmarks"
              className="max-h-[400px] overflow-y-auto"
            >
              <BookmarkSelector
                query={searchQuery}
                selected={selected}
                onSelect={setSelected}
              />
            </TabsContent>
            {/* 其他 Tab 内容 */}
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              // 转换选中项为 ContextItem
              const items = convertToContextItems(selected, selectedTab);
              onSelect(items);
              onOpenChange(false);
            }}
            disabled={selected.length === 0}
          >
            添加 ({selected.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 前后端整合架构

> **来源**: V3 计划 Batch 7 + 7B
> **核心特点**: 前后端可并行开发，通过 API 层解耦

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Batch 7 前后端架构                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Frontend (Batch 7)                       │    │
│  │  ┌───────────┐ ┌───────────┐ ┌────────────┐ ┌────────────┐ │    │
│  │  │ToolPicker │ │QuickAction│ │ActionConfirm│ │ContextPanel│ │    │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬──────┘ └─────┬──────┘ │    │
│  └────────┼─────────────┼─────────────┼──────────────┼────────┘    │
│           │             │             │              │              │
│           ▼             ▼             ▼              ▼              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                 API Layer (Next.js Routes)                   │    │
│  │                                                              │    │
│  │  POST /api/agent/unified     ← 扩展：支持 explicitTool       │    │
│  │  POST /api/agent/regenerate  ← 新增：重新生成                 │    │
│  │  POST /api/agent/feedback    ← 新增：用户反馈                 │    │
│  │  POST /api/agent/execute     ← 新增：确认执行                 │    │
│  │  POST /api/agent/undo        ← 新增：撤销操作                 │    │
│  │  POST /api/notes/save        ← 新增：保存 AI 输出             │    │
│  └──────────────────────────────────────────────────────────────┘    │
│           │             │             │              │              │
│           ▼             ▼             ▼              ▼              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  Backend Services (Batch 7B)                 │    │
│  │                                                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │ExplicitRouter│  │FeedbackStore │  │SnapshotMgr   │       │    │
│  │  │显式工具路由   │  │反馈存储服务   │  │快照管理器     │       │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │    │
│  │                                                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │NoteService   │  │PlanExecutor  │  │ContextMgr    │       │    │
│  │  │笔记保存服务   │  │方案执行器     │  │上下文管理器   │       │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 整合后的 AI Chat 界面布局

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AnyKeep AI 助手 - 新界面布局                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  📑 上下文面板                                                  │  │
│  │  AI 正在参考: [📄 Vibe Coding ×] [📁 AI学习 ×] [+ 添加]         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  🧑 帮我整理一下最近一周的收藏                                   │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │  🤖 分析完成，发现 23 条待整理：                          │ │  │
│  │  │                                                         │ │  │
│  │  │  建议方案：                                              │ │  │
│  │  │  • 创建「AI 技术」文件夹，移入 12 条                      │ │  │
│  │  │  • 移入「前端开发」(已有)，8 条                          │ │  │
│  │  │  • 清理 3 条重复                                        │ │  │
│  │  │                                                         │ │  │
│  │  │  [✅ 确认执行] [✏️ 调整] [取消]                          │ │  │
│  │  │  ☐ 此类操作不再询问                                     │ │  │
│  │  │                                                         │ │  │
│  │  │  ─────────────────────────────────────────────          │ │  │
│  │  │  [📋] [🔄] [💾] [📤]  |  [👍] [👎]    ← 快速操作栏        │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  [✨ 自动] [🔧 选择工具 ▼]              [发送 ➤]              │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │ 描述你的任务...                                         │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7B.1 数据库迁移

> **来源**: V3 计划 Batch 7B
> **新增表**: ai_feedback, ai_operation_snapshots, ai_notes

### 数据库迁移脚本

```sql
-- supabase/migrations/20251225000002_add_ai_operation_tables.sql

-- 1. AI 反馈表
CREATE TABLE ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('positive', 'negative')),
  negative_reason TEXT CHECK (negative_reason IN ('wrong_intent', 'inaccurate_result', 'bad_format', 'other')),
  negative_comment TEXT,
  original_message TEXT NOT NULL,
  classified_intent TEXT NOT NULL,
  tool_used TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. AI 操作快照表
CREATE TABLE ai_operation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('organize', 'batch_tag', 'dedupe', 'move')),
  before_state JSONB NOT NULL,
  operations JSONB NOT NULL DEFAULT '[]',
  expires_at TIMESTAMPTZ NOT NULL,
  is_reverted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. AI 笔记表
CREATE TABLE ai_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('ai_summary', 'ai_extraction', 'ai_review')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  related_bookmark_ids INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_ai_feedback_user ON ai_feedback(user_id);
CREATE INDEX idx_ai_feedback_created ON ai_feedback(created_at DESC);
CREATE INDEX idx_ai_snapshots_user ON ai_operation_snapshots(user_id);
CREATE INDEX idx_ai_snapshots_expires ON ai_operation_snapshots(expires_at);
CREATE INDEX idx_ai_notes_user ON ai_notes(user_id);
CREATE INDEX idx_ai_notes_created ON ai_notes(created_at DESC);

-- RLS 策略
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_operation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feedback" ON ai_feedback
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own snapshots" ON ai_operation_snapshots
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own notes" ON ai_notes
  FOR ALL USING (auth.uid() = user_id);

-- 过期快照自动清理函数
CREATE OR REPLACE FUNCTION cleanup_expired_snapshots()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_operation_snapshots
  WHERE expires_at < NOW() AND is_reverted = FALSE;
END;
$$ LANGUAGE plpgsql;

-- 定时任务（可选：使用 pg_cron 或应用层定时调用）
-- SELECT cron.schedule('cleanup-snapshots', '0 * * * *', 'SELECT cleanup_expired_snapshots()');
```

---

## 7B.2 显式工具路由

> **来源**: V3 计划 Batch 7B.2
> **核心价值**: 用户主动选择工具 = 100% 意图准确率

### 设计原理

当用户手动选择工具时，应**跳过意图分类**，直接路由到指定工具。

### V3 ExplicitToolRouter 完整实现

```typescript
// src/lib/ai-skills/router/explicit-tool-router.ts

export interface UnifiedRequestWithExplicitTool {
  message: string;
  userId: string;
  conversationId?: string;

  // 🆕 显式工具选择
  explicitTool?: {
    toolId: string; // 'search' | 'organize' | 'summarize' | ...
    skipIntentClassification: boolean; // 跳过意图识别
  };

  // 🆕 上下文引用
  contextReferences?: {
    bookmarkIds?: number[];
    folderIds?: number[];
    previousOutputId?: string;
  };
}

interface ToolHandler {
  handler: string;
  intent: string;
}

export class ExplicitToolRouter {
  private readonly toolMapping: Map<string, ToolHandler> = new Map([
    ["search", { handler: "SearchTool", intent: "query" }],
    ["stats", { handler: "StatsTool", intent: "query" }],
    ["organize", { handler: "OrganizeSkill", intent: "manage" }],
    ["tag", { handler: "BatchTagTool", intent: "manage" }],
    ["dedupe", { handler: "DedupeTool", intent: "manage" }],
    ["summarize", { handler: "SummarizeSkill", intent: "create" }],
    ["extract", { handler: "KnowledgeExtractSkill", intent: "create" }],
    ["review", { handler: "KnowledgeReviewSkill", intent: "create" }],
    ["export", { handler: "DataExportSkill", intent: "export" }],
  ]);

  /**
   * 处理显式工具请求
   */
  async route(request: UnifiedRequestWithExplicitTool): Promise<RouteResult> {
    const { explicitTool, message, contextReferences } = request;

    if (!explicitTool || !explicitTool.skipIntentClassification) {
      // 回退到正常意图识别流程
      return { mode: "auto", handler: null };
    }

    const toolConfig = this.toolMapping.get(explicitTool.toolId);
    if (!toolConfig) {
      throw new Error(`Unknown tool: ${explicitTool.toolId}`);
    }

    return {
      mode: "explicit",
      handler: toolConfig.handler,
      intent: toolConfig.intent,
      context: contextReferences,
      // 消息作为参数传递给工具
      toolParams: this.parseToolParams(message, explicitTool.toolId),
    };
  }

  /**
   * 从消息中解析工具参数
   */
  private parseToolParams(
    message: string,
    toolId: string,
  ): Record<string, unknown> {
    switch (toolId) {
      case "organize":
        return this.parseOrganizeParams(message);
      case "search":
        return { query: message };
      case "export":
        return this.parseExportParams(message);
      default:
        return { input: message };
    }
  }

  private parseOrganizeParams(message: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (/最近一周|这周|7天/.test(message)) {
      params.timeRange = "7d";
    } else if (/最近一个月|这个月|30天/.test(message)) {
      params.timeRange = "30d";
    } else if (/全部|所有/.test(message)) {
      params.timeRange = "all";
    }

    const topicMatch = message.match(/(?:关于|有关)(.+?)(?:的|$)/);
    if (topicMatch) {
      params.topic = topicMatch[1].trim();
    }

    return params;
  }

  private parseExportParams(message: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (/markdown|md/i.test(message)) params.format = "markdown";
    else if (/csv/i.test(message)) params.format = "csv";
    else if (/obsidian/i.test(message)) params.format = "obsidian";
    else if (/json/i.test(message)) params.format = "json";

    return params;
  }
}
```

### 交互流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Tool Picker 交互流程                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  模式 A: 自动模式（默认）                                             │
│  ────────────────────────                                           │
│  用户: "帮我找一下 AI 相关的文章"                                     │
│  系统: → IntentRouter 判断意图 → 调用 search tool → 返回结果         │
│                                                                      │
│  模式 B: 手动选择工具                                                 │
│  ────────────────────────                                           │
│  用户: [点击「智能整理」] → "最近一周的"                              │
│  系统: → 跳过意图识别 → 直接调用 organize tool → 执行整理流程         │
│                                                                      │
│  优势:                                                               │
│  • 用户明确选择 = 100% 意图准确率                                    │
│  • 减少"你理解错了"的挫败感                                          │
│  • 符合 YouMind 的交互模式                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### API 路由修改

```typescript
// src/app/api/agent/unified/route.ts

export async function POST(request: Request) {
  const body = await request.json();

  const validatedRequest = UnifiedRequestSchema.parse({
    message: body.message,
    conversationId: body.conversationId ?? uuidv4(),
    userId: body.userId,
    explicitTool: body.explicitTool, // 新增
    context: body.context, // 新增
  });

  // ... 其余逻辑
}

// Zod Schema 更新
const UnifiedRequestSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().uuid().optional(),
  userId: z.string(),
  explicitTool: z
    .enum(["auto", "search", "organize", "summarize", "export", "extract"])
    .optional(),
  context: z.array(ContextItemSchema).optional(),
});
```

---

## 7B.3 反馈服务

### 数据库设计

```sql
-- 用户反馈表
CREATE TABLE ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  message_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like', 'dislike')),
  reasons TEXT[], -- 负反馈原因
  comment TEXT,   -- 详细评论
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 上下文信息（用于分析）
  request_message TEXT,
  response_message TEXT,
  tool_used TEXT,

  UNIQUE(user_id, message_id)
);

-- 索引
CREATE INDEX idx_ai_feedback_user ON ai_feedback(user_id);
CREATE INDEX idx_ai_feedback_type ON ai_feedback(feedback_type);
CREATE INDEX idx_ai_feedback_created ON ai_feedback(created_at DESC);

-- RLS 策略
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own feedback"
  ON ai_feedback FOR ALL
  USING (auth.uid() = user_id);
```

### 反馈服务实现

```typescript
// src/lib/ai-feedback/feedback.service.ts

interface CreateFeedbackInput {
  userId: string;
  messageId: string;
  conversationId: string;
  feedbackType: "like" | "dislike";
  reasons?: string[];
  comment?: string;
  context: {
    requestMessage: string;
    responseMessage: string;
    toolUsed?: string;
  };
}

export class FeedbackService {
  constructor(private db: SupabaseClient) {}

  async createFeedback(input: CreateFeedbackInput): Promise<void> {
    const { error } = await this.db.from("ai_feedback").upsert(
      {
        user_id: input.userId,
        message_id: input.messageId,
        conversation_id: input.conversationId,
        feedback_type: input.feedbackType,
        reasons: input.reasons,
        comment: input.comment,
        request_message: input.context.requestMessage,
        response_message: input.context.responseMessage,
        tool_used: input.context.toolUsed,
      },
      {
        onConflict: "user_id,message_id",
      },
    );

    if (error) throw error;
  }

  async getFeedbackStats(userId: string): Promise<FeedbackStats> {
    const { data, error } = await this.db
      .from("ai_feedback")
      .select("feedback_type")
      .eq("user_id", userId);

    if (error) throw error;

    const likes = data.filter((f) => f.feedback_type === "like").length;
    const dislikes = data.filter((f) => f.feedback_type === "dislike").length;

    return {
      total: data.length,
      likes,
      dislikes,
      satisfactionRate: data.length > 0 ? likes / data.length : 0,
    };
  }

  // 用于 AI 改进的反馈分析
  async getDislikeReasons(
    limit: number = 100,
  ): Promise<Record<string, number>> {
    const { data, error } = await this.db
      .from("ai_feedback")
      .select("reasons")
      .eq("feedback_type", "dislike")
      .not("reasons", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const reasonCounts: Record<string, number> = {};
    data.forEach((item) => {
      (item.reasons as string[]).forEach((reason) => {
        reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
      });
    });

    return reasonCounts;
  }
}
```

---

## 7B.4 快照管理 (Event Sourcing)

### 业界参考

#### Event Sourcing 核心概念

[Event Sourcing](https://microservices.io/patterns/data/event-sourcing.html) 的核心思想是将状态变更记录为一系列不可变事件，而非直接存储当前状态。

> 参考:
>
> - [Undo/Redo with Event Sourcing](https://ericjinks.com/blog/2025/event-sourcing/)
> - [Snapshots in Event Sourcing](https://www.kurrent.io/blog/snapshots-in-event-sourcing)
> - [ts-event-core](https://github.com/Sam152/ts-event-core)

**关键优势**:

- 完整的操作历史
- 任意时间点状态恢复
- 审计追踪

### 应用到 AnyKeep: 简化版 Event Sourcing

对于 AnyKeep 的撤销需求，我们采用**快照模式**而非完整 Event Sourcing：

```typescript
// 操作快照（用于撤销）
interface OperationSnapshot {
  id: string;
  userId: string;
  operationType: "move" | "delete" | "merge" | "tag" | "archive";
  operationId: string; // 关联的操作 ID
  targetIds: string[]; // 受影响的书签 ID
  beforeState: BookmarkState[]; // 操作前状态
  afterState: BookmarkState[]; // 操作后状态
  createdAt: Date;
  expiresAt: Date; // 24 小时后过期
  undoneAt: Date | null; // 是否已撤销
}

interface BookmarkState {
  id: string;
  folderId: string | null;
  tags: string[];
  status: "active" | "archived" | "deleted";
  deletedAt: Date | null;
  // 其他需要恢复的字段...
}
```

### 数据库设计

```sql
-- 操作快照表
CREATE TABLE ai_operation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  operation_type TEXT NOT NULL,
  operation_id UUID NOT NULL,
  target_ids UUID[] NOT NULL,
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  undone_at TIMESTAMPTZ,

  CONSTRAINT valid_operation_type CHECK (
    operation_type IN ('move', 'delete', 'merge', 'tag', 'archive')
  )
);

-- 索引
CREATE INDEX idx_snapshots_user_expires
  ON ai_operation_snapshots(user_id, expires_at)
  WHERE undone_at IS NULL;

CREATE INDEX idx_snapshots_operation
  ON ai_operation_snapshots(operation_id);

-- 自动清理过期快照（可选：使用 pg_cron）
-- SELECT cron.schedule('cleanup-snapshots', '0 * * * *',
--   $$DELETE FROM ai_operation_snapshots WHERE expires_at < NOW()$$
-- );

-- RLS 策略
ALTER TABLE ai_operation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own snapshots"
  ON ai_operation_snapshots FOR ALL
  USING (auth.uid() = user_id);
```

### 快照服务实现

```typescript
// src/lib/ai-snapshot/snapshot.service.ts

export class SnapshotService {
  constructor(private db: SupabaseClient) {}

  /**
   * 创建操作快照
   */
  async createSnapshot(
    userId: string,
    operationType: OperationType,
    operationId: string,
    bookmarks: Bookmark[],
  ): Promise<string> {
    const beforeState = bookmarks.map(this.extractState);

    const { data, error } = await this.db
      .from("ai_operation_snapshots")
      .insert({
        user_id: userId,
        operation_type: operationType,
        operation_id: operationId,
        target_ids: bookmarks.map((b) => b.id),
        before_state: beforeState,
        after_state: [], // 执行后更新
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * 更新快照的 afterState
   */
  async updateAfterState(
    snapshotId: string,
    bookmarks: Bookmark[],
  ): Promise<void> {
    const afterState = bookmarks.map(this.extractState);

    const { error } = await this.db
      .from("ai_operation_snapshots")
      .update({ after_state: afterState })
      .eq("id", snapshotId);

    if (error) throw error;
  }

  /**
   * 撤销操作（恢复到 beforeState）
   */
  async undoOperation(snapshotId: string): Promise<void> {
    // 1. 获取快照
    const { data: snapshot, error: fetchError } = await this.db
      .from("ai_operation_snapshots")
      .select("*")
      .eq("id", snapshotId)
      .is("undone_at", null)
      .single();

    if (fetchError || !snapshot) {
      throw new Error("Snapshot not found or already undone");
    }

    // 检查是否过期
    if (new Date(snapshot.expires_at) < new Date()) {
      throw new Error("Snapshot has expired");
    }

    // 2. 恢复每个书签的状态
    const beforeState = snapshot.before_state as BookmarkState[];

    for (const state of beforeState) {
      await this.restoreBookmarkState(state);
    }

    // 3. 标记快照为已撤销
    const { error: updateError } = await this.db
      .from("ai_operation_snapshots")
      .update({ undone_at: new Date() })
      .eq("id", snapshotId);

    if (updateError) throw updateError;
  }

  /**
   * 获取用户可撤销的操作
   */
  async getUndoableOperations(userId: string): Promise<OperationSnapshot[]> {
    const { data, error } = await this.db
      .from("ai_operation_snapshots")
      .select("*")
      .eq("user_id", userId)
      .is("undone_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;
    return data;
  }

  private extractState(bookmark: Bookmark): BookmarkState {
    return {
      id: bookmark.id,
      folderId: bookmark.folderId,
      tags: bookmark.tags ?? [],
      status: bookmark.status ?? "active",
      deletedAt: bookmark.deletedAt,
    };
  }

  private async restoreBookmarkState(state: BookmarkState): Promise<void> {
    const updates: Record<string, unknown> = {
      folder_id: state.folderId,
      tags: state.tags,
      status: state.status,
      deleted_at: state.deletedAt,
    };

    const { error } = await this.db
      .from("bookmarks")
      .update(updates)
      .eq("id", state.id);

    if (error) throw error;
  }
}
```

### 集成到操作执行

```typescript
// 在操作执行器中集成快照
export class MoveExecutorWithSnapshot implements OperationExecutor {
  constructor(
    private snapshotService: SnapshotService,
    private db: SupabaseClient,
  ) {}

  async execute(operation: MoveOperation): Promise<OperationResult> {
    const operationId = uuidv4();

    // 1. 获取受影响的书签
    const { data: bookmarks } = await this.db
      .from("bookmarks")
      .select("*")
      .in("id", operation.targets);

    // 2. 创建快照
    const snapshotId = await this.snapshotService.createSnapshot(
      operation.userId,
      "move",
      operationId,
      bookmarks,
    );

    try {
      // 3. 执行移动
      await this.db
        .from("bookmarks")
        .update({ folder_id: operation.params.targetFolderId })
        .in("id", operation.targets);

      // 4. 获取移动后状态并更新快照
      const { data: updatedBookmarks } = await this.db
        .from("bookmarks")
        .select("*")
        .in("id", operation.targets);

      await this.snapshotService.updateAfterState(snapshotId, updatedBookmarks);

      return {
        operationId,
        snapshotId,
        success: true,
        affectedCount: operation.targets.length,
      };
    } catch (error) {
      // 执行失败，使用快照回滚
      await this.snapshotService.undoOperation(snapshotId);
      throw error;
    }
  }
}
```

---

## 7B.5 笔记服务

### 数据库设计

```sql
-- AI 生成的笔记
CREATE TABLE ai_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'markdown',
  source_type TEXT NOT NULL, -- 'ai_response', 'summary', 'extract'
  source_message_id UUID,     -- 关联的 AI 消息
  source_bookmark_ids UUID[], -- 关联的书签
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_ai_notes_user ON ai_notes(user_id);
CREATE INDEX idx_ai_notes_created ON ai_notes(created_at DESC);
CREATE INDEX idx_ai_notes_source ON ai_notes(source_type);

-- 全文搜索
ALTER TABLE ai_notes ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('chinese', title || ' ' || content)) STORED;
CREATE INDEX idx_ai_notes_search ON ai_notes USING GIN(search_vector);

-- RLS
ALTER TABLE ai_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notes"
  ON ai_notes FOR ALL
  USING (auth.uid() = user_id);
```

### 笔记服务实现

```typescript
// src/lib/ai-notes/notes.service.ts

interface CreateNoteInput {
  userId: string;
  title: string;
  content: string;
  contentType?: "markdown" | "html" | "text";
  sourceType: "ai_response" | "summary" | "extract";
  sourceMessageId?: string;
  sourceBookmarkIds?: string[];
  tags?: string[];
}

export class NotesService {
  constructor(private db: SupabaseClient) {}

  async createNote(input: CreateNoteInput): Promise<Note> {
    const { data, error } = await this.db
      .from("ai_notes")
      .insert({
        user_id: input.userId,
        title: input.title,
        content: input.content,
        content_type: input.contentType ?? "markdown",
        source_type: input.sourceType,
        source_message_id: input.sourceMessageId,
        source_bookmark_ids: input.sourceBookmarkIds,
        tags: input.tags,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getNotes(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      search?: string;
      sourceType?: string;
    },
  ): Promise<{ notes: Note[]; total: number }> {
    let query = this.db
      .from("ai_notes")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (options?.sourceType) {
      query = query.eq("source_type", options.sourceType);
    }

    if (options?.search) {
      query = query.textSearch("search_vector", options.search);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit ?? 10) - 1,
      );
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return { notes: data, total: count ?? 0 };
  }

  async updateNote(
    noteId: string,
    userId: string,
    updates: Partial<Pick<Note, "title" | "content" | "tags">>,
  ): Promise<Note> {
    const { data, error } = await this.db
      .from("ai_notes")
      .update({
        ...updates,
        updated_at: new Date(),
      })
      .eq("id", noteId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteNote(noteId: string, userId: string): Promise<void> {
    const { error } = await this.db
      .from("ai_notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", userId);

    if (error) throw error;
  }
}
```

---

## 7B.6 上下文管理

### 上下文管理服务

```typescript
// src/lib/ai-context/context.service.ts

interface ConversationContext {
  conversationId: string;
  userId: string;
  items: ContextItem[];
  createdAt: Date;
  lastUpdatedAt: Date;
}

export class ContextService {
  private cache: Map<string, ConversationContext> = new Map();
  private readonly TTL_MS = 30 * 60 * 1000; // 30 分钟

  constructor(private db: SupabaseClient) {
    // 定期清理过期缓存
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * 获取对话上下文
   */
  async getContext(conversationId: string): Promise<ContextItem[]> {
    const cached = this.cache.get(conversationId);
    if (cached) {
      return cached.items;
    }
    return [];
  }

  /**
   * 添加上下文项
   */
  async addContextItem(
    conversationId: string,
    userId: string,
    item: Omit<ContextItem, "id" | "addedAt">,
  ): Promise<ContextItem> {
    const newItem: ContextItem = {
      id: uuidv4(),
      ...item,
      addedAt: new Date(),
    };

    let context = this.cache.get(conversationId);
    if (!context) {
      context = {
        conversationId,
        userId,
        items: [],
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      };
    }

    context.items.push(newItem);
    context.lastUpdatedAt = new Date();
    this.cache.set(conversationId, context);

    return newItem;
  }

  /**
   * 批量添加上下文项
   */
  async addContextItems(
    conversationId: string,
    userId: string,
    items: Array<Omit<ContextItem, "id" | "addedAt">>,
  ): Promise<ContextItem[]> {
    const results: ContextItem[] = [];
    for (const item of items) {
      const added = await this.addContextItem(conversationId, userId, item);
      results.push(added);
    }
    return results;
  }

  /**
   * 移除上下文项
   */
  async removeContextItem(
    conversationId: string,
    itemId: string,
  ): Promise<void> {
    const context = this.cache.get(conversationId);
    if (!context) return;

    context.items = context.items.filter((item) => item.id !== itemId);
    context.lastUpdatedAt = new Date();
    this.cache.set(conversationId, context);
  }

  /**
   * 清除对话所有上下文
   */
  async clearContext(conversationId: string): Promise<void> {
    this.cache.delete(conversationId);
  }

  /**
   * AI 自动添加引用
   */
  async recordAIReference(
    conversationId: string,
    userId: string,
    bookmarks: Bookmark[],
  ): Promise<void> {
    for (const bookmark of bookmarks) {
      await this.addContextItem(conversationId, userId, {
        type: "bookmark",
        data: bookmark,
        addedBy: "ai",
      });
    }
  }

  /**
   * 获取上下文用于 AI 处理
   */
  async getContextForAI(conversationId: string): Promise<{
    bookmarks: Bookmark[];
    folders: Folder[];
    tags: string[];
  }> {
    const items = await this.getContext(conversationId);

    const bookmarks: Bookmark[] = [];
    const folders: Folder[] = [];
    const tags: string[] = [];

    for (const item of items) {
      switch (item.type) {
        case "bookmark":
          bookmarks.push(item.data as Bookmark);
          break;
        case "folder":
          folders.push(item.data as Folder);
          break;
        case "tag":
          tags.push(item.data as string);
          break;
        case "search_results":
          bookmarks.push(...(item.data as Bookmark[]));
          break;
      }
    }

    return { bookmarks, folders, tags };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, context] of this.cache) {
      if (now - context.lastUpdatedAt.getTime() > this.TTL_MS) {
        this.cache.delete(id);
      }
    }
  }
}
```

---

## API 端点汇总

> **来源**: V3 计划 Batch 7B.8
> **设计原则**: RESTful + 前后端解耦

### 完整端点列表

| 端点                    | 方法        | 说明                              | 对应 UI                   | 优先级 |
| ----------------------- | ----------- | --------------------------------- | ------------------------- | ------ |
| `/api/agent/unified`    | POST        | 扩展：支持 explicitTool + context | ToolPicker + ContextPanel | P0     |
| `/api/agent/feedback`   | POST        | 新增：用户反馈收集                | QuickActions 👍👎         | P0     |
| `/api/agent/undo`       | POST        | 新增：撤销操作                    | ActionConfirmation 撤销   | P1     |
| `/api/agent/regenerate` | POST        | 新增：重新生成                    | QuickActions 🔄           | P1     |
| `/api/notes/save`       | POST        | 新增：保存 AI 输出                | QuickActions 💾           | P1     |
| `/api/agent/context`    | POST/DELETE | 新增：管理上下文                  | ContextPanel              | P1     |
| `/api/agent/execute`    | POST        | 新增：确认执行方案                | ActionConfirmation 确认   | P0     |

### 请求/响应接口

```typescript
// POST /api/agent/unified - 扩展版
interface UnifiedRequestV2 {
  message: string;
  conversationId?: string;
  userId: string;
  explicitTool?: {
    toolId: string;
    skipIntentClassification: boolean;
  };
  contextReferences?: {
    bookmarkIds?: number[];
    folderIds?: number[];
    previousOutputId?: string;
  };
}

// POST /api/agent/feedback
interface FeedbackRequest {
  messageId: string;
  conversationId: string;
  type: "positive" | "negative";
  negativeReason?:
    | "wrong_intent"
    | "inaccurate_result"
    | "bad_format"
    | "other";
  comment?: string;
}

// POST /api/agent/undo
interface UndoRequest {
  snapshotId: string;
}

interface UndoResponse {
  success: boolean;
  restored: number;
  message: string;
}

// POST /api/notes/save
interface SaveNoteRequest {
  content: string;
  title?: string;
  sourceType: "ai_summary" | "ai_extraction" | "ai_review";
  relatedBookmarkIds?: number[];
}
```

---

## 并行开发策略

> **来源**: V3 计划 Batch 7B.10
> **核心优势**: 前后端并行开发，节省 40+ 小时

### 开发时序图

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Batch 7 + 7B 并行开发计划                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Week 1              Week 2              Week 3              Week 4   │
│  ─────────           ─────────           ─────────           ─────── │
│                                                                      │
│  ┌──────────────────────────────────────────────────────┐           │
│  │ 后端: DB迁移 + ExplicitToolRouter + ContextManager    │           │
│  │ 前端: ToolPicker + ContextPanel UI                   │           │
│  └──────────────────────────────────────────────────────┘           │
│                         │                                            │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────┐           │
│  │ 后端: FeedbackService + NoteService + API            │           │
│  │ 前端: QuickActions UI                                │           │
│  └──────────────────────────────────────────────────────┘           │
│                         │                                            │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────┐           │
│  │ 后端: SnapshotManager + 撤销 API                     │           │
│  │ 前端: ActionConfirmation UI                          │           │
│  └──────────────────────────────────────────────────────┘           │
│                         │                                            │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────┐           │
│  │ 集成测试 + Bug 修复 + 优化                            │           │
│  └──────────────────────────────────────────────────────┘           │
│                                                                      │
│  💡 并行优势: Batch 7 (36h) + Batch 7B (50h) = 86h                   │
│              并行后实际周期: ~4 周（非 6 周）                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 任务清单汇总

| 任务                    | 工时    | 说明              | 前置依赖           |
| ----------------------- | ------- | ----------------- | ------------------ |
| **Batch 7 前端 UI**     | **36h** |                   |                    |
| ToolPicker 组件         | 6h      | 工具选择下拉      | -                  |
| QuickActions 组件       | 4h      | 快速操作栏        | -                  |
| ActionConfirmation 组件 | 6h      | 执行确认          | -                  |
| ContextPanel 组件       | 4h      | 上下文引用        | -                  |
| AI Chat 界面重构        | 8h      | 整合所有组件      | 上述组件           |
| 集成到 UnifiedEngine    | 4h      | 工具选择模式      | ExplicitToolRouter |
| 测试用例                | 4h      | UI 交互测试       | -                  |
| **Batch 7B 后端服务**   | **50h** |                   |                    |
| 数据库迁移              | 2h      | 3 张新表          | -                  |
| ExplicitToolRouter 实现 | 6h      | 显式工具路由      | Batch 1            |
| UnifiedEngine 扩展      | 4h      | 支持 explicitTool | -                  |
| FeedbackService 实现    | 4h      | 反馈收集          | DB 迁移            |
| SnapshotManager 实现    | 8h      | 快照与撤销        | DB 迁移            |
| NoteService 实现        | 4h      | AI 输出保存       | DB 迁移            |
| ContextManager 实现     | 6h      | 上下文管理        | -                  |
| API 端点开发            | 6h      | 5 个端点          | 各服务             |
| 单元测试                | 6h      | 各服务测试        | -                  |
| 集成测试                | 4h      | 前后端联调        | Batch 7            |

### 验收标准

| 测试用例                   | 预期行为                       | 优先级 |
| -------------------------- | ------------------------------ | ------ |
| 点击「智能整理」+ 输入范围 | 跳过意图识别，直接进入整理流程 | P0     |
| AI 返回整理方案            | 显示确认组件，等待用户确认     | P0     |
| 点击消息的「复制」按钮     | 复制 AI 输出到剪贴板           | P0     |
| 点击「👎」+ 选择原因       | 记录反馈到 CorrectionLearner   | P1     |
| 上下文面板显示引用         | 用户能看到 AI 参考了哪些内容   | P1     |
| 确认执行后点击「撤销」     | 24 小时内可撤销，恢复原状态    | P1     |

---

## 验证脚本参考

### 工具选择器测试

```typescript
// tests/tool-selector.test.tsx

describe('ToolSelector', () => {
  it('should display all tool options', () => {
    render(<ToolSelector value="auto" onChange={jest.fn()} />);

    fireEvent.click(screen.getByRole('button'));

    TOOL_OPTIONS.forEach(tool => {
      expect(screen.getByText(tool.label)).toBeInTheDocument();
    });
  });

  it('should call onChange when tool selected', () => {
    const onChange = jest.fn();
    render(<ToolSelector value="auto" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('搜索'));

    expect(onChange).toHaveBeenCalledWith('search');
  });

  it('should support keyboard shortcuts', () => {
    const onChange = jest.fn();
    renderHook(() => useToolShortcuts(onChange));

    fireEvent.keyDown(window, { key: 's', metaKey: true });

    expect(onChange).toHaveBeenCalledWith('search');
  });
});
```

### 快照撤销测试

```typescript
// tests/snapshot.service.test.ts

describe("SnapshotService", () => {
  it("should create and restore snapshot", async () => {
    const service = new SnapshotService(mockDb);

    // 创建快照
    const snapshotId = await service.createSnapshot(
      "user-1",
      "move",
      "op-1",
      mockBookmarks,
    );

    // 模拟操作
    await moveBookmarks(mockBookmarks, "new-folder");

    // 撤销操作
    await service.undoOperation(snapshotId);

    // 验证状态恢复
    const restored = await getBookmarks(mockBookmarks.map((b) => b.id));
    restored.forEach((b, i) => {
      expect(b.folderId).toBe(mockBookmarks[i].folderId);
    });
  });

  it("should reject expired snapshot", async () => {
    const service = new SnapshotService(mockDb);

    // 创建过期快照
    const snapshotId = await createExpiredSnapshot();

    await expect(service.undoOperation(snapshotId)).rejects.toThrow(
      "Snapshot has expired",
    );
  });
});
```

---

## 参考资料

1. [OpenAI Apps SDK - Build ChatGPT UI](https://developers.openai.com/apps-sdk/build/chatgpt-ui/)
2. [LangUI - Tailwind Components for AI](https://github.com/LangbaseInc/langui)
3. [AWS Cloudscape - Generative AI Chat Pattern](https://cloudscape.design/patterns/genai/generative-AI-chat/)
4. [Vercel AI SDK - Message Component](https://ai-sdk.dev/elements/components/message)
5. [Shape of AI - UX Patterns](https://www.shapeof.ai)
6. [Smashing Magazine - Design Patterns for AI Interfaces](https://www.smashingmagazine.com/2025/07/design-patterns-ai-interfaces/)
7. [Event Sourcing - Microservices.io](https://microservices.io/patterns/data/event-sourcing.html)
8. [Undo/Redo with Event Sourcing](https://ericjinks.com/blog/2025/event-sourcing/)
9. [Snapshots in Event Sourcing](https://www.kurrent.io/blog/snapshots-in-event-sourcing)
10. [ts-event-core - TypeScript Event Sourcing](https://github.com/Sam152/ts-event-core)
11. [Shape of AI - Citations Pattern](https://www.shapeof.ai/patterns/citations)
