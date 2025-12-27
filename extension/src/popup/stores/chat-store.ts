/**
 * Agent 聊天状态管理
 *
 * 使用 Zustand 管理聊天状态
 */

import { create } from "zustand";

// ============================================
// 类型定义
// ============================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  actions?: Array<{
    name: string;
    status: "pending" | "completed" | "error";
  }>;
}

export interface ChatState {
  /** 消息列表 */
  messages: ChatMessage[];
  /** 当前会话 ID */
  conversationId: string | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 当前输入 */
  inputValue: string;
  /** 是否正在输入 */
  isTyping: boolean;
  /** 错误信息 */
  error: string | null;
}

export interface ChatActions {
  /** 添加用户消息 */
  addUserMessage: (content: string) => void;
  /** 添加助手消息 */
  addAssistantMessage: (
    content: string,
    actions?: ChatMessage["actions"],
  ) => void;
  /** 更新最后一条助手消息 */
  updateLastAssistantMessage: (content: string) => void;
  /** 添加操作到最后一条消息 */
  addActionToLastMessage: (action: {
    name: string;
    status: "pending" | "completed" | "error";
  }) => void;
  /** 设置会话 ID */
  setConversationId: (id: string) => void;
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;
  /** 设置输入值 */
  setInputValue: (value: string) => void;
  /** 设置输入状态 */
  setTyping: (typing: boolean) => void;
  /** 设置错误 */
  setError: (error: string | null) => void;
  /** 清除聊天 */
  clearChat: () => void;
  /** 重置状态 */
  reset: () => void;
}

// ============================================
// 初始状态
// ============================================

const initialState: ChatState = {
  messages: [],
  conversationId: null,
  isLoading: false,
  inputValue: "",
  isTyping: false,
  error: null,
};

// ============================================
// Store
// ============================================

export const useChatStore = create<ChatState & ChatActions>((set) => ({
  ...initialState,

  addUserMessage: (content) => {
    const message: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, message],
      error: null,
    }));
  },

  addAssistantMessage: (content, actions) => {
    const message: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content,
      timestamp: Date.now(),
      actions,
    };
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  updateLastAssistantMessage: (content) => {
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      if (lastIndex >= 0 && messages[lastIndex].role === "assistant") {
        messages[lastIndex] = {
          ...messages[lastIndex],
          content,
        };
      }
      return { messages };
    });
  },

  addActionToLastMessage: (action) => {
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      if (lastIndex >= 0 && messages[lastIndex].role === "assistant") {
        const lastMessage = messages[lastIndex];
        messages[lastIndex] = {
          ...lastMessage,
          actions: [...(lastMessage.actions || []), action],
        };
      }
      return { messages };
    });
  },

  setConversationId: (id) => set({ conversationId: id }),

  setLoading: (loading) => set({ isLoading: loading }),

  setInputValue: (value) => set({ inputValue: value }),

  setTyping: (typing) => set({ isTyping: typing }),

  setError: (error) => set({ error }),

  clearChat: () =>
    set({
      messages: [],
      conversationId: null,
      error: null,
    }),

  reset: () => set(initialState),
}));
