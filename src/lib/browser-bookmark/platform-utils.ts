/**
 * 平台筛选工具函数
 * 用于从书签中提取和筛选平台信息
 */

import { detectPlatformFromUrl } from "@/lib/constants/platforms";
import type { ParsedBookmarkNode } from "./types";
import type { Platform } from "@/types/supabase";

/** 平台统计信息 */
export interface PlatformStats {
  platform: Platform;
  count: number;
}

/**
 * 从书签树中提取所有书签的平台统计
 */
export function extractPlatformStats(
  nodes: ParsedBookmarkNode[],
): PlatformStats[] {
  const platformCounts = new Map<Platform, number>();

  function traverse(nodeList: ParsedBookmarkNode[]) {
    for (const node of nodeList) {
      if (node.type === "bookmark" && node.url) {
        const platform = detectPlatformFromUrl(node.url);
        platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);

  // 转换为数组并按数量排序
  const stats = Array.from(platformCounts.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);

  return stats;
}

/**
 * 获取指定平台的书签 ID 列表
 */
export function getBookmarkIdsByPlatform(
  nodes: ParsedBookmarkNode[],
  platform: Platform,
): string[] {
  const ids: string[] = [];

  function traverse(nodeList: ParsedBookmarkNode[]) {
    for (const node of nodeList) {
      if (node.type === "bookmark" && node.url) {
        const detectedPlatform = detectPlatformFromUrl(node.url);
        if (detectedPlatform === platform) {
          ids.push(node.id);
        }
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return ids;
}

/**
 * 获取所有选中平台的书签 ID 列表
 */
export function getBookmarkIdsByPlatforms(
  nodes: ParsedBookmarkNode[],
  platforms: Set<Platform>,
): Set<string> {
  const ids = new Set<string>();

  function traverse(nodeList: ParsedBookmarkNode[]) {
    for (const node of nodeList) {
      if (node.type === "bookmark" && node.url) {
        const detectedPlatform = detectPlatformFromUrl(node.url);
        if (platforms.has(detectedPlatform)) {
          ids.add(node.id);
        }
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return ids;
}
