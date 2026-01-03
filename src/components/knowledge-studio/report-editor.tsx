"use client";

/**
 * Report Editor - 报告编辑器
 * @module components/knowledge-studio
 */

import { useState, useCallback, useMemo } from "react";
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
import type { ChatTurn, EditMode, EditDiff } from "@/lib/knowledge-studio/client";

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
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [pendingEdit, setPendingEdit] = useState<{
    content: string;
    diff: EditDiff;
  } | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);

  const blueprintConfig = BLUEPRINT_DISPLAY_CONFIG[report.blueprintType];

  // Split content into paragraphs
  const paragraphs = useMemo(() => {
    return report.content.split("\n\n").filter((p) => p.trim());
  }, [report.content]);

  // Handle paragraph click for editing
  const handleParagraphClick = useCallback((index: number) => {
    setEditingParagraphIndex(index);
    setChatTurns([]);
    setPendingEdit(null);
  }, []);

  // Handle send message in chat edit
  const handleSendMessage = useCallback(
    async (message: string, _mode: EditMode) => {
      if (editingParagraphIndex === null) return;

      // Add user message
      const userTurn: ChatTurn = {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        timestamp: new Date(),
      };
      setChatTurns((prev) => [...prev, userTurn]);

      setIsEditLoading(true);

      try {
        // TODO: Call actual edit API
        // Simulate API response
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const originalContent = paragraphs[editingParagraphIndex];
        const newContent = `[已按「${message}」修改] ${originalContent}`;

        // Create diff
        const diff: EditDiff = {
          before: originalContent,
          after: newContent,
          changes: [
            { type: "add", value: `[已按「${message}」修改] ` },
            { type: "unchanged", value: originalContent },
          ],
          stats: { added: 1, removed: 0, unchanged: 1 },
        };

        setPendingEdit({ content: newContent, diff });

        // Add assistant response
        const assistantTurn: ChatTurn = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "已根据您的指示生成修改建议，请查看上方预览。",
          timestamp: new Date(),
        };
        setChatTurns((prev) => [...prev, assistantTurn]);
      } catch {
        // Handle error
        const errorTurn: ChatTurn = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "抱歉，修改失败。请稍后重试。",
          timestamp: new Date(),
        };
        setChatTurns((prev) => [...prev, errorTurn]);
      } finally {
        setIsEditLoading(false);
      }
    },
    [editingParagraphIndex, paragraphs],
  );

  // Accept edit
  const handleAcceptEdit = useCallback(
    (newContent: string) => {
      if (editingParagraphIndex === null) return;

      const newParagraphs = [...paragraphs];
      newParagraphs[editingParagraphIndex] = newContent;
      const newFullContent = newParagraphs.join("\n\n");

      onUpdate?.(newFullContent);
      setPendingEdit(null);
      setEditingParagraphIndex(null);
      setChatTurns([]);
    },
    [editingParagraphIndex, paragraphs, onUpdate],
  );

  // Reject edit
  const handleRejectEdit = useCallback(() => {
    setPendingEdit(null);
  }, []);

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
