/**
 * 会话心跳检测 Hook
 * 定期检查和刷新用户会话，防止长时间操作时会话意外过期
 *
 * V4.2.30: 解决 AUTH-001 会话过期问题
 *
 * 功能：
 * - 每 4 分钟检查一次会话状态
 * - 页面从后台恢复时立即检查
 * - 会话即将过期时自动刷新
 * - 会话失效时触发回调
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { clientLogger } from "@/lib/client-logger";

/** 心跳检测间隔（毫秒）- 4分钟 */
const HEARTBEAT_INTERVAL = 4 * 60 * 1000;

/** 会话即将过期阈值（秒）- 5分钟 */
const EXPIRY_THRESHOLD = 5 * 60;

interface UseSessionHeartbeatOptions {
  /** 会话失效时的回调 */
  onSessionExpired?: () => void;
  /** 会话刷新成功时的回调 */
  onSessionRefreshed?: () => void;
  /** 是否启用心跳检测（默认 true） */
  enabled?: boolean;
}

/**
 * 检查会话是否即将过期
 */
function isSessionNearExpiry(expiresAt: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = expiresAt - now;
  return expiresIn < EXPIRY_THRESHOLD;
}

/**
 * 会话心跳检测 Hook
 *
 * @example
 * ```tsx
 * // 在根布局或认证上下文中使用
 * useSessionHeartbeat({
 *   onSessionExpired: () => router.push('/login'),
 *   onSessionRefreshed: () => clientLogger.info({}, 'Session refreshed'),
 * });
 * ```
 */
export function useSessionHeartbeat(options: UseSessionHeartbeatOptions = {}) {
  const { onSessionExpired, onSessionRefreshed, enabled = true } = options;

  const supabaseRef = useRef(createClient());
  const lastCheckRef = useRef<number>(0);
  const isCheckingRef = useRef(false);

  /**
   * 检查并刷新会话
   */
  const checkAndRefreshSession = useCallback(async () => {
    // 防止并发检查
    if (isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;

    try {
      const supabase = supabaseRef.current;
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        clientLogger.error(
          { error: error.message },
          "[SessionHeartbeat] 获取会话失败",
        );
        return;
      }

      // 没有会话，可能已登出
      if (!session) {
        onSessionExpired?.();
        return;
      }

      // 检查会话是否即将过期
      if (isSessionNearExpiry(session.expires_at ?? 0)) {
        const { data: refreshData, error: refreshError } =
          await supabase.auth.refreshSession();

        if (refreshError) {
          clientLogger.error(
            { error: refreshError.message },
            "[SessionHeartbeat] 刷新会话失败",
          );
          // 刷新失败，会话可能已完全过期
          if (
            refreshError.message.includes("expired") ||
            refreshError.message.includes("invalid")
          ) {
            onSessionExpired?.();
          }
          return;
        }

        if (refreshData.session) {
          onSessionRefreshed?.();
        }
      }

      lastCheckRef.current = Date.now();
    } catch (err) {
      clientLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "[SessionHeartbeat] 检查会话时发生错误",
      );
    } finally {
      isCheckingRef.current = false;
    }
  }, [onSessionExpired, onSessionRefreshed]);

  /**
   * 处理页面可见性变化
   */
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === "visible") {
      const timeSinceLastCheck = Date.now() - lastCheckRef.current;

      // 如果超过 2 分钟没检查，立即检查一次
      if (timeSinceLastCheck > 2 * 60 * 1000) {
        checkAndRefreshSession();
      }
    }
  }, [checkAndRefreshSession]);

  /**
   * 处理网络恢复
   */
  const handleOnline = useCallback(() => {
    checkAndRefreshSession();
  }, [checkAndRefreshSession]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // 初始检查
    checkAndRefreshSession();

    // 设置定时心跳
    const heartbeatTimer = setInterval(
      checkAndRefreshSession,
      HEARTBEAT_INTERVAL,
    );

    // 监听页面可见性变化
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 监听网络状态变化
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(heartbeatTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled, checkAndRefreshSession, handleVisibilityChange, handleOnline]);
}

export default useSessionHeartbeat;
