/**
 * Knowledge Studio Citation Adapter
 * @module ai-agent/citation
 * @description 适配 AI Agent 引用系统到 Knowledge Studio 引用格式
 */

import type { Citation as AgentCitation } from "./types";
import type { Citation as KSCitation } from "@/lib/knowledge-studio/types";

// ============================================================================
// 类型转换
// ============================================================================

/**
 * 将 AI Agent 引用转换为 Knowledge Studio 格式
 * @param agentCitation - AI Agent 引用
 * @param position - 引用位置（在文档中的顺序）
 * @returns Knowledge Studio 格式的引用
 */
export function toKSCitation(
  agentCitation: AgentCitation,
  position?: number,
): KSCitation {
  return {
    bookmarkId: String(agentCitation.bookmarkId),
    title: agentCitation.title,
    url: agentCitation.url,
    excerpt: agentCitation.summary || "",
    position: position ?? agentCitation.index,
  };
}

/**
 * 将 Knowledge Studio 引用转换为 AI Agent 格式
 * @param ksCitation - Knowledge Studio 引用
 * @param index - 引用编号 (1-based)
 * @returns AI Agent 格式的引用
 */
export function toAgentCitation(
  ksCitation: KSCitation,
  index: number,
): AgentCitation {
  return {
    index,
    bookmarkId: parseInt(ksCitation.bookmarkId, 10),
    title: ksCitation.title,
    url: ksCitation.url,
    summary: ksCitation.excerpt,
  };
}

/**
 * 批量转换 AI Agent 引用到 Knowledge Studio 格式
 * @param agentCitations - AI Agent 引用列表
 * @returns Knowledge Studio 格式的引用列表
 */
export function toKSCitations(agentCitations: AgentCitation[]): KSCitation[] {
  return agentCitations.map((citation, idx) => toKSCitation(citation, idx + 1));
}

/**
 * 批量转换 Knowledge Studio 引用到 AI Agent 格式
 * @param ksCitations - Knowledge Studio 引用列表
 * @returns AI Agent 格式的引用列表
 */
export function toAgentCitations(ksCitations: KSCitation[]): AgentCitation[] {
  return ksCitations.map((citation, idx) => toAgentCitation(citation, idx + 1));
}

// ============================================================================
// 引用格式化
// ============================================================================

/**
 * 格式化引用为脚注格式
 * @example "[^1]: 标题 - https://example.com"
 */
export function formatCitationAsFootnote(citation: KSCitation): string {
  return `[^${citation.position}]: ${citation.title} - ${citation.url}`;
}

/**
 * 生成引用参考列表（Markdown 格式）
 * @param citations - Knowledge Studio 引用列表
 * @param title - 列表标题
 * @returns Markdown 格式的引用列表
 */
export function generateReferencesSection(
  citations: KSCitation[],
  title: string = "参考来源",
): string {
  if (citations.length === 0) {
    return "";
  }

  const lines = [
    "",
    `## ${title}`,
    "",
    ...citations.map((citation) => formatCitationAsFootnote(citation)),
  ];

  return lines.join("\n");
}

// ============================================================================
// 引用提取与验证
// ============================================================================

/**
 * 从 Markdown 文本中提取引用编号
 * @param text - Markdown 文本
 * @returns 使用的引用编号列表
 */
export function extractUsedCitationIndices(text: string): number[] {
  const pattern = /\[\^(\d+)\]/g;
  const indices = new Set<number>();
  let match;

  while ((match = pattern.exec(text)) !== null) {
    indices.add(parseInt(match[1], 10));
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * 验证引用完整性
 * @param text - 文档文本
 * @param citations - 引用列表
 * @returns 验证结果
 */
export function validateCitations(
  text: string,
  citations: KSCitation[],
): {
  isValid: boolean;
  usedIndices: number[];
  missingIndices: number[];
  unusedCitations: KSCitation[];
} {
  const usedIndices = extractUsedCitationIndices(text);
  const citationPositions = new Set(citations.map((c) => c.position));

  // 文中引用但未在列表中的
  const missingIndices = usedIndices.filter(
    (idx) => !citationPositions.has(idx),
  );

  // 列表中有但未被引用的
  const unusedCitations = citations.filter(
    (c) => !usedIndices.includes(c.position),
  );

  return {
    isValid: missingIndices.length === 0,
    usedIndices,
    missingIndices,
    unusedCitations,
  };
}

// ============================================================================
// 引用合并
// ============================================================================

/**
 * 合并引用列表（去重）
 * @param existing - 现有引用
 * @param newCitations - 新增引用
 * @returns 合并后的引用列表
 */
export function mergeCitations(
  existing: KSCitation[],
  newCitations: KSCitation[],
): KSCitation[] {
  const urlSet = new Set(existing.map((c) => c.url));
  const merged = [...existing];

  let nextPosition = Math.max(...existing.map((c) => c.position), 0) + 1;

  for (const citation of newCitations) {
    if (!urlSet.has(citation.url)) {
      merged.push({
        ...citation,
        position: nextPosition++,
      });
      urlSet.add(citation.url);
    }
  }

  return merged;
}
