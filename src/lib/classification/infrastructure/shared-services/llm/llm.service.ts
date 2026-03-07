/**
 * 智能分类 v5.0 - LLM Service
 *
 * 使用 DeepSeek deepseek-chat 模型进行智能分类
 */

import OpenAI from "openai";
import { aiEnv } from "@/lib/env";
import type { LoggerService } from "../logger";
import type {
  LLMConfig,
  LLMClassificationRequest,
  LLMClassificationResponse,
} from "./types";
import { LLMError } from "./types";

/**
 * LLM Service 类
 */
export class LLMService {
  private client: OpenAI;
  private config: LLMConfig;
  private logger: LoggerService;

  constructor(logger: LoggerService, config?: Partial<LLMConfig>) {
    this.logger = logger.child({ service: "LLMService" });

    this.config = {
      apiKey:
        config?.apiKey ?? (aiEnv.hasDeepseekApiKey ? aiEnv.deepseekApiKey : ""),
      model: config?.model ?? "deepseek-chat",
      baseURL: config?.baseURL ?? "https://api.deepseek.com",
      temperature: config?.temperature ?? 0.1,
      maxRetries: config?.maxRetries ?? 3,
      timeout: config?.timeout ?? 30000,
    };

    if (!this.config.apiKey) {
      throw new LLMError("DeepSeek API Key is required");
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
    });
  }

  /**
   * 通用文本生成（用于规则提取等非分类任务）
   */
  async complete(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<string> {
    this.logger.debug("开始 LLM 文本生成", {
      promptLength: prompt.length,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    return await this.executeWithRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: options?.temperature ?? this.config.temperature,
        max_tokens: options?.maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new LLMError("Empty response from LLM");
      }

      this.logger.debug("LLM 文本生成完成", {
        responseLength: content.length,
      });

      return content;
    });
  }

  /**
   * 执行智能分类
   */
  async classify(
    request: LLMClassificationRequest,
  ): Promise<LLMClassificationResponse> {
    this.logger.debug("开始 LLM 分类", {
      title: request.title,
      candidatesCount: request.candidates.length,
    });

    const prompt = this.buildPrompt(request);

    return await this.executeWithRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: this.config.temperature,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new LLMError("Empty response from LLM");
      }

      const result = this.parseResponse(content, request.candidates);

      this.logger.debug("LLM 分类完成", {
        folderId: result.folderId,
        confidence: result.confidence,
        tokens: result.tokens.total,
      });

      return result;
    });
  }

  /**
   * 构建分类 Prompt
   * v6: 添加示例书签和关键词，提升 LLM 理解能力
   */
  private buildPrompt(request: LLMClassificationRequest): string {
    // v6: 构建候选文件夹信息（包含示例书签）
    const candidatesText = request.candidates
      .map((c, i) => {
        let info = `${i + 1}. [ID: ${c.id}] **${c.name}**`;

        // 添加匹配分数
        if (c.score !== undefined) {
          info += ` (匹配度: ${(c.score * 100).toFixed(0)}%)`;
        }

        // 添加描述
        if (c.description) {
          info += `\n   描述: ${c.description}`;
        }

        // v6: 添加示例书签（帮助 LLM 理解文件夹内容）
        if (c.sampleBookmarks && c.sampleBookmarks.length > 0) {
          const samples = c.sampleBookmarks
            .slice(0, 3)
            .map((s) => `「${s}」`)
            .join("、");
          info += `\n   已有内容: ${samples}`;
        }

        // v6: 添加关键词标签
        if (c.keywordTags && c.keywordTags.length > 0) {
          info += `\n   关键词: ${c.keywordTags.join(", ")}`;
        }

        return info;
      })
      .join("\n\n");

    return `你是一个智能书签分类助手。请分析以下书签，并从候选文件夹中选择最合适的一个。

**书签信息**:
- 标题: ${request.title}
- 描述: ${request.description || "无"}
- URL: ${request.url}
- 摘要: ${request.summary || "无"}${request.tags && request.tags.length > 0 ? `\n- 标签: ${request.tags.join(", ")}` : ""}

**候选文件夹** (按推荐度排序):
${candidatesText}

**分类规则**:
1. 优先选择与书签主题**最相关**的文件夹
2. 参考文件夹的"已有内容"判断是否匹配
3. 如果书签明确提到某个技术/领域，优先选择对应文件夹
4. 如果不确定，选择最通用的文件夹

**输出 JSON 格式**:
{
  "folderId": 选择的文件夹ID（数字）,
  "confidence": 0.95,
  "reasoning": "选择理由（30字以内）"
}`;
  }

  /**
   * 解析 LLM 响应
   */
  private parseResponse(
    content: string,
    candidates: LLMClassificationRequest["candidates"],
  ): LLMClassificationResponse {
    try {
      // 提取 JSON 内容（可能被包裹在 markdown 代码块中）
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 验证必需字段
      if (typeof parsed.folderId !== "number") {
        throw new Error("Invalid folderId");
      }
      if (typeof parsed.confidence !== "number") {
        throw new Error("Invalid confidence");
      }
      if (typeof parsed.reasoning !== "string") {
        throw new Error("Invalid reasoning");
      }

      // 验证 folderId 是否在候选列表中
      const validFolder = candidates.find(
        (c) => String(c.id) === String(parsed.folderId),
      );
      if (!validFolder) {
        throw new Error(`Invalid folderId: ${parsed.folderId}`);
      }

      // 限制置信度范围
      const confidence = Math.max(0, Math.min(1, parsed.confidence));

      return {
        folderId: parsed.folderId,
        confidence,
        reasoning: parsed.reasoning,
        tokens: {
          prompt: 0, // 实际值需要从 response.usage 获取
          completion: 0,
          total: 0,
        },
      };
    } catch (error) {
      this.logger.error("解析 LLM 响应失败", error as Error, {
        content: content.slice(0, 200),
      });
      throw new LLMError(
        `Failed to parse LLM response: ${(error as Error).message}`,
        error as Error,
      );
    }
  }

  /**
   * 执行带重试的操作
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    attempt: number = 0,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      const canRetry = attempt < this.config.maxRetries && isRetryable;

      if (!canRetry) {
        this.logger.error("LLM 调用失败", error as Error, {
          attempt,
          retryable: isRetryable,
        });
        throw new LLMError(
          `Failed to call LLM: ${(error as Error).message}`,
          error as Error,
          isRetryable,
        );
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      this.logger.warn("LLM 调用失败，准备重试", {
        attempt: attempt + 1,
        maxRetries: this.config.maxRetries,
        delay,
      });

      await this.sleep(delay);
      return this.executeWithRetry(operation, attempt + 1);
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();

    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("rate limit") ||
      message.includes("429") ||
      message.includes("502") ||
      message.includes("503")
    );
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
