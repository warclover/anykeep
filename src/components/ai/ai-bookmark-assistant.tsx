/**
 * AI 书签助手（合并组件）
 *
 * 将 AIQuickActions（智能操作）与 AIBookmarkChat（问答对话）合并为一张卡片，
 * 消除功能重叠，提供统一的 AI 交互入口。
 *
 * 布局：
 *   - 操作区：智能标签 / 智能分类 / 提取要点 / 质量评估（调 quick-actions API，可写库）
 *   - 对话区：相似内容 / 解释内容 预设 + 自由输入（调 unified API，只读对话）
 *   - 结果区：提取要点面板 或 对话回复（共用）
 *
 * @version 1.0.0
 * @since 2026-02-24
 */

"use client";

import { useState, useCallback, useRef } from "react";
import {
  Bot,
  Wand2,
  Send,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { QuickActionType } from "@/lib/ai-actions";
import type {
  AutoTagResult,
  AutoClassifyResult,
  ExtractKeyResult,
  RateQualityResult,
} from "@/lib/ai-actions";
import type { AgentStreamChunk } from "@/lib/ai-agent";

import {
  type QuickActionResultData,
  type ActionState,
  type KeyPointsPanel as KeyPointsPanelData,
  type QuickActionDef,
  OPERATION_ACTIONS,
  CHAT_PRESETS,
  buildBookmarkAttachmentContext,
} from "./assistant-constants";
import { KeyPointsPanel } from "./key-points-panel";
import { ChatResponsePanel } from "./chat-response-panel";

export interface AIBookmarkAssistantProps {
  /** 用户 ID */
  userId: string;
  /** 书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  bookmarkTitle: string;
  /** 书签 URL */
  bookmarkUrl?: string;
  /** AI 生成的摘要 */
  bookmarkSummary?: string | null;
  /** 用户标签 */
  bookmarkTags?: string[] | null;
  /** 来源平台 */
  bookmarkPlatform?: string | null;
  /** 快捷操作完成回调（用于更新外部状态，如标签列表） */
  onActionComplete?: <T extends QuickActionType>(
    action: T,
    result: QuickActionResultData[T],
    applied: boolean,
  ) => void;
  /** 点击展开完整对话 */
  onOpenFullChat?: () => void;
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 组件
// =============================================================================

export function AIBookmarkAssistant({
  userId: _userId,
  bookmarkId,
  bookmarkTitle,
  bookmarkUrl,
  bookmarkSummary,
  bookmarkTags,
  bookmarkPlatform,
  onActionComplete,
  onOpenFullChat,
  className,
}: AIBookmarkAssistantProps) {
  // 快捷操作状态
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>(
    {},
  );
  const [keyPointsPanel, setKeyPointsPanel] =
    useState<KeyPointsPanelData | null>(null);

  // 对话状态
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // =============================================================================
  // 快捷操作逻辑
  // =============================================================================

  const formatResultMessage = (
    actionId: QuickActionType,
    data: QuickActionResultData[typeof actionId],
    applied: boolean,
  ): string => {
    switch (actionId) {
      case "auto-tag": {
        const d = data as AutoTagResult;
        if (d.newTags.length === 0) return "未发现新标签";
        return applied
          ? `已添加 ${d.newTags.length} 个标签`
          : `推荐 ${d.newTags.length} 个新标签`;
      }
      case "auto-classify": {
        const d = data as AutoClassifyResult;
        if (!d.folderId) return "建议创建新文件夹";
        return applied
          ? `已移动到「${d.folderName}」`
          : `推荐「${d.folderName}」`;
      }
      case "extract-key": {
        const d = data as ExtractKeyResult;
        return `提取 ${d.keyPoints.length} 个要点`;
      }
      case "rate-quality": {
        const d = data as RateQualityResult;
        return applied ? `评分 ${d.rating} 星` : `建议评分 ${d.rating} 星`;
      }
      default:
        return "完成";
    }
  };

  const executeAction = useCallback(
    async (action: QuickActionDef) => {
      const actionId = action.id;

      // 切换到操作时，清除对话结果
      setChatResponse(null);
      setChatError(null);

      setActionStates((prev) => ({
        ...prev,
        [actionId]: { status: "loading" },
      }));

      try {
        const res = await fetch("/api/ai/quick-actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: actionId,
            bookmarkId,
            autoApply: false,
          }),
        });

        const result = await res.json();
        if (!result.success) throw new Error(result.error || "操作失败");

        const message = formatResultMessage(
          actionId,
          result.data,
          result.applied,
        );

        setActionStates((prev) => ({
          ...prev,
          [actionId]: { status: "success", message },
        }));

        if (actionId === "extract-key") {
          const d = result.data as ExtractKeyResult;
          setKeyPointsPanel({
            tldr: d.tldr,
            keyPoints: d.keyPoints,
            keywords: d.keywords,
            sentiment: d.sentiment,
            readingTime: d.readingTime,
          });
        } else {
          setTimeout(() => {
            setActionStates((prev) => ({
              ...prev,
              [actionId]: { status: "idle" },
            }));
          }, 3000);
        }

        onActionComplete?.(actionId, result.data, result.applied);
      } catch (err) {
        const message = err instanceof Error ? err.message : "操作失败";
        setActionStates((prev) => ({
          ...prev,
          [actionId]: { status: "error", message },
        }));
        setTimeout(() => {
          setActionStates((prev) => ({
            ...prev,
            [actionId]: { status: "idle" },
          }));
        }, 5000);
      }
    },
    [bookmarkId, onActionComplete],
  );

  const dismissKeyPoints = useCallback(() => {
    setKeyPointsPanel(null);
    setActionStates((prev) => ({ ...prev, "extract-key": { status: "idle" } }));
  }, []);

  // =============================================================================
  // 对话逻辑
  // =============================================================================

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || chatLoading) return;

      // 切换到对话时，清除要点面板
      setKeyPointsPanel(null);
      setActionStates((prev) => ({
        ...prev,
        "extract-key": { status: "idle" },
      }));

      setChatLoading(true);
      setChatResponse(null);
      setChatError(null);

      abortControllerRef.current = new AbortController();

      try {
        const attachmentContext = buildBookmarkAttachmentContext({
          title: bookmarkTitle,
          url: bookmarkUrl,
          summary: bookmarkSummary,
          tags: bookmarkTags,
          platform: bookmarkPlatform,
        });

        const res = await fetch("/api/agent/unified", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            bookmarkIds: [bookmarkId],
            attachmentContext,
            options: { streaming: true, enableUnified: false },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "请求失败");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("无法获取响应流");

        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          for (const line of text.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const chunk: AgentStreamChunk = JSON.parse(line.slice(6));
                if (chunk.type === "text" && chunk.text) {
                  fullContent += chunk.text;
                  setChatResponse(fullContent);
                } else if (chunk.type === "error") {
                  setChatError(chunk.error || "发生错误");
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }

        if (!fullContent) setChatResponse("AI 没有返回内容，请重试");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setChatResponse("已取消");
        } else {
          setChatError(err instanceof Error ? err.message : "请求失败");
        }
      } finally {
        setChatLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      bookmarkId,
      bookmarkTitle,
      bookmarkUrl,
      bookmarkSummary,
      bookmarkTags,
      bookmarkPlatform,
      chatLoading,
    ],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (input.trim()) {
        sendMessage(input.trim());
        setInput("");
      }
    },
    [input, sendMessage],
  );

  const handleCancelChat = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setChatLoading(false);
  }, []);

  const handleClearChat = useCallback(() => {
    setChatResponse(null);
    setChatError(null);
  }, []);

  const isAnyActionLoading = Object.values(actionStates).some(
    (s) => s.status === "loading",
  );
  const hasResult = keyPointsPanel || chatResponse || chatError || chatLoading;

  // =============================================================================
  // 渲染
  // =============================================================================

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10">
            <Bot className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">AI 助手</CardTitle>
            <CardDescription className="text-xs">
              智能操作与快捷问答
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── 操作区 ── */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Wand2 className="size-3" />
            智能操作
          </p>
          <div className="flex gap-2">
            {OPERATION_ACTIONS.map((action) => {
              const state = actionStates[action.id];
              const isSuccess = state?.status === "success";
              const isError = state?.status === "error";
              const isLoading = state?.status === "loading";

              return (
                <TooltipProvider key={action.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-auto py-2 px-2.5 flex-1 flex items-center gap-1.5 transition-all",
                          isSuccess &&
                            "border-green-500 bg-green-50 dark:bg-green-900/20",
                          isError &&
                            "border-red-500 bg-red-50 dark:bg-red-900/20",
                        )}
                        onClick={() => executeAction(action)}
                        disabled={isAnyActionLoading || chatLoading}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-center size-6 shrink-0 rounded-full transition-colors",
                            isSuccess
                              ? "bg-green-100 dark:bg-green-900/30"
                              : isError
                                ? "bg-red-100 dark:bg-red-900/30"
                                : action.bgColor,
                          )}
                        >
                          {isLoading ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : isSuccess ? (
                            <CheckCircle className="size-4 text-green-500" />
                          ) : isError ? (
                            <AlertCircle className="size-4 text-red-500" />
                          ) : (
                            <action.icon
                              className={cn("size-4", action.color)}
                            />
                          )}
                        </div>
                        <span className="text-xs font-medium whitespace-nowrap">
                          {action.label}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{action.description}</p>
                      {state?.message && isSuccess && (
                        <p className="text-green-500 text-xs mt-1">
                          ✓ {state.message}
                        </p>
                      )}
                      {state?.message && isError && (
                        <p className="text-red-400 text-xs mt-1">
                          {state.message}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* ── 对话区 ── */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <HelpCircle className="size-3" />
            快捷问答
          </p>
          <div className="flex gap-2">
            {CHAT_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1"
                onClick={() => sendMessage(preset.prompt)}
                disabled={isAnyActionLoading || chatLoading}
              >
                <preset.icon className="size-3 mr-1" />
                {preset.label}
              </Button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你的问题..."
              disabled={chatLoading || isAnyActionLoading}
              className="h-9 text-sm"
            />
            <Button
              type="submit"
              size="sm"
              disabled={chatLoading || !input.trim() || isAnyActionLoading}
              className="h-9 px-3"
            >
              {chatLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </form>
        </div>

        {/* ── 结果区 ── */}
        {hasResult && (
          <>
            <Separator />

            {/* 提取要点面板 */}
            {keyPointsPanel && (
              <KeyPointsPanel
                data={keyPointsPanel}
                onDismiss={dismissKeyPoints}
              />
            )}

            {/* 对话回复区 */}
            <ChatResponsePanel
              chatResponse={chatResponse}
              chatError={chatError}
              chatLoading={chatLoading}
              onCancel={handleCancelChat}
              onClear={handleClearChat}
            />
          </>
        )}

        {/* 展开完整对话 */}
        {onOpenFullChat && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenFullChat}
            className="w-full h-8 text-xs text-muted-foreground"
          >
            <Sparkles className="size-3 mr-1" />
            展开完整对话
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default AIBookmarkAssistant;
