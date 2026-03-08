/**
 * Conversation History Hook
 * P1: 历史会话管理 Hook
 *
 * 功能：
 * - 获取会话列表
 * - 选择/切换会话
 * - 创建新会话
 * - 删除会话
 * - 加载会话详情
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { API_CONVERSATIONS } from "@/lib/constants/api-paths";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import { conversationStorage } from "@/lib/storage/conversation-storage";

// =============================================================================
// Types
// =============================================================================

/**
 * 会话列表项
 */
export interface ConversationListItem {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  lastIntent: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 会话详情（含完整消息）
 */
export interface ConversationDetail {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
  messageCount: number;
  lastIntent: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook 状态
 */
export interface ConversationHistoryState {
  /** 会话列表 */
  conversations: ConversationListItem[];
  /** 当前选中的会话 ID */
  currentId: string | null;
  /** 当前会话详情 */
  currentDetail: ConversationDetail | null;
  /** 加载状态 */
  isLoading: boolean;
  /** 详情加载状态 */
  isLoadingDetail: boolean;
  /** 错误信息 */
  error: string | null;
  /** 总数量 */
  total: number;
  /** 是否有更多数据 */
  hasMore: boolean;
}

/**
 * Hook 操作方法
 */
export interface ConversationHistoryActions {
  /** 刷新会话列表 */
  refresh: () => Promise<void>;
  /** 加载更多 */
  loadMore: () => Promise<void>;
  /** 选择会话 */
  select: (id: string) => Promise<ConversationDetail | null>;
  /** 创建新会话 */
  create: () => Promise<string | null>;
  /** 删除会话 */
  remove: (id: string) => Promise<boolean>;
  /** 清空当前选择 */
  clearSelection: () => void;
  /** 设置当前会话 ID（不加载详情） */
  setCurrentId: (id: string | null) => void;
}

/**
 * Hook 返回值
 */
export interface UseConversationHistoryReturn {
  state: ConversationHistoryState;
  actions: ConversationHistoryActions;
}

// =============================================================================
// Constants
// =============================================================================

const PAGE_SIZE = 10;

// =============================================================================
// Initial State
// =============================================================================

const initialState: ConversationHistoryState = {
  conversations: [],
  currentId: null,
  currentDetail: null,
  isLoading: false,
  isLoadingDetail: false,
  error: null,
  total: 0,
  hasMore: false,
};

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * 会话历史管理 Hook
 *
 * @example
 * ```tsx
 * const { state, actions } = useConversationHistory();
 *
 * // 刷新列表
 * await actions.refresh();
 *
 * // 选择会话
 * const detail = await actions.select("conv_123");
 *
 * // 创建新会话
 * const newId = await actions.create();
 *
 * // 删除会话
 * await actions.remove("conv_123");
 * ```
 */
export function useConversationHistory(): UseConversationHistoryReturn {
  const [state, setState] = useState<ConversationHistoryState>(() => {
    // 尝试从 localStorage 恢复当前会话 ID
    if (
      typeof window !== "undefined" &&
      FeatureFlags.ENABLE_CONVERSATION_PERSISTENCE
    ) {
      const restored = conversationStorage.restore();
      if (restored?.conversationId) {
        return {
          ...initialState,
          currentId: restored.conversationId,
        };
      }
    }
    return initialState;
  });

  // 分页偏移量
  const offsetRef = useRef(0);

  // 请求取消控制器
  const abortControllerRef = useRef<AbortController | null>(null);

  // ==========================================================================
  // API Methods
  // ==========================================================================

  /**
   * 获取会话列表
   */
  const fetchConversations = useCallback(
    async (offset: number = 0, append: boolean = false) => {
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const response = await fetch(
          `${API_CONVERSATIONS.list}?limit=${PAGE_SIZE}&offset=${offset}`,
          {
            signal: abortControllerRef.current.signal,
          },
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || "获取会话列表失败");
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "获取会话列表失败");
        }

        const { conversations, total } = result.data;

        setState((prev) => ({
          ...prev,
          conversations: append
            ? [...prev.conversations, ...conversations]
            : conversations,
          total,
          hasMore: offset + conversations.length < total,
          isLoading: false,
        }));

        offsetRef.current = offset + conversations.length;
      } catch (error) {
        // 忽略取消错误
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "获取会话列表失败",
        }));
      }
    },
    [],
  );

  /**
   * 获取会话详情
   */
  const fetchDetail = useCallback(
    async (id: string): Promise<ConversationDetail | null> => {
      setState((prev) => ({
        ...prev,
        isLoadingDetail: true,
        error: null,
      }));

      try {
        const response = await fetch(API_CONVERSATIONS.detail(id));

        if (!response.ok) {
          if (response.status === 404) {
            // 会话不存在，清除选择
            setState((prev) => ({
              ...prev,
              currentId: null,
              currentDetail: null,
              isLoadingDetail: false,
            }));
            return null;
          }
          const error = await response.json();
          throw new Error(error.error?.message || "获取会话详情失败");
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "获取会话详情失败");
        }

        const detail = result.data.conversation as ConversationDetail;

        setState((prev) => ({
          ...prev,
          currentId: id,
          currentDetail: detail,
          isLoadingDetail: false,
        }));

        return detail;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoadingDetail: false,
          error: error instanceof Error ? error.message : "获取会话详情失败",
        }));
        return null;
      }
    },
    [],
  );

  /**
   * 创建新会话
   */
  const createConversation = useCallback(async (): Promise<string | null> => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await fetch(API_CONVERSATIONS.list, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "创建会话失败");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "创建会话失败");
      }

      const { conversationId } = result.data;

      // 更新 localStorage
      if (FeatureFlags.ENABLE_CONVERSATION_PERSISTENCE) {
        conversationStorage.clear();
        conversationStorage.save(conversationId, []);
      }

      // 更新状态
      setState((prev) => ({
        ...prev,
        currentId: conversationId,
        currentDetail: null,
        isLoading: false,
      }));

      // 刷新列表
      await fetchConversations(0, false);

      return conversationId;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "创建会话失败",
      }));
      return null;
    }
  }, [fetchConversations]);

  /**
   * 删除会话
   */
  const deleteConversation = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(API_CONVERSATIONS.detail(id), {
          method: "DELETE",
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || "删除会话失败");
        }

        // 从列表中移除
        setState((prev) => {
          const newConversations = prev.conversations.filter(
            (c) => c.id !== id,
          );
          const newState: ConversationHistoryState = {
            ...prev,
            conversations: newConversations,
            total: Math.max(0, prev.total - 1),
          };

          // 如果删除的是当前会话，清除选择
          if (prev.currentId === id) {
            newState.currentId = null;
            newState.currentDetail = null;

            // 清除 localStorage
            if (FeatureFlags.ENABLE_CONVERSATION_PERSISTENCE) {
              conversationStorage.clear();
            }
          }

          return newState;
        });

        return true;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "删除会话失败",
        }));
        return false;
      }
    },
    [],
  );

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * 刷新会话列表
   */
  const refresh = useCallback(async () => {
    offsetRef.current = 0;
    await fetchConversations(0, false);
  }, [fetchConversations]);

  /**
   * 加载更多
   */
  const loadMore = useCallback(async () => {
    if (state.isLoading || !state.hasMore) return;
    await fetchConversations(offsetRef.current, true);
  }, [state.isLoading, state.hasMore, fetchConversations]);

  /**
   * 选择会话
   */
  const select = useCallback(
    async (id: string): Promise<ConversationDetail | null> => {
      // 如果已经是当前会话且有详情，直接返回
      if (state.currentId === id && state.currentDetail) {
        return state.currentDetail;
      }

      const detail = await fetchDetail(id);

      // 更新 localStorage
      if (detail && FeatureFlags.ENABLE_CONVERSATION_PERSISTENCE) {
        conversationStorage.updateConversationId(id);
      }

      return detail;
    },
    [state.currentId, state.currentDetail, fetchDetail],
  );

  /**
   * 清空当前选择（用于新建对话）
   */
  const clearSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentId: null,
      currentDetail: null,
    }));

    // 清除 localStorage
    if (FeatureFlags.ENABLE_CONVERSATION_PERSISTENCE) {
      conversationStorage.clear();
    }
  }, []);

  /**
   * 设置当前会话 ID（不加载详情）
   */
  const setCurrentId = useCallback((id: string | null) => {
    setState((prev) => ({
      ...prev,
      currentId: id,
      currentDetail: id === prev.currentId ? prev.currentDetail : null,
    }));
  }, []);

  // ==========================================================================
  // Effects
  // ==========================================================================

  // 组件挂载时加载会话列表
  useEffect(() => {
    // 仅在启用 Feature Flag 时加载
    if (FeatureFlags.ENABLE_CONVERSATION_PERSISTENCE) {
      fetchConversations(0, false);
    }

    // 清理函数
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchConversations]);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    state,
    actions: {
      refresh,
      loadMore,
      select,
      create: createConversation,
      remove: deleteConversation,
      clearSelection,
      setCurrentId,
    },
  };
}
