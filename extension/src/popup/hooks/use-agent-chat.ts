/**
 * Agent 聊天通信 Hook
 *
 * 通过 chrome.runtime.connect 与 Background 建立长连接
 * 处理 SSE 流式响应
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "../stores/chat-store";
import type { AgentStreamChunk } from "../../background/api";

export interface UseAgentChatOptions {
  /** 是否包含页面上下文 */
  includePageContext?: boolean;
  /** 是否包含选中文本 */
  includeSelection?: boolean;
}

export interface UseAgentChatReturn {
  /** 发送消息 */
  sendMessage: (message: string) => void;
  /** 发送快捷操作 */
  sendQuickAction: (
    action:
      | "save_page"
      | "save_selection"
      | "summarize"
      | "extract_links"
      | "ask_about_page",
  ) => void;
  /** 取消当前请求 */
  cancel: () => void;
  /** 清除聊天 */
  clearChat: () => void;
  /** 是否正在连接 */
  isConnecting: boolean;
}

/**
 * Agent 聊天 Hook
 */
export function useAgentChat(
  options: UseAgentChatOptions = {},
): UseAgentChatReturn {
  const { includePageContext = true, includeSelection = false } = options;

  const portRef = useRef<chrome.runtime.Port | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const {
    conversationId,
    messages,
    setLoading,
    setTyping,
    setError,
    setConversationId,
    addUserMessage,
    addAssistantMessage,
    updateLastAssistantMessage,
    addActionToLastMessage,
    clearChat: clearChatStore,
  } = useChatStore();

  /**
   * 处理端口消息
   */
  const handlePortMessage = useCallback(
    (message: {
      type: string;
      chunk?: AgentStreamChunk;
      error?: string;
      conversationId?: string;
    }) => {
      switch (message.type) {
        case "AGENT_CHUNK": {
          const chunk = message.chunk;
          if (!chunk) return;

          setTyping(true);

          switch (chunk.type) {
            case "text":
              if (chunk.data.text) {
                // 更新最后一条消息或创建新消息
                const store = useChatStore.getState();
                const lastMessage = store.messages[store.messages.length - 1];

                if (lastMessage?.role === "assistant") {
                  updateLastAssistantMessage(
                    lastMessage.content + chunk.data.text,
                  );
                } else {
                  addAssistantMessage(chunk.data.text);
                }
              }
              break;

            case "action":
              if (chunk.data.action) {
                addActionToLastMessage({
                  name: chunk.data.action,
                  status: "pending",
                });
              }
              break;

            case "bookmark_created":
              if (chunk.data.bookmark) {
                addActionToLastMessage({
                  name: `已保存: ${chunk.data.bookmark.title}`,
                  status: "completed",
                });
              }
              break;

            case "error":
              setError(chunk.data.message || "发生错误");
              setTyping(false);
              setLoading(false);
              break;

            case "done":
              setTyping(false);
              setLoading(false);
              if (chunk.data.conversationId) {
                setConversationId(chunk.data.conversationId);
              }
              break;
          }
          break;
        }

        case "AGENT_ERROR":
          setError(message.error || "发生错误");
          setTyping(false);
          setLoading(false);
          break;

        case "AGENT_COMPLETE":
          setTyping(false);
          setLoading(false);
          if (message.conversationId) {
            setConversationId(message.conversationId);
          }
          break;
      }
    },
    [
      setTyping,
      setLoading,
      setError,
      setConversationId,
      addAssistantMessage,
      updateLastAssistantMessage,
      addActionToLastMessage,
    ],
  );

  /**
   * 建立连接
   */
  const connect = useCallback(() => {
    if (portRef.current) {
      return portRef.current;
    }

    setIsConnecting(true);

    try {
      const port = chrome.runtime.connect({ name: "agent-chat" });

      port.onMessage.addListener(handlePortMessage);

      port.onDisconnect.addListener(() => {
        portRef.current = null;
        setIsConnecting(false);
      });

      portRef.current = port;
      setIsConnecting(false);
      return port;
    } catch (error) {
      console.error("[AgentChat] Failed to connect:", error);
      setIsConnecting(false);
      return null;
    }
  }, [handlePortMessage]);

  /**
   * 发送消息
   */
  const sendMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return;

      // 添加用户消息
      addUserMessage(message);
      setLoading(true);
      setError(null);

      // 获取或创建连接
      const port = connect();
      if (!port) {
        setError("无法连接到扩展服务");
        setLoading(false);
        return;
      }

      // 构建消息历史
      const messageHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // 发送消息
      port.postMessage({
        type: "AGENT_CHAT",
        payload: {
          message,
          conversationId,
          messageHistory,
          includePageContext,
          includeSelection,
        },
      });
    },
    [
      messages,
      conversationId,
      includePageContext,
      includeSelection,
      addUserMessage,
      setLoading,
      setError,
      connect,
    ],
  );

  /**
   * 发送快捷操作
   */
  const sendQuickAction = useCallback(
    (
      action:
        | "save_page"
        | "save_selection"
        | "summarize"
        | "extract_links"
        | "ask_about_page",
    ) => {
      const actionMessages: Record<string, string> = {
        save_page: "保存这个页面",
        save_selection: "保存选中的内容",
        summarize: "总结这个页面",
        extract_links: "提取页面中的链接",
        ask_about_page: "这个页面讲了什么？",
      };

      const message = actionMessages[action];

      // 添加用户消息
      addUserMessage(message);
      setLoading(true);
      setError(null);

      // 获取或创建连接
      const port = connect();
      if (!port) {
        setError("无法连接到扩展服务");
        setLoading(false);
        return;
      }

      // 发送快捷操作
      port.postMessage({
        type: "AGENT_CHAT",
        payload: {
          message,
          conversationId,
          includePageContext: true,
          includeSelection: action === "save_selection",
          quickAction: action,
        },
      });
    },
    [conversationId, addUserMessage, setLoading, setError, connect],
  );

  /**
   * 取消当前请求
   */
  const cancel = useCallback(() => {
    if (portRef.current) {
      portRef.current.disconnect();
      portRef.current = null;
    }
    setLoading(false);
    setTyping(false);
  }, [setLoading, setTyping]);

  /**
   * 清除聊天
   */
  const clearChat = useCallback(() => {
    cancel();
    clearChatStore();
  }, [cancel, clearChatStore]);

  /**
   * 清理连接
   */
  useEffect(() => {
    return () => {
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, []);

  return {
    sendMessage,
    sendQuickAction,
    cancel,
    clearChat,
    isConnecting,
  };
}
