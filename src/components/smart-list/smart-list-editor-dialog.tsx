/**
 * 智能列表编辑器对话框
 * @description 用于创建和编辑智能列表的对话框组件
 * @version 10.0.0
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Calendar,
  Star,
  BookOpen,
  Award,
  Eye,
  RefreshCcw,
  Filter,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  SMART_LIST_COLORS,
  SMART_LIST_SORT_OPTIONS,
} from "@/lib/smart-list/presets";
import type {
  SmartListClient,
  SmartListFilters,
  SmartListColor,
  SmartListSortBy,
  CreateSmartListRequest,
  UpdateSmartListRequest,
} from "@/types/smart-list";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 常量定义
// ============================================

/** 图标选项 */
const ICON_OPTIONS = [
  { value: "filter", label: "筛选", Icon: Filter },
  { value: "calendar", label: "日历", Icon: Calendar },
  { value: "star", label: "星标", Icon: Star },
  { value: "book-open", label: "阅读", Icon: BookOpen },
  { value: "award", label: "奖励", Icon: Award },
  { value: "eye", label: "关注", Icon: Eye },
  { value: "refresh-ccw", label: "复读", Icon: RefreshCcw },
];

/** 颜色选项 */
const COLOR_OPTIONS: { value: SmartListColor; label: string }[] = [
  { value: "default", label: "默认" },
  { value: "blue", label: "蓝色" },
  { value: "green", label: "绿色" },
  { value: "orange", label: "橙色" },
  { value: "purple", label: "紫色" },
  { value: "red", label: "红色" },
  { value: "cyan", label: "青色" },
  { value: "pink", label: "粉色" },
  { value: "amber", label: "琥珀" },
  { value: "emerald", label: "翠绿" },
];

/** 平台选项 */
const PLATFORM_OPTIONS = [
  { value: "WECHAT_OFFICIAL_ACCOUNT", label: "微信公众号" },
  { value: "BILIBILI", label: "B站" },
  { value: "XIAOHONGSHU", label: "小红书" },
  { value: "browser", label: "浏览器书签" },
  { value: "UNKNOWN", label: "其他" },
];

/** 时间范围预设 */
const DATE_RANGE_PRESETS = [
  { value: "7d", label: "最近7天", days: 7 },
  { value: "30d", label: "最近30天", days: 30 },
  { value: "90d", label: "最近3个月", days: 90 },
  { value: "365d", label: "最近1年", days: 365 },
];

/** 用途标签预设 */
const USAGE_TAG_OPTIONS = [
  "稍后阅读",
  "值得复读",
  "优质经验",
  "参考借鉴",
  "值得关注",
  "存档备份",
];

// ============================================
// 类型定义
// ============================================

export interface SmartListEditorDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 编辑模式时的智能列表数据 */
  smartList?: SmartListClient;
  /** 保存回调 */
  onSave: (
    data: CreateSmartListRequest | UpdateSmartListRequest,
  ) => Promise<void>;
  /** 预览回调 */
  onPreview?: (filters: SmartListFilters) => Promise<number>;
}

// ============================================
// 组件实现
// ============================================

export function SmartListEditorDialog({
  open,
  onOpenChange,
  smartList,
  onSave,
  onPreview,
}: SmartListEditorDialogProps) {
  const isEditMode = !!smartList;

  // 表单状态
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("filter");
  const [color, setColor] = useState<SmartListColor>("default");
  const [sortBy, setSortBy] = useState<SmartListSortBy>("created_desc");

  // 筛选条件状态
  const [platform, setPlatform] = useState<string>("");
  const [dateRangePreset, setDateRangePreset] = useState<string>("");
  const [isRead, setIsRead] = useState<boolean | undefined>(undefined);
  const [isStarred, setIsStarred] = useState<boolean | undefined>(undefined);
  const [isHighValue, setIsHighValue] = useState<boolean | undefined>(
    undefined,
  );
  const [selectedUsageTags, setSelectedUsageTags] = useState<string[]>([]);

  // UI 状态
  const [isSaving, setIsSaving] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // 重置表单（需要在 useEffect 之前定义）
  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setIcon("filter");
    setColor("default");
    setSortBy("created_desc");
    setPlatform("");
    setDateRangePreset("");
    setIsRead(undefined);
    setIsStarred(undefined);
    setIsHighValue(undefined);
    setSelectedUsageTags([]);
    setPreviewCount(null);
  }, []);

  // 初始化表单（编辑模式）
  useEffect(() => {
    if (open && smartList) {
      setName(smartList.name);
      setDescription(smartList.description || "");
      setIcon(smartList.icon);
      setColor(smartList.color);
      setSortBy(smartList.sortBy);

      // 恢复筛选条件
      const filters = smartList.filters;
      if (filters.platform) {
        setPlatform(
          Array.isArray(filters.platform)
            ? filters.platform[0]
            : filters.platform,
        );
      }
      if (filters.dateRange?.type === "relative" && filters.dateRange.value) {
        setDateRangePreset(`${filters.dateRange.value}d`);
      }
      if (filters.isRead !== undefined) {
        setIsRead(filters.isRead);
      }
      if (filters.isStarred !== undefined) {
        setIsStarred(filters.isStarred);
      }
      if (filters.isHighValue !== undefined) {
        setIsHighValue(filters.isHighValue);
      }
      if (filters.usageTags) {
        setSelectedUsageTags(filters.usageTags);
      }
    } else if (open) {
      // 新建模式：重置表单
      resetForm();
    }
  }, [open, smartList, resetForm]);

  // 构建筛选条件对象
  const buildFilters = useCallback((): SmartListFilters => {
    const filters: SmartListFilters = {};

    if (platform) {
      filters.platform = platform;
    }

    if (dateRangePreset) {
      const preset = DATE_RANGE_PRESETS.find(
        (p) => p.value === dateRangePreset,
      );
      if (preset) {
        filters.dateRange = {
          type: "relative",
          value: preset.days,
          unit: "day",
        };
      }
    }

    if (isRead !== undefined) {
      filters.isRead = isRead;
    }

    if (isStarred !== undefined) {
      filters.isStarred = isStarred;
    }

    if (isHighValue !== undefined) {
      filters.isHighValue = isHighValue;
    }

    if (selectedUsageTags.length > 0) {
      filters.usageTags = selectedUsageTags;
    }

    return filters;
  }, [
    platform,
    dateRangePreset,
    isRead,
    isStarred,
    isHighValue,
    selectedUsageTags,
  ]);

  // 预览匹配数量
  const handlePreview = useCallback(async () => {
    if (!onPreview) return;

    setIsLoadingPreview(true);
    try {
      const filters = buildFilters();
      const count = await onPreview(filters);
      setPreviewCount(count);
    } catch (error) {
      clientLogger.error({ error }, "Preview failed");
    } finally {
      setIsLoadingPreview(false);
    }
  }, [onPreview, buildFilters]);

  // 保存
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const filters = buildFilters();
      const data: CreateSmartListRequest | UpdateSmartListRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        color,
        filters,
        sortBy,
      };

      await onSave(data);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      clientLogger.error({ error }, "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    description,
    icon,
    color,
    sortBy,
    buildFilters,
    onSave,
    onOpenChange,
    resetForm,
  ]);

  // 切换用途标签
  const toggleUsageTag = useCallback((tag: string) => {
    setSelectedUsageTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "编辑智能列表" : "新建智能列表"}
          </DialogTitle>
          <DialogDescription>
            设置筛选条件，自动聚合符合条件的收藏内容
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="filters">筛选条件</TabsTrigger>
          </TabsList>

          {/* 基本信息 */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* 名称 */}
            <div className="space-y-2">
              <Label htmlFor="name">名称 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入智能列表名称"
                maxLength={50}
              />
            </div>

            {/* 描述 */}
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述这个智能列表的用途"
                rows={2}
                maxLength={200}
              />
            </div>

            {/* 图标和颜色 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>图标</Label>
                <Select value={icon} onValueChange={setIcon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <opt.Icon className="size-4" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>颜色</Label>
                <Select
                  value={color}
                  onValueChange={(v) => setColor(v as SmartListColor)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "size-3 rounded-full",
                              SMART_LIST_COLORS[opt.value].bg,
                            )}
                          />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 排序方式 */}
            <div className="space-y-2">
              <Label>排序方式</Label>
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as SmartListSortBy)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SMART_LIST_SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* 筛选条件 */}
          <TabsContent value="filters" className="space-y-4 mt-4">
            {/* 来源平台 */}
            <div className="space-y-2">
              <Label>来源平台</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="不限" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不限</SelectItem>
                  {PLATFORM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 时间范围 */}
            <div className="space-y-2">
              <Label>收藏时间</Label>
              <Select
                value={dateRangePreset}
                onValueChange={setDateRangePreset}
              >
                <SelectTrigger>
                  <SelectValue placeholder="不限" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不限</SelectItem>
                  {DATE_RANGE_PRESETS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* 状态筛选 */}
            <div className="space-y-3">
              <Label>状态筛选</Label>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  仅未读
                </span>
                <Switch
                  checked={isRead === false}
                  onCheckedChange={(checked) =>
                    setIsRead(checked ? false : undefined)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  仅星标
                </span>
                <Switch
                  checked={isStarred === true}
                  onCheckedChange={(checked) =>
                    setIsStarred(checked ? true : undefined)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  仅高价值（5星）
                </span>
                <Switch
                  checked={isHighValue === true}
                  onCheckedChange={(checked) =>
                    setIsHighValue(checked ? true : undefined)
                  }
                />
              </div>
            </div>

            <Separator />

            {/* 用途标签 */}
            <div className="space-y-2">
              <Label>用途标签</Label>
              <div className="flex flex-wrap gap-2">
                {USAGE_TAG_OPTIONS.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    variant={
                      selectedUsageTags.includes(tag) ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => toggleUsageTag(tag)}
                    className="text-xs"
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* 预览 */}
            {onPreview && (
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm">
                  {isLoadingPreview ? (
                    <span className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="size-4 animate-spin" />
                      计算中...
                    </span>
                  ) : previewCount !== null ? (
                    <span>
                      匹配{" "}
                      <strong className="text-primary">{previewCount}</strong>{" "}
                      条收藏
                    </span>
                  ) : (
                    <span className="text-gray-500">点击预览查看匹配数量</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePreview}
                  disabled={isLoadingPreview}
                >
                  预览
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
            {isEditMode ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SmartListEditorDialog;
