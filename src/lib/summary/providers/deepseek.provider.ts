/**
 * DeepSeek Provider
 *
 * DeepSeek API 的 Provider 实现
 * 继承 BaseProvider，仅实现差异化部分
 *
 * @version 2.1.0
 * @since 2025-12-14
 */

import { BaseProvider } from "./base.provider";
import type { ProviderConfig } from "../summary.types";
import { DEEPSEEK_DEFAULT_CONFIG } from "../summary.config";

/**
 * DeepSeek Provider 实现
 *
 * 作为主力 Provider，优先级最高
 *
 * 与 BaseProvider 的差异：
 * - API Key 环境变量: DEEPSEEK_API_KEY
 * - 定价模型不同
 */
export class DeepSeekProvider extends BaseProvider {
  readonly name = "deepseek" as const;
  readonly priority = 1; // 最高优先级

  constructor(config?: Partial<ProviderConfig>) {
    super({
      ...DEEPSEEK_DEFAULT_CONFIG,
      ...config,
      apiKey: config?.apiKey || process.env.DEEPSEEK_API_KEY || "",
    });
  }

  /**
   * 获取 API Key 环境变量名
   */
  protected getApiKeyEnvName(): string {
    return "DEEPSEEK_API_KEY";
  }

  /**
   * 估算成本
   *
   * DeepSeek 定价：约 ¥0.001/1K tokens (input) + ¥0.002/1K tokens (output)
   * 假设 input:output = 3:1
   */
  estimateCost(tokenCount: number): number {
    const inputTokens = tokenCount * 0.75;
    const outputTokens = tokenCount * 0.25;
    return Math.ceil((inputTokens / 1000) * 0.1 + (outputTokens / 1000) * 0.2);
  }
}
