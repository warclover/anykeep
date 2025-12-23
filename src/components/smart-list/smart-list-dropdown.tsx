/**
 * 智能列表下拉选择器
 * @description 紧凑的下拉选择器，替代折叠列表形式
 * @version 1.1.0 - 2025-12-21 修复点击后菜单消失问题（使用 Popover 替代 DropdownMenu）
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Calendar,
  Star,
  BookOpen,
  Award,
  Eye,
  RefreshCcw,
  Filter,
  Check,
  ChevronDown,
  Plus,
  Settings2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSmartLists } from "@/hooks/use-smart-lists";
import { SMART_LIST_COLORS } from "@/lib/smart-list/presets";
import { SmartListEditorDialog } from "./smart-list-editor-dialog";
import type {
  SmartListClient,
  SmartListColor,
  CreateSmartListRequest,
  UpdateSmartListRequest,
} from "@/types/smart-list";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { toast } from "sonner";

// ============================================
// 图标映射
// ============================================

const ICON_MAP: Record<string, typeof Calendar> = {
  calendar: Calendar,
  star: Star,
  "book-open": BookOpen,
  award: Award,
  eye: Eye,
  "refresh-ccw": RefreshCcw,
  filter: Filter,
};

// ============================================
// 类型定义
// ============================================

export interface SmartListDropdownProps {
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 组件实现
// ============================================

export function SmartListDropdown({ className }: SmartListDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

  // 获取智能列表数据
  const { smartLists, isFirstLoad, error, create, preview } = useSmartLists({
    includePresets: true,
  });

  // 当前选中的智能列表 ID
  const currentSmartListId = searchParams?.get("smartList") ?? null;

  // 当前选中的智能列表
  const currentSmartList = useMemo(() => {
    if (!currentSmartListId) return null;
    return (
      smartLists.find((list) => String(list.id) === currentSmartListId) ?? null
    );
  }, [smartLists, currentSmartListId]);

  // 是否在智能列表页面
  const isOnSmartListPage = pathname === "/home" && currentSmartListId !== null;

  // 获取显示的名称和数量
  const displayName = currentSmartList?.name ?? "智能列表";
  const displayCount = currentSmartList?.bookmarkCount;
  const displayIcon = currentSmartList?.icon ?? "filter";
  const displayColor = currentSmartList?.color ?? "default";

  // 获取图标和颜色
  const IconComponent = ICON_MAP[displayIcon] || Filter;
  const colorConfig =
    SMART_LIST_COLORS[displayColor as SmartListColor] ||
    SMART_LIST_COLORS.default;

  // 选择智能列表
  const handleSelect = useCallback(
    (smartList: SmartListClient) => {
      router.push(`/home?smartList=${smartList.id}`);
      setIsOpen(false);
    },
    [router],
  );

  // 打开新建对话框
  const handleCreate = useCallback(() => {
    setIsOpen(false);
    setIsEditorOpen(true);
  }, []);

  // 打开 AI 助手创建
  const handleAICreate = useCallback(() => {
    setIsOpen(false);
    setIsAIAssistantOpen(true);
  }, []);

  // 保存新建的智能列表
  const handleSave = useCallback(
    async (data: CreateSmartListRequest | UpdateSmartListRequest) => {
      try {
        const newList = await create(data as CreateSmartListRequest);
        toast.success("智能列表已创建");
        // 跳转到新创建的列表
        router.push(`/home?smartList=${newList.id}`);
      } catch (err) {
        toast.error("创建失败，请稍后重试");
        throw err;
      }
    },
    [create, router],
  );

  // 跳转到管理页面
  const handleManage = useCallback(() => {
    router.push("/settings?tab=smart-lists");
    setIsOpen(false);
  }, [router]);

  // 加载中状态
  if (isFirstLoad) {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <Loader2 className="size-5 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-red-500 rounded-lg bg-red-50 dark:bg-red-900/20">
          <Filter className="size-5" />
          <span>加载失败</span>
        </div>
      </div>
    );
  }

  // 空状态
  if (smartLists.length === 0) {
    return (
      <div className={className}>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-3 text-gray-500"
          onClick={handleCreate}
        >
          <Plus className="size-5" />
          <span>创建智能列表</span>
        </Button>
        <SmartListEditorDialog
          open={isEditorOpen}
          onOpenChange={setIsEditorOpen}
          onSave={handleSave}
          onPreview={preview}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-between gap-3 h-10 px-3",
              "hover:bg-gray-100 dark:hover:bg-gray-800",
              isOnSmartListPage && cn(colorConfig.bg, colorConfig.text),
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <IconComponent className="size-5 shrink-0" />
              <span className="truncate font-medium">{displayName}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {displayCount !== undefined && displayCount > 0 && (
                <span className="text-xs tabular-nums opacity-70">
                  {displayCount > 999 ? "999+" : displayCount}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-1"
          sideOffset={4}
        >
          <ScrollArea className="max-h-64">
            {/* 智能列表选项 */}
            <div className="space-y-0.5">
              {smartLists.map((smartList) => {
                const ItemIcon = ICON_MAP[smartList.icon] || Filter;
                const itemColorConfig =
                  SMART_LIST_COLORS[smartList.color as SmartListColor] ||
                  SMART_LIST_COLORS.default;
                const isSelected = currentSmartListId === String(smartList.id);

                return (
                  <button
                    key={smartList.id}
                    type="button"
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-sm",
                      "hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                      "focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-800",
                      isSelected && "bg-gray-100 dark:bg-gray-800",
                    )}
                    onClick={() => handleSelect(smartList)}
                  >
                    <ItemIcon
                      className={cn("size-4 shrink-0", itemColorConfig.text)}
                    />
                    <span className="flex-1 truncate text-left">
                      {smartList.name}
                    </span>
                    <span className="text-xs tabular-nums text-gray-400">
                      {smartList.bookmarkCount > 999
                        ? "999+"
                        : smartList.bookmarkCount}
                    </span>
                    {isSelected && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {/* 分隔线 */}
          <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />

          {/* 操作按钮 */}
          <div className="space-y-0.5">
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-sm",
                "hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                "focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-800",
              )}
              onClick={handleCreate}
            >
              <Plus className="size-4" />
              <span>新建智能列表</span>
            </button>

            <button
              type="button"
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-sm",
                "hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                "focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-800",
                "text-primary",
              )}
              onClick={handleAICreate}
            >
              <Sparkles className="size-4" />
              <span>AI 帮我创建</span>
            </button>

            <button
              type="button"
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-sm",
                "hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                "focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-800",
              )}
              onClick={handleManage}
            >
              <Settings2 className="size-4" />
              <span>管理智能列表</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* 编辑器对话框 */}
      <SmartListEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSave={handleSave}
        onPreview={preview}
      />

      {/* AI 助手面板 */}
      <AIAssistantPanel
        open={isAIAssistantOpen}
        onOpenChange={setIsAIAssistantOpen}
        title="AI 创建智能列表"
        description="告诉我你想要什么样的智能列表，我来帮你查询和创建"
      />
    </div>
  );
}

export default SmartListDropdown;
