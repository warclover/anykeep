/**
 * 智能分类 v5.0 - Gardener 主服务
 *
 * 整合阈值自适应、文件夹建议、同义词检测、命名引擎
 */

import type { LoggerService } from "../shared/logger";
import type { IEmbeddingService } from "../shared/embedding";
import { ThresholdAdapter } from "./threshold-adapter";
import type { ClassificationStats } from "./threshold-adapter";
import { FolderSuggester } from "./folder-suggester";
import type { FolderStats, UserStats } from "./folder-suggester";
import { SynonymDetector } from "./synonym-detector";
import type { FolderInfo } from "./synonym-detector";
import { NamingEngine } from "./naming-engine";
import type {
  GardenerConfig,
  ThresholdAdjustment,
  FolderSuggestion,
  SynonymGroup,
  NamingSuggestion,
} from "./types";
import { GardenerError } from "./types";

/**
 * Gardener 分析报告
 */
export interface GardenerReport {
  /** 阈值调整建议 */
  thresholdAdjustment: ThresholdAdjustment | null;
  /** 文件夹建议列表 */
  folderSuggestions: FolderSuggestion[];
  /** 同义词组列表 */
  synonymGroups: SynonymGroup[];
  /** 命名建议列表 */
  namingSuggestions: NamingSuggestion[];
  /** 生成时间 */
  generatedAt: Date;
}

/**
 * Gardener 主服务
 */
export class GardenerService {
  private logger: LoggerService;
  private config: GardenerConfig;
  private thresholdAdapter: ThresholdAdapter;
  private folderSuggester: FolderSuggester;
  private synonymDetector: SynonymDetector;
  private namingEngine: NamingEngine;

  constructor(
    logger: LoggerService,
    embeddingService: IEmbeddingService,
    config?: Partial<GardenerConfig>,
  ) {
    this.logger = logger.child({ service: "Gardener" });

    // 默认配置
    this.config = {
      thresholds: {
        t0ConfidenceThreshold:
          config?.thresholds?.t0ConfidenceThreshold ?? 0.85,
        vectorConflictThreshold:
          config?.thresholds?.vectorConflictThreshold ?? 0.15,
        minThreshold: config?.thresholds?.minThreshold ?? 0.7,
        maxThreshold: config?.thresholds?.maxThreshold ?? 0.95,
      },
      synonymSimilarityThreshold: config?.synonymSimilarityThreshold ?? 0.85,
      overDispersedThreshold: config?.overDispersedThreshold ?? 0.5,
      overConcentratedThreshold: config?.overConcentratedThreshold ?? 0.4,
      lowUsageDays: config?.lowUsageDays ?? 90,
    };

    // 初始化组件
    this.thresholdAdapter = new ThresholdAdapter(
      logger,
      this.config.thresholds,
    );
    this.folderSuggester = new FolderSuggester(logger, this.config);
    this.synonymDetector = new SynonymDetector(
      logger,
      embeddingService,
      this.config,
    );
    this.namingEngine = new NamingEngine(logger);
  }

  /**
   * 生成完整的 Gardener 报告
   */
  async generateReport(
    classificationStats: ClassificationStats,
    folderStatsList: FolderStats[],
    userStats: UserStats,
  ): Promise<GardenerReport> {
    this.logger.info("开始生成 Gardener 报告", {
      totalClassifications: classificationStats.totalClassifications,
      folderCount: folderStatsList.length,
    });

    try {
      // 1. 阈值调整分析
      const thresholdAdjustment =
        this.thresholdAdapter.analyze(classificationStats);

      // 2. 文件夹健康分析
      const folderSuggestions = this.folderSuggester.analyzeBatch(
        folderStatsList,
        userStats,
      );

      // 3. 同义词检测
      const folderInfoList: FolderInfo[] = folderStatsList.map((stats) => ({
        folderId: stats.folderId,
        folderName: stats.folderName,
        bookmarkCount: stats.bookmarkCount,
      }));
      const synonymGroups = await this.synonymDetector.detect(folderInfoList);

      // 4. 命名建议
      const namingSuggestions = this.namingEngine.suggestBatch(
        folderStatsList.map((stats) => ({
          folderId: stats.folderId,
          folderName: stats.folderName,
        })),
      );

      const report: GardenerReport = {
        thresholdAdjustment,
        folderSuggestions,
        synonymGroups,
        namingSuggestions,
        generatedAt: new Date(),
      };

      this.logger.info("Gardener 报告生成完成", {
        hasThresholdAdjustment: !!thresholdAdjustment,
        folderSuggestionsCount: folderSuggestions.length,
        synonymGroupsCount: synonymGroups.length,
        namingSuggestionsCount: namingSuggestions.length,
      });

      return report;
    } catch (error) {
      this.logger.error(
        "生成 Gardener 报告失败",
        error instanceof Error ? error : undefined,
      );

      throw new GardenerError(
        `生成 Gardener 报告失败: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * 应用阈值调整
   */
  applyThresholdAdjustment(adjustment: ThresholdAdjustment): void {
    this.logger.info("应用阈值调整", {
      from: adjustment.currentThreshold,
      to: adjustment.suggestedThreshold,
    });

    this.thresholdAdapter.applyAdjustment(adjustment);
  }

  /**
   * 获取当前配置
   */
  getConfig(): GardenerConfig {
    return {
      ...this.config,
      thresholds: this.thresholdAdapter.getConfig(),
    };
  }
}
