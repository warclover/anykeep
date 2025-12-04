/**
 * 自定义用途标签数据 Hook
 * 统一管理自定义标签的获取、缓存和同步
 *
 * 特点：
 * - 模块级缓存，多组件共享数据
 * - 自动去重请求（同时只有一个请求在飞行中）
 * - 支持乐观更新和手动刷新
 * - 通过 CustomEvent 跨组件同步
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { CustomUsageTag } from "@/types/supabase";

// ============================================
// 模块级缓存（所有组件实例共享）
// ============================================

interface CacheState {
  data: CustomUsageTag[];
  timestamp: number;
  isLoading: boolean;
  error: Error | null;
}

// 缓存状态
let cache: CacheState = {
  data: [],
  timestamp: 0,
  isLoading: false,
  error: null,
};

// 缓存有效期（5分钟）
const CACHE_TTL = 5 * 60 * 1000;

// 订阅者列表（用于通知所有使用该 Hook 的组件）
const subscribers = new Set<() => void>();

// 通知所有订阅者数据已更新
function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

// 进行中的请求（防止重复请求）
let pendingRequest: Promise<CustomUsageTag[]> | null = null;

// ============================================
// 核心 API 调用
// ============================================

async function fetchCustomTags(): Promise<CustomUsageTag[]> {
  const response = await fetch("/api/settings/usage-tags");
  if (!response.ok) {
    throw new Error("加载自定义标签失败");
  }
  const data = await response.json();
  return data.data?.customUsageTags || [];
}

// ============================================
// Hook 实现
// ============================================

export interface UseCustomUsageTagsResult {
  /** 自定义标签列表 */
  customTags: CustomUsageTag[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 手动刷新数据 */
  refresh: () => Promise<void>;
  /** 乐观更新：添加标签 */
  addTag: (tag: CustomUsageTag) => void;
  /** 乐观更新：更新标签 */
  updateTag: (tagId: string, updates: Partial<CustomUsageTag>) => void;
  /** 乐观更新：删除标签 */
  removeTag: (tagId: string) => void;
  /** 设置完整标签列表（用于 API 返回后同步） */
  setTags: (tags: CustomUsageTag[]) => void;
}

export function useCustomUsageTags(): UseCustomUsageTagsResult {
  // 组件级状态（触发重新渲染）
  const [, forceUpdate] = useState({});

  // 订阅缓存更新
  useEffect(() => {
    const update = () => forceUpdate({});
    subscribers.add(update);
    return () => {
      subscribers.delete(update);
    };
  }, []);

  // 初始加载
  useEffect(() => {
    const now = Date.now();
    const isStale = now - cache.timestamp > CACHE_TTL;
    const hasData = cache.data.length > 0;

    // 有新鲜数据，不需要请求
    if (hasData && !isStale) {
      return;
    }

    // 正在加载中，不重复请求
    if (cache.isLoading || pendingRequest) {
      return;
    }

    // 发起请求
    cache.isLoading = true;
    notifySubscribers();

    pendingRequest = fetchCustomTags()
      .then((tags) => {
        cache.data = tags;
        cache.timestamp = Date.now();
        cache.error = null;
        return tags;
      })
      .catch((err) => {
        cache.error = err;
        return cache.data; // 保留旧数据
      })
      .finally(() => {
        cache.isLoading = false;
        pendingRequest = null;
        notifySubscribers();
      });
  }, []);

  // 手动刷新
  const refresh = useCallback(async () => {
    if (pendingRequest) {
      await pendingRequest;
      return;
    }

    cache.isLoading = true;
    notifySubscribers();

    pendingRequest = fetchCustomTags()
      .then((tags) => {
        cache.data = tags;
        cache.timestamp = Date.now();
        cache.error = null;
        return tags;
      })
      .catch((err) => {
        cache.error = err;
        return cache.data;
      })
      .finally(() => {
        cache.isLoading = false;
        pendingRequest = null;
        notifySubscribers();
      });

    await pendingRequest;
  }, []);

  // 乐观更新：添加
  const addTag = useCallback((tag: CustomUsageTag) => {
    cache.data = [...cache.data, tag];
    cache.timestamp = Date.now();
    notifySubscribers();
  }, []);

  // 乐观更新：更新
  const updateTag = useCallback(
    (tagId: string, updates: Partial<CustomUsageTag>) => {
      cache.data = cache.data.map((t) =>
        t.id === tagId ? { ...t, ...updates } : t,
      );
      cache.timestamp = Date.now();
      notifySubscribers();
    },
    [],
  );

  // 乐观更新：删除
  const removeTag = useCallback((tagId: string) => {
    cache.data = cache.data.filter((t) => t.id !== tagId);
    cache.timestamp = Date.now();
    notifySubscribers();
  }, []);

  // 设置完整列表（API 返回后同步）
  const setTags = useCallback((tags: CustomUsageTag[]) => {
    cache.data = tags;
    cache.timestamp = Date.now();
    notifySubscribers();
  }, []);

  return {
    customTags: cache.data,
    isLoading: cache.isLoading,
    error: cache.error,
    refresh,
    addTag,
    updateTag,
    removeTag,
    setTags,
  };
}

// ============================================
// 工具函数：清除缓存（测试或登出时使用）
// ============================================

export function clearCustomUsageTagsCache() {
  cache = {
    data: [],
    timestamp: 0,
    isLoading: false,
    error: null,
  };
  pendingRequest = null;
  notifySubscribers();
}
