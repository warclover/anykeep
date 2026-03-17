/**
 * LlmScorer - LLM 语义分类
 *
 * 关键创新：接收前序 Scorer 的 Top-3 候选及理由注入 prompt（Chain-of-Thought），
 * 相当于将旧系统的 T0+T1 合并为单次 LLM 调用。
 *
 * 迁移自旧系统：
 * - strategies/modern/t0-generator.ts
 * - strategies/modern/t1-corrector.ts
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { logger } from "@/lib/logger";
import type {
  Scorer,
  Score,
  Signal,
  BookmarkContext,
  FolderContext,
  UserContext,
  MergedScore,
} from "../types";
import { CLASSIFICATION_CONFIG } from "../config";
import { callLlm, sanitizeInput } from "../infra/llm";

/** LLM 返回的结构化结果 */
interface LlmClassifyOutput {
  folderId: number;
  confidence: number;
  reasoning: string;
}

export class LlmScorer implements Scorer {
  readonly name = "llm";
  readonly tier = "slow" as const;
  readonly defaultWeight = CLASSIFICATION_CONFIG.scorerWeights.llm;

  /** 冷启动且无候选时跳过 */
  shouldRun(_bookmark: BookmarkContext, userCtx: UserContext): boolean {
    return userCtx.folderCount > 0;
  }

  async score(
    bookmark: BookmarkContext,
    candidates: FolderContext[],
    _userCtx: UserContext,
    priorResults?: Map<number, MergedScore>,
  ): Promise<Map<number, Score>> {
    const results = new Map<number, Score>();

    try {
      // 1. 限制候选数量
      const topCandidates = selectTopCandidates(candidates, priorResults);

      // 2. 构建 prompt
      const { systemPrompt, userPrompt } = buildPrompt(
        bookmark,
        topCandidates,
        priorResults,
      );

      // 3. 调用 LLM
      const response = await callLlm({ systemPrompt, userPrompt });

      // 4. 解析 LLM 响应
      const output = parseLlmResponse(response.content, candidates);

      if (!output) {
        logger.warn(
          { bookmarkId: bookmark.bookmarkId },
          "LlmScorer: Failed to parse LLM response",
        );
        // 解析失败也写入 signal，便于排查
        if (candidates.length > 0) {
          results.set(candidates[0].id, {
            value: 0,
            confidence: 0,
            reason: "LLM 响应解析失败",
            signals: [
              {
                type: "llm_error",
                detail: `parse_failed: ${response.content.slice(0, 80)}`,
                strength: 0,
              },
            ],
          });
        }
        return results;
      }

      // 5. 验证 folderId 存在于候选列表
      const folder = candidates.find((c) => c.id === output.folderId);
      if (!folder) {
        logger.warn(
          { folderId: output.folderId, bookmarkId: bookmark.bookmarkId },
          "LlmScorer: LLM returned invalid folderId",
        );
        return results;
      }

      const confidence = Math.min(Math.max(output.confidence, 0), 1);

      const signals: Signal[] = [
        {
          type: "llm_semantic",
          detail: output.reasoning.slice(0, 100),
          strength: confidence,
        },
      ];

      results.set(output.folderId, {
        value: confidence,
        confidence: confidence * 0.9, // LLM 自身置信度略有衰减
        reason: `LLM 推荐「${folder.name}」: ${output.reasoning.slice(0, 60)}`,
        signals,
      });

      return results;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        { error: errorMsg, bookmarkId: bookmark.bookmarkId },
        "LlmScorer: execution failed",
      );

      // 将错误信息写入 signal，使下游可观测 LLM 失败原因
      if (candidates.length > 0) {
        results.set(candidates[0].id, {
          value: 0,
          confidence: 0,
          reason: `LLM 调用失败: ${errorMsg.slice(0, 80)}`,
          signals: [
            {
              type: "llm_error",
              detail: errorMsg.slice(0, 120),
              strength: 0,
            },
          ],
        });
      }
      return results;
    }
  }
}

// ============================================================================
// Prompt 构建
// ============================================================================

/**
 * 选择注入 LLM prompt 的候选文件夹
 *
 * 优先取前序 Scorer 评分高的，补充其余候选
 */
function selectTopCandidates(
  candidates: FolderContext[],
  priorResults?: Map<number, MergedScore>,
): FolderContext[] {
  const { maxCandidates } = CLASSIFICATION_CONFIG.llm;

  if (!priorResults || priorResults.size === 0) {
    return candidates.slice(0, maxCandidates);
  }

  // 按前序得分排序
  const sorted = [...candidates].sort((a, b) => {
    const scoreA = priorResults.get(a.id)?.value ?? 0;
    const scoreB = priorResults.get(b.id)?.value ?? 0;
    return scoreB - scoreA;
  });

  return sorted.slice(0, maxCandidates);
}

function buildPrompt(
  bookmark: BookmarkContext,
  candidates: FolderContext[],
  priorResults?: Map<number, MergedScore>,
): { systemPrompt: string; userPrompt: string } {
  const { titleMaxLen, summaryMaxLen, maxTags } = CLASSIFICATION_CONFIG.llm;

  const safeTitle = sanitizeInput(bookmark.title, titleMaxLen);
  const safeSummary = sanitizeInput(bookmark.summary ?? "", summaryMaxLen);
  const safeUrl = sanitizeInput(bookmark.url ?? "", 200);
  const safeTags = bookmark.tags
    .slice(0, maxTags)
    .map((t) => sanitizeInput(t, 20))
    .join(", ");

  const systemPrompt = SYSTEM_PROMPT;

  // 构建前序结果部分
  let priorSection = "";
  if (priorResults && priorResults.size > 0) {
    const topPrior = Array.from(priorResults.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    priorSection =
      "\n## 前序匹配结果（供参考）\n" +
      topPrior
        .map((r) => {
          const scorers = Object.entries(r.breakdown)
            .map(([k, v]) => `${k}=${(v * 100).toFixed(0)}%`)
            .join(", ");
          return `- ${r.folderName}: 综合 ${(r.value * 100).toFixed(0)}%（${scorers}）`;
        })
        .join("\n");
  }

  // 构建候选文件夹部分
  const candidateSection = candidates
    .map((c, i) => {
      const samples =
        c.sampleTitles.length > 0
          ? c.sampleTitles.map((t) => `「${sanitizeInput(t, 40)}」`).join("、")
          : "暂无";
      const tags = c.coreTags.length > 0 ? c.coreTags.join(", ") : "暂无";
      return `${i + 1}. **${c.name}** (id=${c.id})\n   已有内容: ${samples}\n   核心标签: ${tags}`;
    })
    .join("\n");

  const userPrompt = `## 待分类书签
- 标题: "${safeTitle}"
- 摘要: "${safeSummary}"
- URL: "${safeUrl}"
- 标签: ${safeTags}
${priorSection}

## 候选文件夹
${candidateSection}

## 要求
1. 综合书签内容和前序匹配结果做判断
2. 如果前序结果一致且合理，直接确认
3. 如果前序结果矛盾或不合理，给出你的独立判断
4. 返回 JSON: { "folderId": number, "confidence": 0.0-1.0, "reasoning": "..." }`;

  return { systemPrompt, userPrompt };
}

const SYSTEM_PROMPT = `你是智能书签分类助手。根据书签的标题、摘要、URL和标签，从候选文件夹中选择最合适的。

规则：
- 仅从候选列表中选择，使用对应的 id
- confidence 取值 0.0-1.0，反映你的确信程度
- reasoning 用中文简要说明分类理由（30字以内）
- 严格返回 JSON 格式，不要附加其他文字`;

// ============================================================================
// 响应解析
// ============================================================================

/**
 * 解析 LLM 返回的 JSON
 *
 * 容错处理：
 * - 提取 JSON 代码块
 * - 校验必需字段
 * - 验证 folderId 合法性
 */
function parseLlmResponse(
  content: string,
  candidates: FolderContext[],
): LlmClassifyOutput | null {
  try {
    // 尝试提取 JSON（可能被 markdown 代码块包裹）
    const jsonStr = extractJson(content);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr);

    // 校验必需字段
    if (typeof parsed.folderId !== "number") return null;
    if (typeof parsed.confidence !== "number") return null;

    // 验证 folderId 在候选中
    const validIds = new Set(candidates.map((c) => c.id));
    if (!validIds.has(parsed.folderId)) return null;

    return {
      folderId: parsed.folderId,
      confidence: parsed.confidence,
      reasoning:
        typeof parsed.reasoning === "string"
          ? parsed.reasoning
          : "LLM 未提供理由",
    };
  } catch {
    return null;
  }
}

/** 从 LLM 输出中提取 JSON 字符串 */
function extractJson(text: string): string | null {
  // 优先匹配 ```json ... ``` 代码块
  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlock?.[1]) return codeBlock[1].trim();

  // 尝试匹配裸 JSON 对象
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch?.[0] ?? null;
}
