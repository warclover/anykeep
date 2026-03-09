/**
 * AI 记忆查看器 Hook
 *
 * 提供加载和管理 AI 跨会话记忆的功能
 *
 * @version 1.1.0
 * @since 2026-01-13
 * @updated 2026-03-09 - 移除 pending tasks 功能
 */

import { useCallback } from "react";

// ============================================
// 类型定义
// ============================================

interface RecentSummary {
  summary: string;
  intents: string[];
  timeAgo: string;
  learnedPreferences?: Record<string, string>;
}

interface AIMemory {
  recentSummaries: RecentSummary[];
  learnedPreferences: Record<string, string>;
}

interface UseAIMemoryViewerReturn {
  /** 加载 AI 记忆 */
  loadMemory: () => Promise<AIMemory>;
  /** 清除 AI 记忆 */
  clearMemory: () => Promise<void>;
}

// ============================================
// API 调用
// ============================================

async function fetchAIMemory(): Promise<AIMemory> {
  const response = await fetch("/api/ai-memory", {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch AI memory");
  }

  const data = await response.json();
  return data.data;
}

async function deleteAIMemory(): Promise<void> {
  const response = await fetch("/api/ai-memory", {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to clear AI memory");
  }
}

// ============================================
// Hook
// ============================================

/**
 * AI 记忆查看器 Hook
 *
 * 提供加载、清除和管理 AI 记忆的功能
 * 认证由 API 路由处理
 */
export function useAIMemoryViewer(): UseAIMemoryViewerReturn {
  const loadMemory = useCallback(async (): Promise<AIMemory> => {
    return fetchAIMemory();
  }, []);

  const clearMemory = useCallback(async (): Promise<void> => {
    await deleteAIMemory();
  }, []);

  return {
    loadMemory,
    clearMemory,
  };
}

export default useAIMemoryViewer;
