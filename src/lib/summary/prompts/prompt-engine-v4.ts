/**
 * V4 Prompt 引擎
 *
 * 组装完整的 Prompt：System + CoT + FewShot + Content + Constraints + Schema
 *
 * 动态选择策略：
 * - 内容 < 500 字：禁用 CoT 和 FewShot
 * - 内容 500-6000 字：启用全部
 * - MapReduce Map 阶段：使用专用 Map Prompt
 * - MapReduce Reduce 阶段：启用 CoT + FewShot
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import type { PromptBuildResult } from "../providers/provider.interface";
import type { SummaryInput } from "../summary.types";
import { getContentTypeConfig } from "./content-type-configs";
import { getCotTemplate } from "./cot-templates";
import { getFewShotExamples } from "./few-shot-examples";
import { NEGATIVE_CONSTRAINTS } from "./negative-constraints";
import {
  isCotEnabled,
  isFewShotEnabled,
  isNegativeConstraintsEnabled,
} from "@/lib/summary/config/ai-summary-config";

// ============================================================================
// 常量
// ============================================================================

/** 启用 CoT 的最小内容长度 */
const COT_MIN_CONTENT_LENGTH = 500;

/** 启用 FewShot 的最小内容长度 */
const FEW_SHOT_MIN_CONTENT_LENGTH = 500;

/** JSON Schema 输出模板 */
const JSON_OUTPUT_SCHEMA = `请严格输出以下 JSON 格式（不要任何额外文字或代码块标记）：
{
  "tldr": "核心摘要（不超过150字），概括核心观点及其价值",
  "key_points": [
    "关键要点1",
    "关键要点2",
    "关键要点3"
  ],
  "keywords": ["标签1", "标签2", "标签3", "标签4", "标签5"],
  "sentiment": "positive|neutral|negative",
  "reading_time": 5,
  "action_items": []
}`;

// ============================================================================
// V4 引擎主类
// ============================================================================

/**
 * V4 Prompt 引擎
 *
 * 按内容类型和上下文动态组装最优 Prompt。
 */
export class PromptEngineV4 {
  /**
   * 构建完整的 V4 Prompt
   *
   * @param input - 摘要输入
   * @param maxTokens - 最大输出 Token 数
   * @returns Prompt 构建结果
   */
  static buildPrompts(
    input: SummaryInput,
    maxTokens: number,
  ): PromptBuildResult {
    const contentType = input.contentType || "article";
    const contentLength = input.content?.length || 0;
    const config = getContentTypeConfig(contentType);

    // 1. System Prompt：角色定义
    const systemPrompt = this.buildSystemPrompt(
      config.systemRole,
      contentType,
      contentLength,
    );

    // 2. User Prompt：CoT + FewShot + Content + Schema + Constraints
    const userPrompt = this.buildUserPrompt(
      input,
      contentType,
      contentLength,
      config.structureGuide,
    );

    return {
      systemPrompt,
      userPrompt,
      temperature: config.temperature,
      maxTokens,
    };
  }

  /**
   * 构建 System Prompt
   */
  private static buildSystemPrompt(
    systemRole: string,
    contentType: string,
    contentLength: number,
  ): string {
    const parts: string[] = [systemRole];

    // 短内容追加简洁指令
    if (contentLength < COT_MIN_CONTENT_LENGTH) {
      parts.push("内容较短，请直接提炼核心信息，输出简洁摘要。");
    }

    // 负面约束嵌入 System Prompt
    if (isNegativeConstraintsEnabled()) {
      parts.push("");
      parts.push(NEGATIVE_CONSTRAINTS);
    }

    parts.push("");
    parts.push("必须输出严格的 JSON 格式，不要任何额外文字或代码块标记。");

    return parts.join("\n");
  }

  /**
   * 构建 User Prompt
   */
  private static buildUserPrompt(
    input: SummaryInput,
    contentType: string,
    contentLength: number,
    structureGuide: string,
  ): string {
    const parts: string[] = [];

    // CoT 引导（内容 >= 500 字时启用）
    if (isCotEnabled() && contentLength >= COT_MIN_CONTENT_LENGTH) {
      parts.push(getCotTemplate(contentType));
      parts.push("");
    }

    // Few-shot 示例（内容 >= 500 字时启用）
    if (isFewShotEnabled() && contentLength >= FEW_SHOT_MIN_CONTENT_LENGTH) {
      const examples = getFewShotExamples(contentType);
      if (examples) {
        parts.push(examples);
        parts.push("");
      }
    }

    // 内容信息
    parts.push(`【标题】${input.title}`);

    if (input.description) {
      parts.push(`【描述】${input.description}`);
    }

    if (input.content) {
      parts.push(`【正文内容】\n${input.content}`);
    }

    parts.push("");

    // 结构引导
    parts.push("【摘要结构要求】");
    parts.push(structureGuide);
    parts.push("");

    // JSON Schema
    parts.push(JSON_OUTPUT_SCHEMA);

    return parts.join("\n");
  }
}
