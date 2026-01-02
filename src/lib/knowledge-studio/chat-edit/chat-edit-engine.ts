/**
 * Chat-to-Edit Engine - 聊天式编辑引擎
 * @module knowledge-studio/chat-edit
 * @description 段落级聊天编辑，支持滑动窗口上下文管理
 */

import { createLogger } from "@/lib/logger";
import type { RecoverableError } from "../types";
import { ERROR_CODES } from "../types";
import type {
  ParagraphInfo,
  ChatEditContext,
  ChatTurn,
  ChatEditRequest,
  EditDiff,
  DiffChange,
  ChatEditResponse,
  SlidingWindowConfig,
} from "./types";
import { DEFAULT_SLIDING_WINDOW_CONFIG, EDIT_MODE_CONFIG } from "./types";
import { buildEditPrompt } from "./prompt-builder";

const logger = createLogger("chat-edit-engine");

/**
 * ChatEditEngine - 聊天式编辑引擎
 *
 * 职责：
 * 1. 管理段落编辑上下文（滑动窗口）
 * 2. 构建编辑 Prompt
 * 3. 调用 AI 模型生成修改
 * 4. 生成差异对比
 * 5. 管理对话历史
 */
export class ChatEditEngine {
  private config: SlidingWindowConfig;

  constructor(config: Partial<SlidingWindowConfig> = {}) {
    this.config = { ...DEFAULT_SLIDING_WINDOW_CONFIG, ...config };
  }

  /**
   * 执行编辑（主入口）
   */
  async edit(request: ChatEditRequest): Promise<ChatEditResponse> {
    logger.info(
      {
        reportId: request.reportId,
        paragraphIndex: request.paragraphIndex,
        editMode: request.intent.mode,
      },
      "Starting paragraph edit",
    );

    try {
      // 1. 验证请求
      this.validateRequest(request);

      // 2. 构建编辑 Prompt
      const _prompt = buildEditPrompt(request.intent, request.context);

      // 3. 调用 AI 模型
      // TODO: 实际调用 AI 模型
      // const response = await this.callModel(prompt);

      // 临时模拟响应
      const newContent = await this.simulateEdit(request);

      // 4. 生成差异
      const diff = this.generateDiff(
        request.context.paragraph.content,
        newContent,
      );

      logger.info(
        {
          reportId: request.reportId,
          paragraphIndex: request.paragraphIndex,
          changesCount: diff.changes.filter((c) => c.type !== "unchanged")
            .length,
        },
        "Edit completed",
      );

      return {
        success: true,
        newContent,
        diff,
      };
    } catch (error) {
      logger.error(
        {
          reportId: request.reportId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Edit failed",
      );

      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  /**
   * 构建编辑上下文
   */
  buildContext(
    paragraphs: string[],
    targetIndex: number,
    existingTurns: ChatTurn[] = [],
  ): ChatEditContext {
    // 获取目标段落
    const content = paragraphs[targetIndex];
    const paragraph: ParagraphInfo = {
      index: targetIndex,
      content,
      wordCount: this.countWords(content),
      startOffset: paragraphs.slice(0, targetIndex).join("\n\n").length,
      endOffset: paragraphs.slice(0, targetIndex + 1).join("\n\n").length,
    };

    // 获取前后上下文
    const surroundingContext = {
      before: paragraphs
        .slice(
          Math.max(0, targetIndex - this.config.contextParagraphs),
          targetIndex,
        )
        .join("\n\n"),
      after: paragraphs
        .slice(targetIndex + 1, targetIndex + 1 + this.config.contextParagraphs)
        .join("\n\n"),
    };

    // 分割对话历史：最近 N 轮 + 摘要
    const recentTurns = existingTurns.slice(-this.config.maxRecentTurns);
    const olderTurns = existingTurns.slice(0, -this.config.maxRecentTurns);

    let olderTurnsSummary: string | undefined;
    if (olderTurns.length > 0) {
      // TODO: 使用 AI 生成摘要
      olderTurnsSummary = this.generateTurnsSummary(olderTurns);
    }

    return {
      paragraph,
      surroundingContext,
      recentTurns,
      olderTurnsSummary,
      reportContext: {
        blueprintType: "", // 由调用方填充
        totalParagraphs: paragraphs.length,
      },
    };
  }

  /**
   * 添加对话轮次
   */
  addTurn(
    existingTurns: ChatTurn[],
    role: "user" | "assistant",
    content: string,
    editResult?: { before: string; after: string },
  ): ChatTurn[] {
    const newTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date(),
      editResult,
    };

    return [...existingTurns, newTurn];
  }

  /**
   * 生成差异对比
   */
  generateDiff(before: string, after: string): EditDiff {
    const changes: DiffChange[] = [];
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    // 简单的按行差异对比
    // TODO: 使用更精细的 diff 算法
    const beforeLines = before.split("\n");
    const afterLines = after.split("\n");

    const maxLen = Math.max(beforeLines.length, afterLines.length);

    for (let i = 0; i < maxLen; i++) {
      const beforeLine = beforeLines[i];
      const afterLine = afterLines[i];

      if (beforeLine === afterLine) {
        if (beforeLine !== undefined) {
          changes.push({
            type: "unchanged",
            value: beforeLine,
            lineNumber: i + 1,
          });
          unchanged++;
        }
      } else {
        if (beforeLine !== undefined) {
          changes.push({
            type: "remove",
            value: beforeLine,
            lineNumber: i + 1,
          });
          removed++;
        }
        if (afterLine !== undefined) {
          changes.push({ type: "add", value: afterLine, lineNumber: i + 1 });
          added++;
        }
      }
    }

    return {
      before,
      after,
      changes,
      stats: { added, removed, unchanged },
    };
  }

  /**
   * 验证请求
   */
  private validateRequest(request: ChatEditRequest): void {
    if (!request.reportId) {
      throw new Error("Report ID is required");
    }

    if (request.paragraphIndex < 0) {
      throw new Error("Invalid paragraph index");
    }

    if (!request.intent.instruction) {
      throw new Error("Edit instruction is required");
    }
  }

  /**
   * 模拟编辑（临时实现）
   */
  private async simulateEdit(request: ChatEditRequest): Promise<string> {
    const { paragraph } = request.context;
    const { mode, instruction } = request.intent;

    const _modeConfig = EDIT_MODE_CONFIG[mode];

    // 模拟不同编辑模式的效果
    switch (mode) {
      case "expand":
        return `${paragraph.content}\n\n[扩展内容] 根据「${instruction}」添加的详细解释和示例。`;

      case "simplify":
        return (
          paragraph.content
            .split("。")
            .slice(0, Math.ceil(paragraph.content.split("。").length / 2))
            .join("。") + "。"
        );

      case "tone":
        return `[${request.intent.targetTone || "调整后"}语气] ${paragraph.content}`;

      case "rewrite":
      case "custom":
      default:
        return `[已按「${instruction}」修改] ${paragraph.content}`;
    }
  }

  /**
   * 生成对话摘要
   */
  private generateTurnsSummary(turns: ChatTurn[]): string {
    // 简单实现：截取关键信息
    // TODO: 使用 AI 生成真正的摘要
    return turns
      .map((t) => `${t.role}: ${t.content.slice(0, 50)}...`)
      .join("\n")
      .slice(0, this.config.maxSummaryTokens * 2); // 粗略估算 token
  }

  /**
   * 统计词数
   */
  private countWords(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  /**
   * 错误处理
   */
  private handleError(error: unknown): RecoverableError {
    if (error instanceof Error) {
      if (error.message.includes("paragraph")) {
        return {
          code: ERROR_CODES.PARAGRAPH_NOT_FOUND,
          message: "找不到目标段落",
          recoverable: false,
        };
      }
    }

    return {
      code: ERROR_CODES.EDIT_CONFLICT,
      message: error instanceof Error ? error.message : "编辑失败",
      recoverable: true,
      retryAfterMs: 1000,
    };
  }
}

// 导出单例
export const chatEditEngine = new ChatEditEngine();
