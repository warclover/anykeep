"use client";

/**
 * 元数据抓取 Hook
 * 提供批量抓取网页元数据的功能
 */

import { useState, useCallback, useRef } from "react";
import { clientLogger } from "@/lib/client-logger";
import type { PageMetadata } from "@/lib/browser-bookmark";

// ============================================
// 类型定义
// ============================================

export interface MetadataFetcherOptions {
  /** 单个请求超时（毫秒） */
  timeout?: number;
  /** 并发数量 */
  concurrency?: number;
  /** 是否抓取 favicon */
  fetchFavicon?: boolean;
}

export interface MetadataResult {
  url: string;
  success: boolean;
  metadata?: PageMetadata;
  error?: string;
}

export interface UseMetadataFetcherReturn {
  /** 是否正在抓取 */
  isFetching: boolean;
  /** 进度（0-100） */
  progress: number;
  /** 抓取结果 */
  results: Map<string, PageMetadata>;
  /** 错误列表 */
  errors: Map<string, string>;
  /** 统计信息 */
  stats: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
  };
  /** 开始抓取 */
  fetch: (urls: string[], options?: MetadataFetcherOptions) => Promise<void>;
  /** 取消抓取 */
  cancel: () => void;
  /** 重置状态 */
  reset: () => void;
  /** 获取指定 URL 的元数据 */
  getMetadata: (url: string) => PageMetadata | undefined;
  /** 检查 URL 是否抓取成功 */
  isSuccess: (url: string) => boolean;
}

// ============================================
// Hook 实现
// ============================================

export function useMetadataFetcher(): UseMetadataFetcherReturn {
  // 状态
  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Map<string, PageMetadata>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    pending: 0,
  });

  // 取消控制
  const abortControllerRef = useRef<AbortController | null>(null);

  // 开始抓取
  const fetchMetadata = useCallback(
    async (urls: string[], options: MetadataFetcherOptions = {}) => {
      if (isFetching || urls.length === 0) return;

      // 重置状态
      setIsFetching(true);
      setProgress(0);
      setResults(new Map());
      setErrors(new Map());
      setStats({
        total: urls.length,
        successful: 0,
        failed: 0,
        pending: urls.length,
      });

      // 创建 AbortController
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // 分批抓取（每批最多 20 个）
        const BATCH_SIZE = 20;
        let completed = 0;
        const newResults = new Map<string, PageMetadata>();
        const newErrors = new Map<string, string>();

        for (let i = 0; i < urls.length; i += BATCH_SIZE) {
          if (controller.signal.aborted) break;

          const batchUrls = urls.slice(
            i,
            Math.min(i + BATCH_SIZE, urls.length),
          );

          const response = await window.fetch(
            "/api/browser-bookmark/fetch-metadata",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                urls: batchUrls,
                timeout: options.timeout || 10000,
                concurrency: options.concurrency || 5,
                fetchFavicon: options.fetchFavicon !== false,
              }),
              signal: controller.signal,
            },
          );

          if (!response.ok) {
            throw new Error("抓取失败");
          }

          const data = await response.json();
          const items = data.data?.items || [];

          // 处理结果
          for (const item of items) {
            if (item.success && item.metadata) {
              newResults.set(item.url, item.metadata);
            } else {
              newErrors.set(item.url, item.error || "未知错误");
            }
          }

          completed += batchUrls.length;
          const currentProgress = Math.round((completed / urls.length) * 100);

          setProgress(currentProgress);
          setResults(new Map(newResults));
          setErrors(new Map(newErrors));
          setStats({
            total: urls.length,
            successful: newResults.size,
            failed: newErrors.size,
            pending: urls.length - completed,
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          clientLogger.error({ error }, "[MetadataFetcher] 抓取元数据失败");
        }
      } finally {
        setIsFetching(false);
        abortControllerRef.current = null;
      }
    },
    [isFetching],
  );

  // 取消抓取
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsFetching(false);
  }, []);

  // 重置状态
  const reset = useCallback(() => {
    setIsFetching(false);
    setProgress(0);
    setResults(new Map());
    setErrors(new Map());
    setStats({
      total: 0,
      successful: 0,
      failed: 0,
      pending: 0,
    });
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // 获取元数据
  const getMetadata = useCallback(
    (url: string) => {
      return results.get(url);
    },
    [results],
  );

  // 检查是否成功
  const isSuccess = useCallback(
    (url: string) => {
      return results.has(url);
    },
    [results],
  );

  return {
    isFetching,
    progress,
    results,
    errors,
    stats,
    fetch: fetchMetadata,
    cancel,
    reset,
    getMetadata,
    isSuccess,
  };
}

export default useMetadataFetcher;
