# 双模式智能体系统 - 前端开发方案 (V4.0)

## 文档信息

| 属性         | 值                           |
| ------------ | ---------------------------- |
| **版本**     | V4.0                         |
| **创建日期** | 2026-02-02                   |
| **关联文档** | implementation-guide-V4.0.md |

---

## 目录

1. [变更概览](#1-变更概览)
2. [新增组件清单](#2-新增组件清单)
3. [修改组件清单](#3-修改组件清单)
4. [页面集成方案](#4-页面集成方案)
5. [组件详细设计](#5-组件详细设计)
6. [状态管理方案](#6-状态管理方案)
7. [路由与导航](#7-路由与导航)
8. [响应式设计](#8-响应式设计)
9. [开发优先级](#9-开发优先级)

---

## 1. 变更概览

### 1.1 变更类型统计

| 类型           | 数量  | 说明                     |
| -------------- | ----- | ------------------------ |
| **新增组件**   | 12 个 | 全新创建的 UI 组件       |
| **新增 Hooks** | 5 个  | 状态管理和逻辑复用       |
| **修改页面**   | 3 个  | 需要集成新功能的现有页面 |
| **修改组件**   | 4 个  | 需要适配的现有组件       |

### 1.2 架构变更图

```
┌─────────────────────────────────────────────────────────────────┐
│                         页面层                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  首页 (/)   │  │ 收藏夹页面  │  │  搜索页面   │              │
│  │  [修改]     │  │   [修改]    │  │   [修改]    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       容器组件层                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              BookmarkListContainer [修改]                │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │  │ ActionBar   │  │SelectionBar │  │ FABContainer│      │    │
│  │  │   [新增]    │  │  [修改]     │  │   [新增]    │      │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       功能组件层                                 │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │PredictionButton│ │PredictionSheet│ │ExecutionStatus│          │
│  │    [新增]      │ │    [新增]     │ │    [新增]     │          │
│  └───────────────┘ └───────────────┘ └───────────────┘          │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │   UndoToast   │ │CommandPalette │ │BatteryIndicator│         │
│  │    [新增]     │ │    [新增]     │ │    [新增]      │         │
│  └───────────────┘ └───────────────┘ └───────────────┘          │
│  ┌───────────────┐ ┌───────────────┐                            │
│  │QuotaExhausted │ │DeleteConfirm  │                            │
│  │   Dialog      │ │   Dialog      │                            │
│  │    [新增]     │ │    [新增]     │                            │
│  └───────────────┘ └───────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       基础组件层                                 │
│  ┌────────��──────┐ ┌───────────────┐ ┌───────────────┐          │
│  │FloatingAction │ │  ProgressBar  │ │HighlightWrapper│         │
│  │   Button      │ │    [新增]     │ │    [新增]      │         │
│  │    [新增]     │ └───────────────┘ └───────────────┘          │
│  └───────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 新增组件清单

### 2.1 基础 UI 组件

| 组件名                 | 路径                                           | 用途           | 复杂度 |
| ---------------------- | ---------------------------------------------- | -------------- | ------ |
| `FloatingActionButton` | `src/components/ui/floating-action-button.tsx` | 移动端悬浮按钮 | 低     |
| `ProgressBar`          | `src/components/ui/progress-bar.tsx`           | 操作进度条     | 低     |
| `HighlightWrapper`     | `src/components/ui/highlight-wrapper.tsx`      | 高亮效果容器   | 低     |

### 2.2 业务组件 (fluid-agent)

| 组件名                 | 路径                                                           | 用途           | 复杂度 |
| ---------------------- | -------------------------------------------------------------- | -------------- | ------ |
| `PredictionButton`     | `src/lib/fluid-agent/ui/components/prediction-button.tsx`      | 智能推荐按钮   | 低     |
| `PredictionSheet`      | `src/lib/fluid-agent/ui/components/prediction-sheet.tsx`       | 移动端推荐列表 | 中     |
| `ExecutionStatus`      | `src/lib/fluid-agent/ui/components/execution-status.tsx`       | 操作执行状态栏 | 中     |
| `UndoToast`            | `src/lib/fluid-agent/ui/components/undo-toast.tsx`             | 撤销通知       | 低     |
| `BatteryIndicator`     | `src/lib/fluid-agent/ui/components/battery-indicator.tsx`      | 配额电池图标   | 低     |
| `QuotaExhaustedDialog` | `src/lib/fluid-agent/ui/components/quota-exhausted-dialog.tsx` | 配额耗尽弹窗   | 中     |
| `DeleteConfirmDialog`  | `src/lib/fluid-agent/ui/components/delete-confirm-dialog.tsx`  | 删除确认弹窗   | 低     |
| `CommandPalette`       | `src/lib/fluid-agent/ui/components/command-palette.tsx`        | Cmd+K 指令框   | 高     |

### 2.3 容器组件

| 组件名         | 路径                                        | 用途             | 复杂度 |
| -------------- | ------------------------------------------- | ---------------- | ------ |
| `ActionBar`    | `src/components/bookmark/action-bar.tsx`    | 桌面端操作工具栏 | 中     |
| `FABContainer` | `src/components/bookmark/fab-container.tsx` | 移动端 FAB 容器  | 中     |

### 2.4 Hooks

| Hook 名             | 路径                                                  | 用途          |
| ------------------- | ----------------------------------------------------- | ------------- |
| `usePrediction`     | `src/lib/fluid-agent/ui/hooks/use-prediction.ts`      | 获取智能推荐  |
| `useAgentHighlight` | `src/lib/fluid-agent/ui/hooks/use-agent-highlight.ts` | 高亮状态管理  |
| `useBattery`        | `src/lib/fluid-agent/ui/hooks/use-battery.ts`         | 配额状态���理 |
| `useReduceMotion`   | `src/lib/fluid-agent/ui/hooks/use-reduce-motion.ts`   | 动效偏好      |
| `useCommandPalette` | `src/lib/fluid-agent/ui/hooks/use-command-palette.ts` | 指令框控制    |

---

## 3. 修改组件清单

### 3.1 需要修改的页面

| 页面       | 路径                                   | 修改内容                            |
| ---------- | -------------------------------------- | ----------------------------------- |
| 首页       | `src/app/(main)/page.tsx`              | 集成 ActionBar、FAB、CommandPalette |
| 收藏夹页面 | `src/app/(main)/folders/[id]/page.tsx` | 集成 ActionBar、FAB                 |
| 搜索页面   | `src/app/(main)/search/page.tsx`       | 集成 ActionBar                      |

### 3.2 需要修改的组件

| 组件           | 路径                                        | 修改内容                              |
| -------------- | ------------------------------------------- | ------------------------------------- |
| `BookmarkItem` | `src/components/bookmark/bookmark-item.tsx` | 添加高亮支持                          |
| `BookmarkList` | `src/components/bookmark/bookmark-list.tsx` | 集成选择状态、高亮                    |
| `SelectionBar` | `src/components/bookmark/selection-bar.tsx` | 添加 PredictionButton                 |
| `Layout`       | `src/components/layout/main-layout.tsx`     | 添加 BatteryIndicator、CommandPalette |

---

## 4. 页面集成方案

### 4.1 首页集成

**文件**: `src/app/(main)/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { BookmarkList } from "@/components/bookmark/bookmark-list";
import { ActionBar } from "@/components/bookmark/action-bar";
import { FABContainer } from "@/components/bookmark/fab-container";
import { ExecutionStatus } from "@/lib/fluid-agent/ui/components/execution-status";
import { usePrediction } from "@/lib/fluid-agent/ui/hooks/use-prediction";
import { useMediaQuery } from "@/hooks/use-media-query";

export default function HomePage() {
  const [selectedBookmarks, setSelectedBookmarks] = useState<Bookmark[]>([]);
  const [activeOperationId, setActiveOperationId] = useState<string | null>(
    null,
  );

  const { predictions } = usePrediction(selectedBookmarks);
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <div className="relative min-h-screen">
      {/* 书签列表 */}
      <BookmarkList
        selectedBookmarks={selectedBookmarks}
        onSelectionChange={setSelectedBookmarks}
      />

      {/* 桌面端: ActionBar */}
      {!isMobile && selectedBookmarks.length > 0 && (
        <ActionBar
          selection={selectedBookmarks}
          predictions={predictions}
          onClearSelection={() => setSelectedBookmarks([])}
          onOperationStart={setActiveOperationId}
        />
      )}

      {/* 移动端: FAB */}
      {isMobile && (
        <FABContainer
          selection={selectedBookmarks}
          predictions={predictions}
          onOperationStart={setActiveOperationId}
        />
      )}

      {/* 执行状态栏 */}
      {activeOperationId && (
        <ExecutionStatus
          operationId={activeOperationId}
          onCancel={() => setActiveOperationId(null)}
        />
      )}
    </div>
  );
}
```

### 4.2 主布局集成

**文件**: `src/components/layout/main-layout.tsx`

```tsx
"use client";

import { BatteryIndicator } from "@/lib/fluid-agent/ui/components/battery-indicator";
import { CommandPalette } from "@/lib/fluid-agent/ui/components/command-palette";
import { Toaster } from "sonner";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-4">
            {/* 电池指示器 */}
            <BatteryIndicator />
            <UserMenu />
          </nav>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="container py-6">{children}</main>

      {/* 全局组件 */}
      <CommandPalette />
      <Toaster position="bottom-right" />
    </div>
  );
}
```

---

## 5. 组件详细设计

### 5.1 FloatingActionButton

**路径**: `src/components/ui/floating-action-button.tsx`

```tsx
"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label?: string;
  badge?: number;
  position?: "bottom-right" | "bottom-center";
  elevated?: boolean;
}

export const FloatingActionButton = forwardRef<
  HTMLButtonElement,
  FloatingActionButtonProps
>(
  (
    {
      icon,
      label,
      badge,
      position = "bottom-right",
      elevated = false,
      className,
      ...props
    },
    ref,
  ) => {
    const positionClasses = {
      "bottom-right": "right-4 bottom-4",
      "bottom-center": "left-1/2 -translate-x-1/2 bottom-4",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "fixed z-50",
          "flex items-center justify-center",
          "min-w-14 h-14 px-4",
          "rounded-full shadow-lg",
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90",
          "transition-all duration-200",
          elevated && "translate-y-[-60px]",
          positionClasses[position],
          className,
        )}
        {...props}
      >
        {/* 图标 */}
        <span className="text-xl">{icon}</span>

        {/* 可选标签 */}
        {label && <span className="ml-2 text-sm font-medium">{label}</span>}

        {/* 徽章 */}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>
    );
  },
);

FloatingActionButton.displayName = "FloatingActionButton";
```

**Props**:

| Prop       | 类型                                | 默认值           | 说明                     |
| ---------- | ----------------------------------- | ---------------- | ------------------------ |
| `icon`     | `ReactNode`                         | -                | 按钮图标                 |
| `label`    | `string`                            | -                | 可选文本标签             |
| `badge`    | `number`                            | -                | 右上角徽章数字           |
| `position` | `'bottom-right' \| 'bottom-center'` | `'bottom-right'` | 位置                     |
| `elevated` | `boolean`                           | `false`          | 是否上移（状态栏显示时） |

---

### 5.2 ActionBar

**路径**: `src/components/bookmark/action-bar.tsx`

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, FolderInput, Tags, X } from "lucide-react";
import { PredictionButton } from "@/lib/fluid-agent/ui/components/prediction-button";
import { DeleteConfirmDialog } from "@/lib/fluid-agent/ui/components/delete-confirm-dialog";
import type { Bookmark } from "@/types/bookmark";
import type { PredictionResult } from "@/lib/fluid-agent/types";

interface ActionBarProps {
  selection: Bookmark[];
  predictions: PredictionResult[];
  onClearSelection: () => void;
  onOperationStart: (operationId: string) => void;
  onDelete?: (bookmarkIds: string[]) => void;
  onMove?: (bookmarkIds: string[]) => void;
  onTag?: (bookmarkIds: string[]) => void;
}

export function ActionBar({
  selection,
  predictions,
  onClearSelection,
  onOperationStart,
  onDelete,
  onMove,
  onTag,
}: ActionBarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePredictionClick = async (prediction: PredictionResult) => {
    setLoading(true);
    try {
      // 执行操作...
      // const result = await operationExecutor.execute(...)
      // onOperationStart(result.operationId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur animate-in slide-in-from-bottom">
        <div className="container flex h-16 items-center justify-between">
          {/* 左侧: 选中计数 + 取消 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              已选择 {selection.length} 项
            </span>
            <Button variant="ghost" size="icon" onClick={onClearSelection}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 中间: 常规操作 */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMove?.(selection.map((b) => b.id))}
            >
              <FolderInput className="mr-2 h-4 w-4" />
              移动
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTag?.(selection.map((b) => b.id))}
            >
              <Tags className="mr-2 h-4 w-4" />
              标签
            </Button>
          </div>

          {/* 右侧: 智能推荐 */}
          <div className="flex items-center gap-2">
            {predictions.slice(0, 2).map((prediction) => (
              <PredictionButton
                key={prediction.ruleId}
                prediction={prediction}
                onClick={() => handlePredictionClick(prediction)}
                loading={loading}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        bookmarks={selection}
        onConfirm={() => {
          onDelete?.(selection.map((b) => b.id));
          setShowDeleteConfirm(false);
          onClearSelection();
        }}
      />
    </>
  );
}
```

---

### 5.3 FABContainer

**路径**: `src/components/bookmark/fab-container.tsx`

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { PredictionSheet } from "@/lib/fluid-agent/ui/components/prediction-sheet";
import { operationExecutor } from "@/lib/fluid-agent";
import type { Bookmark } from "@/types/bookmark";
import type { PredictionResult } from "@/lib/fluid-agent/types";

interface FABContainerProps {
  selection: Bookmark[];
  predictions: PredictionResult[];
  onOperationStart: (operationId: string) => void;
}

export function FABContainer({
  selection,
  predictions,
  onOperationStart,
}: FABContainerProps) {
  const [showSheet, setShowSheet] = useState(false);
  const hasSelection = selection.length > 0;
  const hasPredictions = predictions.length > 0;
  const showMagicMode = hasSelection && hasPredictions;

  // 检查是否有活跃操作（用于上移 FAB）
  const hasActiveOperation = operationExecutor.hasActiveOperation();

  const handleFABClick = () => {
    if (showMagicMode) {
      setShowSheet(true);
    } else {
      // 默认行为: 添加新书签
      // router.push('/add');
    }
  };

  const handleSelectPrediction = async (prediction: PredictionResult) => {
    setShowSheet(false);
    const result = await operationExecutor.execute(
      prediction.action,
      selection,
      prediction.params,
    );
    onOperationStart(result.operationId);
  };

  return (
    <>
      <FloatingActionButton
        icon={showMagicMode ? "✨" : <Plus className="h-6 w-6" />}
        label={showMagicMode ? `${predictions.length}` : undefined}
        onClick={handleFABClick}
        elevated={hasActiveOperation}
        className={
          showMagicMode ? "bg-gradient-to-r from-purple-500 to-blue-500" : ""
        }
      />

      <PredictionSheet
        open={showSheet}
        onOpenChange={setShowSheet}
        predictions={predictions}
        onSelect={handleSelectPrediction}
      />
    </>
  );
}
```

---

### 5.4 PredictionSheet

**路径**: `src/lib/fluid-agent/ui/components/prediction-sheet.tsx`

```tsx
"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import type { PredictionResult } from "../../types";

interface PredictionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  predictions: PredictionResult[];
  onSelect: (prediction: PredictionResult) => void;
}

export function PredictionSheet({
  open,
  onOpenChange,
  predictions,
  onSelect,
}: PredictionSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const displayCount = expanded ? predictions.length : 3;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>✨</span>
            <span>智能推荐</span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {predictions.slice(0, displayCount).map((prediction) => (
            <button
              key={prediction.ruleId}
              className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-muted transition-colors"
              onClick={() => onSelect(prediction)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{prediction.icon}</span>
                <div className="text-left">
                  <div className="font-medium">{prediction.label}</div>
                  <div className="text-sm text-muted-foreground">
                    将影响 {prediction.affectedCount} 项
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  置信度 {prediction.confidence}%
                </span>
              </div>
            </button>
          ))}
        </div>

        {predictions.length > 3 && !expanded && (
          <Button
            variant="ghost"
            className="w-full mt-4"
            onClick={() => setExpanded(true)}
          >
            <ChevronDown className="mr-2 h-4 w-4" />
            展开更多推荐 ({predictions.length - 3})
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

---

### 5.5 CommandPalette

**路径**: `src/lib/fluid-agent/ui/components/command-palette.tsx`

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { commandMatcher } from "../../commands/command-matcher";
import type { PresetCommand } from "../../types";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [commands, setCommands] = useState<PresetCommand[]>([]);

  // 监听快捷键
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // 搜索命令
  useEffect(() => {
    if (search) {
      const matched = commandMatcher.match(search);
      setCommands(matched);
    } else {
      setCommands(commandMatcher.getAll());
    }
  }, [search]);

  const handleSelect = useCallback(async (command: PresetCommand) => {
    setOpen(false);
    setSearch("");
    await commandMatcher.execute(command.id);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="输入命令..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>未找到匹配的命令</CommandEmpty>
        <CommandGroup heading="快捷命令">
          {commands.map((command) => (
            <CommandItem
              key={command.id}
              value={command.id}
              onSelect={() => handleSelect(command)}
            >
              <span className="mr-3 text-xl">{command.icon}</span>
              <div className="flex flex-col">
                <span>{command.name}</span>
                <span className="text-xs text-muted-foreground">
                  {command.description}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

---

### 5.6 QuotaExhaustedDialog

**路径**: `src/lib/fluid-agent/ui/components/quota-exhausted-dialog.tsx`

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, Clock } from "lucide-react";
import { useBattery } from "../hooks/use-battery";

interface QuotaExhaustedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade?: () => void;
}

export function QuotaExhaustedDialog({
  open,
  onOpenChange,
  onUpgrade,
}: QuotaExhaustedDialogProps) {
  const { resetAt } = useBattery();

  const formatResetTime = () => {
    const now = new Date();
    const diff = resetAt.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}小时${minutes}分钟`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            今日智能推荐次数已用完
          </DialogTitle>
          <DialogDescription>
            您今日的 5 次智能推荐已全部使用。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatResetTime()}后重置</span>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm">升级 Pro 版可解锁：</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>✓ 无限次智能推荐</li>
              <li>✓ 高级 AI 分析功能</li>
              <li>✓ 更大存储空间</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            明天再试
          </Button>
          <Button onClick={onUpgrade} className="w-full sm:w-auto">
            升级 Pro 版
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 5.7 DeleteConfirmDialog

**路径**: `src/lib/fluid-agent/ui/components/delete-confirm-dialog.tsx`

```tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Bookmark } from "@/types/bookmark";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarks: Bookmark[];
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  bookmarks,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            ⚠️ 确认删除
          </AlertDialogTitle>
          <AlertDialogDescription>
            即将删除 {bookmarks.length} 个书签：
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ScrollArea className="max-h-[200px] rounded-md border p-4">
          <ul className="space-y-2">
            {bookmarks.slice(0, 10).map((bookmark) => (
              <li key={bookmark.id} className="flex items-center gap-2 text-sm">
                <span>📄</span>
                <span className="truncate">{bookmark.title}</span>
              </li>
            ))}
            {bookmarks.length > 10 && (
              <li className="text-sm text-muted-foreground">
                ... 还有 {bookmarks.length - 10} 项
              </li>
            )}
          </ul>
        </ScrollArea>

        <p className="text-sm text-muted-foreground">
          删除后可在 30 天内从回收站恢复。
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

### 5.8 HighlightWrapper

**路径**: `src/components/ui/highlight-wrapper.tsx`

```tsx
"use client";

import { cn } from "@/lib/utils";
import { useAgentHighlight } from "@/lib/fluid-agent/ui/hooks/use-agent-highlight";

interface HighlightWrapperProps {
  entityId: string;
  children: React.ReactNode;
  className?: string;
}

export function HighlightWrapper({
  entityId,
  children,
  className,
}: HighlightWrapperProps) {
  const { highlightClassName } = useAgentHighlight(entityId);

  return (
    <div
      className={cn(
        "transition-all duration-300",
        highlightClassName,
        className,
      )}
    >
      {children}
    </div>
  );
}
```

---

## 6. 状态管理方案

### 6.1 状态架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        全局状态                                  │
│  ┌──────────────���──┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  HighlightStore │  │  BatteryState   │  │CommandPalette   │  │
│  │    (Zustand)    │  │ (React Query)   │  │   State         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        页面状态                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   SelectionContext                       │    │
│  │  - selectedBookmarks: Bookmark[]                         │    │
│  │  - setSelectedBookmarks: (bookmarks) => void            │    │
│  │  - clearSelection: () => void                            │    │
│  │  - toggleSelection: (bookmark) => void                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   OperationContext                       │    │
│  │  - activeOperationId: string | null                      │    │
│  │  - setActiveOperationId: (id) => void                    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 SelectionContext

**路径**: `src/contexts/selection-context.tsx`

```tsx
"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { Bookmark } from "@/types/bookmark";

interface SelectionContextType {
  selectedBookmarks: Bookmark[];
  setSelectedBookmarks: (bookmarks: Bookmark[]) => void;
  clearSelection: () => void;
  toggleSelection: (bookmark: Bookmark) => void;
  isSelected: (bookmarkId: string) => boolean;
  selectRange: (
    startId: string,
    endId: string,
    allBookmarks: Bookmark[],
  ) => void;
}

const SelectionContext = createContext<SelectionContextType | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedBookmarks, setSelectedBookmarks] = useState<Bookmark[]>([]);

  const clearSelection = useCallback(() => {
    setSelectedBookmarks([]);
  }, []);

  const toggleSelection = useCallback((bookmark: Bookmark) => {
    setSelectedBookmarks((prev) => {
      const isSelected = prev.some((b) => b.id === bookmark.id);
      if (isSelected) {
        return prev.filter((b) => b.id !== bookmark.id);
      }
      return [...prev, bookmark];
    });
  }, []);

  const isSelected = useCallback(
    (bookmarkId: string) => {
      return selectedBookmarks.some((b) => b.id === bookmarkId);
    },
    [selectedBookmarks],
  );

  const selectRange = useCallback(
    (startId: string, endId: string, allBookmarks: Bookmark[]) => {
      const startIndex = allBookmarks.findIndex((b) => b.id === startId);
      const endIndex = allBookmarks.findIndex((b) => b.id === endId);

      if (startIndex === -1 || endIndex === -1) return;

      const [from, to] =
        startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

      const range = allBookmarks.slice(from, to + 1);
      setSelectedBookmarks((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        const newBookmarks = range.filter((b) => !existingIds.has(b.id));
        return [...prev, ...newBookmarks];
      });
    },
    [],
  );

  return (
    <SelectionContext.Provider
      value={{
        selectedBookmarks,
        setSelectedBookmarks,
        clearSelection,
        toggleSelection,
        isSelected,
        selectRange,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within SelectionProvider");
  }
  return context;
}
```

---

## 7. 路由与导航

### 7.1 无需新增路由

本方案不需要新增页面路由，所有功能通过组件集成到现有页面。

### 7.2 快捷键导航

| 快捷键          | 功能                | 实现组件         |
| --------------- | ------------------- | ---------------- |
| `Cmd/Ctrl + K`  | 打开指令框          | `CommandPalette` |
| `Escape`        | 关闭指令框/取消选择 | 各组件内部       |
| `Cmd/Ctrl + A`  | 全选                | `BookmarkList`   |
| `Shift + Click` | 范围选择            | `BookmarkList`   |

---

## 8. 响应式设计

### 8.1 断点定义

| 断点 | 宽度   | 适用设备 |
| ---- | ------ | -------- |
| `sm` | 640px  | 手机横屏 |
| `md` | 768px  | 平板竖屏 |
| `lg` | 1024px | 平板横屏 |
| `xl` | 1280px | 桌面     |

### 8.2 组件响应式行为

| 组件               | 移动端 (<768px) | 桌面端 (≥768px) |
| ------------------ | --------------- | --------------- |
| `ActionBar`        | 隐藏            | 底部固定显示    |
| `FAB`              | 显示            | 隐藏            |
| `PredictionSheet`  | Bottom Sheet    | 不使用          |
| `PredictionButton` | 在 Sheet 中     | 在 ActionBar 中 |
| `CommandPalette`   | 全屏            | 居中弹窗        |
| `ExecutionStatus`  | 底部全宽        | 底部居中卡片    |

### 8.3 useMediaQuery Hook

```tsx
// src/hooks/use-media-query.ts
import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

// 便捷 Hooks
export function useIsMobile() {
  return useMediaQuery("(max-width: 767px)");
}

export function useIsTablet() {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

export function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}
```

---

## 9. 开发优先级

### 9.1 Phase 1: 基础组件 (Day 1-2)

| 优先级 | 组件                   | 依赖                |
| ------ | ---------------------- | ------------------- |
| P0     | `FloatingActionButton` | 无                  |
| P0     | `HighlightWrapper`     | `useAgentHighlight` |
| P0     | `PredictionButton`     | 无                  |
| P0     | `SelectionContext`     | 无                  |

### 9.2 Phase 2: 容器组件 (Day 3-4)

| 优先级 | 组件              | 依赖                                      |
| ------ | ----------------- | ----------------------------------------- |
| P0     | `ActionBar`       | `PredictionButton`                        |
| P0     | `FABContainer`    | `FloatingActionButton`, `PredictionSheet` |
| P0     | `PredictionSheet` | `PredictionButton`                        |
| P0     | `ExecutionStatus` | `OperationExecutor`                       |

### 9.3 Phase 3: 对话框组件 (Day 5)

| 优先级 | 组件                   | 依赖              |
| ------ | ---------------------- | ----------------- |
| P0     | `DeleteConfirmDialog`  | 无                |
| P1     | `QuotaExhaustedDialog` | `useBattery`      |
| P1     | `UndoToast`            | `SnapshotManager` |
| P1     | `BatteryIndicator`     | `useBattery`      |

### 9.4 Phase 4: 指令框 (Day 6)

| 优先级 | 组件             | 依赖             |
| ------ | ---------------- | ---------------- |
| P1     | `CommandPalette` | `CommandMatcher` |

### 9.5 Phase 5: 页面集成 (Day 7-8)

| 优先级 | 任务                | 说明                                  |
| ------ | ------------------- | ------------------------------------- |
| P0     | 修改 `BookmarkItem` | 添加高亮支持                          |
| P0     | 修改 `BookmarkList` | ���成选择逻辑                         |
| P0     | 修改首页            | 集成 ActionBar/FAB                    |
| P1     | 修改主布局          | 添加 BatteryIndicator、CommandPalette |

---

## 附录

### A. 组件文件清单

```
src/
├── components/
│   ├── ui/
│   │   ├── floating-action-button.tsx    [新增]
│   │   ├── progress-bar.tsx              [新增]
│   │   └── highlight-wrapper.tsx         [新增]
│   └── bookmark/
│       ├── action-bar.tsx                [新增]
│       ├── fab-container.tsx             [新增]
│       ├── bookmark-item.tsx             [修改]
│       ├── bookmark-list.tsx             [修改]
│       └── selection-bar.tsx             [修改]
├── contexts/
│   └── selection-context.tsx             [新增]
├── hooks/
│   └── use-media-query.ts                [新增]
└── lib/fluid-agent/ui/
    ├── hooks/
    │   ├── use-prediction.ts             [新增]
    │   ├── use-agent-highlight.ts        [新增]
    │   ├── use-battery.ts                [新增]
    │   ├── use-reduce-motion.ts          [新增]
    │   └── use-command-palette.ts        [新增]
    └── components/
        ├── prediction-button.tsx         [新增]
        ├── prediction-sheet.tsx          [新增]
        ├── execution-status.tsx          [新增]
        ├── undo-toast.tsx                [新增]
        ├── battery-indicator.tsx         [新增]
        ├── quota-exhausted-dialog.tsx    [新增]
        ├── delete-confirm-dialog.tsx     [新增]
        └── command-palette.tsx           [新增]
```

### B. 依赖关系图

```
CommandPalette ─────────────────────────────────────────────────┐
                                                                │
BatteryIndicator ─► useBattery                                  │
       │                                                        │
       ▼                                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                         MainLayout                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           HomePage                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    SelectionContext                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      │
│  │BookmarkList │      │  ActionBar  │      │FABContainer │      │
│  │  (修改)     │      │   (新增)    │      │   (新增)    │      │
│  └──────┬──────┘      └──────┬──────┘      └──────┬──────┘      │
│         │                    │                    │             ���
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      │
│  │BookmarkItem │      │Prediction   │      │Prediction   │      │
│  │HighlightWrap│      │   Button    │      │   Sheet     │      │
│  └─────────────┘      └─────────────┘      └─────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ExecutionStatus  │
                    │   UndoToast     │
                    └─────────────────┘
```

### C. 样式 Token

```css
/* 智能推荐渐变 */
.prediction-gradient {
  background: linear-gradient(
    to right,
    rgb(168 85 247 / 0.1),
    rgb(59 130 246 / 0.1)
  );
}

.prediction-gradient:hover {
  background: linear-gradient(
    to right,
    rgb(168 85 247 / 0.2),
    rgb(59 130 246 / 0.2)
  );
}

/* 高亮效果 */
.highlight-processing {
  @apply ring-2 ring-blue-400 ring-opacity-75 animate-pulse;
}

.highlight-completed {
  @apply ring-2 ring-green-400 ring-opacity-75;
}

/* FAB 上移动画 */
.fab-elevated {
  transform: translateY(-60px);
  transition: transform 0.2s ease-out;
}
```
