/**
 * Knowledge Studio Obsidian 格式化器
 * @module export/formatters
 * @description 专门用于导出 Knowledge Studio 合成报告为 Obsidian 格式
 */

import type {
  SynthesisReport,
  Citation,
  BlueprintType,
} from "@/lib/knowledge-studio/types";
import { BLUEPRINT_DISPLAY_CONFIG } from "@/lib/knowledge-studio/blueprint";

// ============================================================================
// 类型定义
// ============================================================================

export interface KSObsidianExportOptions {
  /** 是否包含引用详情 */
  includeCitations?: boolean;
  /** 是否包含生成元数据 */
  includeMetadata?: boolean;
  /** 是否包含双链 */
  includeWikiLinks?: boolean;
  /** 标签前缀 */
  tagPrefix?: string;
  /** 输出模式 */
  outputMode?: "single" | "zip";
}

export interface KSObsidianFormatResult {
  /** 格式化后的内容 */
  content: string;
  /** 文件名 */
  filename: string;
  /** MIME 类型 */
  mimeType: string;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_OPTIONS: Required<KSObsidianExportOptions> = {
  includeCitations: true,
  includeMetadata: true,
  includeWikiLinks: true,
  tagPrefix: "knowledge-studio",
  outputMode: "single",
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 格式化日期为 ISO 格式
 */
function formatDateISO(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

/**
 * 格式化日期为本地格式
 */
function formatDateLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("zh-CN");
}

/**
 * 清理文件名中的非法字符
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 100);
}

/**
 * 获取蓝图类型显示名称
 */
function getBlueprintDisplayName(type: BlueprintType): string {
  return BLUEPRINT_DISPLAY_CONFIG[type]?.name || type;
}

/**
 * 获取蓝图类型图标
 */
function getBlueprintIcon(type: BlueprintType): string {
  return BLUEPRINT_DISPLAY_CONFIG[type]?.icon || "📝";
}

// ============================================================================
// KS Obsidian 格式化器
// ============================================================================

/**
 * Knowledge Studio Obsidian 格式化器
 */
export class KSObsidianFormatter {
  private options: Required<KSObsidianExportOptions>;

  constructor(options?: KSObsidianExportOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 生成 Frontmatter
   */
  private generateFrontmatter(report: SynthesisReport): string {
    const fm: string[] = ["---"];

    // 基本信息
    fm.push(
      `title: "${(report.title || "知识合成报告").replace(/"/g, '\\"')}"`,
    );
    fm.push(`blueprint_type: "${report.blueprintType}"`);
    fm.push(
      `blueprint_name: "${getBlueprintDisplayName(report.blueprintType)}"`,
    );
    fm.push(`version: ${report.version}`);
    fm.push(`created: ${formatDateISO(report.createdAt)}`);
    fm.push(`updated: ${formatDateISO(report.updatedAt)}`);

    // 标签
    fm.push("tags:");
    fm.push(`  - ${this.options.tagPrefix}`);
    fm.push(`  - ${this.options.tagPrefix}/${report.blueprintType}`);

    // 引用来源数量
    if (report.citations && report.citations.length > 0) {
      fm.push(`sources_count: ${report.citations.length}`);
    }

    // 生成元数据
    if (this.options.includeMetadata && report.generationMetadata) {
      const meta = report.generationMetadata;
      if (meta.model) {
        fm.push(`model: "${meta.model}"`);
      }
      if (meta.durationMs) {
        fm.push(`generation_time_ms: ${meta.durationMs}`);
      }
      if (meta.tokens) {
        fm.push(`tokens_used: ${meta.tokens.total || 0}`);
      }
    }

    fm.push("---");
    fm.push("");

    return fm.join("\n");
  }

  /**
   * 生成引用部分
   */
  private generateCitationsSection(citations: Citation[]): string {
    if (!citations || citations.length === 0) {
      return "";
    }

    let section = "\n## 参考来源\n\n";

    citations.forEach((citation, index) => {
      const idx = citation.position || index + 1;

      if (this.options.includeWikiLinks) {
        // 尝试生成双链（如果标题可用）
        section += `[^${idx}]: ${citation.title} - [${citation.url}](${citation.url})\n`;
      } else {
        section += `[^${idx}]: ${citation.title} - ${citation.url}\n`;
      }

      if (citation.excerpt) {
        section += `  > ${citation.excerpt}\n`;
      }
    });

    return section;
  }

  /**
   * 生成元数据部分
   */
  private generateMetadataSection(report: SynthesisReport): string {
    if (!this.options.includeMetadata || !report.generationMetadata) {
      return "";
    }

    const meta = report.generationMetadata;
    let section = "\n---\n\n## 生成信息\n\n";

    section += "| 项目 | 值 |\n";
    section += "|------|----|\n";

    if (meta.model) {
      section += `| 模型 | ${meta.model} |\n`;
    }

    if (meta.durationMs) {
      const seconds = (meta.durationMs / 1000).toFixed(2);
      section += `| 生成耗时 | ${seconds}s |\n`;
    }

    if (meta.tokens) {
      section += `| Token 消耗 | ${meta.tokens.total || 0} |\n`;
      if (meta.tokens.input) {
        section += `| 输入 Token | ${meta.tokens.input} |\n`;
      }
      if (meta.tokens.output) {
        section += `| 输出 Token | ${meta.tokens.output} |\n`;
      }
    }

    if (meta.stagesTiming) {
      const stages = meta.stagesTiming;
      section += `| 解析阶段 | ${stages.parsing}ms |\n`;
      section += `| 大纲阶段 | ${stages.outline}ms |\n`;
      section += `| 内容阶段 | ${stages.content}ms |\n`;
      section += `| 引用阶段 | ${stages.citations}ms |\n`;
      section += `| 完成阶段 | ${stages.finalizing}ms |\n`;
    }

    return section;
  }

  /**
   * 格式化单个报告
   */
  formatReport(report: SynthesisReport): KSObsidianFormatResult {
    let content = "";

    // Frontmatter
    content += this.generateFrontmatter(report);

    // 标题
    const icon = getBlueprintIcon(report.blueprintType);
    const typeName = getBlueprintDisplayName(report.blueprintType);
    content += `# ${icon} ${report.title || "知识合成报告"}\n\n`;

    // 类型标记
    content += `> **蓝图类型**：${icon} ${typeName}\n`;
    content += `> **创建时间**：${formatDateLocal(report.createdAt)}\n`;
    if (report.version > 1) {
      content += `> **版本**：v${report.version}（更新于 ${formatDateLocal(report.updatedAt)}）\n`;
    }
    content += "\n---\n\n";

    // 正文内容
    content += report.content;

    // 引用来源
    if (this.options.includeCitations) {
      content += this.generateCitationsSection(report.citations);
    }

    // 生成元数据
    if (this.options.includeMetadata) {
      content += this.generateMetadataSection(report);
    }

    // 底部标签
    content += `\n---\n\n`;
    content += `#${this.options.tagPrefix} #${this.options.tagPrefix}/${report.blueprintType}\n`;

    // 生成文件名
    const datePart = formatDateISO(report.createdAt);
    const titlePart = sanitizeFilename(report.title || "synthesis");
    const filename = `${datePart}_${titlePart}.md`;

    return {
      content,
      filename,
      mimeType: "text/markdown;charset=utf-8",
    };
  }

  /**
   * 格式化多个报告（ZIP 模式）
   */
  async formatReportsZip(reports: SynthesisReport[]): Promise<Blob> {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // 按蓝图类型分组
    const byType = new Map<BlueprintType, SynthesisReport[]>();

    reports.forEach((report) => {
      const type = report.blueprintType;
      const typeReports = byType.get(type);
      if (typeReports) {
        typeReports.push(report);
      } else {
        byType.set(type, [report]);
      }
    });

    // 创建文件夹结构
    byType.forEach((typeReports, type) => {
      const typeName = getBlueprintDisplayName(type);
      const folder = zip.folder(sanitizeFilename(typeName));

      if (folder) {
        typeReports.forEach((report) => {
          const result = this.formatReport(report);
          folder.file(result.filename, result.content);
        });
      }
    });

    // 生成索引文件
    const indexContent = this.generateIndexFile(reports);
    zip.file("INDEX.md", indexContent);

    return zip.generateAsync({ type: "blob" });
  }

  /**
   * 生成索引文件
   */
  private generateIndexFile(reports: SynthesisReport[]): string {
    let md = "";

    md += "---\n";
    md += `title: "Knowledge Studio 报告索引"\n`;
    md += `exported: ${formatDateISO(new Date())}\n`;
    md += `count: ${reports.length}\n`;
    md += "---\n\n";

    md += "# 📚 Knowledge Studio 报告索引\n\n";
    md += `> 导出时间：${formatDateLocal(new Date())}\n`;
    md += `> 总计：${reports.length} 份报告\n\n`;
    md += "---\n\n";

    // 按蓝图类型分组
    const byType = new Map<BlueprintType, SynthesisReport[]>();

    reports.forEach((report) => {
      const type = report.blueprintType;
      const typeReports = byType.get(type);
      if (typeReports) {
        typeReports.push(report);
      } else {
        byType.set(type, [report]);
      }
    });

    // 生成每个类型的索引
    byType.forEach((typeReports, type) => {
      const icon = getBlueprintIcon(type);
      const typeName = getBlueprintDisplayName(type);

      md += `## ${icon} ${typeName}（${typeReports.length}）\n\n`;

      typeReports.forEach((report, index) => {
        const result = this.formatReport(report);
        const folderName = sanitizeFilename(typeName);
        md += `${index + 1}. [[${folderName}/${result.filename}|${report.title || "无标题"}]] - ${formatDateISO(report.createdAt)}\n`;
      });

      md += "\n";
    });

    return md;
  }

  /**
   * 生成预览
   */
  generatePreview(report: SynthesisReport): string {
    const result = this.formatReport(report);
    return result.content.substring(0, 2000) + "\n\n...(预览截断)";
  }
}

// ============================================================================
// 快捷导出函数
// ============================================================================

/**
 * 导出单个报告为 Obsidian 格式
 */
export function exportReportToObsidian(
  report: SynthesisReport,
  options?: KSObsidianExportOptions,
): KSObsidianFormatResult {
  const formatter = new KSObsidianFormatter(options);
  return formatter.formatReport(report);
}

/**
 * 导出多个报告为 Obsidian ZIP
 */
export async function exportReportsToObsidianZip(
  reports: SynthesisReport[],
  options?: KSObsidianExportOptions,
): Promise<Blob> {
  const formatter = new KSObsidianFormatter(options);
  return formatter.formatReportsZip(reports);
}

/**
 * 生成报告预览
 */
export function generateReportPreview(
  report: SynthesisReport,
  options?: KSObsidianExportOptions,
): string {
  const formatter = new KSObsidianFormatter(options);
  return formatter.generatePreview(report);
}
