import { clientLogger } from "@/lib/client-logger";

/**
 * MD 阅读器高亮工具函数
 * Spec: md-reader-upgrade / REQ-10
 *
 * 提供高亮定位的核心工具函数：
 * - 计算选区 offset（相对于内容容器）
 * - 从 offset 恢复 Range
 * - anchor_text 模糊匹配算法
 */

/**
 * 选区位置信息
 */
export interface SelectionOffset {
  /** 起始字符偏移 */
  startOffset: number;
  /** 结束字符偏移 */
  endOffset: number;
  /** 锚定文本（用于内容变更后重新定位） */
  anchorText: string;
}

/**
 * 文本节点遍历器
 * 遍历容器内的所有文本节点
 *
 * @param container - 容器节点
 * @param includeWhitespace - 是否包括纯空白文本节点（默认 false）
 */
function* walkTextNodes(
  container: Node,
  includeWhitespace: boolean = false,
): Generator<Text> {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
  );

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    // 根据参数决定是否跳过空白文本节点
    if (includeWhitespace || (node.textContent && node.textContent.trim())) {
      yield node;
    }
  }
}

/**
 * 获取节点在容器内的文本偏移
 *
 * 使用 Range API 计算从容器开始到目标位置的文本长度。
 * 这种方法更可靠，能正确处理 Element 和 Text 节点。
 *
 * @param container - 容器节点
 * @param targetNode - 目标节点（可以是 Text 或 Element）
 * @param nodeOffset - 节点内偏移
 * @returns 容器内的文本偏移，失败时返回 -1
 */
function getTextOffset(
  container: Node,
  targetNode: Node,
  nodeOffset: number,
): number {
  try {
    // 检查目标节点是否在容器内
    if (!container.contains(targetNode)) {
      return -1;
    }

    // 创建一个临时 Range，从容器开始到目标位置
    const tempRange = document.createRange();
    tempRange.setStart(container, 0);
    tempRange.setEnd(targetNode, nodeOffset);

    // 使用 Range 的 toString() 获取文本长度
    // 这会正确处理所有节点类型
    return tempRange.toString().length;
  } catch (error) {
    // Range 设置失败（如偏移超出范围）
    if (process.env.NODE_ENV === "development") {
      clientLogger.error({ error }, "[highlight-utils] getTextOffset failed:");
    }
    return -1;
  }
}

/**
 * 根据偏移找到对应的文本节点和节点内偏移
 */
function findNodeAtOffset(
  container: Node,
  targetOffset: number,
): { node: Text; offset: number } | null {
  let currentOffset = 0;

  for (const textNode of walkTextNodes(container)) {
    const nodeLength = textNode.textContent?.length || 0;

    if (currentOffset + nodeLength >= targetOffset) {
      return {
        node: textNode,
        offset: targetOffset - currentOffset,
      };
    }

    currentOffset += nodeLength;
  }

  return null;
}

/**
 * 从当前选区计算偏移
 *
 * @param container - 内容容器元素
 * @returns 选区偏移信息，无选区时返回 null
 *
 * @example
 * ```ts
 * const container = document.getElementById('content');
 * const offset = getSelectionOffset(container);
 * if (offset) {
 *   console.log(`选中了 ${offset.startOffset} 到 ${offset.endOffset}`);
 *   console.log(`选中文本: ${offset.anchorText}`);
 * }
 * ```
 */
export function getSelectionOffset(container: Element): SelectionOffset | null {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);

  // 检查选区是否在容器内
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  try {
    const startOffset = getTextOffset(
      container,
      range.startContainer,
      range.startOffset,
    );
    const endOffset = getTextOffset(
      container,
      range.endContainer,
      range.endOffset,
    );

    // 边界检查：如果未找到目标节点，返回 null
    if (startOffset === -1 || endOffset === -1) {
      return null;
    }

    // 获取选中的文本作为锚定文本
    const anchorText = range.toString().slice(0, 100); // 限制长度

    return {
      startOffset,
      endOffset,
      anchorText,
    };
  } catch (error) {
    // 偏移计算失败（如节点偏移超出范围）
    if (process.env.NODE_ENV === "development") {
      clientLogger.error(
        { error },
        "[highlight-utils] getSelectionOffset failed:",
      );
    }
    return null;
  }
}

/**
 * 从 Range 计算偏移
 *
 * @param container - 内容容器元素
 * @param range - Range 对象
 * @returns 选区偏移信息
 */
export function getRangeOffset(
  container: Element,
  range: Range,
): SelectionOffset | null {
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  try {
    const startOffset = getTextOffset(
      container,
      range.startContainer,
      range.startOffset,
    );
    const endOffset = getTextOffset(
      container,
      range.endContainer,
      range.endOffset,
    );

    // 边界检查：如果未找到目标节点，返回 null
    if (startOffset === -1 || endOffset === -1) {
      return null;
    }

    const anchorText = range.toString().slice(0, 100);

    return {
      startOffset,
      endOffset,
      anchorText,
    };
  } catch (error) {
    // 偏移计算失败（如节点偏移超出范围）
    if (process.env.NODE_ENV === "development") {
      clientLogger.error({ error }, "[highlight-utils] getRangeOffset failed:");
    }
    return null;
  }
}

/**
 * 从偏移恢复 Range
 *
 * @param container - 内容容器元素
 * @param startOffset - 起始偏移
 * @param endOffset - 结束偏移
 * @returns Range 对象，失败时返回 null
 *
 * @example
 * ```ts
 * const container = document.getElementById('content');
 * const range = restoreRange(container, 10, 50);
 * if (range) {
 *   // 应用高亮样式
 *   const mark = document.createElement('mark');
 *   range.surroundContents(mark);
 * }
 * ```
 */
export function restoreRange(
  container: Element,
  startOffset: number,
  endOffset: number,
): Range | null {
  const startResult = findNodeAtOffset(container, startOffset);
  const endResult = findNodeAtOffset(container, endOffset);

  if (!startResult || !endResult) {
    return null;
  }

  try {
    const range = document.createRange();
    range.setStart(startResult.node, startResult.offset);
    range.setEnd(endResult.node, endResult.offset);
    return range;
  } catch (error) {
    // Range 设置失败（如偏移超出范围）
    if (process.env.NODE_ENV === "development") {
      clientLogger.error({ error }, "[highlight-utils] restoreRange failed:");
    }
    return null;
  }
}

/**
 * 模糊匹配：在内容中查找锚定文本的位置
 *
 * 当内容发生变化时，使用锚定文本重新定位高亮位置。
 * 支持部分匹配和相似度匹配。
 *
 * @param container - 内容容器元素
 * @param anchorText - 锚定文本
 * @param originalStart - 原始起始偏移（用于就近匹配）
 * @returns 新的偏移信息，找不到时返回 null
 *
 * @example
 * ```ts
 * const container = document.getElementById('content');
 * const result = fuzzyMatchAnchor(container, '这是要匹配的文本', 100);
 * if (result) {
 *   console.log(`找到匹配: ${result.startOffset} - ${result.endOffset}`);
 * }
 * ```
 */
export function fuzzyMatchAnchor(
  container: Element,
  anchorText: string,
  originalStart?: number,
): SelectionOffset | null {
  if (!anchorText || anchorText.length < 3) {
    return null;
  }

  // 获取容器的全部文本内容
  const fullText = container.textContent || "";

  // 精确匹配
  let matchIndex = fullText.indexOf(anchorText);

  if (matchIndex !== -1) {
    // 如果有多个匹配，选择最接近原始位置的
    if (originalStart !== undefined) {
      const allMatches: number[] = [];
      let searchIndex = 0;

      while ((matchIndex = fullText.indexOf(anchorText, searchIndex)) !== -1) {
        allMatches.push(matchIndex);
        searchIndex = matchIndex + 1;
      }

      if (allMatches.length > 1) {
        // 选择最接近原始位置的匹配
        matchIndex = allMatches.reduce((closest, current) =>
          Math.abs(current - originalStart) < Math.abs(closest - originalStart)
            ? current
            : closest,
        );
      } else if (allMatches.length === 1) {
        matchIndex = allMatches[0];
      }
    }

    if (matchIndex !== -1) {
      return {
        startOffset: matchIndex,
        endOffset: matchIndex + anchorText.length,
        anchorText,
      };
    }
  }

  // 部分匹配：尝试匹配前半部分或后半部分
  const halfLength = Math.floor(anchorText.length / 2);

  if (halfLength >= 10) {
    // 尝试前半部分
    const firstHalf = anchorText.slice(0, halfLength);
    matchIndex = fullText.indexOf(firstHalf);

    if (matchIndex !== -1) {
      return {
        startOffset: matchIndex,
        endOffset: matchIndex + firstHalf.length,
        anchorText: firstHalf,
      };
    }

    // 尝试后半部分
    const secondHalf = anchorText.slice(-halfLength);
    matchIndex = fullText.indexOf(secondHalf);

    if (matchIndex !== -1) {
      return {
        startOffset: matchIndex,
        endOffset: matchIndex + secondHalf.length,
        anchorText: secondHalf,
      };
    }
  }

  return null;
}

/**
 * 验证高亮偏移是否有效
 */
export function isValidOffset(
  container: Element,
  startOffset: number,
  endOffset: number,
): boolean {
  if (startOffset < 0 || endOffset <= startOffset) {
    return false;
  }

  const fullText = container.textContent || "";
  return endOffset <= fullText.length;
}

/**
 * 获取高亮文本预览（用于显示）
 */
export function getHighlightPreview(
  text: string,
  maxLength: number = 50,
): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * 清除当前选区
 */
export function clearSelection(): void {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
}

/**
 * 检查是否有文本被选中
 */
export function hasSelection(): boolean {
  const selection = window.getSelection();
  return (
    selection !== null &&
    !selection.isCollapsed &&
    selection.toString().length > 0
  );
}

/**
 * 获取选区的边界矩形（用于定位工具栏）
 */
export function getSelectionRect(): DOMRect | null {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  return range.getBoundingClientRect();
}
