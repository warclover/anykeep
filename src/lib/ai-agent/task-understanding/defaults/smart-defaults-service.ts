/**
 * 智能默认值服务
 *
 * 核心思想：不问用户，AI 自己决定，记录决策供用户事后查看和纠正
 *
 * 决策优先级：用户偏好 > 上下文推断 > 系统默认
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { createLogger } from "@/lib/logger";
import type {
  SmartDefault,
  TaskContext,
  UserPreferences,
  OrganizeMethod,
} from "../types";

const logger = createLogger("SmartDefaultsService");

// =============================================================================
// 配置
// =============================================================================

/**
 * 系统默认值配置
 */
const SYSTEM_DEFAULTS = {
  organizeMethod: "topic" as OrganizeMethod,
  scope: "all" as "all" | "recent" | "unclassified",
  exportFormat: "markdown" as string,
  batchSize: 50,
} as const;

/**
 * 上下文推断阈值
 */
const INFERENCE_THRESHOLDS = {
  /** 平台集中度阈值（超过此比例认为是单一平台） */
  platformConcentration: 0.6,
  /** 少量数据阈值（低于此数量简化处理） */
  smallDataset: 20,
  /** 大量数据阈值（超过此数量需要分批） */
  largeDataset: 100,
} as const;

// =============================================================================
// 智能默认值服务
// =============================================================================

/**
 * 智能默认值服务
 *
 * 为任务参数提供智能默认值，实现零接管体验
 */
export class SmartDefaultsService {
  constructor(private preferencesProvider: PreferencesProvider) {}

  // ===========================================================================
  // 公共方法
  // ===========================================================================

  /**
   * 为任务获取智能默认值
   *
   * @param taskType 任务类型
   * @param context 任务上下文
   * @returns 智能默认值列表
   */
  async resolveDefaults(
    taskType: string,
    context: TaskContext,
  ): Promise<SmartDefault[]> {
    const defaults: SmartDefault[] = [];
    const userPrefs = await this.preferencesProvider.getPreferences(
      context.userId,
    );

    try {
      // 根据任务类型解析不同的默认值
      switch (taskType) {
        case "organize":
        case "batch_organize":
          defaults.push(await this.resolveOrganizeMethod(context, userPrefs));
          defaults.push(await this.resolveTargetFolder(context, userPrefs));
          defaults.push(this.resolveScope(context, userPrefs));
          break;

        case "move":
          defaults.push(await this.resolveTargetFolder(context, userPrefs));
          break;

        case "batch_tags":
          defaults.push(this.resolveTagAction(context));
          break;

        case "export":
          defaults.push(this.resolveExportFormat(context, userPrefs));
          break;

        case "search":
          defaults.push(this.resolveSearchMode(context));
          break;

        default:
          // 通用默认值
          defaults.push(this.resolveScope(context, userPrefs));
      }

      logger.debug(
        {
          taskType,
          userId: context.userId,
          defaults: defaults.map((d) => ({
            field: d.field,
            value: d.value,
            source: d.source,
          })),
        },
        "解析智能默认值",
      );

      return defaults;
    } catch (error) {
      logger.error({ taskType, error }, "解析智能默认值失败");
      // 回退到系统默认
      return this.getSystemDefaults(taskType);
    }
  }

  /**
   * 获取单个字段的智能默认值
   */
  async resolveDefault(
    field: string,
    context: TaskContext,
  ): Promise<SmartDefault> {
    const userPrefs = await this.preferencesProvider.getPreferences(
      context.userId,
    );

    switch (field) {
      case "organizeMethod":
        return this.resolveOrganizeMethod(context, userPrefs);
      case "targetFolder":
        return this.resolveTargetFolder(context, userPrefs);
      case "scope":
        return this.resolveScope(context, userPrefs);
      case "exportFormat":
        return this.resolveExportFormat(context, userPrefs);
      default:
        return {
          field,
          value: "",
          source: "system_default",
          confidence: 0.5,
          reason: "未知字段，使用空默认值",
        };
    }
  }

  // ===========================================================================
  // 私有方法 - 具体字段解析
  // ===========================================================================

  /**
   * 解析整理方式
   */
  private async resolveOrganizeMethod(
    context: TaskContext,
    userPrefs?: UserPreferences | null,
  ): Promise<SmartDefault> {
    const field = "organizeMethod";

    // 1. 检查用户偏好
    if (userPrefs?.preferredOrganizeMethod) {
      return {
        field,
        value: userPrefs.preferredOrganizeMethod,
        source: "user_preference",
        confidence: 0.95,
        reason: "基于用户历史偏好",
      };
    }

    // 2. 从用户输入中提取提示
    const inputHint = this.extractOrganizeMethodFromInput(context.input);
    if (inputHint) {
      return {
        field,
        value: inputHint,
        source: "context_infer",
        confidence: 0.85,
        reason: `用户输入中提到"${inputHint}"`,
      };
    }

    // 3. 根据内容特征推断
    const platformDistribution = context.stats.platformDistribution;
    const totalBookmarks = context.stats.total;

    // 如果某平台占比超过 60%，建议按该平台的特征分类
    for (const [platform, count] of Object.entries(platformDistribution)) {
      const ratio = count / totalBookmarks;
      if (ratio > INFERENCE_THRESHOLDS.platformConcentration) {
        const method = this.getRecommendedMethodByPlatform(platform);
        return {
          field,
          value: method,
          source: "context_infer",
          confidence: 0.7,
          reason: `${platform} 内容占比 ${Math.round(ratio * 100)}%，推荐按 ${method} 分类`,
        };
      }
    }

    // 4. 系统默认
    return {
      field,
      value: SYSTEM_DEFAULTS.organizeMethod,
      source: "system_default",
      confidence: 0.6,
      reason: "默认按主题分类",
    };
  }

  /**
   * 解析目标文件夹
   */
  private async resolveTargetFolder(
    context: TaskContext,
    userPrefs?: UserPreferences | null,
  ): Promise<SmartDefault> {
    const field = "targetFolder";

    // 1. 检查用户偏好（常用文件夹）
    if (userPrefs?.frequentFolders && userPrefs.frequentFolders.length > 0) {
      // 根据内容主题匹配最相关的文件夹
      const bestMatch = this.matchFolderByContent(
        context.targetBookmarks || [],
        context.folders,
        userPrefs.frequentFolders,
      );
      if (bestMatch) {
        return {
          field,
          value: bestMatch.id,
          source: "user_preference",
          confidence: 0.8,
          reason: `匹配常用文件夹"${bestMatch.name}"`,
        };
      }
    }

    // 2. 从用户输入中提取文件夹名
    const folderHint = this.extractFolderFromInput(
      context.input,
      context.folders,
    );
    if (folderHint) {
      return {
        field,
        value: folderHint.id,
        source: "context_infer",
        confidence: 0.9,
        reason: `用户提到文件夹"${folderHint.name}"`,
      };
    }

    // 3. 根据平台推断
    if (context.targetBookmarks && context.targetBookmarks.length > 0) {
      const platform = context.targetBookmarks[0].platform;
      const platformFolder = context.folders.find((f) =>
        f.name.toLowerCase().includes(platform?.toLowerCase() || ""),
      );
      if (platformFolder) {
        return {
          field,
          value: platformFolder.id,
          source: "context_infer",
          confidence: 0.75,
          reason: `按平台匹配文件夹"${platformFolder.name}"`,
        };
      }
    }

    // 4. 默认"待整理"
    const inboxFolder = context.folders.find(
      (f) => f.name === "待整理" || f.name === "Inbox" || f.name === "收件箱",
    );
    return {
      field,
      value: inboxFolder?.id || "inbox",
      source: "system_default",
      confidence: 0.5,
      reason: "默认放入待整理",
    };
  }

  /**
   * 解析处理范围
   */
  private resolveScope(
    context: TaskContext,
    _userPrefs?: UserPreferences | null,
  ): SmartDefault {
    const field = "scope";

    // 从用户输入中提取范围提示
    const input = context.input.toLowerCase();

    if (
      input.includes("全部") ||
      input.includes("所有") ||
      input.includes("all")
    ) {
      return {
        field,
        value: "all",
        source: "context_infer",
        confidence: 0.9,
        reason: "用户指定处理全部",
      };
    }

    if (
      input.includes("最近") ||
      input.includes("recent") ||
      input.includes("近期")
    ) {
      return {
        field,
        value: "recent",
        source: "context_infer",
        confidence: 0.85,
        reason: "用户指定处理最近内容",
      };
    }

    if (
      input.includes("未分类") ||
      input.includes("未整理") ||
      input.includes("待整理")
    ) {
      return {
        field,
        value: "unclassified",
        source: "context_infer",
        confidence: 0.85,
        reason: "用户指定处理未分类内容",
      };
    }

    // 根据数据量决定
    const total = context.stats.total;
    if (total < INFERENCE_THRESHOLDS.smallDataset) {
      return {
        field,
        value: "all",
        source: "context_infer",
        confidence: 0.7,
        reason: `数据量较少(${total}条)，处理全部`,
      };
    }

    if (total > INFERENCE_THRESHOLDS.largeDataset) {
      return {
        field,
        value: "recent",
        source: "context_infer",
        confidence: 0.7,
        reason: `数据量较大(${total}条)，优先处理最近内容`,
      };
    }

    // 默认处理全部
    return {
      field,
      value: SYSTEM_DEFAULTS.scope,
      source: "system_default",
      confidence: 0.6,
      reason: "默认处理全部",
    };
  }

  /**
   * 解析标签操作
   */
  private resolveTagAction(context: TaskContext): SmartDefault {
    const field = "tagAction";
    const input = context.input.toLowerCase();

    if (
      input.includes("移除") ||
      input.includes("删除") ||
      input.includes("remove")
    ) {
      return {
        field,
        value: "remove",
        source: "context_infer",
        confidence: 0.9,
        reason: "用户意图移除标签",
      };
    }

    // 默认添加
    return {
      field,
      value: "add",
      source: "system_default",
      confidence: 0.8,
      reason: "默认添加标签",
    };
  }

  /**
   * 解析导出格式
   */
  private resolveExportFormat(
    context: TaskContext,
    _userPrefs?: UserPreferences | null,
  ): SmartDefault {
    const field = "exportFormat";
    const input = context.input.toLowerCase();

    // 从输入中提取格式
    const formatMap: Record<string, string> = {
      csv: "csv",
      markdown: "markdown",
      md: "markdown",
      obsidian: "obsidian",
      json: "json",
      html: "html",
    };

    for (const [keyword, format] of Object.entries(formatMap)) {
      if (input.includes(keyword)) {
        return {
          field,
          value: format,
          source: "context_infer",
          confidence: 0.95,
          reason: `用户指定 ${format} 格式`,
        };
      }
    }

    // 默认 Markdown
    return {
      field,
      value: SYSTEM_DEFAULTS.exportFormat,
      source: "system_default",
      confidence: 0.6,
      reason: "默认 Markdown 格式",
    };
  }

  /**
   * 解析搜索模式
   */
  private resolveSearchMode(context: TaskContext): SmartDefault {
    const field = "searchMode";
    const input = context.input.toLowerCase();

    // 如果是自然语言查询，使用语义搜索
    const isNaturalLanguage =
      input.length > 20 || input.includes("相关") || input.includes("类似");

    if (isNaturalLanguage) {
      return {
        field,
        value: "semantic",
        source: "context_infer",
        confidence: 0.75,
        reason: "自然语言查询，使用语义搜索",
      };
    }

    // 默认关键词搜索
    return {
      field,
      value: "keyword",
      source: "system_default",
      confidence: 0.7,
      reason: "默认关键词搜索",
    };
  }

  // ===========================================================================
  // 私有方法 - 辅助函数
  // ===========================================================================

  /**
   * 从用户输入中提取整理方式
   */
  private extractOrganizeMethodFromInput(input: string): OrganizeMethod | null {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes("按时间") || lowerInput.includes("时间顺序")) {
      return "time";
    }
    if (lowerInput.includes("按平台") || lowerInput.includes("来源")) {
      return "platform";
    }
    if (lowerInput.includes("按作者") || lowerInput.includes("up主")) {
      return "author";
    }
    if (
      lowerInput.includes("按主题") ||
      lowerInput.includes("按类别") ||
      lowerInput.includes("按分类")
    ) {
      return "topic";
    }
    if (lowerInput.includes("自动") || lowerInput.includes("智能")) {
      return "auto";
    }

    return null;
  }

  /**
   * 从用户输入中提取文件夹
   */
  private extractFolderFromInput(
    input: string,
    folders: { id: string; name: string }[],
  ): { id: string; name: string } | null {
    const lowerInput = input.toLowerCase();

    for (const folder of folders) {
      if (lowerInput.includes(folder.name.toLowerCase())) {
        return folder;
      }
    }

    return null;
  }

  /**
   * 根据平台推荐整理方式
   */
  private getRecommendedMethodByPlatform(platform: string): OrganizeMethod {
    const platformMethods: Record<string, OrganizeMethod> = {
      BILIBILI: "author", // B站按 UP主 分类
      XIAOHONGSHU: "topic", // 小红书按主题分类
      ZHIHU: "topic", // 知乎按主题分类
      WECHAT: "time", // 微信按时间分类
      WEIBO: "time", // 微博按时间分类
    };

    return platformMethods[platform.toUpperCase()] || "topic";
  }

  /**
   * 根据内容匹配文件夹
   */
  private matchFolderByContent(
    bookmarks: {
      id: string;
      title: string;
      platform: string;
      tags?: string[];
    }[],
    allFolders: { id: string; name: string }[],
    frequentFolderIds: string[],
  ): { id: string; name: string } | null {
    if (bookmarks.length === 0) return null;

    // 获取常用文件夹
    const frequentFolders = allFolders.filter((f) =>
      frequentFolderIds.includes(f.id),
    );
    if (frequentFolders.length === 0) return null;

    // 简单匹配：看书签标题/标签是否包含文件夹名关键词
    for (const folder of frequentFolders) {
      const folderKeywords = folder.name.toLowerCase().split(/\s+/);

      for (const bookmark of bookmarks) {
        const bookmarkText = [
          bookmark.title.toLowerCase(),
          ...(bookmark.tags || []).map((t) => t.toLowerCase()),
        ].join(" ");

        if (folderKeywords.some((kw) => bookmarkText.includes(kw))) {
          return folder;
        }
      }
    }

    // 返回第一个常用文件夹作为兜底
    return frequentFolders[0];
  }

  /**
   * 获取系统默认值（兜底）
   */
  private getSystemDefaults(taskType: string): SmartDefault[] {
    const defaults: SmartDefault[] = [];

    defaults.push({
      field: "scope",
      value: SYSTEM_DEFAULTS.scope,
      source: "system_default",
      confidence: 0.5,
      reason: "系统默认值",
    });

    if (taskType === "organize" || taskType === "batch_organize") {
      defaults.push({
        field: "organizeMethod",
        value: SYSTEM_DEFAULTS.organizeMethod,
        source: "system_default",
        confidence: 0.5,
        reason: "系统默认值",
      });
    }

    return defaults;
  }
}

// =============================================================================
// 偏好提供者接口
// =============================================================================

/**
 * 偏好提供者接口
 *
 * 用于解耦智能默认值服务和偏好存储
 */
export interface PreferencesProvider {
  /**
   * 获取用户偏好
   */
  getPreferences(userId: string): Promise<UserPreferences | null>;
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建智能默认值服务
 */
export function createSmartDefaultsService(
  preferencesProvider: PreferencesProvider,
): SmartDefaultsService {
  return new SmartDefaultsService(preferencesProvider);
}
