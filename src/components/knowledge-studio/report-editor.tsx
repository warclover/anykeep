"use client";

/**
 * Report Editor - 报告编辑器（纯内容展示）
 * 工具栏功能已移至外层页面统一管理
 * @module components/knowledge-studio
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Edit2 } from "lucide-react";
import type { SynthesisReport } from "@/lib/knowledge-studio/client";
import { ChatEditPanel } from "./chat-edit-panel";
import { CitationCard } from "./citation-card";
import type { ChatTurn, EditMode } from "@/lib/knowledge-studio/client";
import { useChatEdit } from "@/hooks/domain/knowledge-studio/use-chat-edit";
import { toast } from "sonner";
import { AIMarkdown } from "@/components/ai/ai-markdown";

interface ReportEditorProps {
  report: SynthesisReport;
  onUpdate?: (content: string) => void;
  className?: string;
}

export function ReportEditor({
  report,
  onUpdate,
  className,
}: ReportEditorProps) {
  const [editingParagraphIndex, setEditingParagraphIndex] = useState<
    number | null
  >(null);

  // 优化排版：不再分割段落，直接渲染完整内容以保持排版一致性
  // 这样 Markdown 结构不会被破坏，排版更加整齐
  // 如果需要段落编辑功能，可以设置为 true，但排版会稍差
  const shouldSplitParagraphs = false;

  // 段落分割逻辑（仅在 shouldSplitParagraphs 为 true 时使用）
  const paragraphs = useMemo(() => {
    if (!shouldSplitParagraphs) return [];

    const content = report.content.trim();
    if (!content) return [];

    // 按双换行符分割，但保留标题和列表的上下文
    const splits = content.split(/\n\n+/);
    const result: string[] = [];

    for (let i = 0; i < splits.length; i++) {
      const paragraph = splits[i].trim();
      if (!paragraph) continue;

      // 如果当前段落是标题（以 # 开头），单独作为一个段落
      if (paragraph.startsWith("#")) {
        result.push(paragraph);
      }
      // 如果当前段落是列表（以 - 或 * 或数字开头），尝试合并后续的列表项
      else if (/^[-*]\s/.test(paragraph) || /^\d+\.\s/.test(paragraph)) {
        let listContent = paragraph;
        // 检查后续段落是否也是列表
        let j = i + 1;
        while (j < splits.length) {
          const nextPara = splits[j].trim();
          if (!nextPara) break;
          // 如果下一段也是列表，合并
          if (/^[-*]\s/.test(nextPara) || /^\d+\.\s/.test(nextPara)) {
            listContent += "\n\n" + nextPara;
            j++;
          } else {
            break;
          }
        }
        result.push(listContent);
        i = j - 1; // 跳过已合并的段落
      } else {
        result.push(paragraph);
      }
    }

    return result;
  }, [report.content, shouldSplitParagraphs]);

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
      if (result.success && result.newContent) {
        if (shouldSplitParagraphs && editingParagraphIndex !== null) {
          // 段落分割模式：更新段落内容
          const newParagraphs = [...paragraphs];
          newParagraphs[editingParagraphIndex] = result.newContent;
          const newFullContent = newParagraphs.join("\n\n");
          onUpdate?.(newFullContent);
        } else {
          // 完整内容模式：直接使用新内容
          onUpdate?.(result.newContent);
        }
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

      // 如果禁用了段落分割，直接更新完整内容
      if (shouldSplitParagraphs) {
        const newParagraphs = [...paragraphs];
        newParagraphs[editingParagraphIndex] = newContent;
        const newFullContent = newParagraphs.join("\n\n");
        onUpdate?.(newFullContent);
      } else {
        // 直接使用新内容
        onUpdate?.(newContent);
      }

      applyEdit();
      setEditingParagraphIndex(null);
      toast.success("编辑已应用");
    },
    [
      editingParagraphIndex,
      paragraphs,
      onUpdate,
      editResult,
      applyEdit,
      shouldSplitParagraphs,
    ],
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

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Main Content */}
      <div className="flex flex-1">
        {/* Report Content */}
        <ScrollArea className="flex-1">
          <article className="max-w-4xl mx-auto px-8 py-10 bg-background">
            {shouldSplitParagraphs ? (
              /* 段落分割模式（支持逐段编辑） */
              <div className="space-y-3">
                {paragraphs.map((paragraph, index) => (
                  <Sheet
                    key={index}
                    open={editingParagraphIndex === index}
                    onOpenChange={(open) => {
                      if (!open) {
                        setEditingParagraphIndex(null);
                      }
                    }}
                  >
                    <SheetTrigger asChild>
                      <div
                        onClick={() => handleParagraphClick(index)}
                        className={cn(
                          "group relative cursor-pointer rounded-lg p-5 transition-all",
                          "hover:bg-accent/50 hover:shadow-sm",
                          editingParagraphIndex === index &&
                            "bg-accent ring-2 ring-primary shadow-md",
                        )}
                      >
                        {/* Edit icon on hover */}
                        <button
                          className={cn(
                            "absolute -right-2 -top-2 rounded-full bg-primary p-1.5 text-primary-foreground opacity-0 shadow-md transition-opacity z-10",
                            "group-hover:opacity-100",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleParagraphClick(index);
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>

                        {/* Paragraph content with improved typography */}
                        <div
                          className={cn(
                            "prose prose-slate max-w-none dark:prose-invert",
                            // 统一的文字样式
                            "prose-p:text-justify prose-p:leading-[1.85] prose-p:text-[16px] prose-p:text-foreground",
                            "prose-p:my-[1em] prose-p:first:mt-0 prose-p:last:mb-0",
                            // 标题样式
                            "prose-h1:text-3xl prose-h1:font-bold prose-h1:tracking-tight prose-h1:text-foreground",
                            "prose-h1:mt-[1.5em] prose-h1:mb-[0.8em] prose-h1:first:mt-0 prose-h1:border-b prose-h1:border-border prose-h1:pb-2",
                            "prose-h2:text-2xl prose-h2:font-semibold prose-h2:tracking-tight prose-h2:text-foreground",
                            "prose-h2:mt-[1.3em] prose-h2:mb-[0.7em] prose-h2:first:mt-0",
                            "prose-h3:text-xl prose-h3:font-semibold prose-h3:text-foreground",
                            "prose-h3:mt-[1.2em] prose-h3:mb-[0.6em] prose-h3:first:mt-0",
                            "prose-h4:text-lg prose-h4:font-medium prose-h4:text-foreground",
                            "prose-h4:mt-[1em] prose-h4:mb-[0.5em] prose-h4:first:mt-0",
                            // 列表样式
                            "prose-ul:my-[1em] prose-ul:pl-6 prose-ul:list-disc",
                            "prose-ol:my-[1em] prose-ol:pl-6 prose-ol:list-decimal",
                            "prose-li:leading-[1.85] prose-li:my-[0.3em] prose-li:pl-1 prose-li:text-[16px]",
                            // 其他样式
                            "prose-blockquote:border-l-4 prose-blockquote:border-primary/40 prose-blockquote:pl-5 prose-blockquote:italic prose-blockquote:my-[1.2em] prose-blockquote:text-muted-foreground",
                            "prose-code:text-sm prose-code:font-mono prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
                            "prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:my-[1.2em] prose-pre:border prose-pre:border-border",
                            "prose-a:text-primary prose-a:underline prose-a:underline-offset-2 prose-a:decoration-primary/50 hover:prose-a:decoration-primary",
                            "prose-strong:font-semibold prose-strong:text-foreground",
                            "prose-em:italic",
                            "prose-hr:my-[1.5em] prose-hr:border-border",
                          )}
                        >
                          <AIMarkdown content={paragraph} />
                        </div>
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
              </div>
            ) : (
              /* 完整内容模式（更好的排版，但编辑功能受限） */
              <div
                className={cn(
                  // 基础排版样式
                  "prose prose-slate max-w-none dark:prose-invert",
                  // 文字对齐和行高 - 使用两端对齐和合适的行高
                  "prose-p:text-justify prose-p:leading-[1.85] prose-p:text-[16px] prose-p:text-foreground",
                  "prose-p:my-[1.2em] prose-p:first:mt-0 prose-p:last:mb-0",
                  // 标题样式 - 统一间距和字体
                  "prose-h1:text-3xl prose-h1:font-bold prose-h1:tracking-tight prose-h1:text-foreground",
                  "prose-h1:mt-[2em] prose-h1:mb-[0.8em] prose-h1:first:mt-0 prose-h1:border-b prose-h1:border-border prose-h1:pb-2",
                  "prose-h2:text-2xl prose-h2:font-semibold prose-h2:tracking-tight prose-h2:text-foreground",
                  "prose-h2:mt-[1.8em] prose-h2:mb-[0.7em] prose-h2:first:mt-0",
                  "prose-h3:text-xl prose-h3:font-semibold prose-h3:text-foreground",
                  "prose-h3:mt-[1.5em] prose-h3:mb-[0.6em] prose-h3:first:mt-0",
                  "prose-h4:text-lg prose-h4:font-medium prose-h4:text-foreground",
                  "prose-h4:mt-[1.3em] prose-h4:mb-[0.5em] prose-h4:first:mt-0",
                  "prose-h5:text-base prose-h5:font-medium prose-h5:text-foreground",
                  "prose-h5:mt-[1.2em] prose-h5:mb-[0.4em] prose-h5:first:mt-0",
                  "prose-h6:text-sm prose-h6:font-medium prose-h6:text-foreground",
                  "prose-h6:mt-[1em] prose-h6:mb-[0.3em] prose-h6:first:mt-0",
                  // 列表样式 - 统一间距
                  "prose-ul:my-[1.2em] prose-ul:pl-6 prose-ul:list-disc",
                  "prose-ol:my-[1.2em] prose-ol:pl-6 prose-ol:list-decimal",
                  "prose-li:leading-[1.85] prose-li:my-[0.4em] prose-li:pl-1 prose-li:text-[16px]",
                  // 引用块
                  "prose-blockquote:border-l-4 prose-blockquote:border-primary/40 prose-blockquote:pl-5 prose-blockquote:pr-4",
                  "prose-blockquote:italic prose-blockquote:my-[1.5em] prose-blockquote:text-muted-foreground",
                  "prose-blockquote:bg-muted/30 prose-blockquote:py-2 prose-blockquote:rounded-r",
                  // 代码样式
                  "prose-code:text-sm prose-code:font-mono prose-code:bg-muted prose-code:text-foreground",
                  "prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none",
                  "prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto",
                  "prose-pre:my-[1.5em] prose-pre:border prose-pre:border-border",
                  "prose-pre:code:bg-transparent prose-pre:code:p-0",
                  // 表格样式
                  "prose-table:w-full prose-table:my-[1.5em] prose-table:border-collapse",
                  "prose-th:font-semibold prose-th:bg-muted prose-th:p-3 prose-th:border prose-th:border-border",
                  "prose-th:text-left prose-th:text-foreground",
                  "prose-td:p-3 prose-td:border prose-td:border-border prose-td:text-foreground",
                  // 链接样式
                  "prose-a:text-primary prose-a:underline prose-a:underline-offset-2",
                  "prose-a:decoration-primary/50 hover:prose-a:decoration-primary",
                  // 强调样式
                  "prose-strong:font-semibold prose-strong:text-foreground",
                  "prose-em:italic prose-em:text-foreground",
                  // 分隔线
                  "prose-hr:my-[2em] prose-hr:border-border prose-hr:border-t-2",
                  // 图片样式
                  "prose-img:rounded-lg prose-img:my-[1.5em] prose-img:shadow-md",
                )}
              >
                <AIMarkdown content={report.content} />
              </div>
            )}
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
