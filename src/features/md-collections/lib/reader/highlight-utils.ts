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
 */
function* walkTextNodes(container: Node): Generator<Text> {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
  );

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    // 跳过空白文本节点
    if (node.textContent && node.textContent.trim()) {
      yield node;
    }
  }
}

/**
 * 获取节点在容器内的文本偏移
 */
function getTextOffset(
  container: Node,
  targetNode: Node,
  nodeOffset: number,
): number {
  let offset = 0;

  for (const textNode of walkTextNodes(container)) {
    if (textNode === targetNode) {
      return offset + nodeOffset;
    }
    offset += textNode.textContent?.length || 0;
  }

  return offset;
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

  // 获取选中的文本作为锚定文本
  const anchorText = range.toString().slice(0, 100); // 限制长度

  return {
    startOffset,
    endOffset,
    anchorText,
  };
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
  const anchorText = range.toString().slice(0, 100);

  return {
    startOffset,
    endOffset,
    anchorText,
  };
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
  } catch {
    // Range 设置失败（如偏移超出范围）
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
 * 计算两个字符串的相似度（Levenshtein 距离）
 * 返回 0-1 之间的值，1 表示完全相同
 */
export function stringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  const len1 = str1.length;
  const len2 = str2.length;

  // 创建距离矩阵
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // 初始化第一行和第一列
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // 填充矩阵
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // 删除
        matrix[i][j - 1] + 1, // 插入
        matrix[i - 1][j - 1] + cost, // 替换
      );
    }
  }

  // 计算相似度
  const distance = matrix[len1][len2];
  return 1 - distance / Math.max(len1, len2);
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
