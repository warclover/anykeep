/**
 * 国际化缓存优化
 *
 * P3 性能优化: 缓存翻译结果，避免每次渲染都重新计算
 *
 * 使用场景：
 * - 高频使用翻译的组件
 * - 需要访问嵌套翻译键的组件（如 "nav.myBookmarks"）
 *
 * @example
 * ```tsx
 * import { useUiTextMemo } from "@/lib/i18n/cache";
 *
 * function MyComponent() {
 *   const { t } = useUiTextMemo();
 *   return <div>{t("nav.myBookmarks")}</div>;
 * }
 * ```
 */

"use client";

import { useMemo, useEffect, useRef } from "react";
import { useUiText } from "./hooks";

/**
 * 翻译缓存 Map
 * 使用 Map 而非普通对象，支持任意类型的键
 */
const translationCache = new Map<string, unknown>();

/**
 * 清空翻译缓存
 * 用于语言切换时清除旧语言的缓存
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}

/**
 * 带缓存的翻译 Hook
 *
 * 工作原理：
 * 1. 使用 Map 缓存已访问过的翻译路径
 * 2. 使用 useMemo 确保缓存访问函数引用稳定
 * 3. 语言切换时自动清除缓存
 *
 * 性能收益：
 * - 减少嵌套对象属性访问的开销
 * - 对于重复访问的翻译键，直接返回缓存结果
 */
export function useUiTextMemo() {
  const messages = useUiText();

  // 使用 ref 存储当前语言，用于检测语言切换
  const localeRef = useRef(messages);

  // 在 effect 中检测语言切换并清除缓存（修复：不能在渲染期间访问 ref）
  useEffect(() => {
    if (messages !== localeRef.current) {
      clearTranslationCache();
      localeRef.current = messages;
    }
  }, [messages]);

  /**
   * 获取缓存后的翻译函数
   * 使用 useMemo 确保函数引用稳定
   */
  const getCachedTranslation = useMemo(() => {
    return (key: string): string => {
      // 检查缓存
      if (translationCache.has(key)) {
        return translationCache.get(key) as string;
      }

      // 解析嵌套键（如 "nav.myBookmarks"）
      const parts = key.split(".");
      let value: unknown = messages;

      for (const part of parts) {
        value = (value as Record<string, unknown>)?.[part];
        if (value === undefined) {
          break; // 提前退出避免不必要的访问
        }
      }

      const result = (value as string) || key;

      // 存入缓存
      translationCache.set(key, result);

      return result;
    };
  }, [messages]);

  /**
   * 批量获取翻译（用于组件需要多个翻译的场景）
   */
  const getBatchTranslations = useMemo(() => {
    return (keys: string[]): Record<string, string> => {
      const result: Record<string, string> = {};

      for (const key of keys) {
        result[key] = getCachedTranslation(key);
      }

      return result;
    };
  }, [getCachedTranslation]);

  return {
    /** 带缓存的翻译函数 */
    t: getCachedTranslation,
    /** 批量获取翻译 */
    batch: getBatchTranslations,
    /** 原始消息对象（用于需要直接访问的场景） */
    messages,
  };
}

/**
 * 类型守卫：检查是否为翻译键
 */
export function isTranslationKey(value: unknown): value is string {
  return typeof value === "string" && value.includes(".");
}

/**
 * 辅助函数：获取嵌套属性值（不带缓存）
 * 用于服务端组件或不需要缓存的场景
 */
export function getNestedValue<T = unknown>(
  obj: Record<string, unknown>,
  path: string,
): T | null {
  const parts = path.split(".");
  let value: unknown = obj;

  for (const part of parts) {
    value = (value as Record<string, unknown>)?.[part];
    if (value === undefined) {
      return null;
    }
  }

  return value as T | null;
}

/**
 * 获取缓存统计信息（用于调试）
 */
export function getCacheStats() {
  return {
    size: translationCache.size,
    keys: Array.from(translationCache.keys()),
  };
}
