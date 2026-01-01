/**
 * Brain-Sync 复习队列统计 Hook
 *
 * 提供待复习卡片数量，用于侧边栏/菜单徽章显示
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 常量配置
// ============================================

/** 轮询间隔（毫秒）：5 分钟 */
const POLLING_INTERVAL_MS = 5 * 60 * 1000;

/** 偏好数据缓存时间（毫秒）：30 秒 */
const PREFERENCES_CACHE_TTL_MS = 30_000;

/** 请求最小间隔（毫秒）：5 秒 */
const MIN_REQUEST_INTERVAL_MS = 5_000;

// ============================================
// 模块级缓存（跨组件实例共享）
// ============================================

interface PreferencesCache {
  data: {
    enabled: boolean;
    showMenuBadge: boolean;
    showSidebarReminder: boolean;
  } | null;
  timestamp: number;
}

interface StatsCache {
  data: BrainSyncStats | null;
  timestamp: number;
}

let preferencesCache: PreferencesCache = { data: null, timestamp: 0 };
let statsCache: StatsCache = { data: null, timestamp: 0 };
let lastPrefsRequestTime = 0;
let lastStatsRequestTime = 0;
let pendingPrefsRequest: Promise<{
  enabled: boolean;
  showMenuBadge: boolean;
  showSidebarReminder: boolean;
} | null> | null = null;
let pendingStatsRequest: Promise<BrainSyncStats | null> | null = null;

// ============================================
// 类型定义
// ============================================

export interface BrainSyncStats {
  total: number;
  overdue: number;
  dueToday: number;
}

export interface UseBrainSyncStatsReturn {
  stats: BrainSyncStats | null;
  loading: boolean;
  enabled: boolean;
  /** 是否显示菜单徽章（默认关闭） */
  showMenuBadge: boolean;
  /** 是否显示侧边栏提醒（默认关闭） */
  showSidebarReminder: boolean;
  refresh: () => Promise<void>;
}

// ============================================
// Hook 实现
// ============================================

export function useBrainSyncStats(): UseBrainSyncStatsReturn {
  const [stats, setStats] = useState<BrainSyncStats | null>(statsCache.data);
  const [loading, setLoading] = useState(!statsCache.data);
  const [enabled, setEnabled] = useState(
    preferencesCache.data?.enabled ?? false,
  );
  const [showMenuBadge, setShowMenuBadge] = useState(
    preferencesCache.data?.showMenuBadge ?? false,
  );
  const [showSidebarReminder, setShowSidebarReminder] = useState(
    preferencesCache.data?.showSidebarReminder ?? false,
  );
  const [isPageVisible, setIsPageVisible] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 获取偏好数据（带缓存和请求去重）
   */
  const fetchPreferences = useCallback(async (): Promise<{
    enabled: boolean;
    showMenuBadge: boolean;
    showSidebarReminder: boolean;
  } | null> => {
    const now = Date.now();

    // 检查缓存是否有效
    if (
      preferencesCache.data &&
      now - preferencesCache.timestamp < PREFERENCES_CACHE_TTL_MS
    ) {
      return preferencesCache.data;
    }

    // 检查请求间隔
    if (now - lastPrefsRequestTime < MIN_REQUEST_INTERVAL_MS) {
      if (pendingPrefsRequest) return pendingPrefsRequest;
      return preferencesCache.data;
    }

    // 复用正在进行的请求
    if (pendingPrefsRequest) return pendingPrefsRequest;

    // 发起新请求
    lastPrefsRequestTime = now;
    pendingPrefsRequest = (async () => {
      try {
        const response = await fetch("/api/brain-sync/preferences");
        if (response.status === 429) return preferencesCache.data;

        const data = await response.json();
        const prefs = data.data?.preferences;
        const result = {
          enabled: data.success && prefs?.enabled === true,
          showMenuBadge: prefs?.showMenuBadge ?? false,
          showSidebarReminder: prefs?.showSidebarReminder ?? false,
        };
        preferencesCache = { data: result, timestamp: Date.now() };
        return result;
      } catch {
        return preferencesCache.data;
      } finally {
        pendingPrefsRequest = null;
      }
    })();

    return pendingPrefsRequest;
  }, []);

  /**
   * 获取队列统计（带缓存和请求去重）
   */
  const fetchStats = useCallback(async (): Promise<BrainSyncStats | null> => {
    const now = Date.now();

    // 检查请求间隔
    if (now - lastStatsRequestTime < MIN_REQUEST_INTERVAL_MS) {
      if (pendingStatsRequest) return pendingStatsRequest;
      return statsCache.data;
    }

    // 复用正在进行的请求
    if (pendingStatsRequest) return pendingStatsRequest;

    // 发起新请求
    lastStatsRequestTime = now;
    pendingStatsRequest = (async () => {
      try {
        const response = await fetch("/api/brain-sync/queue?limit=100");
        if (response.status === 429) return statsCache.data;

        const data = await response.json();
        if (data.success && data.data.stats) {
          const result: BrainSyncStats = {
            total: data.data.stats.total,
            overdue: data.data.stats.overdue,
            dueToday: data.data.stats.dueToday,
          };
          statsCache = { data: result, timestamp: Date.now() };
          return result;
        }
        return statsCache.data;
      } catch {
        return statsCache.data;
      } finally {
        pendingStatsRequest = null;
      }
    })();

    return pendingStatsRequest;
  }, []);

  /**
   * 加载数据
   */
  const loadData = useCallback(async () => {
    try {
      const prefs = await fetchPreferences();
      if (!prefs?.enabled) {
        setEnabled(false);
        setShowMenuBadge(false);
        setShowSidebarReminder(false);
        setLoading(false);
        return;
      }

      setEnabled(true);
      setShowMenuBadge(prefs.showMenuBadge);
      setShowSidebarReminder(prefs.showSidebarReminder);

      const statsData = await fetchStats();
      if (statsData) {
        setStats(statsData);
      }
    } catch (err) {
      clientLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to load Brain-Sync stats",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchPreferences, fetchStats]);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 监听页面可见性
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      setIsPageVisible(visible);
      if (visible && enabled) {
        loadData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enabled, loadData]);

  // 定期轮询
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (enabled && isPageVisible) {
      intervalRef.current = setInterval(loadData, POLLING_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, isPageVisible, loadData]);

  return {
    stats,
    loading,
    enabled,
    showMenuBadge,
    showSidebarReminder,
    refresh: loadData,
  };
}
