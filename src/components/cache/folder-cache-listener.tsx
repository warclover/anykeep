"use client";

/**
 * 文件夹缓存失效监听器
 *
 * 监听文件夹变更事件，清除 Keep-Alive 中的 /folders 页面缓存
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import { useEffect } from "react";
import { useKeepAlive, subscribeFolderCacheInvalidation } from "@/lib/cache";

/**
 * 需要在文件夹变更时清除的页面路径
 */
const FOLDER_RELATED_PAGES = ["/folders", "/home"];

export function FolderCacheListener() {
  const { remove, cachedKeys } = useKeepAlive();

  useEffect(() => {
    // 订阅文件夹缓存失效事件
    const unsubscribe = subscribeFolderCacheInvalidation(() => {
      // 清除所有文件夹相关页面的缓存
      FOLDER_RELATED_PAGES.forEach((path) => {
        if (cachedKeys.includes(path)) {
          remove(path);
        }
      });
    });

    return unsubscribe;
  }, [remove, cachedKeys]);

  // 此组件不渲染任何内容
  return null;
}
