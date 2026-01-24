/**
 * 智能分类 v5.0 - 文件夹建议器
 *
 * 检测文件夹健康状态，发现过度分散、过度集中等问题
 */

import type { LoggerService } from "../shared/logger";
import type {
  FolderSuggestion,
  FolderIssue,
  FolderHealthStatus,
  GardenerConfig,
} from "./types";

/**
 * 文件夹统计数据
 */
export interface FolderStats {
  /** 文件夹 ID */
  folderId: number;
  /** 文件夹名称 */
  folderName: string;
  /** 书签数量 */
  bookmarkCount: number;
  /** 最后使用时间 */
  lastUsedAt: Date;
  /** 平均分类置信度 */
  averageConfidence: number;
  /** 用户纠正次数 */
  userCorrectionCount: number;
}

/**
 * 用户整体统计
 */
export interface UserStats {
  /** 总文件夹数 */
  totalFolders: number;
  /** 总书签数 */
  totalBookmarks: number;
  /** 平均每个文件夹的书签数 */
  averageBookmarksPerFolder: number;
}

/**
 * 文件夹建议器
 */
export class FolderSuggester {
  private logger: LoggerService;
  private config: GardenerConfig;

  constructor(logger: LoggerService, config: GardenerConfig) {
    this.logger = logger.child({ service: "FolderSuggester" });
    this.config = config;
  }

  /**
   * 分析文件夹并生成建议
   */
  analyze(folderStats: FolderStats, userStats: UserStats): FolderSuggestion {
    this.logger.debug("分析文件夹", {
      folderId: folderStats.folderId,
      folderName: folderStats.folderName,
      bookmarkCount: folderStats.bookmarkCount,
    });

    const issues: FolderIssue[] = [];

    // 检测过度集中
    const concentrationIssue = this.checkOverConcentration(
      folderStats,
      userStats,
    );
    if (concentrationIssue) {
      issues.push(concentrationIssue);
    }

    // 检测低使用率
    const lowUsageIssue = this.checkLowUsage(folderStats);
    if (lowUsageIssue) {
      issues.push(lowUsageIssue);
    }

    // 检测命名不一致
    const namingIssue = this.checkNamingInconsistency(folderStats);
    if (namingIssue) {
      issues.push(namingIssue);
    }

    // 检测低置信度
    const confidenceIssue = this.checkLowConfidence(folderStats);
    if (confidenceIssue) {
      issues.push(confidenceIssue);
    }

    // 检测高纠正率
    const correctionIssue = this.checkHighCorrectionRate(folderStats);
    if (correctionIssue) {
      issues.push(correctionIssue);
    }

    // 计算健康状态和优先级
    const healthStatus = this.calculateHealthStatus(issues);
    const priority = this.calculatePriority(issues);

    return {
      folderId: folderStats.folderId,
      folderName: folderStats.folderName,
      healthStatus,
      issues,
      priority,
    };
  }

  /**
   * 批量分析文件夹
   */
  analyzeBatch(
    folderStatsList: FolderStats[],
    userStats: UserStats,
  ): FolderSuggestion[] {
    this.logger.info("批量分析文件夹", {
      count: folderStatsList.length,
    });

    const suggestions = folderStatsList.map((stats) =>
      this.analyze(stats, userStats),
    );

    // 检测过度分散（需要全局视角）
    const dispersedIssue = this.checkOverDispersion(userStats);
    if (dispersedIssue) {
      // 为所有文件夹添加过度分散警告
      suggestions.forEach((suggestion) => {
        if (suggestion.issues.length === 0) {
          suggestion.issues.push(dispersedIssue);
          suggestion.healthStatus = "warning";
          suggestion.priority = Math.max(suggestion.priority, 0.5);
        }
      });
    }

    // 按优先级排序
    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 检测过度集中
   */
  private checkOverConcentration(
    folderStats: FolderStats,
    userStats: UserStats,
  ): FolderIssue | null {
    if (userStats.totalBookmarks === 0) return null;

    const concentration = folderStats.bookmarkCount / userStats.totalBookmarks;

    if (concentration > this.config.overConcentratedThreshold) {
      return {
        type: "over_concentrated",
        severity: Math.min(
          1,
          concentration / this.config.overConcentratedThreshold,
        ),
        description: `该文件夹包含 ${(concentration * 100).toFixed(1)}% 的书签，可能过度集中`,
        suggestedAction: "考虑将书签细分到子文件夹，或创建更具体的分类",
      };
    }

    return null;
  }

  /**
   * 检测过度分散
   */
  private checkOverDispersion(userStats: UserStats): FolderIssue | null {
    if (userStats.totalBookmarks === 0 || userStats.totalFolders === 0)
      return null;

    const dispersion = userStats.totalFolders / userStats.totalBookmarks;

    if (dispersion > this.config.overDispersedThreshold) {
      return {
        type: "over_dispersed",
        severity: Math.min(1, dispersion / this.config.overDispersedThreshold),
        description: `文件夹数量过多（${userStats.totalFolders} 个文件夹 / ${userStats.totalBookmarks} 个书签），可能过度分散`,
        suggestedAction: "考虑合并相似的文件夹，或删除空文件夹",
      };
    }

    return null;
  }

  /**
   * 检测低使用率
   */
  private checkLowUsage(folderStats: FolderStats): FolderIssue | null {
    const daysSinceLastUse = Math.floor(
      (Date.now() - folderStats.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceLastUse > this.config.lowUsageDays) {
      return {
        type: "low_usage",
        severity: Math.min(
          1,
          daysSinceLastUse / (this.config.lowUsageDays * 2),
        ),
        description: `该文件夹已 ${daysSinceLastUse} 天未使用`,
        suggestedAction: "考虑归档或删除该文件夹",
      };
    }

    return null;
  }

  /**
   * 检测命名不一致
   */
  private checkNamingInconsistency(
    folderStats: FolderStats,
  ): FolderIssue | null {
    const name = folderStats.folderName;

    // 检测常见命名问题
    const hasSpecialChars = /[^\w\s\u4e00-\u9fa5-]/.test(name);
    const hasMultipleSpaces = /\s{2,}/.test(name);
    const startsWithSpace = /^\s/.test(name);
    const endsWithSpace = /\s$/.test(name);

    if (
      hasSpecialChars ||
      hasMultipleSpaces ||
      startsWithSpace ||
      endsWithSpace
    ) {
      return {
        type: "naming_inconsistent",
        severity: 0.3,
        description: "文件夹名称包含特殊字符或格式不规范",
        suggestedAction: "建议使用规范的命名格式",
      };
    }

    return null;
  }

  /**
   * 检测低置信度
   */
  private checkLowConfidence(folderStats: FolderStats): FolderIssue | null {
    if (folderStats.averageConfidence < 0.7) {
      return {
        type: "duplicate_content",
        severity: 1 - folderStats.averageConfidence,
        description: `平均分类置信度较低（${(folderStats.averageConfidence * 100).toFixed(1)}%）`,
        suggestedAction: "该文件夹的定位可能不够清晰，考虑重新定义或合并",
      };
    }

    return null;
  }

  /**
   * 检测高纠正率
   */
  private checkHighCorrectionRate(
    folderStats: FolderStats,
  ): FolderIssue | null {
    if (folderStats.bookmarkCount === 0) return null;

    const correctionRate =
      folderStats.userCorrectionCount / folderStats.bookmarkCount;

    if (correctionRate > 0.2) {
      return {
        type: "duplicate_content",
        severity: Math.min(1, correctionRate / 0.3),
        description: `用户纠正率较高（${(correctionRate * 100).toFixed(1)}%）`,
        suggestedAction: "该文件夹的分类规则可能需要调整",
      };
    }

    return null;
  }

  /**
   * 计算健康状态
   */
  private calculateHealthStatus(issues: FolderIssue[]): FolderHealthStatus {
    if (issues.length === 0) return "healthy";

    const maxSeverity = Math.max(...issues.map((issue) => issue.severity));

    if (maxSeverity >= 0.7) return "critical";
    if (maxSeverity >= 0.4) return "warning";
    return "healthy";
  }

  /**
   * 计算优先级
   */
  private calculatePriority(issues: FolderIssue[]): number {
    if (issues.length === 0) return 0;

    // 优先级 = 平均严重程度 × 问题数量权重
    const averageSeverity =
      issues.reduce((sum, issue) => sum + issue.severity, 0) / issues.length;
    const countWeight = Math.min(1, issues.length / 3);

    return averageSeverity * 0.7 + countWeight * 0.3;
  }
}
