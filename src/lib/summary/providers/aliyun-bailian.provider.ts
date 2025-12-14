/**
 * Aliyun Bailian (DashScope) Provider
 *
 * 阿里百炼云 API 的 Provider 实现
 * 使用 OpenAI 兼容接口
 * 继承 BaseProvider，仅实现差异化部分
 *
 * @see https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
 *
 * @version 2.1.0
 * @since 2025-12-14
 */

import { logger } from "@/lib/logger";
import { BaseProvider } from "./base.provider";
import type { ProviderConfig } from "../summary.types";
import {
  ALIYUN_BAILIAN_DEFAULT_CONFIG,
  ALIYUN_MODELS,
} from "../summary.config";

/**
 * 阿里百炼云支持的模型
 */
export { ALIYUN_MODELS };

/**
 * 阿里百炼云 Provider 实现
 *
 * 作为备选 Provider，优先级为 2
 *
 * 与 BaseProvider 的差异：
 * - API Key 环境变量: DASHSCOPE_API_KEY
 * - 定价模型不同（支持多种模型）
 * - 支持运行时切换模型
 */
export class AliyunBailianProvider extends BaseProvider {
  readonly name = "aliyun-bailian" as const;
  readonly priority = 2; // 备选优先级

  constructor(config?: Partial<ProviderConfig>) {
    super({
      ...ALIYUN_BAILIAN_DEFAULT_CONFIG,
      ...config,
      apiKey: config?.apiKey || process.env.DASHSCOPE_API_KEY || "",
    });
  }

  /**
   * 获取 API Key 环境变量名
   */
  protected getApiKeyEnvName(): string {
    return "DASHSCOPE_API_KEY";
  }

  /**
   * 估算成本
   *
   * 阿里百炼云定价（按模型）：
   * - qwen-turbo: ¥0.0003/1K input, ¥0.0006/1K output
   * - qwen-plus: ¥0.0008/1K input, ¥0.002/1K output
   * - qwen-max: ¥0.002/1K input, ¥0.006/1K output
   * - qwen-long: ¥0.0005/1K input, ¥0.002/1K output
   */
  estimateCost(tokenCount: number): number {
    const model = this.config.model;
    let inputRate = 0.3; // 默认 qwen-turbo (分/1K tokens)
    let outputRate = 0.6;

    switch (model) {
      case ALIYUN_MODELS.QWEN_TURBO:
        inputRate = 0.3;
        outputRate = 0.6;
        break;
      case ALIYUN_MODELS.QWEN_PLUS:
        inputRate = 0.8;
        outputRate = 2;
        break;
      case ALIYUN_MODELS.QWEN_MAX:
        inputRate = 2;
        outputRate = 6;
        break;
      case ALIYUN_MODELS.QWEN_LONG:
        inputRate = 0.5;
        outputRate = 2;
        break;
    }

    // 假设 input:output = 3:1
    const inputTokens = tokenCount * 0.75;
    const outputTokens = tokenCount * 0.25;
    return Math.ceil(
      (inputTokens / 1000) * inputRate + (outputTokens / 1000) * outputRate,
    );
  }

  /**
   * 切换模型
   *
   * 运行时切换使用的模型
   */
  switchModel(
    model:
      | typeof ALIYUN_MODELS.QWEN_TURBO
      | typeof ALIYUN_MODELS.QWEN_PLUS
      | typeof ALIYUN_MODELS.QWEN_MAX
      | typeof ALIYUN_MODELS.QWEN_LONG,
  ): void {
    this.config.model = model;
    logger.info(
      { provider: this.name, model },
      "AliyunBailianProvider: Model switched",
    );
  }
}
