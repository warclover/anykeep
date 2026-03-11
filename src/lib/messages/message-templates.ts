/**
 * 消息模板系统
 * @description 定义各类消息的标题、内容、操作链接等模板
 */

import type { MessageType } from "./types";

// ============================================
// 模板类型定义
// ============================================

export interface MessageTemplate {
  /** 生成消息标题 */
  title: (data: Record<string, unknown>) => string;
  /** 生成消息内容（可选） */
  content?: (data: Record<string, unknown>) => string | undefined;
  /** 生成操作链接（可选） */
  actionUrl?: (data: Record<string, unknown>) => string | undefined;
  /** 操作按钮文案 */
  actionLabel?: string;
  /** 默认优先级 */
  defaultPriority?: number;
}

// ============================================
// 消息模板定义
// ============================================

export const MESSAGE_TEMPLATES: Record<MessageType, MessageTemplate> = {
  // ========== 分类相关 ==========
  classification_auto: {
    title: (data) => `已自动分类到「${data.folderName}」`,
    content: (data) => {
      const confidence = data.confidence as number;
      if (!confidence) return undefined;
      // 兼容两种格式：0-1 小数或 0-100 整数
      const percent = confidence > 1 ? confidence : confidence * 100;
      return `置信度 ${Math.round(percent)}%`;
    },
    actionUrl: (data) => `/home?bookmark=${data.bookmarkId}`,
    actionLabel: "查看",
    defaultPriority: 2,
  },

  classification_batch: {
    title: (data) => `批量分类完成：${data.successCount}/${data.totalCount} 条`,
    content: (data) => {
      const failed =
        (data.totalCount as number) - (data.successCount as number);
      return failed > 0 ? `${failed} 条未能自动分类` : "全部分类成功";
    },
    actionUrl: () => "/home",
    actionLabel: "查看",
    defaultPriority: 2,
  },

  /**
   * @deprecated V4.2 已弃用
   * 新的分类建议改用 V4.2 待确认系统（pending_confirmations 表 + ConfirmationMessageItem 组件）
   * 此模板仅为旧消息的向后兼容保留，新分类建议不再生成此类型消息
   * 旧消息点击"确认分类"会被重定向到 /messages/pending
   * @see src/lib/confirmation/confirmation.service.ts
   */
  classification_suggest: {
    title: (data) => `建议分类到「${data.folderName}」`,
    content: (data) => {
      const confidence = data.confidence as number;
      if (!confidence) return "请确认是否正确";
      // 兼容两种格式：0-1 小数或 0-100 整数
      const percent = confidence > 1 ? confidence : confidence * 100;
      return `置信度 ${Math.round(percent)}%，请确认是否正确`;
    },
    actionUrl: (data) => `/home?bookmark=${data.bookmarkId}&action=confirm`,
    actionLabel: "确认分类",
    defaultPriority: 5,
  },

  classification_failed: {
    title: () => "分类失败",
    content: (data) => `无法为书签自动分类：${data.reason || "未知原因"}`,
    actionUrl: (data) => `/home?bookmark=${data.bookmarkId}`,
    actionLabel: "手动分类",
    defaultPriority: 4,
  },

  reclassify_complete: {
    title: (data) => {
      const movedCount = data.movedCount as number;
      const suggestionsCreated = data.suggestionsCreated as number;
      if (movedCount > 0 && suggestionsCreated > 0) {
        return `一键分类完成：已移动 ${movedCount} 条，${suggestionsCreated} 条待确认`;
      } else if (movedCount > 0) {
        return `一键分类完成：已移动 ${movedCount} 条书签`;
      } else if (suggestionsCreated > 0) {
        return `一键分类完成：${suggestionsCreated} 条待确认`;
      } else {
        return "一键分类完成";
      }
    },
    content: (data) => {
      const processed = data.processed as number;
      const movedCount = data.movedCount as number;
      const suggestionsCreated = data.suggestionsCreated as number;
      const isFullAuto = data.isFullAuto as boolean;

      const parts: string[] = [];
      parts.push(`共分析 ${processed} 条书签`);

      if (isFullAuto) {
        if (movedCount > 0) {
          parts.push(`${movedCount} 条已自动移动`);
        }
        if (suggestionsCreated > 0) {
          parts.push(`${suggestionsCreated} 条需要确认`);
        }
      } else {
        if (suggestionsCreated > 0) {
          parts.push(`${suggestionsCreated} 条分类建议等待确认`);
        }
      }

      if (movedCount === 0 && suggestionsCreated === 0) {
        parts.push("未找到合适的分类建议");
      }

      return parts.join("，");
    },
    actionUrl: (data) => {
      const suggestionsCreated = data.suggestionsCreated as number;
      return suggestionsCreated > 0
        ? "/messages/pending"
        : "/home?folder=inbox";
    },
    actionLabel: "查看详情",
    defaultPriority: 5,
  },

  // ========== 导入相关 ==========
  import_complete: {
    title: (data) => `成功导入 ${data.successCount} 条书签`,
    content: (data) =>
      data.folderName ? `已保存到「${data.folderName}」` : undefined,
    actionUrl: () => "/home?platform=browser",
    actionLabel: "查看",
    defaultPriority: 5,
  },

  import_partial: {
    title: (data) => `导入完成，${data.failedCount} 条失败`,
    content: (data) =>
      `成功 ${data.successCount} 条，失败 ${data.failedCount} 条`,
    actionUrl: () => "/home?platform=browser",
    actionLabel: "查看详情",
    defaultPriority: 5,
  },

  import_failed: {
    title: () => "导入失败",
    content: (data) => (data.reason as string) || "请检查文件格式后重试",
    actionUrl: () => "/settings/import",
    actionLabel: "重试",
    defaultPriority: 8,
  },

  // ========== 批量操作 ==========
  batch_move: {
    title: (data) => `已移动 ${data.count} 条书签`,
    content: (data) => `移动到「${data.targetFolder}」`,
    actionUrl: (data) => `/folders/${data.folderId}`,
    actionLabel: "查看文件夹",
    defaultPriority: 2,
  },

  batch_delete: {
    title: (data) => `已删除 ${data.count} 条书签`,
    content: () => "可在垃圾箱中恢复",
    actionUrl: () => "/home?folder=trash",
    actionLabel: "查看垃圾箱",
    defaultPriority: 2,
  },

  batch_tag: {
    title: (data) => `已为 ${data.count} 条书签添加标签`,
    content: (data) => {
      const tags = data.tags as string[];
      return tags?.length ? `标签：${tags.join("、")}` : undefined;
    },
    defaultPriority: 2,
  },

  batch_restore: {
    title: (data) => `已恢复 ${data.count} 条书签`,
    content: () => "书签已从垃圾箱恢复",
    actionUrl: () => "/home",
    actionLabel: "查看",
    defaultPriority: 2,
  },

  // ========== 书签状态 ==========
  bookmark_saved: {
    title: (data) => {
      const bookmarkTitle = data.title as string;
      return bookmarkTitle?.length > 30
        ? `已保存：${bookmarkTitle.substring(0, 30)}...`
        : `已保存：${bookmarkTitle}`;
    },
    content: (data) =>
      data.folderName ? `保存到「${data.folderName}」` : undefined,
    actionUrl: (data) => `/home?bookmark=${data.bookmarkId}`,
    actionLabel: "查看",
    defaultPriority: 1,
  },

  bookmark_invalid: {
    title: (data) => `检测到 ${data.count} 个失效链接`,
    content: () => "建议清理或更新这些书签",
    actionUrl: () => "/home?folder=invalid",
    actionLabel: "查看",
    defaultPriority: 4,
  },

  bookmark_expired: {
    title: (data) => `${data.count} 条书签即将过期`,
    content: () => "请及时阅读或归档",
    actionUrl: () => "/home?sort=expires",
    actionLabel: "查看",
    defaultPriority: 4,
  },

  // ========== 文件夹操作 ==========
  folder_created: {
    title: (data) => `已创建文件夹「${data.folderName}」`,
    actionUrl: (data) => `/folders/${data.folderId}`,
    actionLabel: "查看",
    defaultPriority: 1,
  },

  folder_merged: {
    title: (data) => `已合并到「${data.targetFolder}」`,
    content: (data) => `${data.count} 条书签已迁移`,
    actionUrl: (data) => `/folders/${data.folderId}`,
    actionLabel: "查看",
    defaultPriority: 4,
  },

  // ========== 系统消息 ==========
  system_announcement: {
    title: (data) => data.title as string,
    content: (data) => data.content as string,
    actionUrl: (data) => data.url as string | undefined,
    actionLabel: "了解更多",
    defaultPriority: 8,
  },

  system_maintenance: {
    title: () => "系统维护通知",
    content: (data) =>
      (data.content as string) || "系统将进行维护，届时可能暂时无法访问",
    actionUrl: (data) => data.url as string | undefined,
    actionLabel: "了解详情",
    defaultPriority: 9,
  },

  system_update: {
    title: () => "新版本更新",
    content: (data) => (data.content as string) || "有新功能上线，快来体验吧",
    actionUrl: (data) => data.url as string | undefined,
    actionLabel: "查看更新",
    defaultPriority: 5,
  },

  // ========== 配额相关 ==========
  quota_warning: {
    title: (data) => `存储空间即将用尽 (${data.usagePercent}%)`,
    content: () => "建议清理不需要的内容或升级套餐",
    actionUrl: () => "/settings/subscription",
    actionLabel: "升级",
    defaultPriority: 7,
  },

  quota_critical: {
    title: (data) => `存储空间严重不足 (${data.usagePercent}%)`,
    content: () => "即将无法保存新内容，请立即处理",
    actionUrl: () => "/settings/subscription",
    actionLabel: "立即升级",
    defaultPriority: 9,
  },

  quota_exceeded: {
    title: () => "存储空间已用尽",
    content: () => "无法保存新内容，请清理或升级套餐",
    actionUrl: () => "/settings/subscription",
    actionLabel: "立即处理",
    defaultPriority: 10,
  },

  // ========== 用户反馈 ==========
  feedback_received: {
    title: () => "感谢您的反馈",
    content: () => "我们已收到您的反馈，会认真处理",
    defaultPriority: 2,
  },

  feedback_response: {
    title: () => "您的反馈有回复了",
    content: (data) => data.response as string,
    actionUrl: () => "/settings/feedback",
    actionLabel: "查看回复",
    defaultPriority: 5,
  },

  // ========== AI 处理 ==========
  ai_summary_complete: {
    title: () => "AI 摘要生成完成",
    content: (data) => {
      const count = data.count as number;
      return count ? `已为 ${count} 条书签生成摘要` : undefined;
    },
    actionUrl: (data) =>
      data.bookmarkId ? `/home?bookmark=${data.bookmarkId}` : "/home",
    actionLabel: "查看",
    defaultPriority: 2,
  },

  ai_tags_complete: {
    title: () => "AI 标签生成完成",
    content: (data) => {
      const count = data.count as number;
      return count ? `已为 ${count} 条书签生成标签` : undefined;
    },
    actionUrl: (data) =>
      data.bookmarkId ? `/home?bookmark=${data.bookmarkId}` : "/home",
    actionLabel: "查看",
    defaultPriority: 2,
  },

  ai_processing_failed: {
    title: () => "AI 处理失败",
    content: (data) => (data.reason as string) || "请稍后重试",
    actionUrl: (data) =>
      data.bookmarkId ? `/home?bookmark=${data.bookmarkId}` : undefined,
    actionLabel: "重试",
    defaultPriority: 4,
  },

  // ========== V4.2 新增：AI 文件夹进化 ==========
  folder_auto_created: {
    title: (data) => `✨ AI 创建了新文件夹「${data.folderName}」`,
    content: (data) => {
      const count = data.bookmarkCount as number;
      const reason = data.reason as string;
      let text = count ? `已将 ${count} 条相似收藏归类` : "";
      if (reason) {
        text += text ? `\n${reason}` : reason;
      }
      return text || undefined;
    },
    actionUrl: (data) => `/folders/${data.folderId}`,
    actionLabel: "查看",
    defaultPriority: 5,
  },

  folder_auto_split: {
    title: (data) => `✂️ AI 分拆了文件夹「${data.originalName}」`,
    content: (data) => {
      const newFolders = data.newFolders as string[];
      const reason = data.reason as string;
      let text = newFolders?.length ? `分拆为：${newFolders.join("、")}` : "";
      if (reason) {
        text += text ? `\n${reason}` : reason;
      }
      return text || undefined;
    },
    actionUrl: () => "/folders",
    actionLabel: "查看文件夹",
    defaultPriority: 5,
  },

  folder_auto_merged: {
    title: (data) => `🔗 AI 合并了 ${data.folderCount} 个文件夹`,
    content: (data) => {
      const targetName = data.targetName as string;
      const reason = data.reason as string;
      let text = targetName ? `合并到「${targetName}」` : "";
      if (reason) {
        text += text ? `\n${reason}` : reason;
      }
      return text || undefined;
    },
    actionUrl: (data) => `/folders/${data.targetFolderId}`,
    actionLabel: "查看",
    defaultPriority: 5,
  },

  folder_auto_renamed: {
    title: () => `✏️ AI 重命名了文件夹`,
    content: (data) => {
      const oldName = data.oldName as string;
      const newName = data.newName as string;
      const reason = data.reason as string;
      let text = `「${oldName}」→「${newName}」`;
      if (reason) {
        text += `\n${reason}`;
      }
      return text;
    },
    actionUrl: (data) => `/folders/${data.folderId}`,
    actionLabel: "查看",
    defaultPriority: 5,
  },

  folder_operation_undone: {
    title: (data) => `↩️ 已撤销：${data.actionLabel}`,
    content: (data) => (data.detail as string) || "操作已成功撤销",
    actionUrl: () => "/settings/ai-history",
    actionLabel: "查看历史",
    defaultPriority: 4,
  },

  ai_evolution_report: {
    title: (data) => `📊 ${data.month} 月 AI 进化报告`,
    content: (data) => {
      const classifiedCount = data.classifiedCount as number;
      const createdFolders = data.createdFolders as number;
      return `本月整理了 ${classifiedCount} 条收藏${createdFolders ? `，创建了 ${createdFolders} 个新文件夹` : ""}`;
    },
    actionUrl: () => "/settings",
    actionLabel: "查看报告",
    defaultPriority: 5,
  },

  // ========== V4.2 新增：成本监控 ==========
  cost_warning: {
    title: (data) => `⚠️ AI 使用费用接近限额 (${data.usagePercent}%)`,
    content: (data) => {
      const period = data.period as string;
      const currentCost = (data.currentCostCents as number) / 100;
      const limit = (data.limitCents as number) / 100;
      const periodLabel = period === "daily" ? "今日" : "本月";
      return `${periodLabel}已使用 $${currentCost.toFixed(2)}，限额 $${limit.toFixed(2)}`;
    },
    actionUrl: () => "/settings/usage",
    actionLabel: "查看详情",
    defaultPriority: 7,
  },

  cost_critical: {
    title: () => "🚨 AI 使用费用超出限额",
    content: (data) => {
      const period = data.period as string;
      const currentCost = (data.currentCostCents as number) / 100;
      const limit = (data.limitCents as number) / 100;
      const periodLabel = period === "daily" ? "今日" : "本月";
      return `${periodLabel}费用 $${currentCost.toFixed(2)} 已超出限额 $${limit.toFixed(2)}，部分 AI 功能可能受限`;
    },
    actionUrl: () => "/settings/usage",
    actionLabel: "立即查看",
    defaultPriority: 9,
  },

  cost_daily_exceeded: {
    title: () => "📊 今日 AI 使用费用已达上限",
    content: (data) => {
      const currentCost = (data.currentCostCents as number) / 100;
      const limit = (data.limitCents as number) / 100;
      return `今日费用 $${currentCost.toFixed(2)}（限额 $${limit.toFixed(2)}），明日将自动恢复`;
    },
    actionUrl: () => "/settings/usage",
    actionLabel: "查看使用情况",
    defaultPriority: 8,
  },

  // ========== V4.3 新增：页面监控 ==========
  page_content_changed: {
    title: (data) => {
      const pageTitle = data.pageTitle as string;
      const truncatedTitle =
        pageTitle?.length > 25
          ? `${pageTitle.substring(0, 25)}...`
          : pageTitle || "监控页面";
      return `📄 「${truncatedTitle}」内容已更新`;
    },
    content: (data) => {
      const similarityScore = data.similarityScore as number;
      const changeSummary = data.changeSummary as string;
      const parts: string[] = [];
      if (similarityScore !== undefined) {
        const changePercent = Math.round(100 - similarityScore);
        parts.push(`内容变化约 ${changePercent}%`);
      }
      if (changeSummary) {
        parts.push(changeSummary);
      }
      return parts.length > 0 ? parts.join("，") : "检测到页面内容变更";
    },
    actionUrl: (data) =>
      data.bookmarkId ? `/home?bookmark=${data.bookmarkId}` : "/monitors",
    actionLabel: "查看变更",
    defaultPriority: 5,
  },

  page_monitor_failed: {
    title: (data) => {
      const pageTitle = data.pageTitle as string;
      const truncatedTitle =
        pageTitle?.length > 25
          ? `${pageTitle.substring(0, 25)}...`
          : pageTitle || "监控页面";
      return `⚠️ 「${truncatedTitle}」检查失败`;
    },
    content: (data) => {
      const errorMessage = data.errorMessage as string;
      const consecutiveFailures = data.consecutiveFailures as number;
      const parts: string[] = [];
      if (errorMessage) {
        parts.push(errorMessage);
      }
      if (consecutiveFailures && consecutiveFailures >= 3) {
        parts.push("已暂停监控");
      } else if (consecutiveFailures) {
        parts.push(`连续失败 ${consecutiveFailures} 次`);
      }
      return parts.length > 0 ? parts.join("，") : "页面检查过程中发生错误";
    },
    actionUrl: (data) =>
      data.monitorId ? `/monitors/${data.monitorId}` : "/monitors",
    actionLabel: "查看详情",
    defaultPriority: 5,
  },

  page_monitor_quota_reached: {
    title: (data) => {
      const currentCount = data.currentCount as number;
      const maxCount = data.maxCount as number;
      return `🔔 监控配额已达上限 (${currentCount}/${maxCount})`;
    },
    content: (data) => {
      const membershipType = data.membershipType as string;
      if (membershipType === "FREE") {
        return "免费用户最多可监控 5 个页面，升级 Pro 可监控 50 个页面";
      }
      return "已达到 Pro 会员的监控配额上限";
    },
    actionUrl: (data) => {
      const membershipType = data.membershipType as string;
      return membershipType === "FREE" ? "/settings/subscription" : "/monitors";
    },
    actionLabel: "查看详情",
    defaultPriority: 7,
  },
};

// ============================================
// 工具函数
// ============================================

/**
 * 获取消息模板
 */
export function getMessageTemplate(
  type: MessageType,
): MessageTemplate | undefined {
  return MESSAGE_TEMPLATES[type];
}

/**
 * 渲染消息内容
 */
export function renderMessage(
  type: MessageType,
  data: Record<string, unknown>,
): {
  title: string;
  content: string | undefined;
  actionUrl: string | undefined;
  actionLabel: string | undefined;
  defaultPriority: number;
} | null {
  const template = MESSAGE_TEMPLATES[type];
  if (!template) {
    return null;
  }

  return {
    title: template.title(data),
    content: template.content?.(data),
    actionUrl: template.actionUrl?.(data),
    actionLabel: template.actionLabel,
    defaultPriority: template.defaultPriority ?? 1,
  };
}
