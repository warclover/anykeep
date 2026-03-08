/**
 * Chat-to-Edit Engine - 聊天式编辑引擎
 * @module knowledge-studio/chat-edit
 * @description 段落级聊天编辑，支持滑动窗口上下文管理
 */

import { generateText } from "ai";
import * as Diff from "diff";
import { createLogger } from "@/lib/logger";
import { aiProviderRouter } from "@/lib/ai-providers";
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
import { DEFAULT_SLIDING_WINDOW_CONFIG } from "./types";
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
      const prompt = buildEditPrompt(request.intent, request.context);

      // 3. 调用 AI 模型
      const newContent = await this.callAIModel(prompt);

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
   * 调用 AI 模型生成编辑内容
   */
  private async callAIModel(prompt: {
    system: string;
    user: string;
  }): Promise<string> {
    // 获取模型配置
    const selection = aiProviderRouter.selectProvider({
      taskType: "chat",
      preferredProvider: "deepseek",
    });

    if (!selection) {
      throw new Error("没有可用的 AI 服务");
    }

    logger.debug(
      {
        provider: selection.provider.name,
        model: selection.provider.defaultModel,
      },
      "Using AI model for edit",
    );

    const result = await generateText({
      model: selection.model,
      system: prompt.system,
      prompt: prompt.user,
      maxOutputTokens: 2048, // 编辑任务通常不需要太长输出
      temperature: 0.7,
    });

    const text = result.text.trim();

    if (!text) {
      throw new Error("AI 返回空内容");
    }

    return text;
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
      // TODO(@backlog): 使用 AI 生成摘要
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
   *
   * 使用 Myers diff 算法（基于最长公共子序列），
   * 与 git diff 相同的算法，提供更精确的变更检测。
   */
  generateDiff(before: string, after: string): EditDiff {
    const changes: DiffChange[] = [];
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    // 使用 diff 库的行级 diff（Myers 算法）
    const diffResult = Diff.diffLines(before, after);
    let lineNumber = 1;

    for (const part of diffResult) {
      // 分割成单独的行来处理
      const lines = part.value.split("\n");
      // 移除最后一个空元素（如果存在）
      if (lines[lines.length - 1] === "") {
        lines.pop();
      }

      for (const line of lines) {
        if (part.added) {
          changes.push({
            type: "add",
            value: line,
            lineNumber,
          });
          added++;
        } else if (part.removed) {
          changes.push({
            type: "remove",
            value: line,
            lineNumber,
          });
          removed++;
        } else {
          changes.push({
            type: "unchanged",
            value: line,
            lineNumber,
          });
          unchanged++;
        }
        lineNumber++;
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
   * 生成对话摘要（使用 AI）
   */
  private async generateTurnsSummaryWithAI(turns: ChatTurn[]): Promise<string> {
    if (turns.length === 0) {
      return "";
    }

    try {
      // 获取模型配置（摘要生成任务）
      const selection = aiProviderRouter.selectProvider({
        taskType: "summary",
        preferredProvider: "deepseek",
      });

      if (!selection) {
        throw new Error("没有可用的 AI 服务");
      }

      const turnsText = turns
        .map(
          (t) =>
            `${t.role === "user" ? "用户" : "助手"}: ${t.content.slice(0, 200)}${t.content.length > 200 ? "..." : ""}`,
        )
        .join("\n");

      const result = await generateText({
        model: selection.model,
        system:
          "你是一位助手，负责将对话历史压缩成简洁的摘要。保留关键编辑意图和决策，去除冗余信息。输出控制在 100 字以内。",
        prompt: `请将以下编辑对话历史压缩成摘要：\n\n${turnsText}`,
        maxOutputTokens: 200,
        temperature: 0.3,
      });

      return result.text.trim();
    } catch (error) {
      // AI 失败时回退到简单截取
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "AI summary generation failed, using fallback",
      );
      return this.generateTurnsSummaryFallback(turns);
    }
  }

  /**
   * 生成对话摘要（简单回退方案）
   */
  private generateTurnsSummaryFallback(turns: ChatTurn[]): string {
    return turns
      .map((t) => `${t.role}: ${t.content.slice(0, 50)}...`)
      .join("\n")
      .slice(0, this.config.maxSummaryTokens * 2);
  }

  /**
   * 同步生成对话摘要（用于 buildContext）
   * 注意：这是同步方法，使用简单截取。如需 AI 摘要，请使用 generateTurnsSummaryWithAI
   */
  private generateTurnsSummary(turns: ChatTurn[]): string {
    return this.generateTurnsSummaryFallback(turns);
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
