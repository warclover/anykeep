/**
 * 智能分类 v5.0 - 命名引擎
 *
 * 生成规范化的文件夹名称建议
 */

import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type { FolderId } from "@/lib/shared/types";
import type { NamingSuggestion } from "./types";

/**
 * 命名规则
 */
interface NamingRule {
  /** 规则名称 */
  name: string;
  /** 检测函数 */
  detect: (name: string) => boolean;
  /** 修复函数 */
  fix: (name: string) => string;
  /** 置信度 */
  confidence: number;
}

/**
 * 命名引擎
 */
export class NamingEngine {
  private logger: LoggerService;
  private rules: NamingRule[];

  constructor(logger: LoggerService) {
    this.logger = logger.child({ service: "NamingEngine" });
    this.rules = this.initializeRules();
  }

  /**
   * 初始化命名规则
   */
  private initializeRules(): NamingRule[] {
    return [
      // 规则 1: 移除前后空格
      {
        name: "trim_spaces",
        detect: (name) => name !== name.trim(),
        fix: (name) => name.trim(),
        confidence: 1.0,
      },
      // 规则 2: 合并多个空格
      {
        name: "merge_spaces",
        detect: (name) => /\s{2,}/.test(name),
        fix: (name) => name.replace(/\s{2,}/g, " "),
        confidence: 1.0,
      },
      // 规则 3: 移除特殊字符（保留中文、英文、数字、空格、连字符）
      {
        name: "remove_special_chars",
        detect: (name) => /[^\w\s\u4e00-\u9fa5-]/.test(name),
        fix: (name) => name.replace(/[^\w\s\u4e00-\u9fa5-]/g, ""),
        confidence: 0.8,
      },
      // 规则 4: 首字母大写（仅英文）
      {
        name: "capitalize_first_letter",
        detect: (name) => {
          const firstChar = name.charAt(0);
          return /[a-z]/.test(firstChar);
        },
        fix: (name) => name.charAt(0).toUpperCase() + name.slice(1),
        confidence: 0.7,
      },
      // 规则 5: 统一连字符（将下划线替换为连字符）
      {
        name: "normalize_separators",
        detect: (name) => name.includes("_"),
        fix: (name) => name.replace(/_/g, "-"),
        confidence: 0.6,
      },
      // 规则 6: 移除冗余词汇（如 "文件夹"、"Folder"）
      {
        name: "remove_redundant_words",
        detect: (name) => /文件夹|folder|目录|directory/i.test(name),
        fix: (name) =>
          name
            .replace(/文件夹/g, "")
            .replace(/folder/gi, "")
            .replace(/目录/g, "")
            .replace(/directory/gi, "")
            .trim(),
        confidence: 0.9,
      },
      // 规则 7: 统一缩写（常见技术术语）
      {
        name: "normalize_abbreviations",
        detect: (name) => {
          const lowerName = name.toLowerCase();
          return (
            lowerName.includes("javascript") ||
            lowerName.includes("typescript") ||
            lowerName.includes("python")
          );
        },
        fix: (name) => {
          let fixed = name;
          fixed = fixed.replace(/javascript/gi, "JavaScript");
          fixed = fixed.replace(/typescript/gi, "TypeScript");
          fixed = fixed.replace(/python/gi, "Python");
          return fixed;
        },
        confidence: 0.8,
      },
    ];
  }

  /**
   * 生成命名建议
   */
  suggest(folderId: FolderId, currentName: string): NamingSuggestion | null {
    this.logger.debug("生成命名建议", {
      folderId,
      currentName,
    });

    // 应用所有匹配的规则
    let suggestedName = currentName;
    const appliedRules: NamingRule[] = [];

    for (const rule of this.rules) {
      if (rule.detect(suggestedName)) {
        suggestedName = rule.fix(suggestedName);
        appliedRules.push(rule);
        this.logger.debug("应用命名规则", {
          ruleName: rule.name,
          before: currentName,
          after: suggestedName,
        });
      }
    }

    // 如果没有变化，返回 null
    if (suggestedName === currentName) {
      return null;
    }

    // 计算置信度（应用规则的平均置信度）
    const confidence =
      appliedRules.reduce((sum, rule) => sum + rule.confidence, 0) /
      appliedRules.length;

    // 生成原因说明
    const reason = this.generateReason(appliedRules);

    this.logger.info("生成命名建议", {
      folderId,
      currentName,
      suggestedName,
      confidence,
      appliedRules: appliedRules.map((r) => r.name),
    });

    return {
      folderId,
      currentName,
      suggestedName,
      reason,
      confidence,
    };
  }

  /**
   * 批量生成命名建议
   */
  suggestBatch(
    folders: Array<{ folderId: number; folderName: string }>,
  ): NamingSuggestion[] {
    this.logger.info("批量生成命名建议", {
      count: folders.length,
    });

    const suggestions: NamingSuggestion[] = [];

    for (const folder of folders) {
      const suggestion = this.suggest(folder.folderId, folder.folderName);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    this.logger.info("批量命名建议完成", {
      total: folders.length,
      suggestions: suggestions.length,
    });

    return suggestions;
  }

  /**
   * 生成原因说明
   */
  private generateReason(appliedRules: NamingRule[]): string {
    const reasons: string[] = [];

    for (const rule of appliedRules) {
      switch (rule.name) {
        case "trim_spaces":
          reasons.push("移除前后空格");
          break;
        case "merge_spaces":
          reasons.push("合并多余空格");
          break;
        case "remove_special_chars":
          reasons.push("移除特殊字符");
          break;
        case "capitalize_first_letter":
          reasons.push("首字母大写");
          break;
        case "normalize_separators":
          reasons.push("统一分隔符");
          break;
        case "remove_redundant_words":
          reasons.push("移除冗余词汇");
          break;
        case "normalize_abbreviations":
          reasons.push("统一技术术语");
          break;
      }
    }

    return reasons.join("、");
  }

  /**
   * 验证文件夹名称
   */
  validate(name: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // 检查长度
    if (name.length === 0) {
      issues.push("名称不能为空");
    }
    if (name.length > 100) {
      issues.push("名称过长（超过100字符）");
    }

    // 检查前后空格
    if (name !== name.trim()) {
      issues.push("名称包含前后空格");
    }

    // 检查多余空格
    if (/\s{2,}/.test(name)) {
      issues.push("名称包含多余空格");
    }

    // 检查特殊字符
    if (/[^\w\s\u4e00-\u9fa5-]/.test(name)) {
      issues.push("名称包含特殊字符");
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
