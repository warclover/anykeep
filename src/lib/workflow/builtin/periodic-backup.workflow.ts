/**
 * 定期备份工作流
 *
 * 自动导出全量数据到指定格式（JSON/Markdown）
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type { WorkflowDefinition } from "../types";

/**
 * 定期备份工作流
 *
 * 触发条件：每周日 03:00
 * 步骤：
 * 1. 统计数据量
 * 2. 导出 JSON 格式
 * 3. 导出 Markdown 格式
 * 4. 清理旧备份
 * 5. 发送完成通知
 */
export const periodicBackupWorkflow: WorkflowDefinition = {
  id: "periodic_backup",
  name: "定期备份",
  description: "自动导出全量数据到指定格式（JSON/Markdown）",
  version: "1.0.0",
  category: "builtin",

  triggers: [
    {
      type: "schedule",
      schedule: {
        type: "cron",
        value: "0 3 * * 0", // 每周日 03:00
      },
    },
    {
      type: "manual",
    },
    {
      type: "conversation",
      patterns: ["备份数据", "导出备份", "数据备份", "全量导出"],
    },
  ],

  steps: [
    {
      id: "count_data",
      name: "统计数据量",
      type: "skill",
      config: {
        skillId: "count_bookmarks",
        inputMapping: {
          scope: "all",
          includeStats: true,
        },
        outputMapping: {
          totalCount: "bookmarkCount",
          folderCount: "folderCount",
          tagCount: "tagCount",
        },
      },
    },
    {
      id: "export_json",
      name: "导出 JSON 格式",
      type: "skill",
      config: {
        skillId: "data_export",
        inputMapping: {
          format: "json",
          scope: "all",
          includeMetadata: true,
          includeSnapshots: false,
        },
        outputMapping: {
          filePath: "jsonBackupPath",
          fileSize: "jsonFileSize",
        },
      },
    },
    {
      id: "export_markdown",
      name: "导出 Markdown 格式",
      type: "skill",
      config: {
        skillId: "data_export",
        inputMapping: {
          format: "markdown",
          scope: "all",
          groupBy: "folder",
        },
        outputMapping: {
          filePath: "markdownBackupPath",
          fileSize: "markdownFileSize",
        },
      },
    },
    {
      id: "cleanup_old_backups",
      name: "清理旧备份",
      type: "skill",
      config: {
        skillId: "cleanup_backups",
        inputMapping: {
          keepCount: 4, // 保留最近 4 次备份
        },
        outputMapping: {
          deletedCount: "cleanedBackups",
        },
      },
      onError: "continue",
    },
    {
      id: "send_notification",
      name: "发送完成通知",
      type: "notification",
      config: {
        toolName: "send_notification",
        args: {
          template: "backup_complete",
          variables: [
            "bookmarkCount",
            "jsonBackupPath",
            "markdownBackupPath",
            "jsonFileSize",
            "markdownFileSize",
          ],
        },
      },
    },
  ],

  config: {
    timeout: 300000, // 5 分钟
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};
