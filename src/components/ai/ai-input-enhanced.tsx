"use client";

/**
 * Phase 4: AI 增强输入组件
 *
 * 在原有 AIInput 基础上增加：
 * - AttachmentButton: 附件按钮（最左侧）
 * - ToolDropdown: 工具下拉菜单（YouMind 风格）
 * - ContextIndicator: 上下文引用指示器
 * - AttachmentIndicator: 附件指示器
 * - AttachmentErrorBoundary: 错误边界保护
 *
 * @version 1.3.0
 * @since 2025-12-25
 * @updated 2025-12-26 - 使用 ToolDropdown 替换 ToolSelector
 * @updated 2025-12-26 - 添加附件按钮和附件指示器
 * @updated 2025-12-26 - 添加错误边界保护预览模态框
 */

import { useRef, useCallback, useState, type KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { clientLogger } from "@/lib/client-logger";
import { ToolDropdown, getToolDisplayName } from "./phase4/tool-dropdown";
import { ContextIndicator } from "./phase4/context-panel";
import {
  AttachmentButton,
  AttachmentPopover,
  AttachmentIndicator,
  AttachmentPreviewModal,
  AttachmentErrorBoundary,
  type AttachmentItem,
  type OnSelectionChange,
  ATTACHMENT_LIMITS,
} from "./attachment";
import { useAttachmentBookmarks } from "@/hooks/ai/use-attachment-bookmarks";
import type { ToolType, ContextItem } from "./phase4/types";

// =============================================================================
// 类型定义
// =============================================================================

export interface AIInputEnhancedProps {
  /** 输入值 */
  value: string;
  /** 值变化回调 */
  onChange: (value: string) => void;
  /** 提交回调 */
  onSubmit: (tool: ToolType) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 占位符文本 */
  placeholder?: string;
  /** 当前选中的工具 */
  selectedTool: ToolType;
  /** 工具变化回调 */
  onToolChange: (tool: ToolType) => void;
  /** 上下文项列表 */
  contextItems: ContextItem[];
  /** 展开上下文面板回调 */
  onExpandContext: () => void;
  /** 清除上下文回调 */
  onClearContext: () => void;
  /** 是否启用快捷键 */
  enableShortcuts?: boolean;
  /** 附件列表 */
  attachments: AttachmentItem[];
  /** 附件变化回调（支持函数式更新，避免闭包陷阱） */
  onAttachmentsChange: OnSelectionChange;
  /** 清除附件回调 */
  onClearAttachments: () => void;
  /** 添加文件附件回调 */
  onAddFiles: (files: File[]) => Promise<void>;
  /** 是否正在处理文件 */
  isProcessingFile?: boolean;
}

// =============================================================================
// 组件实现
// =============================================================================

export function AIInputEnhanced({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "",
  selectedTool,
  onToolChange,
  contextItems,
  onExpandContext,
  onClearContext,
  enableShortcuts: _enableShortcuts = true,
  attachments,
  onAttachmentsChange,
  onClearAttachments,
  onAddFiles,
  isProcessingFile = false,
}: AIInputEnhancedProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 附件弹出面板状态
  const [isAttachmentPopoverOpen, setIsAttachmentPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 附件预览状态
  const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // 获取书签数据
  const {
    bookmarks,
    isLoading: isLoadingBookmarks,
    isSearching,
    isSearchMode,
  } = useAttachmentBookmarks({
    searchQuery,
    enabled: isAttachmentPopoverOpen,
  });

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter 发送（Shift+Enter 换行）
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !disabled) {
          onSubmit(selectedTool);
        }
      }
    },
    [value, disabled, onSubmit, selectedTool],
  );

  // 处理提交
  const handleSubmit = useCallback(() => {
    if (value.trim() && !disabled) {
      onSubmit(selectedTool);
    }
  }, [value, disabled, onSubmit, selectedTool]);

  // 处理附件预览
  const handlePreviewAttachment = useCallback((item: AttachmentItem) => {
    setPreviewItem(item);
    setIsPreviewOpen(true);
  }, []);

  // 处理移除单个附件 - 使用函数式更新避免闭包陷阱
  const handleRemoveAttachment = useCallback(
    (id: string) => {
      onAttachmentsChange((prev) => prev.filter((item) => item.id !== id));
    },
    [onAttachmentsChange],
  );

  const hasContext = contextItems.length > 0;
  const hasAttachments = attachments.length > 0;

  return (
    <div className="border-t border-pink-100 bg-gradient-to-t from-pink-50/30 to-white">
      {/* 附件指示器 - 有附件时显示 */}
      {hasAttachments && (
        <AttachmentIndicator
          items={attachments}
          onClear={onClearAttachments}
          onExpand={() => setIsAttachmentPopoverOpen(true)}
          onPreview={handlePreviewAttachment}
          onRemove={handleRemoveAttachment}
        />
      )}

      {/* 上下文引用指示器 */}
      {hasContext && (
        <ContextIndicator
          items={contextItems}
          onExpand={onExpandContext}
          onClear={onClearContext}
        />
      )}

      {/* 输入区域 */}
      <div className="p-4">
        <div className="flex items-end gap-3">
          {/* 附件按钮 - 最左侧 */}
          <AttachmentPopover
            open={isAttachmentPopoverOpen}
            onOpenChange={setIsAttachmentPopoverOpen}
            trigger={
              <AttachmentButton
                count={attachments.length}
                maxCount={ATTACHMENT_LIMITS.MAX_COUNT}
                disabled={disabled}
              />
            }
            selectedItems={attachments}
            onSelectionChange={onAttachmentsChange}
            maxCount={ATTACHMENT_LIMITS.MAX_COUNT}
            bookmarks={bookmarks}
            isLoadingBookmarks={isLoadingBookmarks}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isSearching={isSearching}
            isSearchMode={isSearchMode}
            isProcessingFile={isProcessingFile}
            onFilesAdd={onAddFiles}
          />

          {/* 工具下拉菜单 - YouMind 风格 */}
          <ToolDropdown
            value={selectedTool}
            onChange={onToolChange}
            disabled={disabled}
            className="flex-shrink-0"
          />

          {/* 输入框容器 - 糖果色风格 */}
          <div
            className={cn(
              "flex-1 bg-white rounded-2xl px-4 h-9 flex items-center transition-all duration-200",
              "border-2 border-pink-100",
              "focus-within:border-pink-300 focus-within:shadow-[0_0_0_3px_rgba(244,114,182,0.15)]",
            )}
          >
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className={cn(
                "w-full bg-transparent resize-none outline-none text-gray-700 placeholder-gray-400 text-[10px]",
                "h-6 min-h-[24px] max-h-[24px] border-0 p-0 focus-visible:ring-0",
              )}
              style={{
                overflow: "hidden",
              }}
            />
          </div>

          {/* 发送按钮 - 糖果色风格 */}
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
              "bg-gradient-to-r from-pink-400 to-rose-400 text-white",
              "shadow-lg shadow-pink-200 hover:shadow-pink-300 hover:scale-105",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none",
            )}
          >
            {disabled ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>

        {/* 工具提示 */}
        {selectedTool !== "auto" && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md">
              使用「{getToolDisplayName(selectedTool)}」工具
            </span>
            <span className="text-muted-foreground/60">点击工具按钮切换</span>
          </div>
        )}
      </div>

      {/* 附件预览模态框 - 使用错误边界包装 */}
      <AttachmentErrorBoundary
        onError={(error, errorInfo) => {
          clientLogger.error(
            {
              component: "AIInputEnhanced",
              error: error.message,
              componentStack: errorInfo.componentStack,
            },
            "AttachmentPreviewModal error",
          );
        }}
        onReset={() => {
          setPreviewItem(null);
          setIsPreviewOpen(false);
        }}
      >
        <AttachmentPreviewModal
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          attachment={previewItem}
        />
      </AttachmentErrorBoundary>
    </div>
  );
}

export default AIInputEnhanced;
