# P2-010: 用途标签触发自动快照 - 技术设计方案

> **版本**: v1.0 (待审核)
> **制定日期**: 2025-12-16
> **工时估算**: 3 天
> **前置依赖**: 网页快照功能 (已实现)、用途标签系统 (已实现)
> **定位**: 智能联动功能（提升用户体验）

---

## 一、功能定位

### 1.1 核心场景

```
用户场景：
1. 用户收藏一篇优质技术文章
2. 阅读后标记为「优质经验」，表示这是高价值内容
3. 系统自动创建网页快照 → 永久保存，防止网页失效

核心价值：
- 「优质经验」= 高价值 = 值得永久保存
- 减少用户操作步骤（一次操作，两件事）
- 防止网页 404/删除/付费墙导致内容丢失
```

### 1.2 设计原则

| 原则         | 说明                           |
| ------------ | ------------------------------ |
| **可配置**   | 用户可自定义哪些标签触发快照   |
| **预设合理** | 「优质经验」默认启用，开箱即用 |
| **不打扰**   | 可取消、静默失败、不阻塞主流程 |
| **配额感知** | 尊重用户配额限制，超额时提示   |

### 1.3 功能边界

| ✅ 做                | ❌ 不做                 |
| -------------------- | ----------------------- |
| 标签触发自动快照     | 自动触发其他 AI 处理    |
| 用户可配置触发标签   | 批量历史补救（Phase 2） |
| 配额不足时提示升级   | 强制创建超出配额        |
| 支持取消（延迟窗口） | 撤销已完成的快照        |

---

## 二、数据模型设计

### 2.1 用户设置扩展

**存储位置**: `profiles.settings` JSON 字段

```typescript
// 扩展 UserSettings 类型
interface UserSettings {
  // ... 现有设置 ...

  /** 自动快照设置 (P2-010 新增) */
  autoSnapshot?: AutoSnapshotSettings;
}

interface AutoSnapshotSettings {
  /** 功能总开关 (默认: true) */
  enabled: boolean;

  /** 触发标签列表 (默认: ["优质经验"]) */
  triggerTags: string[];

  /** 快照类型 (默认: "basic") */
  snapshotType: "basic" | "standard" | "full";

  /** 创建前显示确认 Toast (默认: true) */
  showConfirmToast: boolean;

  /** 确认延迟时间(毫秒) (默认: 3000) */
  confirmDelayMs: number;

  /** 配额不足时静默跳过 (默认: false) */
  silentOnQuotaExceeded: boolean;
}
```

### 2.2 默认配置

```typescript
// src/lib/constants/auto-snapshot.ts

export const DEFAULT_AUTO_SNAPSHOT_SETTINGS: AutoSnapshotSettings = {
  enabled: true,
  triggerTags: ["优质经验"], // 预设「优质经验」已配置
  snapshotType: "basic",
  showConfirmToast: true,
  confirmDelayMs: 3000, // 3秒取消窗口
  silentOnQuotaExceeded: false,
};

/** 推荐的触发标签（用于设置页面展示） */
export const RECOMMENDED_TRIGGER_TAGS = [
  { value: "优质经验", description: "高质量经验内容，值得永久保存" },
  { value: "值得复读", description: "需要反复学习的内容" },
  { value: "值得关注", description: "需要持续关注的内容" },
];
```

### 2.3 数据库扩展（可选）

```sql
-- 扩展 bookmark_snapshots 表，记录触发来源
-- 迁移文件: 20251216000001_add_snapshot_trigger_source.sql

ALTER TABLE bookmark_snapshots
  ADD COLUMN IF NOT EXISTS trigger_source VARCHAR(50)
  DEFAULT 'manual'
  CHECK (trigger_source IN ('manual', 'auto-tag', 'batch', 'scheduled', 'api'));

-- 可选：记录触发的具体标签
ALTER TABLE bookmark_snapshots
  ADD COLUMN IF NOT EXISTS trigger_tag VARCHAR(100);

-- 索引（用于统计分析）
CREATE INDEX IF NOT EXISTS idx_snapshots_trigger_source
  ON bookmark_snapshots(trigger_source)
  WHERE trigger_source IS NOT NULL;

COMMENT ON COLUMN bookmark_snapshots.trigger_source IS '快照触发来源: manual=手动, auto-tag=标签自动, batch=批量, scheduled=定时, api=API调用';
COMMENT ON COLUMN bookmark_snapshots.trigger_tag IS '触发快照的标签名称（仅 auto-tag 来源时有值）';
```

---

## 三、技术实现方案

### 3.1 核心流程

```
用户添加/修改用途标签
         │
         ▼
┌─────────────────────────────────────────┐
│ 1. 标签变更检测                          │
│    - 获取新增的标签列表                   │
│    - 过滤出配置为触发的标签               │
└───────────────┬─────────────────────────┘
                │ 有触发标签
                ▼
┌─────────────────────────────────────────┐
│ 2. 前置检查                              │
│    - 功能是否启用？                       │
│    - 书签是否已有有效快照？               │
│    - 用户配额是否足够？                   │
└───────────────┬─────────────────────────┘
                │ 通过
                ▼
┌─────────────────────────────────────────┐
│ 3. 显示确认 Toast（可取消）              │
│    "正在为优质内容创建快照..."            │
│    [取消] 按钮 + 倒计时                  │
│    延迟: 3 秒                            │
└───────────────┬─────────────────────────┘
                │ 无取消
                ▼
┌─────────────────────────────────────────┐
│ 4. 调用快照服务                          │
│    POST /api/snapshots                   │
│    { bookmarkId, source: 'auto-tag',     │
│      triggerTag: '优质经验' }            │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ 5. 结果反馈                              │
│    成功: "快照创建中，内容将被永久保存"   │
│    失败: 静默或提示（根据设置）           │
└─────────────────────────────────────────┘
```

### 3.2 核心 Hook 实现

```typescript
// src/hooks/use-auto-snapshot.ts

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useSnapshot } from "@/hooks/use-snapshot";
import { useAutoSnapshotSettings } from "@/hooks/use-auto-snapshot-settings";

interface UseAutoSnapshotOptions {
  bookmarkId: number;
  bookmarkUrl: string;
  hasSnapshot: boolean;
}

interface UseAutoSnapshotResult {
  /** 检查并触发自动快照 */
  checkAndTriggerSnapshot: (
    prevTags: string[],
    newTags: string[],
  ) => Promise<void>;

  /** 取消待执行的快照 */
  cancelPendingSnapshot: () => void;

  /** 是否有待执行的快照 */
  hasPendingSnapshot: boolean;
}

export function useAutoSnapshot({
  bookmarkId,
  bookmarkUrl,
  hasSnapshot,
}: UseAutoSnapshotOptions): UseAutoSnapshotResult {
  const { settings } = useAutoSnapshotSettings();
  const { createSnapshot, checkQuota } = useSnapshot();
  const pendingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cancelledRef = useRef(false);

  const cancelPendingSnapshot = useCallback(() => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
      cancelledRef.current = true;
      toast.dismiss("auto-snapshot-pending");
      toast.info("已取消自动快照");
    }
  }, []);

  const checkAndTriggerSnapshot = useCallback(
    async (prevTags: string[], newTags: string[]) => {
      // 1. 检查功能是否启用
      if (!settings.enabled) return;

      // 2. 检查是否有新增的触发标签
      const addedTags = newTags.filter((t) => !prevTags.includes(t));
      const triggerTag = addedTags.find((t) =>
        settings.triggerTags.includes(t),
      );

      if (!triggerTag) return;

      // 3. 检查是否已有快照
      if (hasSnapshot) {
        console.log("[AutoSnapshot] 书签已有快照，跳过");
        return;
      }

      // 4. 检查配额
      const quotaCheck = await checkQuota();
      if (!quotaCheck.canCreate) {
        if (!settings.silentOnQuotaExceeded) {
          toast.warning("快照配额已满", {
            description: "升级到 Pro 获取更多配额",
            action: {
              label: "升级",
              onClick: () => (window.location.href = "/settings/membership"),
            },
          });
        }
        return;
      }

      // 5. 显示确认 Toast（带取消按钮）
      cancelledRef.current = false;

      if (settings.showConfirmToast) {
        toast.loading(`正在为「${triggerTag}」内容创建快照...`, {
          id: "auto-snapshot-pending",
          description: "内容将被永久保存，防止网页失效",
          duration: settings.confirmDelayMs,
          action: {
            label: "取消",
            onClick: cancelPendingSnapshot,
          },
        });
      }

      // 6. 延迟执行（给用户取消机会）
      pendingTimeoutRef.current = setTimeout(async () => {
        if (cancelledRef.current) return;

        toast.dismiss("auto-snapshot-pending");

        try {
          const result = await createSnapshot(bookmarkId, {
            snapshotType: settings.snapshotType,
            source: "auto-tag",
            triggerTag,
          });

          toast.success("快照创建中", {
            description: "内容将被永久保存，稍后可在详情页查看",
          });
        } catch (error) {
          console.error("[AutoSnapshot] 创建失败:", error);
          if (!settings.silentOnQuotaExceeded) {
            toast.error("快照创建失败", {
              description: "请稍后手动创建",
            });
          }
        }

        pendingTimeoutRef.current = null;
      }, settings.confirmDelayMs);
    },
    [
      settings,
      hasSnapshot,
      bookmarkId,
      checkQuota,
      createSnapshot,
      cancelPendingSnapshot,
    ],
  );

  return {
    checkAndTriggerSnapshot,
    cancelPendingSnapshot,
    hasPendingSnapshot: pendingTimeoutRef.current !== null,
  };
}
```

### 3.3 设置 Hook 实现

```typescript
// src/hooks/use-auto-snapshot-settings.ts

import { useCallback, useEffect, useState } from "react";
import { useProfile } from "@/hooks/use-profile";
import { DEFAULT_AUTO_SNAPSHOT_SETTINGS } from "@/lib/constants/auto-snapshot";
import type { AutoSnapshotSettings } from "@/types/supabase";

interface UseAutoSnapshotSettingsResult {
  settings: AutoSnapshotSettings;
  isLoading: boolean;
  updateSettings: (updates: Partial<AutoSnapshotSettings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export function useAutoSnapshotSettings(): UseAutoSnapshotSettingsResult {
  const { profile, updateProfile, isLoading: profileLoading } = useProfile();

  const settings: AutoSnapshotSettings = {
    ...DEFAULT_AUTO_SNAPSHOT_SETTINGS,
    ...(profile?.settings?.autoSnapshot || {}),
  };

  const updateSettings = useCallback(
    async (updates: Partial<AutoSnapshotSettings>) => {
      const newSettings = { ...settings, ...updates };
      await updateProfile({
        settings: {
          ...(profile?.settings || {}),
          autoSnapshot: newSettings,
        },
      });
    },
    [settings, profile, updateProfile],
  );

  const resetToDefaults = useCallback(async () => {
    await updateSettings(DEFAULT_AUTO_SNAPSHOT_SETTINGS);
  }, [updateSettings]);

  return {
    settings,
    isLoading: profileLoading,
    updateSettings,
    resetToDefaults,
  };
}
```

### 3.4 集成到标签更新流程

```typescript
// 修改现有的标签更新逻辑
// src/components/bookmark/usage-tag-selector.tsx (示例集成点)

import { useAutoSnapshot } from "@/hooks/use-auto-snapshot";

function UsageTagSelector({ bookmark, onTagsChange }: Props) {
  const [prevTags, setPrevTags] = useState(bookmark.user_tags || []);

  const { checkAndTriggerSnapshot } = useAutoSnapshot({
    bookmarkId: bookmark.id,
    bookmarkUrl: bookmark.url,
    hasSnapshot: bookmark.has_snapshot,
  });

  const handleTagsChange = async (newTags: string[]) => {
    // 1. 更新标签（原有逻辑）
    await onTagsChange(newTags);

    // 2. 检查是否需要触发自动快照
    await checkAndTriggerSnapshot(prevTags, newTags);

    // 3. 更新 prevTags
    setPrevTags(newTags);
  };

  // ... 其他代码
}
```

---

## 四、API 扩展

### 4.1 创建快照 API 扩展

**端点**: `POST /api/snapshots`

**请求体扩展**:

```typescript
interface CreateSnapshotRequest {
  bookmarkId: number;
  snapshotType?: "basic" | "standard" | "full";
  priority?: "low" | "normal" | "high";

  // P2-010 新增字段
  source?: "manual" | "auto-tag" | "batch" | "scheduled" | "api";
  triggerTag?: string; // 仅 source='auto-tag' 时有值
}
```

**修改点**: `src/app/api/snapshots/route.ts`

```typescript
// POST handler 中增加字段处理
const {
  bookmarkId,
  snapshotType = "basic",
  priority = "normal",
  source = "manual", // P2-010: 默认手动
  triggerTag, // P2-010: 触发标签
} = await request.json();

// 创建快照记录时包含新字段
const snapshotInsert: BookmarkSnapshotInsert = {
  // ... 现有字段
  trigger_source: source,
  trigger_tag: source === "auto-tag" ? triggerTag : null,
};
```

### 4.2 获取自动快照设置 API

**端点**: `GET /api/settings/auto-snapshot`

**响应**:

```typescript
interface GetAutoSnapshotSettingsResponse {
  success: true;
  data: AutoSnapshotSettings;
}
```

### 4.3 更新自动快照设置 API

**端点**: `PUT /api/settings/auto-snapshot`

**请求体**:

```typescript
interface UpdateAutoSnapshotSettingsRequest {
  enabled?: boolean;
  triggerTags?: string[];
  snapshotType?: "basic" | "standard" | "full";
  showConfirmToast?: boolean;
  confirmDelayMs?: number;
  silentOnQuotaExceeded?: boolean;
}
```

---

## 五、前端组件设计

### 5.1 设置页面组件

**位置**: `src/components/settings/auto-snapshot-settings.tsx`

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚙️ 自动快照设置                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  自动快照                                              [开关 ✓]     │
│  当添加特定用途标签时，自动为收藏创建网页快照                         │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  触发标签                                                           │
│  选择哪些用途标签会触发自动快照                                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ☑️ 优质经验    高质量经验内容，值得永久保存                   │   │
│  │ ☐ 值得复读    需要反复学习的内容                             │   │
│  │ ☐ 值得关注    需要持续关注的内容                             │   │
│  │ ☐ 下次分享用  准备分享给他人的内容                           │   │
│  │ ─────────────────────────────────────────────────────────── │   │
│  │ + 添加自定义标签                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  快照类型                                              [基础 ▼]     │
│  • 基础：提取正文内容（推荐，节省配额）                              │
│  • 标准：完整网页（需要 Pro）                                       │
│  • 完整：含截图（需要 Pro）                                         │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ▼ 高级选项                                                        │
│                                                                     │
│  创建前显示提示                                        [开关 ✓]     │
│  显示 Toast 提示并提供取消机会                                       │
│                                                                     │
│  确认延迟                                              [3 秒 ▼]     │
│  取消窗口时间                                                       │
│                                                                     │
│  配额不足时静默跳过                                    [开关 ✗]     │
│  关闭后配额不足时会显示升级提示                                       │
│                                                                     │
│                                           [恢复默认]    [保存]      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 组件实现

```typescript
// src/components/settings/auto-snapshot-settings.tsx

'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Camera, Sparkles } from 'lucide-react';
import { useAutoSnapshotSettings } from '@/hooks/use-auto-snapshot-settings';
import { USAGE_TAG_PRESETS } from '@/lib/constants/usage-tags';
import { RECOMMENDED_TRIGGER_TAGS } from '@/lib/constants/auto-snapshot';
import { toast } from 'sonner';

export function AutoSnapshotSettings() {
  const { settings, updateSettings, resetToDefaults, isLoading } = useAutoSnapshotSettings();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleTag = async (tagValue: string, checked: boolean) => {
    const newTags = checked
      ? [...settings.triggerTags, tagValue]
      : settings.triggerTags.filter((t) => t !== tagValue);

    setIsSaving(true);
    try {
      await updateSettings({ triggerTags: newTags });
      toast.success(checked ? '已添加触发标签' : '已移除触发标签');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(settings);
      toast.success('设置已保存');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-purple-500" />
          <CardTitle>自动快照设置</CardTitle>
        </div>
        <CardDescription>
          当添加特定用途标签时，自动为收藏创建网页快照
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 总开关 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">自动快照</p>
            <p className="text-sm text-muted-foreground">
              标记特定标签时自动创建快照
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => updateSettings({ enabled })}
            disabled={isLoading}
          />
        </div>

        {settings.enabled && (
          <>
            {/* 触发标签选择 */}
            <div className="space-y-3">
              <p className="font-medium">触发标签</p>
              <div className="space-y-2 rounded-lg border p-4">
                {USAGE_TAG_PRESETS.map((preset) => {
                  const isChecked = settings.triggerTags.includes(preset.value);
                  const recommendation = RECOMMENDED_TRIGGER_TAGS.find(
                    (r) => r.value === preset.value
                  );

                  return (
                    <div
                      key={preset.value}
                      className="flex items-start gap-3 py-2"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          handleToggleTag(preset.value, !!checked)
                        }
                        disabled={isSaving}
                      />
                      <div className="flex-1">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-sm font-medium ${preset.bgLight} ${preset.textLight}`}
                        >
                          {preset.label}
                        </span>
                        {recommendation && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {recommendation.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 快照类型 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">快照类型</p>
                <p className="text-sm text-muted-foreground">
                  基础类型提取正文，节省配额
                </p>
              </div>
              <Select
                value={settings.snapshotType}
                onValueChange={(value: 'basic' | 'standard' | 'full') =>
                  updateSettings({ snapshotType: value })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">基础</SelectItem>
                  <SelectItem value="standard">标准 (Pro)</SelectItem>
                  <SelectItem value="full">完整 (Pro)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 高级选项 */}
            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    isAdvancedOpen ? 'rotate-180' : ''
                  }`}
                />
                高级选项
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-4 space-y-4">
                {/* 显示确认提示 */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">创建前显示提示</p>
                    <p className="text-sm text-muted-foreground">
                      显示 Toast 并提供取消机会
                    </p>
                  </div>
                  <Switch
                    checked={settings.showConfirmToast}
                    onCheckedChange={(showConfirmToast) =>
                      updateSettings({ showConfirmToast })
                    }
                  />
                </div>

                {/* 确认延迟 */}
                {settings.showConfirmToast && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">确认延迟</p>
                      <p className="text-sm text-muted-foreground">
                        取消窗口时间
                      </p>
                    </div>
                    <Select
                      value={String(settings.confirmDelayMs)}
                      onValueChange={(value) =>
                        updateSettings({ confirmDelayMs: Number(value) })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2000">2 秒</SelectItem>
                        <SelectItem value="3000">3 秒</SelectItem>
                        <SelectItem value="5000">5 秒</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 配额不足时静默 */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">配额不足时静默跳过</p>
                    <p className="text-sm text-muted-foreground">
                      关闭后会显示升级提示
                    </p>
                  </div>
                  <Switch
                    checked={settings.silentOnQuotaExceeded}
                    onCheckedChange={(silentOnQuotaExceeded) =>
                      updateSettings({ silentOnQuotaExceeded })
                    }
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={resetToDefaults}
                disabled={isSaving}
              >
                恢复默认
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

### 5.3 Toast 提示设计

```typescript
// 触发时的 Toast
toast.loading("正在为「优质经验」内容创建快照...", {
  id: "auto-snapshot-pending",
  description: "内容将被永久保存，防止网页失效",
  duration: 3000,
  action: {
    label: "取消",
    onClick: () => cancelPendingSnapshot(),
  },
});

// 成功 Toast
toast.success("快照创建中", {
  description: "内容将被永久保存，稍后可在详情页查看",
  action: {
    label: "查看",
    onClick: () => router.push(`/bookmark/${bookmarkId}`),
  },
});

// 配额不足 Toast
toast.warning("快照配额已满", {
  description: "升级到 Pro 获取更多配额",
  action: {
    label: "升级",
    onClick: () => router.push("/settings/membership"),
  },
});

// 取消 Toast
toast.info("已取消自动快照");
```

---

## 六、实施计划

### 6.1 子任务分解

| 子任务ID | 任务内容                                             | 工时  | 依赖               |
| -------- | ---------------------------------------------------- | ----- | ------------------ |
| P2-010-1 | 常量定义：默认配置、推荐标签                         | 0.25d | -                  |
| P2-010-2 | 类型定义：AutoSnapshotSettings 扩展                  | 0.25d | -                  |
| P2-010-3 | Hook：use-auto-snapshot-settings                     | 0.5d  | P2-010-1, P2-010-2 |
| P2-010-4 | Hook：use-auto-snapshot（核心逻辑）                  | 0.5d  | P2-010-3           |
| P2-010-5 | API 扩展：POST /api/snapshots 支持 source/triggerTag | 0.25d | -                  |
| P2-010-6 | 数据库迁移：trigger_source/trigger_tag 字段          | 0.25d | -                  |
| P2-010-7 | 设置页组件：AutoSnapshotSettings                     | 0.5d  | P2-010-3           |
| P2-010-8 | 集成：标签选择器触发逻辑                             | 0.25d | P2-010-4           |
| P2-010-9 | 集成测试                                             | 0.25d | All                |

**总计**: 3 天

### 6.2 文件清单

```
新增文件:
src/lib/constants/auto-snapshot.ts              # 默认配置常量
src/hooks/use-auto-snapshot.ts                  # 核心 Hook
src/hooks/use-auto-snapshot-settings.ts         # 设置 Hook
src/components/settings/auto-snapshot-settings.tsx  # 设置组件
supabase/migrations/20251216000001_add_snapshot_trigger_source.sql  # 数据库迁移

修改文件:
src/types/supabase.ts                           # 类型扩展
src/app/api/snapshots/route.ts                  # API 扩展
src/components/bookmark/usage-tag-selector.tsx  # 集成触发逻辑
src/app/(main)/settings/page.tsx                # 设置页面集成
```

### 6.3 风险与缓解

| 风险               | 可能性 | 影响 | 缓解措施                       |
| ------------------ | ------ | ---- | ------------------------------ |
| 用户误触发消耗配额 | 中     | 中   | 3秒取消窗口 + Toast 提示       |
| 配额快速耗尽       | 低     | 中   | 默认只启用「优质经验」一个标签 |
| 网络延迟导致体验差 | 低     | 低   | 乐观 UI + 后台异步处理         |
| 设置同步问题       | 低     | 低   | 使用 profile.settings 统一存储 |

---

## 七、验收标准

### 7.1 功能验收

- [ ] 添加「优质经验」标签时自动触发快照创建
- [ ] 显示 3 秒取消窗口 Toast
- [ ] 点击「取消」可阻止快照创建
- [ ] 配额不足时显示升级提示
- [ ] 已有快照的书签不重复创建
- [ ] 设置页可配置触发标签
- [ ] 设置页可关闭自动快照功能
- [ ] 快照记录包含 trigger_source 和 trigger_tag

### 7.2 边界情况验收

- [ ] 功能关闭时不触发任何逻辑
- [ ] 多个触发标签同时添加只创建一个快照
- [ ] 快速切换标签不会创建多个快照
- [ ] 网络失败时静默处理或显示提示（根据设置）

### 7.3 用户体验验收

- [ ] Toast 提示清晰友好
- [ ] 设置页面布局合理
- [ ] 默认配置开箱即用
- [ ] 高级选项折叠不影响常规使用

---

## 八、未来扩展

| 扩展方向       | 优先级 | 说明                                       |
| -------------- | ------ | ------------------------------------------ |
| 历史补救       | P2     | 为已标记「优质经验」的历史收藏批量创建快照 |
| 自定义标签触发 | P3     | 支持用户自定义标签也可触发                 |
| 智能建议       | P3     | AI 检测到高质量内容时主动建议创建快照      |
| 统计分析       | P3     | 展示自动快照触发次数、成功率等数据         |

---

**文档状态**: 📝 待审核 (v1.0)
**制定者**: Claude
**审核者**: [待填写]
