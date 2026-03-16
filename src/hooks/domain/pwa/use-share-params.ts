/**
 * useShareParams - 消费系统分享传入的 URL 参数
 *
 * 处理两种来源：
 * 1. PWA Web Share Target: /api/share-target 重定向到 /home?action=create&url=...&title=...
 * 2. 登录后回跳: /login?redirect=/home?share_url=...&share_title=...
 *
 * 读取参数后自动清理 URL，避免刷新重复触发。
 *
 * @since 2026-03-16
 */

"use client";

import { useMemo, useCallback, useSyncExternalStore } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export interface ShareParams {
  url: string;
  title?: string;
}

interface UseShareParamsReturn {
  /** 当前待消费的分享参数，null 表示无分享 */
  shareParams: ShareParams | null;
  /** 标记参数已消费（清理 URL + 重置状态） */
  consume: () => void;
}

// ---------- 模块级 store ----------

/** 已消费的 URL 集合，阻止同一 URL 重复触发 */
const consumedUrls = new Set<string>();

let shareStore: ShareParams | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): ShareParams | null {
  return shareStore;
}

function getServerSnapshot(): ShareParams | null {
  return null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setStore(value: ShareParams | null) {
  shareStore = value;
  listeners.forEach((l) => l());
}

/**
 * 解析系统分享 URL 参数。
 *
 * 调用方在 dialog 打开并预填后调用 consume() 完成消费。
 */
export function useShareParams(): UseShareParamsReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // 从 searchParams 提取分享数据（纯计算，无副作用）
  const extracted = useMemo(() => {
    const action = searchParams?.get("action");
    const url =
      searchParams?.get("url") || searchParams?.get("share_url") || null;
    const title =
      searchParams?.get("title") ||
      searchParams?.get("share_title") ||
      undefined;
    if (action === "create" && url && !consumedUrls.has(url)) {
      return { url, title } satisfies ShareParams;
    }
    return null;
  }, [searchParams]);

  // 同步写入 store（extracted 变化时触发一次）
  // 使用 useMemo 而非 useEffect 以确保首次渲染即可读取
  useMemo(() => {
    if (extracted && (!shareStore || shareStore.url !== extracted.url)) {
      setStore(extracted);
    }
  }, [extracted]);

  const shareParams = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const consume = useCallback(() => {
    if (shareStore?.url) {
      consumedUrls.add(shareStore.url);
    }
    setStore(null);
    // 清理 URL 中的分享参数，保留其他参数
    const params = new URLSearchParams(window.location.search);
    params.delete("action");
    params.delete("url");
    params.delete("title");
    params.delete("share_url");
    params.delete("share_title");
    const remaining = params.toString();
    const cleanUrl = remaining
      ? `${pathname}?${remaining}`
      : (pathname ?? "/home");
    router.replace(cleanUrl, { scroll: false });
  }, [pathname, router]);

  return { shareParams, consume };
}
