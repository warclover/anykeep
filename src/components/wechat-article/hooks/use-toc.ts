/**
 * 文章目录 Hook
 *
 * @module wechat-article/hooks
 * @description 从 HTML 内容提取目录结构
 *
 * Phase 4 升级：UX 优化 - 目录导航
 */

"use client";

import { useMemo, useCallback } from "react";

// =============================================================================
// 类型定义
// =============================================================================

export interface TocItem {
  /** 唯一标识 */
  id: string;
  /** 标题文本 */
  text: string;
  /** 标题级别 (1-6) */
  level: number;
  /** 子项 */
  children?: TocItem[];
}

export interface UseTocOptions {
  /** 最大标题级别 (默认 3，即 h1-h3) */
  maxLevel?: number;
  /** 最小标题数量（少于此数不生成目录） */
  minItems?: number;
}

export interface UseTocReturn {
  /** 目录项列表（扁平结构） */
  items: TocItem[];
  /** 目录项列表（树形结构） */
  tree: TocItem[];
  /** 是否有足够的标题生成目录 */
  hasToc: boolean;
  /** 滚动到指定标题 */
  scrollToHeading: (id: string) => void;
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 从 HTML 提取标题
 */
function extractHeadingsFromHtml(
  html: string,
  maxLevel: number,
): TocItem[] {
  if (!html) return [];

  const items: TocItem[] = [];
  const levelPattern = `[1-${maxLevel}]`;
  const headingRegex = new RegExp(
    `<h(${levelPattern})[^>]*(?:id="([^"]*)")?[^>]*>([\\s\\S]*?)</h\\1>`,
    "gi",
  );

  let match;
  let index = 0;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const existingId = match[2];
    // 提取纯文本（移除 HTML 标签）
    const text = match[3]
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();

    if (!text) continue;

    const id = existingId || `toc-heading-${index}`;
    items.push({ id, text, level });
    index++;
  }

  return items;
}

/**
 * 将扁平列表转换为树形结构
 */
function buildTocTree(items: TocItem[]): TocItem[] {
  if (items.length === 0) return [];

  const tree: TocItem[] = [];
  const stack: TocItem[] = [];

  for (const item of items) {
    const newItem: TocItem = { ...item, children: [] };

    // 找到父节点
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      tree.push(newItem);
    } else {
      const parent = stack[stack.length - 1];
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(newItem);
    }

    stack.push(newItem);
  }

  return tree;
}

// =============================================================================
// Hook 实现
// =============================================================================

/**
 * 文章目录 Hook
 *
 * 功能：
 * - 从 HTML 提取 h1-h3 标题
 * - 生成树形目录结构
 * - 支持点击跳转
 */
export function useToc(
  html: string | null | undefined,
  options: UseTocOptions = {},
): UseTocReturn {
  const { maxLevel = 3, minItems = 2 } = options;

  // 提取并构建目录
  const { items, tree } = useMemo(() => {
    if (!html) {
      return { items: [], tree: [] };
    }

    const extractedItems = extractHeadingsFromHtml(html, maxLevel);
    const builtTree = buildTocTree(extractedItems);

    return {
      items: extractedItems,
      tree: builtTree,
    };
  }, [html, maxLevel]);

  // 是否有足够的目录项
  const hasToc = items.length >= minItems;

  // 滚动到指定标题
  const scrollToHeading = useCallback((id: string) => {
    // 尝试通过 ID 查找元素
    let element = document.getElementById(id);

    // 如果没找到，尝试通过 data 属性或其他方式
    if (!element) {
      element = document.querySelector(`[data-toc-id="${id}"]`);
    }

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);

  return {
    items,
    tree,
    hasToc,
    scrollToHeading,
  };
}
