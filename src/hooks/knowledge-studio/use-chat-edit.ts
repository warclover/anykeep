/**
 * useChatEdit - 聊天式编辑 Hook
 * @module hooks/knowledge-studio
 * @description 管理 Chat-to-Edit 状态和 SSE 流
 */

"use client";

import { useState, useCallback, useRef } from "react";
import type { EditMode, StreamChunk, EditDiff } from "@/lib/knowledge-studio";

/**
 * 编辑状态
 */
export type EditStatus = "idle" | "editing" | "applying" | "success" | "error";

/**
 * 编辑指令
 */
export interface EditInstruction {
  paragraphIndex: number;
  instruction: string;
  mode?: EditMode;
  targetTone?: string;
}

/**
 * 对话消息
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  editResult?: {
    before: string;
    after: string;
  };
}

/**
 * 编辑结果
 */
export interface EditResult {
  success: boolean;
  newContent?: string;
  diff?: EditDiff;
  error?: {
    code: string;
    message: string;
    recoverable?: boolean;
  };
}

/**
 * Hook 返回值
 */
export interface UseChatEditReturn {
  status: EditStatus;
  messages: ChatMessage[];
  currentEdit: EditResult | null;
  edit: (reportId: string, instruction: EditInstruction) => Promise<void>;
  applyEdit: () => void;
  rejectEdit: () => void;
  clearHistory: () => void;
  cancel: () => void;
}

/**
 * useChatEdit Hook
 */
export function useChatEdit(): UseChatEditReturn {
  const [status, setStatus] = useState<EditStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentEdit, setCurrentEdit] = useState<EditResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const edit = useCallback(
    async (reportId: string, instruction: EditInstruction) => {
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      // 添加用户消息
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: instruction.instruction,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setStatus("editing");
      setCurrentEdit(null);

      try {
        const response = await fetch(
          `/api/knowledge-studio/reports/${reportId}/edit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paragraphIndex: instruction.paragraphIndex,
              instruction: instruction.instruction,
              mode: instruction.mode || "rewrite",
              targetTone: instruction.targetTone,
              conversationHistory: messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: m.timestamp.toISOString(),
              })),
            }),
            signal,
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "编辑请求失败");
        }

        if (!response.body) {
          throw new Error("无法读取响应流");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const chunk: StreamChunk = JSON.parse(line.slice(6));

                switch (chunk.type) {
                  case "text":
                    setCurrentEdit({
                      success: true,
                      newContent: chunk.data.newContent as string,
                      diff: chunk.data.diff as EditDiff,
                    });
                    break;

                  case "done":
                    setStatus("success");
                    // 添加 AI 回复消息
                    const assistantMessage: ChatMessage = {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      content: "已完成编辑，请确认修改。",
                      timestamp: new Date(),
                      editResult: {
                        before: "", // 需要从上下文获取
                        after: chunk.data.newContent as string,
                      },
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                    break;

                  case "error":
                    setStatus("error");
                    setCurrentEdit({
                      success: false,
                      error: {
                        code: chunk.data.error?.code || "UNKNOWN_ERROR",
                        message: chunk.data.error?.message || "编辑失败",
                        recoverable: chunk.data.error?.recoverable ?? false,
                      },
                    });
                    break;
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setStatus("idle");
          return;
        }

        setStatus("error");
        setCurrentEdit({
          success: false,
          error: {
            code: "EDIT_ERROR",
            message: error instanceof Error ? error.message : "编辑失败",
            recoverable: true,
          },
        });
      }
    },
    [messages],
  );

  const applyEdit = useCallback(() => {
    if (currentEdit?.success) {
      setStatus("idle");
      // 编辑已应用，可以触发外部回调
    }
  }, [currentEdit]);

  const rejectEdit = useCallback(() => {
    setCurrentEdit(null);
    setStatus("idle");
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setCurrentEdit(null);
    setStatus("idle");
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus("idle");
  }, []);

  return {
    status,
    messages,
    currentEdit,
    edit,
    applyEdit,
    rejectEdit,
    clearHistory,
    cancel,
  };
}
