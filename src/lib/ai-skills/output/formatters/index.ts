/**
 * 格式化器模块导出
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

// 基类
export {
  BaseFormatter,
  type FormatterConfig,
  type FormatterContext,
  type FormatterResult,
} from "./base-formatter";

// 列表格式化器
export {
  ListFormatter,
  createListFormatter,
  type ListItem,
  type ListFormatterConfig,
} from "./list-formatter";

// 表格格式化器
export {
  TableFormatter,
  createTableFormatter,
  type TableColumn,
  type TableFormatterConfig,
} from "./table-formatter";

// 报告格式化器
export {
  ReportFormatter,
  createReportFormatter,
  type ReportSection,
  type ReportData,
  type ReportFormatterConfig,
} from "./report-formatter";

// ============================================
// 格式化器工厂
// ============================================

import type { DeliverableType } from "../types";
import { ListFormatter } from "./list-formatter";
import { TableFormatter } from "./table-formatter";
import { ReportFormatter } from "./report-formatter";
import type { FormatterConfig } from "./base-formatter";

/**
 * 根据交付物类型获取格式化器
 */
export function getFormatterForType(
  type: DeliverableType,
  config?: Partial<FormatterConfig>,
): ListFormatter | TableFormatter | ReportFormatter {
  switch (type) {
    case "list":
      return new ListFormatter(config);
    case "table":
      return new TableFormatter(config);
    case "report":
    case "document":
      return new ReportFormatter(config);
    // cards, mindmap, graph 可以扩展更多格式化器
    default:
      // 默认使用列表格式化器
      return new ListFormatter(config);
  }
}
