/**
 * 网络状态监测 Hook
 * V5.0: 实时监测网络连接状态，支持降级策略
 *
 * 特点：
 * - 监测在线/离线状态
 * - 检测慢速网络
 * - 提供网络质量指标
 * - 支持恢复通知
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * 网络状态类型
 */
export type NetworkStatus = "online" | "offline" | "slow";

/**
 * 网络质量等级
 */
export type NetworkQuality = "good" | "moderate" | "poor" | "unknown";

/**
 * 网络信息接口（扩展 Navigator）
 */
interface NetworkInformation {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  downlink?: number; // Mbps
  rtt?: number; // 往返时间 (ms)
  saveData?: boolean;
  addEventListener?: (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => void;
  removeEventListener?: (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

/**
 * Hook 返回值
 */
interface UseNetworkStatusResult {
  /** 网络状态 */
  status: NetworkStatus;
  /** 是否在线 */
  isOnline: boolean;
  /** 是否离线 */
  isOffline: boolean;
  /** 是否慢速网络 */
  isSlow: boolean;
  /** 网络质量等级 */
  quality: NetworkQuality;
  /** 网络类型 (4g/3g/2g/slow-2g) */
  effectiveType: string | null;
  /** 估算下行速度 (Mbps) */
  downlink: number | null;
  /** 往返延迟 (ms) */
  rtt: number | null;
  /** 是否启用省流量模式 */
  saveData: boolean;
  /** 上次状态变化时间 */
  lastChanged: Date | null;
  /** 手动刷新网络状态 */
  refresh: () => void;
}

/**
 * Hook 配置选项
 */
interface UseNetworkStatusOptions {
  /** 慢速网络 RTT 阈值 (ms)，默认 500ms */
  slowThreshold?: number;
  /** 状态变化回调 */
  onStatusChange?: (
    status: NetworkStatus,
    previousStatus: NetworkStatus,
  ) => void;
  /** 恢复在线回调 */
  onOnline?: () => void;
  /** 离线回调 */
  onOffline?: () => void;
}

/**
 * 获取网络连接信息
 */
function getConnection(): NetworkInformation | null {
  if (typeof navigator === "undefined") return null;
  return (
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection ||
    null
  );
}

/**
 * 根据网络信息判断质量等级
 */
function getNetworkQuality(
  connection: NetworkInformation | null,
): NetworkQuality {
  if (!connection) return "unknown";

  const { effectiveType, rtt } = connection;

  // 基于 effectiveType 判断
  if (effectiveType === "4g") {
    return rtt && rtt < 100 ? "good" : "moderate";
  }
  if (effectiveType === "3g") {
    return "moderate";
  }
  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    return "poor";
  }

  // 基于 RTT 判断
  if (rtt !== undefined) {
    if (rtt < 100) return "good";
    if (rtt < 300) return "moderate";
    return "poor";
  }

  return "unknown";
}

/**
 * 网络状态监测 Hook
 */
export function useNetworkStatus(
  options: UseNetworkStatusOptions = {},
): UseNetworkStatusResult {
  const { slowThreshold = 500, onStatusChange, onOnline, onOffline } = options;

  // 状态
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [connectionInfo, setConnectionInfo] =
    useState<NetworkInformation | null>(() => getConnection());
  const [lastChanged, setLastChanged] = useState<Date | null>(null);

  // 上一个状态引用（用于比较）
  const prevStatusRef = useRef<NetworkStatus>("online");

  // 计算派生状态
  const isSlow =
    connectionInfo?.effectiveType === "slow-2g" ||
    connectionInfo?.effectiveType === "2g" ||
    (connectionInfo?.rtt !== undefined && connectionInfo.rtt > slowThreshold);

  const status: NetworkStatus = !isOnline
    ? "offline"
    : isSlow
      ? "slow"
      : "online";
  const quality = getNetworkQuality(connectionInfo);

  /**
   * 更新连接信息
   */
  const updateConnectionInfo = useCallback(() => {
    const connection = getConnection();
    setConnectionInfo(connection ? { ...connection } : null);
  }, []);

  /**
   * 处理在线事件
   */
  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setLastChanged(new Date());
    updateConnectionInfo();
    onOnline?.();
  }, [onOnline, updateConnectionInfo]);

  /**
   * 处理离线事件
   */
  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setLastChanged(new Date());
    onOffline?.();
  }, [onOffline]);

  /**
   * 处理连接变化事件
   */
  const handleConnectionChange = useCallback(() => {
    updateConnectionInfo();
    setLastChanged(new Date());
  }, [updateConnectionInfo]);

  /**
   * 手动刷新
   */
  const refresh = useCallback(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    updateConnectionInfo();
    setLastChanged(new Date());
  }, [updateConnectionInfo]);

  // 监听状态变化并触发回调
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      onStatusChange?.(status, prevStatusRef.current);
      prevStatusRef.current = status;
    }
  }, [status, onStatusChange]);

  // 设置事件监听
  useEffect(() => {
    // SSR 检查
    if (typeof window === "undefined") return;

    // 监听在线/离线事件
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 监听网络连接变化
    const connection = getConnection();
    if (connection?.addEventListener) {
      connection.addEventListener("change", handleConnectionChange);
    }

    // 初始化连接信息（使用 setTimeout 避免同步 setState）
    const initTimeout = setTimeout(() => {
      updateConnectionInfo();
    }, 0);

    return () => {
      clearTimeout(initTimeout);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      if (connection?.removeEventListener) {
        connection.removeEventListener("change", handleConnectionChange);
      }
    };
  }, [
    handleOnline,
    handleOffline,
    handleConnectionChange,
    updateConnectionInfo,
  ]);

  return {
    status,
    isOnline,
    isOffline: !isOnline,
    isSlow,
    quality,
    effectiveType: connectionInfo?.effectiveType || null,
    downlink: connectionInfo?.downlink || null,
    rtt: connectionInfo?.rtt || null,
    saveData: connectionInfo?.saveData || false,
    lastChanged,
    refresh,
  };
}

/**
 * 离线提示组件
 * 用于在页面顶部显示离线状态
 */
export function OfflineBanner({
  show,
  message = "您当前处于离线状态",
}: {
  show: boolean;
  message?: string;
}) {
  if (!show) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm text-white">
      <span className="inline-flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        {message}
      </span>
    </div>
  );
}

/**
 * 慢速网络提示组件
 */
export function SlowNetworkBanner({
  show,
  message = "当前网络较慢，部分功能可能受影响",
}: {
  show: boolean;
  message?: string;
}) {
  if (!show) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-50 bg-yellow-100 px-4 py-2 text-center text-sm text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200">
      {message}
    </div>
  );
}
