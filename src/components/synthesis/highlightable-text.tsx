/**
 * 可高亮文本组件
 *
 * 功能：
 * - 文本选择时显示高亮工具栏
 * - 渲染已有高亮
 * - 点击高亮显示备注/操作
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { Highlighter, MessageSquare, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_CLASSES,
  type HighlightColor,
  type HighlightSection,
  type SynthesisHighlight,
} from "@/lib/synthesis/types/highlight";

// ============================================================================
// 类型定义
// ============================================================================

interface HighlightableTextProps {
  /** 文本内容 */
  content: string;
  /** 区块类型 */
  section: HighlightSection;
  /** 项目索引（用于共识/分歧等列表项） */
  itemIndex?: number;
  /** 已有高亮列表 */
  highlights: SynthesisHighlight[];
  /** 创建高亮回调 */
  onCreateHighlight: (
    content: string,
    start: number,
    end: number,
    color: HighlightColor,
  ) => Promise<void>;
  /** 更新高亮回调 */
  onUpdateHighlight: (
    highlightId: string,
    updates: { note?: string; color?: HighlightColor },
  ) => Promise<void>;
  /** 删除高亮回调 */
  onDeleteHighlight: (highlightId: string) => Promise<void>;
  /** 自定义类名 */
  className?: string;
}

interface SelectionState {
  text: string;
  start: number;
  end: number;
  rect: DOMRect | null;
}

// ============================================================================
// 颜色选择器组件
// ============================================================================

function ColorPicker({
  value,
  onChange,
}: {
  value: HighlightColor;
  onChange: (color: HighlightColor) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onChange(color)}
          className={cn(
            "w-5 h-5 rounded-full border-2 transition-transform",
            HIGHLIGHT_COLOR_CLASSES[color].bg,
            value === color
              ? "scale-125 border-gray-600"
              : "border-transparent hover:scale-110",
          )}
          title={color}
        />
      ))}
    </div>
  );
}

// ============================================================================
// 选择工具栏组件
// ============================================================================

function SelectionToolbar({
  position,
  onHighlight,
  onClose,
}: {
  position: { top: number; left: number };
  onHighlight: (color: HighlightColor) => void;
  onClose: () => void;
}) {
  const [selectedColor, setSelectedColor] = useState<HighlightColor>("yellow");

  return (
    <div
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-2 flex items-center gap-2"
      style={{
        top: position.top - 50,
        left: position.left,
        transform: "translateX(-50%)",
      }}
    >
      <ColorPicker value={selectedColor} onChange={setSelectedColor} />
      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={() => onHighlight(selectedColor)}
      >
        <Highlighter className="h-4 w-4 mr-1" />
        高亮
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// 高亮弹窗组件
// ============================================================================

function HighlightPopover({
  highlight,
  onUpdate,
  onDelete,
  children,
}: {
  highlight: SynthesisHighlight;
  onUpdate: (updates: {
    note?: string;
    color?: HighlightColor;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  children: ReactNode;
}) {
  const [note, setNote] = useState(highlight.note || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSaveNote = async () => {
    await onUpdate({ note });
    setIsEditing(false);
  };

  const handleColorChange = async (color: HighlightColor) => {
    await onUpdate({ color });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          {/* 颜色选择 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">颜色</span>
            <ColorPicker value={highlight.color} onChange={handleColorChange} />
          </div>

          {/* 备注 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">备注</span>
              {!isEditing && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => setIsEditing(true)}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {highlight.note ? "编辑" : "添加"}
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="添加备注..."
                  className="text-sm min-h-[80px]"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNote(highlight.note || "");
                      setIsEditing(false);
                    }}
                  >
                    取消
                  </Button>
                  <Button size="sm" onClick={handleSaveNote}>
                    保存
                  </Button>
                </div>
              </div>
            ) : highlight.note ? (
              <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                {highlight.note}
              </p>
            ) : null}
          </div>

          {/* 删除按钮 */}
          <div className="pt-2 border-t">
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={async () => {
                await onDelete();
                setIsOpen(false);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除高亮
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function HighlightableText({
  content,
  section,
  itemIndex,
  highlights,
  onCreateHighlight,
  onUpdateHighlight,
  onDeleteHighlight,
  className,
}: HighlightableTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);

  // 过滤当前区块的高亮
  const sectionHighlights = useMemo(
    () =>
      highlights.filter(
        (h) =>
          h.position.section === section &&
          (itemIndex === undefined || h.position.itemIndex === itemIndex),
      ),
    [highlights, section, itemIndex],
  );

  // 处理文本选择
  const handleMouseUp = useCallback(() => {
    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed) {
      setSelection(null);
      return;
    }

    const selectedText = windowSelection.toString().trim();
    if (!selectedText || selectedText.length < 2) {
      setSelection(null);
      return;
    }

    // 确保选择在当前容器内
    const range = windowSelection.getRangeAt(0);
    if (!containerRef.current?.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    // 计算在原始文本中的位置
    const start = content.indexOf(selectedText);
    if (start === -1) {
      setSelection(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    setSelection({
      text: selectedText,
      start,
      end: start + selectedText.length,
      rect,
    });
  }, [content]);

  // 创建高亮
  const handleCreateHighlight = useCallback(
    async (color: HighlightColor) => {
      if (!selection) return;

      await onCreateHighlight(
        selection.text,
        selection.start,
        selection.end,
        color,
      );

      // 清除选择
      window.getSelection()?.removeAllRanges();
      setSelection(null);
    },
    [selection, onCreateHighlight],
  );

  // 清除选择
  const handleClearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, []);

  // 点击外部清除选择
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        handleClearSelection();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClearSelection]);

  // 渲染带高亮的文本
  const renderedContent = useMemo(() => {
    if (sectionHighlights.length === 0) {
      return content;
    }

    // 按位置排序高亮
    const sortedHighlights = [...sectionHighlights].sort(
      (a, b) => a.position.start - b.position.start,
    );

    const parts: ReactNode[] = [];
    let lastEnd = 0;

    sortedHighlights.forEach((highlight, index) => {
      const { start, end } = highlight.position;

      // 添加高亮前的普通文本
      if (start > lastEnd) {
        parts.push(
          <span key={`text-${index}`}>{content.slice(lastEnd, start)}</span>,
        );
      }

      // 添加高亮文本
      const colorClasses = HIGHLIGHT_COLOR_CLASSES[highlight.color];
      parts.push(
        <HighlightPopover
          key={highlight.id}
          highlight={highlight}
          onUpdate={(updates) => onUpdateHighlight(highlight.id, updates)}
          onDelete={() => onDeleteHighlight(highlight.id)}
        >
          <mark
            className={cn(
              "cursor-pointer rounded px-0.5 transition-colors",
              colorClasses.bg,
              colorClasses.hover,
              highlight.note && "underline decoration-dotted",
            )}
          >
            {content.slice(start, end)}
          </mark>
        </HighlightPopover>,
      );

      lastEnd = end;
    });

    // 添加最后的普通文本
    if (lastEnd < content.length) {
      parts.push(<span key="text-last">{content.slice(lastEnd)}</span>);
    }

    return parts;
  }, [content, sectionHighlights, onUpdateHighlight, onDeleteHighlight]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* 文本内容 */}
      <div
        className="text-sm leading-relaxed whitespace-pre-wrap select-text"
        onMouseUp={handleMouseUp}
      >
        {renderedContent}
      </div>

      {/* 选择工具栏 */}
      {selection && selection.rect && (
        <SelectionToolbar
          position={{
            top: selection.rect.top + window.scrollY,
            left: selection.rect.left + selection.rect.width / 2,
          }}
          onHighlight={handleCreateHighlight}
          onClose={handleClearSelection}
        />
      )}
    </div>
  );
}
