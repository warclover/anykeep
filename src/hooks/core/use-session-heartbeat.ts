/**
 * 会话心跳检测 Hook
 * 基于行业最佳实践的会���管理，依赖 Supabase 内置自动刷新机制
 *
 * V4.2.31: 对齐行业标准优化
 * - 依赖 Supabase onAuthStateChange 监听内置刷新
 * - Visibility 恢复立即刷新（删除 2 分钟等待）
 * - 添加多 Tab 同步机制（BroadcastChannel）
 * - 心跳仅作为兜底机制（10 分钟间隔）
 *
 * 参考：
 * - Supabase 官方文档：https://supabase.com/docs/guides/auth/sessions
 * - Next.js + Supabase 最佳实践
 *
 * @version 2.0.0
 * @since 2025-12-22
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { clientLogger } from "@/lib/client-logger";

/** 心跳检测间隔（毫秒）- 10 分钟（仅作为兜底，主要依赖 Supabase 自动刷新） */
const HEARTBEAT_INTERVAL = 10 * 60 * 1000;

/** 多 Tab 同步频道名称 */
const BROADCAST_CHANNEL_NAME = "anykeep-session-sync";

/** 会话同步消息类型 */
type SessionSyncMessage =
  | { type: "SESSION_REFRESHED"; timestamp: number }
  | { type: "SESSION_EXPIRED"; timestamp: number };

interface UseSessionHeartbeatOptions {
  /** 会话失效时的回调 */
  onSessionExpired?: () => void;
  /** 会话刷新成功时的回调 */
  onSessionRefreshed?: () => void;
  /** 是否启用心跳检测（默认 true） */
  enabled?: boolean;
}

/**
 * 会话心跳检测 Hook（V2.0 - 行业标准版）
 *
 * 核心策略：
 * 1. 使用 onAuthStateChange 监听 Supabase 内置刷新事件
 * 2. Visibility 恢复时立即触发会话检查
 * 3. 使用 BroadcastChannel 同步多 Tab 状态
 * 4. 心跳仅作为兜底机制（10 分钟间隔）
 *
 * @example
 * ```tsx
 * useSessionHeartbeat({
 *   onSessionExpired: () => router.push('/login'),
 *   onSessionRefreshed: () => console.log('Session refreshed'),
 * });
 * ```
 */
export function useSessionHeartbeat(options: UseSessionHeartbeatOptions = {}) {
  const { onSessionExpired, onSessionRefreshed, enabled = true } = options;

  const supabaseRef = useRef(createClient());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const isCheckingRef = useRef(false);
  const lastRefreshTimestampRef = useRef<number>(0);
  /** V4.2.32: AbortController 用于取消进行中的请求 */
  const abortControllerRef = useRef<AbortController | null>(null);
  /** V4.2.33: 标记 Auth SDK 是否已完成初始化（INITIAL_SESSION 已触发） */
  const isAuthReadyRef = useRef(false);

  /**
   * 广播会话状态变更到其他 Tab
   */
  const broadcastSessionEvent = useCallback((message: SessionSyncMessage) => {
    try {
      broadcastChannelRef.current?.postMessage(message);
    } catch {
      // BroadcastChannel 可能在某些环境不可用
    }
  }, []);

  /**
   * 判断是否为 AbortError（请求被取消）
   * V4.2.32: 静默处理 AbortError，这是正常的取消行为
   */
  const isAbortError = useCallback((err: unknown): boolean => {
    if (err instanceof Error) {
      return (
        err.name === "AbortError" ||
        err.message.includes("abort") ||
        err.message.includes("signal is aborted")
      );
    }
    return false;
  }, []);

  /**
   * 触发会话刷新（使用 Supabase 内置机制）
   * V4.2.32: 添加 AbortController 支持，防止组件卸载时的内存泄漏
   */
  const triggerSessionRefresh = useCallback(async () => {
    // V4.2.33: Auth SDK 未完成初始化时跳过，避免竞态 Failed to fetch
    if (!isAuthReadyRef.current) return;
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    // 取消之前进行中的请求
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const supabase = supabaseRef.current;

      // 使用 getUser() 触发服务端验证，这会自动刷新即将过期的 Token
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      // V4.2.32: 静默处理 AbortError
      if (error && isAbortError(error)) {
        return; // 请求被取消，静默返回
      }

      if (error || !user) {
        clientLogger.warn(
          { error: error?.message },
          "[SessionHeartbeat] 会话验证失败",
        );
        // 不立即触发 expired，让 onAuthStateChange 处理
      }
    } catch (err) {
      // V4.2.32: 静默处理 AbortError
      if (isAbortError(err)) {
        return;
      }
      clientLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "[SessionHeartbeat] 触发刷新时发生错误",
      );
    } finally {
      isCheckingRef.current = false;
    }
  }, [isAbortError]);

  /**
   * 处理页面可见性变化 - 立即刷新（行业标准）
   */
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === "visible") {
      // 行业标准：切回 Tab 时立即触发刷新检查，不等待
      triggerSessionRefresh();
    }
  }, [triggerSessionRefresh]);

  /**
   * 处理窗口获得焦点 - 立即刷新
   */
  const handleFocus = useCallback(() => {
    triggerSessionRefresh();
  }, [triggerSessionRefresh]);

  /**
   * 处理网络恢复
   */
  const handleOnline = useCallback(() => {
    triggerSessionRefresh();
  }, [triggerSessionRefresh]);

  /**
   * 处理其他 Tab 的会话同步消息
   */
  const handleBroadcastMessage = useCallback(
    (event: MessageEvent<SessionSyncMessage>) => {
      const message = event.data;

      // 防止处理自己发出的消息或过期消息
      if (message.timestamp <= lastRefreshTimestampRef.current) {
        return;
      }

      lastRefreshTimestampRef.current = message.timestamp;

      if (message.type === "SESSION_EXPIRED") {
        onSessionExpired?.();
      } else if (message.type === "SESSION_REFRESHED") {
        onSessionRefreshed?.();
      }
    },
    [onSessionExpired, onSessionRefreshed],
  );

  // 主要效果：设置 Supabase onAuthStateChange 监听
  useEffect(() => {
    if (!enabled) return;

    const supabase = supabaseRef.current;

    // 核心：监听 Supabase 内置的认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const timestamp = Date.now();

      switch (event) {
        case "TOKEN_REFRESHED":
          clientLogger.debug({}, "[SessionHeartbeat] Token 已自动刷新");
          lastRefreshTimestampRef.current = timestamp;
          onSessionRefreshed?.();
          broadcastSessionEvent({ type: "SESSION_REFRESHED", timestamp });
          break;

        case "SIGNED_OUT":
          clientLogger.info({}, "[SessionHeartbeat] 用户已登出");
          onSessionExpired?.();
          broadcastSessionEvent({ type: "SESSION_EXPIRED", timestamp });
          break;

        case "USER_UPDATED":
          // 用户信息更新，可能需要刷新 UI
          break;

        case "SIGNED_IN":
        case "INITIAL_SESSION":
          // 初始会话或登录，记录时间戳
          if (session) {
            lastRefreshTimestampRef.current = timestamp;
          }
          // V4.2.33: 标记 Auth SDK 已就绪，允许后续 getUser() 调用
          if (!isAuthReadyRef.current) {
            isAuthReadyRef.current = true;
          }
          break;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [enabled, onSessionExpired, onSessionRefreshed, broadcastSessionEvent]);

  // 设置 BroadcastChannel 多 Tab 同步
  useEffect(() => {
    if (!enabled) return;

    // 检查 BroadcastChannel 支持
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      broadcastChannelRef.current = channel;
      channel.addEventListener("message", handleBroadcastMessage);

      return () => {
        channel.removeEventListener("message", handleBroadcastMessage);
        channel.close();
        broadcastChannelRef.current = null;
      };
    } catch {
      // BroadcastChannel 创建失败，静默处理
    }
  }, [enabled, handleBroadcastMessage]);

  // 设置事件监听和兜底心跳
  useEffect(() => {
    if (!enabled) return;

    // 初始检查
    triggerSessionRefresh();

    // 兜底心跳（10 分钟间隔，主要依赖 Supabase 自动刷新）
    const heartbeatTimer = setInterval(
      triggerSessionRefresh,
      HEARTBEAT_INTERVAL,
    );

    // 监听页面可见性变化（立即刷新）
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 监听窗口焦点（立即刷新）
    window.addEventListener("focus", handleFocus);

    // 监听网络状态变化
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(heartbeatTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      // V4.2.32: 清理进行中的请求
      abortControllerRef.current?.abort();
    };
  }, [
    enabled,
    triggerSessionRefresh,
    handleVisibilityChange,
    handleFocus,
    handleOnline,
  ]);
}

export default useSessionHeartbeat;
