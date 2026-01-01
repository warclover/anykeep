/**
 * 手动导出适配器
 *
 * @module distribution/adapters
 * @description 将现有的导出功能（CSV、Markdown、Obsidian 等）包装为分发适配器
 *
 * @example
 * ```typescript
 * const adapter = new ManualExportAdapter();
 *
 * // 验证配置
 * const validation = await adapter.validateConfig(target);
 *
 * // 执行导出
 * const result = await adapter.distribute(bookmarks, target);
 *
 * // 结果包含下载文件
 * if (result.deliverable?.type === 'download') {
 *   downloadFile(result.deliverable.content, result.deliverable.filename);
 * }
 * ```
 */

import type { IDistributionAdapter } from "../interfaces";
import type {
  DistributionTarget,
  DistributionBookmark,
  DistributionResult,
  DistributionRecord,
  ManualExportTargetConfig,
  SupportedPlatform,
  ValidationResult,
  TestConnectionResult,
} from "../types";
import { ExportService } from "@/lib/export/services/export.service";
import type {
  ExportFormat,
  ExportConfig,
  BookmarkWithFolder,
} from "@/lib/export/types";
import { EXPORT_FORMAT_CONFIG } from "@/lib/export/constants";

/**
 * 格式映射：分发格式 -> 导出格式
 */
const FORMAT_MAPPING: Record<ManualExportTargetConfig["format"], ExportFormat> =
  {
    csv: "csv",
    json: "json",
    markdown: "markdown",
    obsidian: "obsidian",
    html: "html",
  };

/**
 * 支持的格式列表
 */
const SUPPORTED_FORMATS: ManualExportTargetConfig["format"][] = [
  "csv",
  "json",
  "markdown",
  "obsidian",
  "html",
];

/**
 * 从 targetConfig 提取 ManualExportTargetConfig
 */
function getExportConfig(config: DistributionTarget): ManualExportTargetConfig {
  const targetConfig =
    config.targetConfig as unknown as ManualExportTargetConfig;
  return {
    format: targetConfig?.format || "json",
    fields: targetConfig?.fields,
    options: targetConfig?.options,
  };
}

/**
 * 手动导出适配器
 *
 * 将现有的 ExportService 包装为 IDistributionAdapter 实现
 */
export class ManualExportAdapter implements IDistributionAdapter {
  readonly type = "manual_export" as const;
  readonly displayName = "手动导出";
  readonly supportedPlatforms: readonly SupportedPlatform[] = [
    "web",
    "mobile",
    "desktop",
  ];

  private readonly exportService: ExportService;

  constructor(exportService?: ExportService) {
    this.exportService = exportService ?? new ExportService();
  }

  /**
   * 初始化适配器（手动导出无需初始化）
   */
  async initialize(_config: DistributionTarget): Promise<void> {
    // 手动导出不需要初始化连接
    return;
  }

  /**
   * 执行导出分发
   */
  async distribute(
    bookmarks: DistributionBookmark[],
    config: DistributionTarget,
  ): Promise<DistributionResult> {
    const targetConfig = getExportConfig(config);
    const format = FORMAT_MAPPING[targetConfig.format] || "json";

    // 转换书签格式
    const exportBookmarks = this.convertBookmarks(bookmarks);

    // 构建导出配置
    const exportConfig: ExportConfig = {
      format,
      options: this.buildFormatOptions(targetConfig),
    };

    // 执行导出
    const exportResult = await this.exportService.export(
      exportBookmarks,
      exportConfig,
    );

    // 构建分发记录
    const records = this.buildRecords(
      bookmarks,
      config.id,
      exportResult.success,
    );

    // 构建分发结果
    return {
      success: exportResult.success,
      distributedCount: exportResult.success ? bookmarks.length : 0,
      failedCount: exportResult.success ? 0 : bookmarks.length,
      records,
      errors: exportResult.success
        ? undefined
        : [
            {
              bookmarkId: "*",
              code: exportResult.errorCode || "EXPORT_FAILED",
              message: exportResult.error || "导出失败",
            },
          ],
      deliverable: exportResult.success
        ? {
            type: "download",
            filename: exportResult.filename,
            mimeType: this.getMimeType(format),
            content:
              typeof exportResult.content === "string"
                ? exportResult.content
                : undefined,
            // Blob 需要在客户端创建 URL，服务端返回 undefined
            url:
              exportResult.content instanceof Blob &&
              typeof URL !== "undefined" &&
              URL.createObjectURL
                ? URL.createObjectURL(exportResult.content)
                : undefined,
          }
        : undefined,
    };
  }

  /**
   * 验证配置
   */
  async validateConfig(config: DistributionTarget): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 先检查原始配置中是否有格式
    const rawConfig = config.targetConfig as Record<string, unknown>;
    if (!rawConfig?.format) {
      errors.push("缺少导出格式配置");
    } else if (
      !SUPPORTED_FORMATS.includes(
        rawConfig.format as ManualExportTargetConfig["format"],
      )
    ) {
      errors.push(`不支持的导出格式: ${rawConfig.format}`);
    }

    // 验证字段配置（可选）
    if (rawConfig?.fields && !Array.isArray(rawConfig.fields)) {
      errors.push("fields 必须是数组");
    }

    // 警告：某些格式可能需要额外配置
    const options = rawConfig?.options as
      | ManualExportTargetConfig["options"]
      | undefined;
    if (rawConfig?.format === "obsidian" && options?.zipMultipleFiles) {
      warnings.push("Obsidian ZIP 格式可能需要较长处理时间");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * 测试连接（手动导出无需连接测试）
   */
  async testConnection(
    _config: DistributionTarget,
  ): Promise<TestConnectionResult> {
    // 手动导出不需要连接测试，直接返回成功
    return {
      success: true,
      details: {
        message: "手动导出无需连接测试",
        supportedFormats: SUPPORTED_FORMATS,
      },
    };
  }

  /**
   * 转换书签格式：DistributionBookmark -> BookmarkWithFolder
   *
   * 注意：只填充导出服务实际使用的字段，其他字段使用默认值
   */
  private convertBookmarks(
    bookmarks: DistributionBookmark[],
  ): BookmarkWithFolder[] {
    return bookmarks.map((bookmark) => ({
      // 必需字段
      id: parseInt(bookmark.id, 10) || 0,
      user_id: "",
      url: bookmark.url,
      title: bookmark.title || "",
      platform: bookmark.platform || "unknown",
      is_starred: false,

      // 导出服务使用的可选字段
      description: bookmark.description || null,
      author: null,
      platform_content_id: null,
      folder_id: bookmark.folderId ? parseInt(bookmark.folderId, 10) : null,
      ai_summary: bookmark.aiSummary || null,
      ai_tags: null,
      user_tags: bookmark.tags || null,
      notes: null,
      cover_url: null,
      rating: null,
      is_read: false,
      read_at: null,
      created_at: bookmark.createdAt.toISOString(),
      updated_at: bookmark.updatedAt.toISOString(),
      embedding: null,

      // 文件夹关联
      folders: null,

      // 其他必需字段使用默认值
      ai_content_type: null,
      ai_content_type_confidence: null,
      ai_vision_data: null,
      classification_result: null,
      classification_status: null,
      cluster_confidence: null,
      cluster_id: null,
      content_type: null,
      deleted_at: null,
      embedding_version: null,
      has_snapshot: null,
      image_count: null,
      import_batch_id: null,
      import_source: null,
      invalidated_at: null,
      is_in_trash: null,
      is_invalid: null,
      is_locked: null,
      is_marked_for_deletion: null,
      last_snapshot_at: null,
      last_validation_at: null,
      pending_cluster: null,
      pending_since: null,
      publish_time: null,
      search_vector: null,
      snapshot_status: null,
      source_name: null,
      starred_at: null,
      status: null,
      tag_embedding: null,
      tag_embedding_at: null,
    })) as BookmarkWithFolder[];
  }

  /**
   * 构建格式特定选项
   */
  private buildFormatOptions(
    config: ManualExportTargetConfig,
  ): ExportConfig["options"] {
    const options: ExportConfig["options"] = {};

    switch (config.format) {
      case "csv":
        options.csv = {
          fields: config.fields,
          includeHeader: true,
          delimiter: ",",
        };
        break;

      case "markdown":
        options.markdown = {
          includeAiSummary: config.options?.includeAiSummary ?? true,
          includeFrontmatter: true,
        };
        break;

      case "obsidian":
        options.obsidian = {
          outputMode: config.options?.zipMultipleFiles ? "zip" : "single",
        };
        break;
    }

    return options;
  }

  /**
   * 构建分发记录
   */
  private buildRecords(
    bookmarks: DistributionBookmark[],
    targetId: string,
    success: boolean,
  ): DistributionRecord[] {
    const now = new Date();

    return bookmarks.map((bookmark) => ({
      id: `${targetId}-${bookmark.id}-${now.getTime()}`,
      targetId,
      bookmarkId: bookmark.id,
      status: success ? ("success" as const) : ("failed" as const),
      distributedAt: success ? now : undefined,
      retryCount: 0,
      createdAt: now,
    }));
  }

  /**
   * 获取 MIME 类型
   */
  private getMimeType(format: ExportFormat): string {
    return EXPORT_FORMAT_CONFIG[format]?.mimeType || "application/octet-stream";
  }
}
