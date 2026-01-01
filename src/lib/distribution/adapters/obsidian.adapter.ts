/**
 * Obsidian 本地同步适配器
 *
 * @module distribution/adapters
 * @description 将书签同步到本地 Obsidian Vault 目录
 *
 * **注意**: 此适配器仅支持桌面端（Electron），在 Web/Mobile 端调用会抛出错误
 *
 * @example
 * ```typescript
 * const adapter = new ObsidianAdapter();
 *
 * // 验证配置
 * const validation = await adapter.validateConfig(target);
 *
 * // 执行同步
 * const result = await adapter.distribute(bookmarks, target);
 * ```
 */

import type { IDistributionAdapter } from "../interfaces";
import type {
  DistributionTarget,
  DistributionBookmark,
  DistributionResult,
  DistributionRecord,
  ObsidianTargetConfig,
  SupportedPlatform,
  ValidationResult,
  TestConnectionResult,
} from "../types";
import { PlatformNotSupportedError } from "../errors";
import { logger } from "@/lib/logger";

/**
 * 文件名模式类型
 */
type FilenamePattern = "title" | "date-title" | "id-title";

/**
 * 文件名最大长度
 */
const MAX_FILENAME_LENGTH = 100;

/**
 * 测试文件名
 */
const TEST_FILE_NAME = ".anykeep-test";

/**
 * 文件系统接口（用于依赖注入和测试）
 */
export interface FileSystemInterface {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(
    path: string,
    content: string,
    encoding: BufferEncoding,
  ): Promise<void>;
  access(path: string): Promise<void>;
  unlink(path: string): Promise<void>;
}

/**
 * 路径工具接口（用于依赖注入和测试）
 */
export interface PathInterface {
  join(...paths: string[]): string;
}

/**
 * 清理文件名中的非法字符
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    .trim()
    .substring(0, MAX_FILENAME_LENGTH);
}

/**
 * 格式化日期为 ISO 格式（YYYY-MM-DD）
 */
function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * 格式化日期为本地格式
 */
function formatDateLocal(date: Date): string {
  return date.toLocaleString("zh-CN");
}

/**
 * 生成 YAML Frontmatter
 */
function generateFrontmatter(bookmark: DistributionBookmark): string {
  const lines: string[] = ["---"];

  lines.push(`title: "${(bookmark.title || "无标题").replace(/"/g, '\\"')}"`);
  lines.push(`url: "${bookmark.url}"`);

  if (bookmark.platform) {
    lines.push(`platform: "${bookmark.platform}"`);
  }

  if (bookmark.createdAt) {
    lines.push(`created: ${formatDateISO(bookmark.createdAt)}`);
  }

  if (bookmark.tags && bookmark.tags.length > 0) {
    lines.push("tags:");
    bookmark.tags.forEach((tag) => {
      const cleanTag = tag.replace(/[#[\]]/g, "").trim();
      if (cleanTag) {
        lines.push(`  - ${cleanTag}`);
      }
    });
  }

  lines.push("---");
  lines.push("");

  return lines.join("\n");
}

/**
 * 生成 Markdown 内容
 */
function generateMarkdownContent(
  bookmark: DistributionBookmark,
  useYamlFrontmatter: boolean,
): string {
  let md = "";

  // Frontmatter
  if (useYamlFrontmatter) {
    md += generateFrontmatter(bookmark);
  }

  // 标题
  md += `# ${bookmark.title || "无标题"}\n\n`;

  // 链接
  md += `**链接**：[${bookmark.url}](${bookmark.url})\n\n`;

  // 元信息
  const metaInfo: string[] = [];
  if (bookmark.platform) {
    metaInfo.push(`平台: ${bookmark.platform}`);
  }
  if (bookmark.createdAt) {
    metaInfo.push(`收藏时间: ${formatDateLocal(bookmark.createdAt)}`);
  }
  if (metaInfo.length > 0) {
    md += `> ${metaInfo.join(" | ")}\n\n`;
  }

  // AI 摘要
  if (bookmark.aiSummary) {
    md += `## 摘要\n\n${bookmark.aiSummary}\n\n`;
  }

  // 描述
  if (bookmark.description) {
    md += `## 描述\n\n${bookmark.description}\n\n`;
  }

  // 标签（Obsidian 格式）
  if (bookmark.tags && bookmark.tags.length > 0) {
    const tagLinks = bookmark.tags.map((tag) => {
      const cleanTag = tag.replace(/[#[\]]/g, "").trim();
      return `#${cleanTag}`;
    });
    md += `\n---\n\n${tagLinks.join(" ")}\n`;
  }

  return md;
}

/**
 * Obsidian 本地同步适配器
 *
 * 将书签写入本地 Obsidian Vault 目录作为 Markdown 文件
 */
export class ObsidianAdapter implements IDistributionAdapter {
  readonly type = "obsidian" as const;
  readonly displayName = "Obsidian 本地同步";
  readonly description = "将收藏同步到本地 Obsidian Vault 目录";
  readonly supportedPlatforms: readonly SupportedPlatform[] = ["desktop"];

  private readonly injectedFs?: FileSystemInterface;
  private readonly injectedPath?: PathInterface;

  /**
   * 构造函数
   *
   * @param fs - 可选的文件系统接口（用于测试）
   * @param path - 可选的路径接口（用于测试）
   */
  constructor(fs?: FileSystemInterface, path?: PathInterface) {
    this.injectedFs = fs;
    this.injectedPath = path;
  }

  /**
   * 初始化适配器
   */
  async initialize(_config: DistributionTarget): Promise<void> {
    // 检查平台支持
    this.ensureDesktopPlatform();
    return;
  }

  /**
   * 执行同步分发
   */
  async distribute(
    bookmarks: DistributionBookmark[],
    config: DistributionTarget,
  ): Promise<DistributionResult> {
    // 检查平台支持
    this.ensureDesktopPlatform();

    const obsConfig = this.getObsidianConfig(config);
    const records: DistributionRecord[] = [];

    // 动态导入 Node.js fs 模块
    const fs = await this.getFs();
    const path = await this.getPath();

    // 构建目标目录路径
    const targetDir = path.join(obsConfig.vaultPath, obsConfig.folderName);

    // 确保目录存在
    try {
      await fs.mkdir(targetDir, { recursive: true });
    } catch (error) {
      logger.error(
        { error, targetDir },
        "ObsidianAdapter: Failed to create target directory",
      );
      return {
        success: false,
        distributedCount: 0,
        failedCount: bookmarks.length,
        records: bookmarks.map((b) =>
          this.createFailedRecord(b, config.id, "目录创建失败"),
        ),
        errors: [
          {
            bookmarkId: "*",
            code: "DIRECTORY_CREATE_FAILED",
            message: `无法创建目录: ${targetDir}`,
          },
        ],
      };
    }

    // 文件名计数器，用于处理冲突
    const filenameCounters = new Map<string, number>();

    // 逐个同步书签
    for (const bookmark of bookmarks) {
      try {
        // 生成文件名
        let filename = this.generateFilename(
          bookmark,
          obsConfig.filenamePattern,
        );

        // 处理文件名冲突
        const count = filenameCounters.get(filename) || 0;
        if (count > 0) {
          const extIndex = filename.lastIndexOf(".");
          const baseName =
            extIndex > 0 ? filename.slice(0, extIndex) : filename;
          const ext = extIndex > 0 ? filename.slice(extIndex) : "";
          filename = `${baseName}_${count}${ext}`;
        }
        filenameCounters.set(filename, count + 1);

        const filepath = path.join(targetDir, filename);

        // 检查文件是否已存在（幂等性）
        const exists = await this.fileExists(fs, filepath);
        if (exists) {
          logger.debug(
            { filepath },
            "ObsidianAdapter: File already exists, skipping",
          );
          records.push({
            id: this.generateRecordId(config.id, bookmark.id),
            targetId: config.id,
            bookmarkId: bookmark.id,
            status: "success",
            distributedAt: new Date(),
            externalId: filepath,
            createdAt: new Date(),
            retryCount: 0,
          });
          continue;
        }

        // 生成 Markdown 内容
        const content = generateMarkdownContent(
          bookmark,
          obsConfig.useYamlFrontmatter,
        );

        // 写入文件
        await fs.writeFile(filepath, content, "utf-8");

        logger.debug(
          { filepath },
          "ObsidianAdapter: File written successfully",
        );

        records.push({
          id: this.generateRecordId(config.id, bookmark.id),
          targetId: config.id,
          bookmarkId: bookmark.id,
          status: "success",
          distributedAt: new Date(),
          externalId: filepath,
          createdAt: new Date(),
          retryCount: 0,
        });
      } catch (error) {
        logger.error(
          { error, bookmarkId: bookmark.id },
          "ObsidianAdapter: Failed to sync bookmark",
        );

        records.push(
          this.createFailedRecord(
            bookmark,
            config.id,
            error instanceof Error ? error.message : "未知错误",
          ),
        );
      }
    }

    const successCount = records.filter((r) => r.status === "success").length;
    const failedCount = records.filter((r) => r.status === "failed").length;

    logger.info(
      {
        totalBookmarks: bookmarks.length,
        successCount,
        failedCount,
        targetDir,
      },
      "ObsidianAdapter: Distribution completed",
    );

    return {
      success: failedCount === 0,
      distributedCount: successCount,
      failedCount,
      records,
      errors:
        failedCount > 0
          ? records
              .filter((r) => r.status === "failed")
              .map((r) => ({
                bookmarkId: r.bookmarkId,
                code: "WRITE_FAILED",
                message: r.errorMessage || "写入文件失败",
              }))
          : undefined,
    };
  }

  /**
   * 验证配置
   */
  async validateConfig(config: DistributionTarget): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查平台支持
    if (!this.isDesktopPlatform()) {
      errors.push("Obsidian 同步仅支持桌面客户端");
      return { valid: false, errors, warnings };
    }

    const rawConfig = config.targetConfig as Record<string, unknown>;

    // 检查 vaultPath
    if (!rawConfig?.vaultPath || typeof rawConfig.vaultPath !== "string") {
      errors.push("Vault 路径不能为空");
    } else {
      // 验证路径是否存在且可写
      try {
        const fs = await this.getFs();
        await fs.access(rawConfig.vaultPath as string);
      } catch {
        errors.push("Vault 路径不存在或无访问权限");
      }
    }

    // 检查 folderName
    if (!rawConfig?.folderName || typeof rawConfig.folderName !== "string") {
      errors.push("保存目录不能为空");
    } else if ((rawConfig.folderName as string).length > 100) {
      errors.push("保存目录名过长（最多 100 字符）");
    }

    // 检查 filenamePattern（可选）
    const validPatterns: FilenamePattern[] = [
      "title",
      "date-title",
      "id-title",
    ];
    if (
      rawConfig?.filenamePattern &&
      !validPatterns.includes(rawConfig.filenamePattern as FilenamePattern)
    ) {
      warnings.push(
        `不支持的文件名模式: ${rawConfig.filenamePattern}，将使用默认模式`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * 测试连接
   */
  async testConnection(
    config: DistributionTarget,
  ): Promise<TestConnectionResult> {
    // 检查平台支持
    if (!this.isDesktopPlatform()) {
      return {
        success: false,
        error: "Obsidian 同步仅支持桌面客户端",
      };
    }

    // 先验证配置
    const validation = await this.validateConfig(config);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join("; "),
      };
    }

    const obsConfig = this.getObsidianConfig(config);
    const fs = await this.getFs();
    const path = await this.getPath();

    // 尝试创建测试文件
    const testDir = path.join(obsConfig.vaultPath, obsConfig.folderName);
    const testFile = path.join(testDir, TEST_FILE_NAME);

    try {
      // 创建目录
      await fs.mkdir(testDir, { recursive: true });

      // 写入测试文件
      await fs.writeFile(
        testFile,
        `AnyKeep connection test - ${new Date().toISOString()}`,
        "utf-8",
      );

      // 删除测试文件
      await fs.unlink(testFile);

      return {
        success: true,
        details: {
          vaultPath: obsConfig.vaultPath,
          folderName: obsConfig.folderName,
          message: "连接测试成功",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `无法写入测试文件: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): Record<string, unknown> {
    return {
      vaultPath: "",
      folderName: "AnyKeep",
      filenamePattern: "{{title}}-{{date}}",
      useYamlFrontmatter: true,
    };
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    // 无需清理
    return;
  }

  // ==================== 私有方法 ====================

  /**
   * 获取 Obsidian 配置
   */
  private getObsidianConfig(config: DistributionTarget): ObsidianTargetConfig {
    const targetConfig = config.targetConfig as unknown as ObsidianTargetConfig;
    return {
      vaultPath: targetConfig?.vaultPath || "",
      folderName: targetConfig?.folderName || "AnyKeep",
      filenamePattern: targetConfig?.filenamePattern || "{{title}}-{{date}}",
      template: targetConfig?.template,
      useYamlFrontmatter: targetConfig?.useYamlFrontmatter ?? true,
    };
  }

  /**
   * 生成文件名
   */
  private generateFilename(
    bookmark: DistributionBookmark,
    pattern: string,
  ): string {
    const date = formatDateISO(bookmark.createdAt || new Date());
    const safeTitle = sanitizeFilename(bookmark.title || "无标题");
    const shortId = bookmark.id.substring(0, 8);

    // 解析模式
    let filename = pattern
      .replace("{{title}}", safeTitle)
      .replace("{{date}}", date)
      .replace("{{id}}", shortId);

    // 如果模式解析后为空，使用默认
    if (!filename.trim()) {
      filename = safeTitle;
    }

    // 确保以 .md 结尾
    if (!filename.endsWith(".md")) {
      filename += ".md";
    }

    return filename;
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(
    fs: FileSystemInterface,
    filepath: string,
  ): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 创建失败记录
   */
  private createFailedRecord(
    bookmark: DistributionBookmark,
    targetId: string,
    errorMessage: string,
  ): DistributionRecord {
    return {
      id: this.generateRecordId(targetId, bookmark.id),
      targetId,
      bookmarkId: bookmark.id,
      status: "failed",
      errorMessage,
      createdAt: new Date(),
      retryCount: 0,
    };
  }

  /**
   * 生成记录 ID
   */
  private generateRecordId(targetId: string, bookmarkId: string): string {
    return `${targetId}-${bookmarkId}-${Date.now()}`;
  }

  /**
   * 检查是否为桌面平台
   */
  private isDesktopPlatform(): boolean {
    // 检查 Node.js 环境
    return (
      typeof process !== "undefined" && process.versions?.node !== undefined
    );
  }

  /**
   * 确保在桌面平台运行
   */
  private ensureDesktopPlatform(): void {
    if (!this.isDesktopPlatform()) {
      throw new PlatformNotSupportedError("obsidian", ["desktop"]);
    }
  }

  /**
   * 动态获取 fs/promises 模块
   */
  private async getFs(): Promise<FileSystemInterface> {
    // 如果注入了依赖，使用注入的
    if (this.injectedFs) {
      return this.injectedFs;
    }

    // 否则动态导入 Node.js fs 模块
    try {
      const fsModule = await import("fs/promises");
      return {
        mkdir: async (path, options) => {
          await fsModule.mkdir(path, options);
        },
        writeFile: (path, content, encoding) =>
          fsModule.writeFile(path, content, encoding),
        access: (path) => fsModule.access(path),
        unlink: (path) => fsModule.unlink(path),
      };
    } catch {
      throw new PlatformNotSupportedError("obsidian", ["desktop"]);
    }
  }

  /**
   * 动态获取 path 模块
   */
  private async getPath(): Promise<PathInterface> {
    // 如果注入了依赖，使用注入的
    if (this.injectedPath) {
      return this.injectedPath;
    }

    // 否则动态导入 Node.js path 模块
    try {
      const pathModule = await import("path");
      return {
        join: (...paths) => pathModule.join(...paths),
      };
    } catch {
      throw new PlatformNotSupportedError("obsidian", ["desktop"]);
    }
  }
}
