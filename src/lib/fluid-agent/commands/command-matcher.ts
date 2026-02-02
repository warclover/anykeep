import type { PresetCommand } from "../types";
import { presetCommands } from "./preset-commands";

interface MatchResult {
  command: PresetCommand;
  score: number;
  matchedKeyword: string;
}

class CommandMatcher {
  private readonly MIN_MATCH_SCORE = 0.5;

  /**
   * 根据输入文本匹配命令
   * @param input 用户输入
   * @param requiresSelection 是否需要有选中内容
   * @returns 匹配结果列表，按分数降序排列
   */
  match(input: string, requiresSelection?: boolean): MatchResult[] {
    if (!input || input.trim().length === 0) {
      return [];
    }

    const normalizedInput = input.toLowerCase().trim();
    const results: MatchResult[] = [];

    for (const command of presetCommands) {
      // 过滤需要选择的命令
      if (
        requiresSelection !== undefined &&
        command.requiresSelection !== requiresSelection
      ) {
        continue;
      }

      // 检查每个关键词
      for (const keyword of command.keywords) {
        const score = this.calculateScore(
          normalizedInput,
          keyword.toLowerCase(),
        );

        if (score >= this.MIN_MATCH_SCORE) {
          results.push({
            command,
            score,
            matchedKeyword: keyword,
          });
          break; // 每个命令只匹配一次
        }
      }
    }

    // 按分数降序排列
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 精确匹配命令
   */
  exactMatch(input: string): PresetCommand | null {
    const normalizedInput = input.toLowerCase().trim();

    for (const command of presetCommands) {
      for (const keyword of command.keywords) {
        if (keyword.toLowerCase() === normalizedInput) {
          return command;
        }
      }
    }

    return null;
  }

  /**
   * 获取建议（用于自动补全）
   */
  getSuggestions(input: string, limit: number = 5): PresetCommand[] {
    if (!input || input.trim().length === 0) {
      return presetCommands.slice(0, limit);
    }

    const matches = this.match(input);
    return matches.slice(0, limit).map((m) => m.command);
  }

  /**
   * 计算匹配分数
   * - 完全匹配: 1.0
   * - 前缀匹配: 0.8
   * - 包含匹配: 0.6
   * - 模糊匹配: 0.5
   */
  private calculateScore(input: string, keyword: string): number {
    // 完全匹配
    if (input === keyword) {
      return 1.0;
    }

    // 前缀匹配
    if (keyword.startsWith(input)) {
      return 0.8;
    }

    // 包含匹配
    if (keyword.includes(input)) {
      return 0.6;
    }

    // 输入包含关键词
    if (input.includes(keyword)) {
      return 0.6;
    }

    // 简单的编辑距离检查（容忍一个字符差异）
    if (this.isCloseMatch(input, keyword)) {
      return 0.5;
    }

    return 0;
  }

  /**
   * 检查是否为近似匹配（编辑距离 <= 1）
   */
  private isCloseMatch(a: string, b: string): boolean {
    if (Math.abs(a.length - b.length) > 1) {
      return false;
    }

    let differences = 0;
    const maxLen = Math.max(a.length, b.length);

    for (let i = 0; i < maxLen; i++) {
      if (a[i] !== b[i]) {
        differences++;
        if (differences > 1) {
          return false;
        }
      }
    }

    return differences <= 1;
  }
}

export const commandMatcher = new CommandMatcher();
