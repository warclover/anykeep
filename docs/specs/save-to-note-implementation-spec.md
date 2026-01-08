# Save to Note 功能实现规范

> 生成时间: 2025-01-08
> 版本: v2.1
> 状态: 待开发

---

## 一、功能概述

### 1.1 核心需求

在 AI 助手输出内容后，增加保存按钮（位于复制按钮旁边），用户点击后自动将内容保存为 MD 收藏。

### 1.2 设计原则

1. **零摩擦保存**：一键保存，无需选择文件夹，AI 自动生成标题
2. **不干扰原则**：成功提示轻量化（Toast），不弹窗阻断
3. **高频优化**：标题生成异步预取，乐观更新
4. **Skills 化**：AI 可以通过对话指令完成保存

### 1.3 保存位置

统一保存到「AI 生成」系统文件夹（自动创建，不可删除）

### 1.4 标题生成

AI 生成标题 + 日期时间，格式：`{AI标题} - 2025.01.08`

### 1.5 重复检测

检测到重复时提示，但允许用户选择仍然保存

---

## 二、需要保存功能的位置

| 序号 | 位置           | 组件文件                                                    | 优先级 |
| ---- | -------------- | ----------------------------------------------------------- | ------ |
| 1    | AI 对话消息    | `src/components/ai/phase4/quick-actions.tsx`                | P0     |
| 2    | 交付物卡片     | `src/components/ai/ai-deliverable-card.tsx`                 | P0     |
| 3    | 主题合成详情页 | `src/components/synthesis/synthesis-detail-page-client.tsx` | P1     |

---

## 三、数据库变更

### 3.1 迁移文件 1: 系统文件夹支持

```sql
-- 文件: supabase/migrations/20250108001_add_system_folder_support.sql

-- 添加系统文件夹字段
ALTER TABLE md_folders
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS system_type VARCHAR(50);

-- 系统文件夹不可删除触发器
CREATE OR REPLACE FUNCTION prevent_system_folder_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_system = TRUE THEN
    RAISE EXCEPTION 'Cannot delete system folder';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_prevent_system_folder_delete ON md_folders;
CREATE TRIGGER tr_prevent_system_folder_delete
BEFORE DELETE ON md_folders
FOR EACH ROW EXECUTE FUNCTION prevent_system_folder_delete();
```

### 3.2 迁移文件 2: 扩展 source_type

```sql
-- 文件: supabase/migrations/20250108002_extend_md_source_type.sql

-- 添加 source_metadata 字段
ALTER TABLE md_collections
ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT NULL;

-- 更新 source_type 检查约束（如果使用 CHECK 约束）
-- 如果使用枚举类型，需要添加新值
DO $$
BEGIN
  -- 尝试添加新的枚举值（如果是枚举类型）
  ALTER TYPE md_source_type ADD VALUE IF NOT EXISTS 'ai_response';
  ALTER TYPE md_source_type ADD VALUE IF NOT EXISTS 'deliverable';
  ALTER TYPE md_source_type ADD VALUE IF NOT EXISTS 'synthesis';
  ALTER TYPE md_source_type ADD VALUE IF NOT EXISTS 'report';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;  -- 如果不是枚举类型
END $$;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_md_collections_source_type
ON md_collections(source_type) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_md_collections_folder_id
ON md_collections(folder_id) WHERE deleted_at IS NULL;
```

### 3.3 迁移文件 3: 保存历史表

```sql
-- 文件: supabase/migrations/20250108003_create_note_save_history.sql

CREATE TABLE IF NOT EXISTS note_save_history (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id INTEGER NOT NULL REFERENCES md_collections(id) ON DELETE CASCADE,

  -- 来源信息
  source_type VARCHAR(50) NOT NULL,
  source_id VARCHAR(100),
  source_conversation_id VARCHAR(100),

  -- 元数据
  content_hash VARCHAR(64),
  generated_title VARCHAR(200),
  is_duplicate_save BOOLEAN DEFAULT FALSE,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_note_save_history_user_id ON note_save_history(user_id);
CREATE INDEX idx_note_save_history_note_id ON note_save_history(note_id);
CREATE INDEX idx_note_save_history_created_at ON note_save_history(created_at DESC);

-- RLS
ALTER TABLE note_save_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own save history"
ON note_save_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own save history"
ON note_save_history FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

---

## 四、新增文件清单

### 4.1 UI 组件

#### 文件: `src/components/shared/save-to-note/index.ts`

```typescript
export { SaveToNoteButton } from "./save-to-note-button";
export { SaveToNoteDialog } from "./save-to-note-dialog";
export { SaveSuccessToast } from "./save-success-toast";
export { DuplicateWarningPopover } from "./duplicate-warning-popover";
export type * from "./types";
```

#### 文件: `src/components/shared/save-to-note/types.ts`

```typescript
export type SaveSourceType =
  | "ai_response"
  | "deliverable"
  | "synthesis"
  | "report";

export interface SaveToNotePayload {
  content: string;
  sourceType: SaveSourceType;
  sourceId?: string;
  sourceConversationId?: string;
  customTitle?: string;
  skipDuplicateCheck?: boolean;
}

export interface SavedNoteInfo {
  id: number;
  title: string;
  viewUrl: string;
  folderName: string;
}

export interface DuplicateInfo {
  id: number;
  title: string;
  savedAt: string;
}

export type SaveButtonState =
  | "idle"
  | "checking"
  | "generating"
  | "saving"
  | "success"
  | "error";
```

#### 文件: `src/components/shared/save-to-note/save-to-note-button.tsx`

```typescript
'use client'

import * as React from 'react'
import { Save, Check, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSaveToNote } from '@/hooks/use-save-to-note'
import { DuplicateWarningPopover } from './duplicate-warning-popover'
import { SaveSuccessToast } from './save-success-toast'
import { toast } from 'sonner'
import type { SaveSourceType, SaveButtonState } from './types'
import { cn } from '@/lib/utils'

interface SaveToNoteButtonProps {
  content: string
  sourceType: SaveSourceType
  sourceId?: string
  sourceConversationId?: string
  className?: string
  onSaveSuccess?: (noteId: number, noteTitle: string) => void
  onSaveError?: (error: Error) => void
}

const buttonStates: Record<SaveButtonState, {
  icon: React.ElementType
  text: string
  className: string
  iconClassName?: string
}> = {
  idle: {
    icon: Save,
    text: '保存',
    className: 'text-muted-foreground hover:text-foreground'
  },
  checking: {
    icon: Loader2,
    text: '检查中',
    className: 'text-muted-foreground',
    iconClassName: 'animate-spin'
  },
  generating: {
    icon: Loader2,
    text: '生成标题',
    className: 'text-primary',
    iconClassName: 'animate-spin'
  },
  saving: {
    icon: Loader2,
    text: '保存中',
    className: 'text-primary',
    iconClassName: 'animate-spin'
  },
  success: {
    icon: Check,
    text: '已保存',
    className: 'text-green-500'
  },
  error: {
    icon: AlertCircle,
    text: '失败',
    className: 'text-destructive'
  }
}

export function SaveToNoteButton({
  content,
  sourceType,
  sourceId,
  sourceConversationId,
  className,
  onSaveSuccess,
  onSaveError
}: SaveToNoteButtonProps) {
  const {
    state,
    duplicateInfo,
    savedNote,
    save,
    saveAnyway,
    reset
  } = useSaveToNote({
    onSuccess: (noteId, noteTitle) => {
      // 显示成功 Toast
      toast.custom((t) => (
        <SaveSuccessToast
          noteId={noteId}
          noteTitle={noteTitle}
          folderName="AI 生成"
          onViewNote={() => {
            window.open(`/md-collections/${noteId}`, '_blank')
            toast.dismiss(t)
          }}
        />
      ), { duration: 3000 })

      onSaveSuccess?.(noteId, noteTitle)
    },
    onError: (error) => {
      toast.error('保存失败', { description: error.message })
      onSaveError?.(error)
    }
  })

  const handleClick = async () => {
    if (state !== 'idle') return

    await save({
      content,
      sourceType,
      sourceId,
      sourceConversationId
    })
  }

  const handleSaveAnyway = async () => {
    await saveAnyway({
      content,
      sourceType,
      sourceId,
      sourceConversationId
    })
  }

  const handleViewExisting = () => {
    if (duplicateInfo) {
      window.open(`/md-collections/${duplicateInfo.id}`, '_blank')
      reset()
    }
  }

  const currentState = buttonStates[state]
  const Icon = currentState.icon

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 px-2 gap-1.5',
              currentState.className,
              className
            )}
            onClick={handleClick}
            disabled={state !== 'idle' && state !== 'error'}
          >
            <Icon className={cn('h-4 w-4', currentState.iconClassName)} />
            <span className="text-xs">{currentState.text}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>保存到我的笔记</p>
        </TooltipContent>
      </Tooltip>

      <DuplicateWarningPopover
        open={!!duplicateInfo}
        onOpenChange={(open) => !open && reset()}
        duplicateNote={duplicateInfo}
        onViewExisting={handleViewExisting}
        onSaveAnyway={handleSaveAnyway}
      />
    </>
  )
}
```

#### 文件: `src/components/shared/save-to-note/save-success-toast.tsx`

```typescript
import { Check, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SaveSuccessToastProps {
  noteId: number
  noteTitle: string
  folderName: string
  onViewNote: () => void
}

export function SaveSuccessToast({
  noteTitle,
  folderName,
  onViewNote
}: SaveSuccessToastProps) {
  return (
    <div className="flex items-start gap-3 min-w-[300px] bg-background border rounded-lg p-4 shadow-lg">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100
                      flex items-center justify-center">
        <Check className="w-4 h-4 text-green-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          已保存到「{folderName}」
        </p>
        <p className="text-sm text-muted-foreground truncate mt-0.5">
          {noteTitle}
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="flex-shrink-0 text-primary"
        onClick={onViewNote}
      >
        查看笔记
        <ArrowRight className="w-3 h-3 ml-1" />
      </Button>
    </div>
  )
}
```

#### 文件: `src/components/shared/save-to-note/duplicate-warning-popover.tsx`

```typescript
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import type { DuplicateInfo } from './types'

interface DuplicateWarningPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  duplicateNote: DuplicateInfo | null
  onViewExisting: () => void
  onSaveAnyway: () => void
}

export function DuplicateWarningPopover({
  open,
  onOpenChange,
  duplicateNote,
  onViewExisting,
  onSaveAnyway
}: DuplicateWarningPopoverProps) {
  if (!duplicateNote) return null

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span /> {/* 隐藏触发器，由父组件控制 */}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="font-medium">相似内容已存在</span>
          </div>

          <div className="p-2 bg-muted rounded-md">
            <p className="text-sm font-medium truncate">
              {duplicateNote.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              保存于 {new Date(duplicateNote.savedAt).toLocaleDateString('zh-CN')}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onViewExisting}>
              查看已有
            </Button>
            <Button size="sm" onClick={onSaveAnyway}>
              仍然保存
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

#### 文件: `src/components/shared/save-to-note/save-to-note-dialog.tsx`

```typescript
'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import type { SaveSourceType } from './types'

interface SaveToNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string
  sourceType: SaveSourceType
  suggestedTitle?: string
  onSave: (title: string) => Promise<void>
  isSaving?: boolean
}

export function SaveToNoteDialog({
  open,
  onOpenChange,
  content,
  suggestedTitle = '',
  onSave,
  isSaving = false
}: SaveToNoteDialogProps) {
  const [title, setTitle] = React.useState(suggestedTitle)

  React.useEffect(() => {
    if (open && suggestedTitle) {
      setTitle(suggestedTitle)
    }
  }, [open, suggestedTitle])

  const handleSave = async () => {
    await onSave(title)
  }

  const contentPreview = content.slice(0, 200) + (content.length > 200 ? '...' : '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>保存到我的笔记</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入笔记标题"
            />
          </div>

          <div className="space-y-2">
            <Label>保存位置</Label>
            <div className="p-2 bg-muted rounded-md text-sm">
              📁 AI 生成（默认）
            </div>
          </div>

          <div className="space-y-2">
            <Label>内容预览</Label>
            <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground max-h-[150px] overflow-y-auto">
              {contentPreview}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 4.2 Hook

#### 文件: `src/hooks/use-save-to-note.ts`

```typescript
"use client";

import * as React from "react";
import type {
  SaveToNotePayload,
  SavedNoteInfo,
  DuplicateInfo,
  SaveButtonState,
} from "@/components/shared/save-to-note/types";

interface UseSaveToNoteOptions {
  onSuccess?: (noteId: number, noteTitle: string) => void;
  onError?: (error: Error) => void;
}

interface UseSaveToNoteReturn {
  state: SaveButtonState;
  duplicateInfo: DuplicateInfo | null;
  savedNote: SavedNoteInfo | null;
  error: Error | null;
  save: (
    payload: SaveToNotePayload,
  ) => Promise<{ isDuplicate: boolean; noteId?: number; title?: string }>;
  saveAnyway: (
    payload: SaveToNotePayload,
  ) => Promise<{ noteId: number; title: string }>;
  reset: () => void;
}

export function useSaveToNote(
  options?: UseSaveToNoteOptions,
): UseSaveToNoteReturn {
  const [state, setState] = React.useState<SaveButtonState>("idle");
  const [duplicateInfo, setDuplicateInfo] =
    React.useState<DuplicateInfo | null>(null);
  const [savedNote, setSavedNote] = React.useState<SavedNoteInfo | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  const save = React.useCallback(
    async (payload: SaveToNotePayload) => {
      try {
        setState("checking");
        setError(null);

        // 1. 检查重复（如果未跳过）
        if (!payload.skipDuplicateCheck) {
          const duplicateRes = await fetch(
            "/api/md-collections/check-duplicate",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: payload.content }),
            },
          );

          const duplicateData = await duplicateRes.json();

          if (duplicateData.isDuplicate && duplicateData.existingNote) {
            setDuplicateInfo({
              id: duplicateData.existingNote.id,
              title: duplicateData.existingNote.title,
              savedAt: duplicateData.existingNote.created_at,
            });
            setState("idle");
            return { isDuplicate: true };
          }
        }

        // 2. 生成标题（如果未提供）
        setState("generating");
        let title = payload.customTitle;

        if (!title) {
          const titleRes = await fetch("/api/ai/generate-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: payload.content.slice(0, 500) }),
          });

          const titleData = await titleRes.json();
          title = titleData.title;
        }

        // 格式化标题
        const date = new Date()
          .toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
          .replace(/\//g, ".");
        const formattedTitle = `${title} - ${date}`;

        // 3. 保存到 MD 收藏
        setState("saving");
        const saveRes = await fetch("/api/md-collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawContent: payload.content,
            title: formattedTitle,
            sourceType: payload.sourceType,
            sourceMetadata: {
              sourceId: payload.sourceId,
              conversationId: payload.sourceConversationId,
            },
          }),
        });

        if (!saveRes.ok) {
          throw new Error("保存失败");
        }

        const noteData = await saveRes.json();

        // 4. 更新状态
        const savedNoteInfo: SavedNoteInfo = {
          id: noteData.id,
          title: formattedTitle,
          viewUrl: `/md-collections/${noteData.id}`,
          folderName: "AI 生成",
        };

        setSavedNote(savedNoteInfo);
        setState("success");
        options?.onSuccess?.(noteData.id, formattedTitle);

        // 5. 3秒后重置
        setTimeout(() => setState("idle"), 3000);

        return {
          isDuplicate: false,
          noteId: noteData.id,
          title: formattedTitle,
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error("保存失败");
        setError(error);
        setState("error");
        options?.onError?.(error);

        setTimeout(() => setState("idle"), 3000);
        throw error;
      }
    },
    [options],
  );

  const saveAnyway = React.useCallback(
    async (payload: SaveToNotePayload) => {
      setDuplicateInfo(null);
      const result = await save({ ...payload, skipDuplicateCheck: true });
      return { noteId: result.noteId!, title: result.title! };
    },
    [save],
  );

  const reset = React.useCallback(() => {
    setState("idle");
    setDuplicateInfo(null);
    setSavedNote(null);
    setError(null);
  }, []);

  return {
    state,
    duplicateInfo,
    savedNote,
    error,
    save,
    saveAnyway,
    reset,
  };
}
```

### 4.3 API

#### 文件: `src/app/api/ai/generate-title/route.ts`

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const TITLE_GENERATION_PROMPT = `根据以下内容生成一个简洁的中文标题。

要求：
1. 标题长度不超过 20 个字
2. 突出内容的核心主题
3. 不要使用"关于"、"浅谈"等套话
4. 如果是建议类内容，可以用"XX建议"、"XX方案"
5. 如果是总结类内容，可以用"XX要点"、"XX总结"

内容：
{content}

只输出标题，不要其他内容。`;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { content } = await request.json();

    if (!content || content.length < 10) {
      return NextResponse.json({ error: "内容过短" }, { status: 400 });
    }

    // 使用 DeepSeek 生成标题（成本低）
    const deepseek = createOpenAI({
      baseURL: process.env.DEEPSEEK_API_BASE_URL || "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });

    const { text } = await generateText({
      model: deepseek("deepseek-chat"),
      prompt: TITLE_GENERATION_PROMPT.replace(
        "{content}",
        content.slice(0, 500),
      ),
      maxTokens: 50,
      temperature: 0.3,
    });

    const title = text.trim().replace(/^["'「」]|["'「」]$/g, "");

    return NextResponse.json({ title });
  } catch (error) {
    console.error("Generate title error:", error);
    return NextResponse.json({ error: "生成标题失败" }, { status: 500 });
  }
}
```

### 4.4 AI 生成文件夹逻辑

#### 文件: `src/lib/md-collections/ensure-ai-folder.ts`

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

const AI_GENERATED_FOLDER = {
  name: "AI 生成",
  icon: "✨",
  color: "#8B5CF6",
  isSystem: true,
  systemType: "ai_generated",
};

export async function ensureAIGeneratedFolder(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  // 1. 查找现有文件夹
  const { data: existing } = await supabase
    .from("md_folders")
    .select("id")
    .eq("user_id", userId)
    .eq("is_system", true)
    .eq("system_type", "ai_generated")
    .single();

  if (existing) {
    return existing.id;
  }

  // 2. 不存在则创建
  const { data: newFolder, error } = await supabase
    .from("md_folders")
    .insert({
      user_id: userId,
      name: AI_GENERATED_FOLDER.name,
      icon: AI_GENERATED_FOLDER.icon,
      color: AI_GENERATED_FOLDER.color,
      is_system: AI_GENERATED_FOLDER.isSystem,
      system_type: AI_GENERATED_FOLDER.systemType,
      sort_order: -1, // 置顶
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`创建 AI 生成文件夹失败: ${error.message}`);
  }

  return newFolder.id;
}
```

---

## 五、修改现有文件

### 5.1 AI 消息操作栏

#### 文件: `src/components/ai/phase4/quick-actions.tsx`

在复制按钮后添加保存按钮：

```typescript
// 导入
import { SaveToNoteButton } from '@/components/shared/save-to-note'

// 在 ActionButtons 组件中，复制按钮后添加：
<SaveToNoteButton
  content={content}
  sourceType="ai_response"
  sourceId={messageId}
/>
```

### 5.2 交付物卡片

#### 文件: `src/components/ai/ai-deliverable-card.tsx`

在卡片底部操作区添加保存按钮：

```typescript
// 导入
import { SaveToNoteButton } from '@/components/shared/save-to-note'

// 在卡片操作区添加：
<SaveToNoteButton
  content={typeof deliverable.content === 'string' ? deliverable.content : JSON.stringify(deliverable.content)}
  sourceType="deliverable"
  sourceId={deliverable.id}
  suggestedTitle={deliverable.title}
/>
```

### 5.3 MD 收藏 API

#### 文件: `src/app/api/md-collections/route.ts`

修改 POST 方法，支持自动创建 AI 生成文件夹：

```typescript
// 导入
import { ensureAIGeneratedFolder } from "@/lib/md-collections/ensure-ai-folder";

// 在创建逻辑中添加：
let folderId = body.folderId;

// 如果是 AI 来源且未指定文件夹，使用 AI 生成文件夹
const aiSourceTypes = ["ai_response", "deliverable", "synthesis", "report"];
if (!folderId && aiSourceTypes.includes(body.sourceType)) {
  folderId = await ensureAIGeneratedFolder(supabase, user.id);
}
```

---

## 六、AI Skills 化（可选，Phase 2）

### 6.1 save_to_note Tool

#### 文件: `src/lib/ai-agent/tools/save-to-note.tool.ts`

参考规范文档中的 Tool 定义实现。

### 6.2 意图分类规则

#### 文件: `src/lib/ai-agent/router/rules/save-note-rules.ts`

```typescript
export const saveNoteIntentRules = [
  {
    id: "save_last_response",
    patterns: [
      /保存(这个|这条|刚才的?)(回复|内容|建议|分析)?/,
      /存(下来|到笔记)/,
      /(帮我)?记(下来|录一下)/,
      /收藏(这个|这条)/,
    ],
    intent: { type: "action", subtype: "save_note" },
    confidence: 0.9,
  },
];
```

---

## 七、测试要点

### 7.1 单元测试

- [ ] useSaveToNote Hook 状态变化
- [ ] 重复检测逻辑
- [ ] 标题生成 API
- [ ] AI 生成文件夹创建

### 7.2 集成测试

- [ ] 完整保存流程（点击 → 生成标题 → 保存 → Toast）
- [ ] 重复检测弹窗交互
- [ ] 错误处理和重试

### 7.3 E2E 测试

- [ ] AI 对话中保存消息
- [ ] 交付物卡片保存
- [ ] 重复内容保存

---

## 八、实施顺序

```
Day 1:
├── 创建数据库迁移脚本（3个文件）
├── 运行迁移
├── 创建类型定义文件
└── 创建 ensureAIGeneratedFolder 函数

Day 2:
├── 创建标题生成 API
├── 创建 useSaveToNote Hook
├── 创建 SaveToNoteButton 组件
├── 创建 SaveSuccessToast 组件
└── 创建 DuplicateWarningPopover 组件

Day 3:
├── 集成到 AI 消息操作栏
├── 集成到交付物卡片
├── 测试验证
└── Bug 修复

Day 4 (可选):
├── 实现 save_to_note Tool
├── 添加意图分类规则
└── AI 对话保存测试
```

---

## 九、验收标准

1. ✅ AI 消息旁边有保存按钮
2. ✅ 点击保存后自动生成标题
3. ✅ 保存到「AI 生成」文件夹
4. ✅ 显示成功 Toast 带查看入口
5. ✅ 重复内容有提示但可继续保存
6. ✅ 保存历史有记录

---

**开发者注意事项**:

1. 所有新组件使用 `'use client'` 指令
2. 遵循现有代码风格和命名规范
3. 使用 `cn()` 工具函数合并 className
4. Toast 使用 `sonner` 库
5. 数据库操作使用 `@/lib/supabase/server` 或 `@/lib/supabase/client`
