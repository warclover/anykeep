"use client";

/**
 * Knowledge Studio - 聊天编辑 Hook
 * @module hooks/domain/knowledge-studio
 * @description 管理段落级聊天编辑，支持滑动窗口上下文
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  EditMode,
  EditDiff,
  ChatTurn,
  ParagraphInfo,
} from "@/lib/knowledge-studio";

// ============================================================================
// 类型定义
// ============================================================================

export type ChatEditStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "completed"
  | "error";

export interface ChatEditRequest {
  /** 报告 ID */
  reportId: string;
  /** 当前段落索引 */
  paragraphIndex: number;
  /** 用户输入 */
  userMessage: string;
  /** 编辑模式 */
  editMode?: EditMode;
}

export interface ChatEditResult {
  /** 是否成功 */
  success: boolean;
  /** 新内容 */
  newContent?: string;
  /** 差异对比 */
  diff?: EditDiff;
  /** 错误信息 */
  error?: string;
}

export interface UseChatEditOptions {
  /** 报告 ID */
  reportId: string;
  /** 全文内容 */
  fullContent: string;
  /** 编辑完成回调 */
  onEditComplete?: (result: ChatEditResult) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

export interface UseChatEditReturn {
  /** 当前状态 */
  status: ChatEditStatus;
  /** 聊天历史 */
  chatHistory: ChatTurn[];
  /** 当前选中段落 */
  selectedParagraph: ParagraphInfo | null;
  /** 流式响应内容 */
  streamResponse: string;
  /** 编辑结果 */
  result: ChatEditResult | null;
  /** 错误信息 */
  error: string | null;
  /** 选择段落 */
  selectParagraph: (index: number) => void;
  /** 发送编辑请求 */
  sendEdit: (message: string, mode?: EditMode) => Promise<void>;
  /** 应用编辑 */
  applyEdit: () => void;
  /** 撤销编辑 */
  revertEdit: () => void;
  /** 清除聊天历史 */
  clearHistory: () => void;
  /** 重置状态 */
  reset: () => void;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 解析段落信息
 */
function parseParagraphs(content: string): ParagraphInfo[] {
  const paragraphs = content.split(/\n\n+/);
  let offset = 0;

  return paragraphs.map((text, index) => {
    const paragraph: ParagraphInfo = {
      index,
      content: text,
      wordCount: text.length,
      startOffset: offset,
      endOffset: offset + text.length,
    };
    offset += text.length + 2; // +2 for \n\n
    return paragraph;
  });
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useChatEdit(options: UseChatEditOptions): UseChatEditReturn {
  const { reportId, fullContent, onEditComplete, onError } = options;

  // 状态管理
  const [status, setStatus] = useState<ChatEditStatus>("idle");
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [selectedParagraph, setSelectedParagraph] =
    useState<ParagraphInfo | null>(null);
  const [streamResponse, setStreamResponse] = useState("");
  const [result, setResult] = useState<ChatEditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 段落列表
  const paragraphsRef = useRef<ParagraphInfo[]>([]);

  // 取消控制
  const abortControllerRef = useRef<AbortController | null>(null);

  // 解析段落
  useEffect(() => {
    paragraphsRef.current = parseParagraphs(fullContent);
  }, [fullContent]);

  // 清理
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // 选择段落
  const selectParagraph = useCallback((index: number) => {
    const paragraph = paragraphsRef.current[index];
    if (paragraph) {
      setSelectedParagraph(paragraph);
      setChatHistory([]);
      setResult(null);
      setError(null);
    }
  }, []);

  // 重置状态
  const reset = useCallback(() => {
    setStatus("idle");
    setChatHistory([]);
    setSelectedParagraph(null);
    setStreamResponse("");
    setResult(null);
    setError(null);
  }, []);

  // 清除聊天历史
  const clearHistory = useCallback(() => {
    setChatHistory([]);
    setResult(null);
    setError(null);
  }, []);

  // 发送编辑请求
  const sendEdit = useCallback(
    async (message: string, mode: EditMode = "custom") => {
      if (!selectedParagraph) {
        setError("请先选择要编辑的段落");
        return;
      }

      setStatus("loading");
      setStreamResponse("");
      setResult(null);
      setError(null);

      // 添加用户消息到历史
      const userTurn: ChatTurn = {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userTurn]);

      // 创建 AbortController
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(
          `/api/knowledge-studio/reports/${reportId}/edit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paragraphIndex: selectedParagraph.index,
              userMessage: message,
              editMode: mode,
              chatHistory: chatHistory.slice(-6), // 保留最近 3 轮
            }),
            signal: abortControllerRef.current.signal,
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "编辑请求失败");
        }

        if (!response.body) {
          throw new Error("响应体为空");
        }

        setStatus("streaming");

        // 处理 SSE 流
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const chunk = JSON.parse(data);

                // 处理内容流
                if (chunk.type === "content" && chunk.data.content) {
                  assistantContent += chunk.data.content;
                  setStreamResponse(assistantContent);
                }

                // 处理完成事件
                if (chunk.type === "done") {
                  const editResult: ChatEditResult = {
                    success: chunk.data.success ?? true,
                    newContent: chunk.data.newContent,
                    diff: chunk.data.diff,
                  };
                  setResult(editResult);
                  setStatus("completed");

                  // 添加助手消息到历史
                  const assistantTurn: ChatTurn = {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: assistantContent,
                    timestamp: new Date(),
                  };
                  setChatHistory((prev) => [...prev, assistantTurn]);

                  onEditComplete?.(editResult);
                }

                // 处理错误
                if (chunk.type === "error") {
                  throw new Error(chunk.data.error?.message || "编辑失败");
                }
              } catch (parseError) {
                if (parseError instanceof SyntaxError) continue;
                throw parseError;
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setStatus("idle");
          return;
        }

        const errorMessage = err instanceof Error ? err.message : "未知错误";
        setError(errorMessage);
        setStatus("error");
        onError?.(errorMessage);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [selectedParagraph, reportId, chatHistory, onEditComplete, onError],
  );

  // 应用编辑
  const applyEdit = useCallback(() => {
    if (result?.success && result.newContent) {
      // 编辑已通过 API 保存，只需通知调用方
      onEditComplete?.(result);
    }
  }, [result, onEditComplete]);

  // 撤销编辑
  const revertEdit = useCallback(() => {
    setResult(null);
    setStreamResponse("");
  }, []);

  return {
    status,
    chatHistory,
    selectedParagraph,
    streamResponse,
    result,
    error,
    selectParagraph,
    sendEdit,
    applyEdit,
    revertEdit,
    clearHistory,
    reset,
  };
}
