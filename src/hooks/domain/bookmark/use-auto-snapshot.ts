/**
 * 自动快照触发 Hook (P2-010)
 * 当添加特定用途标签时自动创建快照
 *
 * 核心功能：
 * - 检测标签变更
 * - 判断是否触发快照
 * - 显示确认 Toast（可取消）
 * - 调用快照 API
 *
 * V4.2.5 升级：
 * - 微信文章使用专用微信快照 API
 * - 其他平台使用通用网页快照 API
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { clientLogger } from "@/lib/client-logger";
import { useAutoSnapshotSettings } from "@/hooks/use-auto-snapshot-settings";
import {
  useSnapshotFeature,
  useWechatArticleFeature,
} from "@/lib/feature-flags";
import type { SnapshotType } from "@/lib/snapshot/snapshot.types";
import type { Platform } from "@/types/supabase";

// ============================================================================
// 类型定义
// ============================================================================

export interface UseAutoSnapshotOptions {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签 URL */
  bookmarkUrl: string;
  /** 书签平台（V4.2.5: 用于判断使用哪种快照 API） */
  platform?: Platform;
  /** 是否已有快照 */
  hasSnapshot: boolean;
  /** 创建成功回调 */
  onSuccess?: (snapshotId: number) => void;
  /** 创建失败回调 */
  onError?: (error: string) => void;
}

export interface UseAutoSnapshotResult {
  /** 检查标签变更并触发自动快照 */
  checkAndTriggerSnapshot: (
    prevTags: string[],
    newTags: string[],
  ) => Promise<void>;
  /** 取消待执行的快照 */
  cancelPendingSnapshot: () => void;
  /** 是否有待执行的快照 */
  hasPendingSnapshot: boolean;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检查用户快照配额
 */
async function checkSnapshotQuota(): Promise<{
  canCreate: boolean;
  message?: string;
}> {
  try {
    const response = await fetch("/api/snapshots/quota");
    if (!response.ok) {
      return { canCreate: false, message: "无法检查配额" };
    }
    const data = await response.json();
    if (!data.success) {
      return { canCreate: false, message: data.error?.message };
    }

    const quota = data.data;
    const usedCount = quota.usedSnapshotCount || 0;
    const maxCount = quota.maxSnapshotCount || 100;

    if (usedCount >= maxCount) {
      return {
        canCreate: false,
        message: `快照数量已达上限 (${usedCount}/${maxCount})`,
      };
    }

    return { canCreate: true };
  } catch {
    return { canCreate: false, message: "网络错误" };
  }
}

/**
 * 创建快照（带触发来源）
 * V4.2.27: 添加响应类型检查，防止 JSON 解析错误
 */
async function createSnapshotWithSource(
  bookmarkId: number,
  snapshotType: SnapshotType,
  source: string,
  triggerTag?: string,
): Promise<{ success: boolean; snapshotId?: number; error?: string }> {
  try {
    const response = await fetch("/api/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookmarkId,
        snapshotType,
        source,
        triggerTag,
      }),
    });

    // V4.2.27: 检查响应类型，防止热更新期间的 JSON 解析错误
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      clientLogger.error(
        { status: response.status, contentType },
        "[AutoSnapshot] Non-JSON response",
      );
      return {
        success: false,
        error: "服务器响应异常，请稍后重试",
      };
    }

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error?.message || "创建快照失败",
      };
    }

    return {
      success: true,
      snapshotId: result.data?.snapshotId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "网络请求失败",
    };
  }
}

/**
 * V4.2.5: 创建微信文章快照
 * 使用专用的微信快照 API，支持完整排版和图片持久化
 * V4.2.27: 添加响应类型检查，防止 JSON 解析错误
 */
async function createWechatSnapshot(
  bookmarkId: number,
): Promise<{ success: boolean; snapshotId?: number; error?: string }> {
  try {
    const response = await fetch("/api/wechat-article/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookmarkId,
      }),
    });

    // V4.2.27: 检查响应类型，防止热更新期间的 JSON 解析错误
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      clientLogger.error(
        { status: response.status, contentType },
        "[AutoSnapshot] Non-JSON response for wechat",
      );
      return {
        success: false,
        error: "服务器响应异常，请稍后重试",
      };
    }

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error?.message || "创建微信快照失败",
      };
    }

    return {
      success: true,
      snapshotId: result.data?.snapshotId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "网络请求失败",
    };
  }
}

// ============================================================================
// Hook 实现
// ============================================================================

const TOAST_ID = "auto-snapshot-pending";

/**
 * 自动快照触发 Hook
 */
export function useAutoSnapshot({
  bookmarkId,
  bookmarkUrl: _bookmarkUrl,
  platform,
  hasSnapshot,
  onSuccess,
  onError,
}: UseAutoSnapshotOptions): UseAutoSnapshotResult {
  const router = useRouter();
  const { settings } = useAutoSnapshotSettings();
  const isSnapshotFeatureEnabled = useSnapshotFeature();
  const isWechatFeatureEnabled = useWechatArticleFeature();

  // V4.2.5: 判断是否为微信平台
  const isWechatPlatform = platform === "WECHAT_OFFICIAL_ACCOUNT";

  // 使用 ref 管理 timeout，使用 state 暴露给外部
  const pendingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cancelledRef = useRef(false);
  const [hasPendingSnapshot, setHasPendingSnapshot] = useState(false);

  // 组件卸载时清理 timeout，防止内存泄漏
  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
    };
  }, []);

  // 取消待执行的快照
  const cancelPendingSnapshot = useCallback(() => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
      cancelledRef.current = true;
      setHasPendingSnapshot(false);
      toast.dismiss(TOAST_ID);
      toast.info("已取消自动快照");
    }
  }, []);

  // 检查标签变更并触发快照
  const checkAndTriggerSnapshot = useCallback(
    async (prevTags: string[], newTags: string[]) => {
      // 1. 检查功能是否启用
      // V4.2.5: 微信平台检查微信功能开关，其他平台检查快照功能开关
      if (isWechatPlatform) {
        if (!isWechatFeatureEnabled) {
          return;
        }
      } else {
        if (!isSnapshotFeatureEnabled) {
          return;
        }
      }

      if (!settings.enabled) {
        return;
      }

      // 2. 检测新增的触发标签
      const addedTags = newTags.filter((t) => !prevTags.includes(t));
      const triggerTag = addedTags.find((t) =>
        settings.triggerTags.includes(t),
      );

      if (!triggerTag) {
        return;
      }

      // 3. 检查是否已有快照
      if (hasSnapshot) {
        return;
      }

      // 4. 检查配额（非微信平台才检查通用配额）
      if (!isWechatPlatform) {
        const quotaCheck = await checkSnapshotQuota();
        if (!quotaCheck.canCreate) {
          if (!settings.silentOnQuotaExceeded) {
            toast.warning("快照配额已满", {
              description: quotaCheck.message || "升级到 Pro 获取更多配额",
              action: {
                label: "升级",
                onClick: () => router.push("/settings/membership"),
              },
            });
          }
          return;
        }
      }

      // 5. 重置取消标记
      cancelledRef.current = false;

      // 6. 显示确认 Toast
      // V4.2.5: 微信平台显示微信快照提示
      const toastDescription = isWechatPlatform
        ? "微信文章将被永久保存，包含完整排版和图片"
        : "内容将被永久保存，防止网页失效";

      if (settings.showConfirmToast) {
        toast.loading(`正在为「${triggerTag}」内容创建快照...`, {
          id: TOAST_ID,
          description: toastDescription,
          duration: settings.confirmDelayMs + 1000, // 多给 1 秒确保不会提前消失
          action: {
            label: "取消",
            onClick: cancelPendingSnapshot,
          },
        });
      }

      // 7. 延迟执行
      setHasPendingSnapshot(true);
      pendingTimeoutRef.current = setTimeout(async () => {
        // 检查是否已取消
        if (cancelledRef.current) {
          setHasPendingSnapshot(false);
          return;
        }

        toast.dismiss(TOAST_ID);

        try {
          // V4.2.5: 根据平台选择不同的快照 API
          const result = isWechatPlatform
            ? await createWechatSnapshot(bookmarkId)
            : await createSnapshotWithSource(
                bookmarkId,
                settings.snapshotType,
                "auto-tag",
                triggerTag,
              );

          if (result.success) {
            const successDescription = isWechatPlatform
              ? "微信文章已永久保存，稍后可在详情页查看"
              : "内容将被永久保存，稍后可在详情页查看";

            toast.success("快照创建中", {
              description: successDescription,
              action: {
                label: "查看",
                onClick: () => router.push(`/bookmark/${bookmarkId}`),
              },
            });
            onSuccess?.(result.snapshotId!);
          } else {
            // 静默处理某些错误
            if (
              result.error?.includes("已有快照") ||
              result.error?.includes("ALREADY_EXISTS")
            ) {
              return;
            }

            if (!settings.silentOnQuotaExceeded) {
              toast.error("快照创建失败", {
                description: result.error,
              });
            }
            onError?.(result.error || "未知错误");
          }
        } catch (error) {
          clientLogger.error({ error }, "[AutoSnapshot] 创建失败");
          if (!settings.silentOnQuotaExceeded) {
            toast.error("快照创建失败", {
              description: "请稍后手动创建",
            });
          }
          onError?.(error instanceof Error ? error.message : "未知错误");
        }

        pendingTimeoutRef.current = null;
        setHasPendingSnapshot(false);
      }, settings.confirmDelayMs);
    },
    [
      isWechatPlatform,
      isWechatFeatureEnabled,
      isSnapshotFeatureEnabled,
      settings,
      hasSnapshot,
      bookmarkId,
      router,
      cancelPendingSnapshot,
      onSuccess,
      onError,
    ],
  );

  return {
    checkAndTriggerSnapshot,
    cancelPendingSnapshot,
    hasPendingSnapshot,
  };
}
