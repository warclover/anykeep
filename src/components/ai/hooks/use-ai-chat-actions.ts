"use client";

import {
  useState,
  useCallback,
  useEffect,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ToolType } from "../phase4/types";
import type { DisplayMessage, SuggestionItem } from "../types";
import { adaptBackendChunk, processUnifiedChunk } from "../types";
import type { AgentStreamChunk } from "@/lib/ai-agent";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";
import { buildAttachmentContextFull } from "@/lib/ai-agent/context/attachment-context-builder";
import { clientLogger } from "@/lib/client-logger";
import { API_AGENT } from "@/lib/constants/api-paths";
import type { AttachmentItem } from "@/components/ai/attachment/types";
import type { useAIConversation } from "./use-ai-conversation";

export interface UseAIChatActionsOptions {
  conversation: ReturnType<typeof useAIConversation>;
  bookmarkIds?: number[];
  folderId?: number;
  useUnifiedEngine: boolean;
  getContextReferences: () => { bookmarkIds?: number[]; folderIds?: number[] };
  attachments: AttachmentItem[];
  setPendingConfirmations: Dispatch<SetStateAction<PendingConfirmation[]>>;
  setShowMemoryHint: Dispatch<SetStateAction<boolean>>;
  autoSendInitialMessage?: boolean;
  initialMessage?: string;
}

export function useAIChatActions({
  conversation,
  bookmarkIds,
  folderId,
  useUnifiedEngine,
  getContextReferences,
  attachments,
  setPendingConfirmations,
  setShowMemoryHint,
  autoSendInitialMessage,
  initialMessage,
}: UseAIChatActionsOptions) {
  const [selectedTool, setSelectedTool] = useState<ToolType>("auto");
  const {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    setIsLoading,
    conversationId,
    setConversationId,
    abortControllerRef,
    initialMessageProcessedRef,
  } = conversation;
  const handleAgentChunk = useCallback(
    (
      chunk: AgentStreamChunk,
      messageId: string,
      currentMessage: DisplayMessage,
      updateMessage: (msg: DisplayMessage) => void,
    ) => {
      let toolCalls = currentMessage.toolCalls || [];
      const confirmations = currentMessage.pendingConfirmations || [];

      if (chunk.type === "text" && chunk.text) {
        const newContent = (currentMessage.content || "") + chunk.text;
        const updatedMessage = { ...currentMessage, content: newContent };
        updateMessage(updatedMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m)),
        );
      } else if (chunk.type === "tool-call" && chunk.toolCall) {
        toolCalls = [...toolCalls, chunk.toolCall];
        const updatedMessage = { ...currentMessage, toolCalls };
        updateMessage(updatedMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m)),
        );
      } else if (chunk.type === "confirmation" && chunk.confirmation) {
        const confirmation = chunk.confirmation;
        confirmations.push(confirmation);
        const updatedMessage = {
          ...currentMessage,
          pendingConfirmations: [...confirmations],
        };
        updateMessage(updatedMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m)),
        );
        setPendingConfirmations((prev) => [...prev, confirmation]);
      } else if (chunk.type === "done" && chunk.result) {
        if (chunk.result.conversationId) {
          setConversationId(chunk.result.conversationId);
        }
        const updatedMessage = {
          ...currentMessage,
          content: currentMessage.content || chunk.result.content,
          status: "completed" as const,
          toolCalls: chunk.result.toolCalls,
          pendingConfirmations:
            confirmations.length > 0 ? confirmations : undefined,
        };
        updateMessage(updatedMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m)),
        );
      } else if (chunk.type === "error") {
        const updatedMessage = {
          ...currentMessage,
          status: "error" as const,
          error: chunk.error,
        };
        updateMessage(updatedMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m)),
        );
      }
    },
    [setMessages, setPendingConfirmations, setConversationId],
  );

  const sendMessage = useCallback(
    async (content: string, tool: ToolType = "auto") => {
      if (!content.trim() || isLoading) return;

      const userMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        status: "sent",
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      const assistantMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        status: "streaming",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      abortControllerRef.current = new AbortController();

      try {
        const messageHistory = messages
          .filter(
            (m) =>
              m.status === "completed" &&
              (m.role === "user" || m.role === "assistant"),
          )
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        const contextReferences = getContextReferences();

        const attachmentResult = buildAttachmentContextFull(attachments);
        const attachmentContext = attachmentResult.context || undefined;
        const attachmentBookmarkIds =
          attachmentResult.bookmarkIds.length > 0
            ? attachmentResult.bookmarkIds
            : undefined;
        const attachmentMetadata =
          attachmentResult.metadata.bookmarkCount > 0 ||
          attachmentResult.metadata.fileCount > 0
            ? attachmentResult.metadata
            : undefined;

        const requestBody: Record<string, unknown> = {
          message: userMessage.content,
          conversationId,
          messageHistory,
          bookmarkIds,
          folderId,
          options: {
            streaming: true,
            enableUnified: useUnifiedEngine,
          },
        };

        if (attachmentContext) {
          requestBody.attachmentContext = attachmentContext;
        }
        if (attachmentBookmarkIds) {
          requestBody.attachmentBookmarkIds = attachmentBookmarkIds;
        }
        if (attachmentMetadata) {
          requestBody.attachmentMetadata = attachmentMetadata;
        }

        if (tool !== "auto") {
          requestBody.explicitTool = {
            toolId: tool,
            skipIntentClassification: true,
          };
        }

        if (contextReferences.bookmarkIds || contextReferences.folderIds) {
          requestBody.contextReferences = contextReferences;
        }

        const response = await fetch(API_AGENT.unified, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "请求失败");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("无法获取响应流");
        }

        const decoder = new TextDecoder();
        let currentMessage: DisplayMessage = { ...assistantMessage };
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });

          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const rawChunk = JSON.parse(line.slice(6));

                if (useUnifiedEngine) {
                  const chunk = adaptBackendChunk(rawChunk);
                  currentMessage = processUnifiedChunk(chunk, currentMessage);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id ? currentMessage : m,
                    ),
                  );

                  if (chunk.type === "confirmation" && chunk.confirmation) {
                    setPendingConfirmations((prev) => [
                      ...prev,
                      chunk.confirmation,
                    ]);
                  }

                  if (chunk.type === "done" && chunk.data.conversationId) {
                    setConversationId(chunk.data.conversationId);
                  }

                  if (chunk.type === "memory" && chunk.memory?.resolved) {
                    setShowMemoryHint(true);
                    setTimeout(() => setShowMemoryHint(false), 3000);
                  }
                } else {
                  const agentChunk = rawChunk as AgentStreamChunk;
                  handleAgentChunk(
                    agentChunk,
                    assistantMessage.id,
                    currentMessage,
                    (msg) => {
                      currentMessage = msg;
                    },
                  );
                }
              } catch (parseError) {
                if (process.env.NODE_ENV === "development") {
                  const errorMessage =
                    parseError instanceof Error
                      ? parseError.message
                      : String(parseError);
                  clientLogger.error(
                    {
                      error: errorMessage,
                      lineLength: line.length,
                      linePreview: line.slice(0, 200),
                      lineTail:
                        line.length > 200 ? line.slice(-100) : undefined,
                    },
                    "SSE parse error",
                  );
                }
              }
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id && m.status === "streaming"
              ? { ...m, status: "completed" }
              : m,
          ),
        );

        setSelectedTool("auto");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, status: "completed", content: m.content || "已取消" }
                : m,
            ),
          );
        } else {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, status: "error", error: errorMessage }
                : m,
            ),
          );
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },

    [
      isLoading,
      conversationId,
      bookmarkIds,
      folderId,
      messages,
      useUnifiedEngine,
      getContextReferences,
      attachments,
      handleAgentChunk,
      setMessages,
      setInput,
      setIsLoading,
      setConversationId,
      setPendingConfirmations,
      setShowMemoryHint,
      setSelectedTool,
      abortControllerRef,
    ],
  );

  // 自动发送初始消息
  useEffect(() => {
    if (
      autoSendInitialMessage &&
      initialMessage &&
      !initialMessageProcessedRef.current &&
      !isLoading
    ) {
      initialMessageProcessedRef.current = true;
      const timer = setTimeout(() => {
        sendMessage(initialMessage);
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialMessageProcessedRef 是 useRef，引用恒定不变
  }, [autoSendInitialMessage, initialMessage, isLoading, sendMessage]);

  const handleSubmit = useCallback(
    (tool: ToolType) => {
      sendMessage(input, tool);
    },
    [input, sendMessage],
  );

  const handleClear = useCallback(
    (clearContextItems: () => void) => {
      setMessages([]);
      setConversationId(undefined);
      setPendingConfirmations([]);
      clearContextItems();
    },
    [setMessages, setConversationId, setPendingConfirmations],
  );

  const handleRetry = useCallback(() => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUserMessage) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "assistant" && lastMessage.status === "error") {
      setMessages((prev) => prev.slice(0, -1));
    }

    setInput(lastUserMessage.content);
  }, [messages, setMessages, setInput]);

  const handleSuggestionClick = useCallback(
    (suggestion: SuggestionItem) => {
      const messageContent = suggestion.action || suggestion.text;
      sendMessage(messageContent);
    },
    [sendMessage],
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex <= 0) return;

      const userMessage = messages[messageIndex - 1];
      if (userMessage.role !== "user") return;

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      sendMessage(userMessage.content);
    },
    [messages, sendMessage, setMessages],
  );

  return {
    selectedTool,
    setSelectedTool,
    sendMessage,
    handleSubmit,
    handleClear,
    handleRetry,
    handleSuggestionClick,
    handleRegenerate,
  };
}
