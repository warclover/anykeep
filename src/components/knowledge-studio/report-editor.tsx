"use client";

/**
 * Report Editor - 报告编辑器
 * @module components/knowledge-studio
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Edit2, Copy, Download, Share2 } from "lucide-react";
import type { SynthesisReport } from "@/lib/knowledge-studio/client";
import { BLUEPRINT_DISPLAY_CONFIG } from "@/lib/knowledge-studio/client";
import { ChatEditPanel } from "./chat-edit-panel";
import { CitationCard } from "./citation-card";
import type { ChatTurn, EditMode } from "@/lib/knowledge-studio/client";
import { useChatEdit } from "@/hooks/domain/knowledge-studio/use-chat-edit";
import { toast } from "sonner";

interface ReportEditorProps {
  report: SynthesisReport;
  onUpdate?: (content: string) => void;
  onExport?: (format: "markdown" | "html" | "pdf") => void;
  className?: string;
}

export function ReportEditor({
  report,
  onUpdate,
  onExport,
  className,
}: ReportEditorProps) {
  const [editingParagraphIndex, setEditingParagraphIndex] = useState<
    number | null
  >(null);

  const blueprintConfig = BLUEPRINT_DISPLAY_CONFIG[report.blueprintType];

  // Split content into paragraphs
  const paragraphs = useMemo(() => {
    return report.content.split("\n\n").filter((p) => p.trim());
  }, [report.content]);

  // 使用 useChatEdit Hook
  const {
    status: editStatus,
    chatHistory,
    result: editResult,
    error: editError,
    selectParagraph,
    sendEdit,
    applyEdit,
    revertEdit,
  } = useChatEdit({
    reportId: report.id,
    fullContent: report.content,
    onEditComplete: (result) => {
      if (
        result.success &&
        result.newContent &&
        editingParagraphIndex !== null
      ) {
        // 更新段落内容
        const newParagraphs = [...paragraphs];
        newParagraphs[editingParagraphIndex] = result.newContent;
        const newFullContent = newParagraphs.join("\n\n");
        onUpdate?.(newFullContent);
        toast.success("编辑已应用");
      }
    },
    onError: (error) => {
      toast.error(`编辑失败: ${error}`);
    },
  });

  // 当选择段落时，同步到 Hook
  const handleParagraphClick = useCallback(
    (index: number) => {
      setEditingParagraphIndex(index);
      selectParagraph(index);
    },
    [selectParagraph],
  );

  // 当编辑完成时，关闭编辑面板
  useEffect(() => {
    if (editStatus === "completed" && editResult?.success) {
      // 延迟关闭，让用户看到结果
      const timer = setTimeout(() => {
        setEditingParagraphIndex(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [editStatus, editResult]);

  // Handle send message in chat edit
  const handleSendMessage = useCallback(
    async (message: string, mode: EditMode) => {
      if (editingParagraphIndex === null) return;
      await sendEdit(message, mode);
    },
    [editingParagraphIndex, sendEdit],
  );

  // Accept edit
  const handleAcceptEdit = useCallback(
    (newContent: string) => {
      if (editingParagraphIndex === null || !editResult?.success) return;

      const newParagraphs = [...paragraphs];
      newParagraphs[editingParagraphIndex] = newContent;
      const newFullContent = newParagraphs.join("\n\n");

      onUpdate?.(newFullContent);
      applyEdit();
      setEditingParagraphIndex(null);
      toast.success("编辑已应用");
    },
    [editingParagraphIndex, paragraphs, onUpdate, editResult, applyEdit],
  );

  // Reject edit
  const handleRejectEdit = useCallback(() => {
    revertEdit();
  }, [revertEdit]);

  // 转换 chatHistory 为 ChatTurn 格式
  const chatTurns: ChatTurn[] = useMemo(() => {
    return chatHistory.map((turn) => ({
      id: turn.id,
      role: turn.role,
      content: turn.content,
      timestamp: turn.timestamp,
    }));
  }, [chatHistory]);

  // 转换 editResult 为 pendingEdit 格式
  const pendingEdit = useMemo(() => {
    if (editResult?.success && editResult.newContent && editResult.diff) {
      return {
        content: editResult.newContent,
        diff: editResult.diff,
      };
    }
    return null;
  }, [editResult]);

  const isEditLoading = editStatus === "loading" || editStatus === "streaming";

  // 显示错误信息
  useEffect(() => {
    if (editError) {
      toast.error(`编辑失败: ${editError}`);
    }
  }, [editError]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(report.content);
    // TODO: Show toast notification
  }, [report.content]);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{blueprintConfig.icon}</span>
          <div>
            <h2 className="font-semibold">{report.title || "未命名报告"}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{blueprintConfig.name}</Badge>
              <span>版本 {report.version}</span>
              <span>·</span>
              <span>{report.citations.length} 个引用</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-1 h-4 w-4" />
            复制
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport?.("markdown")}
          >
            <Download className="mr-1 h-4 w-4" />
            导出
          </Button>
          <Button variant="outline" size="sm">
            <Share2 className="mr-1 h-4 w-4" />
            分享
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1">
        {/* Report Content */}
        <ScrollArea className="flex-1 p-6">
          <article className="prose prose-slate max-w-none dark:prose-invert">
            {paragraphs.map((paragraph, index) => (
              <Sheet
                key={index}
                open={editingParagraphIndex === index}
                onOpenChange={(open) => {
                  if (!open) {
                    setEditingParagraphIndex(null);
                    setChatTurns([]);
                    setPendingEdit(null);
                  }
                }}
              >
                <SheetTrigger asChild>
                  <div
                    onClick={() => handleParagraphClick(index)}
                    className={cn(
                      "group relative cursor-pointer rounded-lg p-2 -mx-2 transition-colors",
                      "hover:bg-accent",
                      editingParagraphIndex === index &&
                        "bg-accent ring-2 ring-primary",
                    )}
                  >
                    {/* Edit icon on hover */}
                    <button
                      className={cn(
                        "absolute -right-2 -top-2 rounded-full bg-primary p-1.5 text-primary-foreground opacity-0 shadow-md transition-opacity",
                        "group-hover:opacity-100",
                      )}
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>

                    {/* Paragraph content */}
                    {paragraph.startsWith("#") ? (
                      <h2 className="!mt-0">
                        {paragraph.replace(/^#+\s*/, "")}
                      </h2>
                    ) : paragraph.startsWith("-") ||
                      paragraph.startsWith("*") ? (
                      <ul className="!mt-0">
                        {paragraph.split("\n").map((item, i) => (
                          <li key={i}>{item.replace(/^[-*]\s*/, "")}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="!mt-0">{paragraph}</p>
                    )}
                  </div>
                </SheetTrigger>

                <SheetContent
                  side="right"
                  className="w-[400px] p-0 sm:w-[500px]"
                >
                  <SheetHeader className="border-b p-4">
                    <SheetTitle className="flex items-center gap-2">
                      <Edit2 className="h-4 w-4" />
                      编辑段落 {index + 1}
                    </SheetTitle>
                  </SheetHeader>
                  <ChatEditPanel
                    paragraphContent={paragraph}
                    turns={chatTurns}
                    onSendMessage={handleSendMessage}
                    onAcceptEdit={handleAcceptEdit}
                    onRejectEdit={handleRejectEdit}
                    pendingEdit={pendingEdit ?? undefined}
                    isLoading={isEditLoading}
                    className="h-[calc(100vh-80px)]"
                  />
                </SheetContent>
              </Sheet>
            ))}
          </article>
        </ScrollArea>

        {/* Citations Sidebar */}
        {report.citations.length > 0 && (
          <aside className="w-64 border-l">
            <div className="p-4">
              <h3 className="font-medium">引用来源</h3>
              <div className="mt-3 space-y-3">
                {report.citations.map((citation, index) => (
                  <CitationCard
                    key={citation.bookmarkId}
                    citation={citation}
                    index={index}
                  />
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
