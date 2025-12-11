/**
 * Toast 通知服务
 * @description L1 即时反馈层 - 使用 sonner 实现
 * @version 1.0.0
 * @since 2025-12-12
 */

import { toast as sonnerToast } from "sonner";
import type { ToastConfig } from "../types";

// ============================================
// Toast 配置常量
// ============================================

const DEFAULT_DURATION = 3000; // 3 秒
const UNDO_DURATION = 5000; // 可撤销操作 5 秒

// ============================================
// Toast 服务
// ============================================

class ToastService {
  /**
   * 显示 Toast 通知
   */
  show(config: ToastConfig): string | number {
    const {
      type,
      title,
      description,
      duration = DEFAULT_DURATION,
      undoable,
      onUndo,
      action,
    } = config;

    // 构建选项
    const options: Parameters<typeof sonnerToast>[1] = {
      duration: undoable ? UNDO_DURATION : duration,
      description,
    };

    // 添加撤销按钮
    if (undoable && onUndo) {
      options.action = {
        label: "撤销",
        onClick: onUndo,
      };
    } else if (action) {
      options.action = {
        label: action.label,
        onClick: action.onClick,
      };
    }

    // 根据类型调用不同的 toast 方法
    switch (type) {
      case "success":
        return sonnerToast.success(title, options);
      case "error":
        return sonnerToast.error(title, options);
      case "warning":
        return sonnerToast.warning(title, options);
      case "info":
        return sonnerToast.info(title, options);
      case "progress":
        return sonnerToast.loading(title, options);
      default:
        return sonnerToast(title, options);
    }
  }

  // ============================================
  // 快捷方法
  // ============================================

  /**
   * 操作成功
   */
  success(title: string, description?: string): string | number {
    return this.show({ type: "success", title, description });
  }

  /**
   * 操作失败
   */
  error(title: string, description?: string): string | number {
    return this.show({ type: "error", title, description });
  }

  /**
   * 信息提示
   */
  info(title: string, description?: string): string | number {
    return this.show({ type: "info", title, description });
  }

  /**
   * 警告提示
   */
  warning(title: string, description?: string): string | number {
    return this.show({ type: "warning", title, description });
  }

  /**
   * 进度提示（持续显示直到手动关闭）
   */
  progress(title: string, description?: string): string | number {
    return sonnerToast.loading(title, { description });
  }

  /**
   * 关闭指定 toast
   */
  dismiss(toastId: string | number): void {
    sonnerToast.dismiss(toastId);
  }

  /**
   * 关闭所有 toast
   */
  dismissAll(): void {
    sonnerToast.dismiss();
  }

  // ============================================
  // 业务场景快捷方法
  // ============================================

  /**
   * 书签保存成功
   */
  bookmarkSaved(folderName?: string): string | number {
    const title = folderName ? `已保存到「${folderName}」` : "书签已保存";
    return this.success(title);
  }

  /**
   * 分类完成（高置信度自动分类）
   */
  classificationComplete(folderName: string): string | number {
    return this.success(`已自动分类到「${folderName}」`);
  }

  /**
   * 批量操作完成
   */
  batchComplete(action: string, count: number): string | number {
    return this.success(`${action}完成`, `已处理 ${count} 条`);
  }

  /**
   * 可撤销的删除操作
   */
  deletedWithUndo(
    itemName: string,
    onUndo: () => void | Promise<void>,
  ): string | number {
    return this.show({
      type: "success",
      title: `已删除「${itemName}」`,
      undoable: true,
      onUndo,
    });
  }

  /**
   * 导入进度
   */
  importProgress(current: number, total: number): string | number {
    return this.progress(`正在导入 (${current}/${total})...`);
  }

  /**
   * 导入完成
   */
  importComplete(count: number, toastId?: string | number): string | number {
    if (toastId) {
      this.dismiss(toastId);
    }
    return this.success(`导入完成`, `成功导入 ${count} 条书签`);
  }

  /**
   * AI 处理完成
   */
  aiProcessComplete(action: string): string | number {
    return this.success(`AI ${action}完成`);
  }
}

// ============================================
// 单例导出
// ============================================

export const toastService = new ToastService();
