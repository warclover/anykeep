/**
 * Unified Confirmation Hook
 *
 * 统一处理 Tool 确认和 Skill 确认的前端适配器
 * 解决 Agent/Skills 两套确认系统的前端统一问题
 *
 * ## 版本历史
 * - v2.0.0 (2025-12-24): 集成 Effect Layer ConfirmationService
 * - v1.0.0 (2025-12-24): Phase 0.3 初始实现
 *
 * ## 迁移说明
 * v2.0.0 开始，确认操作通过 ConfirmationService 处理，不再直接调用
 * `/api/agent/confirm` 端点（该端点已弃用）
 *
 * @version 2.0.0
 * @since 2025-12-24
 */

import { useCallback } from "react";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";
import type { PendingConfirmation as SkillPendingConfirmation } from "@/lib/ai-skills/orchestration/confirmation-handler";
import { confirmationService } from "@/lib/ai-skills/effects";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 类型定义
// ============================================

/**
 * 确认来源类型
 */
export type ConfirmationSource = "tool" | "skill" | "unknown";

/**
 * 统一确认格式
 */
export interface UnifiedConfirmation {
  /** 确认 ID */
  id: string;
  /** 来源类型 */
  source: ConfirmationSource;
  /** 标题 */
  title: string;
  /** 描述消息 */
  message: string;
  /** 确认选项 */
  options: Array<{
    id: string;
    label: string;
    primary?: boolean;
  }>;
  /** 预览数据 */
  preview?: unknown;
  /** 上下文数据 */
  contextData?: Record<string, unknown>;
  /** 过期时间 */
  expiresAt: Date;
  /** 原始确认对象 */
  original: PendingConfirmation | SkillPendingConfirmation;
}

/**
 * 确认响应
 */
export interface ConfirmationResponse {
  /** 是否确认 */
  confirmed: boolean;
  /** 选择的选项 ID */
  selectedOption: string;
  /** 附加数据 */
  data?: unknown;
}

/**
 * 确认操作结果
 */
export interface ConfirmationActionResult {
  /** 是否成功 */
  success: boolean;
  /** 结果消息 */
  message: string;
  /** 错误信息（如果失败） */
  error?: string;
  /** 原始响应数据 */
  data?: unknown;
}

/**
 * useUnifiedConfirmation 返回值
 */
export interface UseUnifiedConfirmationReturn {
  /** 检测确认来源 */
  detectSource: (
    confirmation: PendingConfirmation | SkillPendingConfirmation,
  ) => ConfirmationSource;
  /** 标准化确认格式 */
  normalizeConfirmation: (
    confirmation: PendingConfirmation | SkillPendingConfirmation,
  ) => UnifiedConfirmation;
  /** 处理确认操作 */
  handleConfirmation: (
    confirmation: UnifiedConfirmation,
    response: ConfirmationResponse,
  ) => Promise<ConfirmationActionResult>;
  /** 确认操作 */
  confirm: (
    confirmation: UnifiedConfirmation,
  ) => Promise<ConfirmationActionResult>;
  /** 取消操作 */
  cancel: (
    confirmation: UnifiedConfirmation,
  ) => Promise<ConfirmationActionResult>;
}

// ============================================
// 工具函数
// ============================================

/**
 * 检测确认来源
 *
 * 通过检查特征字段来判断确认类型：
 * - Tool 确认：有 toolName 和 confirmationId
 * - Skill 确认：有 skillId 或没有 toolName
 */
function detectConfirmationSource(
  confirmation: PendingConfirmation | SkillPendingConfirmation,
): ConfirmationSource {
  // PendingConfirmation (Tool) 有 toolName
  if ("toolName" in confirmation && confirmation.toolName) {
    return "tool";
  }

  // SkillPendingConfirmation 有 skillId
  if ("skillId" in confirmation && confirmation.skillId) {
    return "skill";
  }

  // 检查是否有 confirmationId（Tool 特征）vs id（Skill 特征）
  if ("confirmationId" in confirmation) {
    return "tool";
  }

  if ("id" in confirmation) {
    return "skill";
  }

  return "unknown";
}

/**
 * 获取确认 ID
 */
function getConfirmationId(
  confirmation: PendingConfirmation | SkillPendingConfirmation,
): string {
  if ("confirmationId" in confirmation) {
    return confirmation.confirmationId;
  }
  if ("id" in confirmation) {
    return confirmation.id;
  }
  return "";
}

/**
 * 标准化确认格式
 */
function normalizeToUnified(
  confirmation: PendingConfirmation | SkillPendingConfirmation,
): UnifiedConfirmation {
  const source = detectConfirmationSource(confirmation);
  const id = getConfirmationId(confirmation);

  // Tool 确认格式
  if (source === "tool") {
    const toolConfirmation = confirmation as PendingConfirmation;
    return {
      id,
      source,
      title: toolConfirmation.description || "确认操作",
      message: toolConfirmation.description || "",
      options: [
        { id: "confirm", label: "确认", primary: true },
        { id: "cancel", label: "取消" },
      ],
      preview: toolConfirmation.params,
      expiresAt: toolConfirmation.expiresAt,
      original: toolConfirmation,
    };
  }

  // Skill 确认格式
  if (source === "skill") {
    const skillConfirmation = confirmation as SkillPendingConfirmation;
    return {
      id,
      source,
      title: skillConfirmation.title,
      message: skillConfirmation.message,
      options: skillConfirmation.options.map((opt) => ({
        id: opt.id,
        label: opt.label,
        primary: opt.primary,
      })),
      preview: skillConfirmation.preview,
      contextData: skillConfirmation.contextData,
      expiresAt: skillConfirmation.expiresAt,
      original: skillConfirmation,
    };
  }

  // 未知来源 - 尽力解析
  return {
    id,
    source: "unknown",
    title: "确认操作",
    message: "",
    options: [
      { id: "confirm", label: "确认", primary: true },
      { id: "cancel", label: "取消" },
    ],
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 默认 5 分钟
    original: confirmation,
  };
}

// ============================================
// Hook 实现
// ============================================

/**
 * 统一确认处理 Hook
 *
 * 统一处理 Tool 和 Skill 两种确认系统的前端适配器。
 *
 * @example
 * ```tsx
 * const { handleConfirmation, confirm, cancel } = useUnifiedConfirmation();
 *
 * // 处理流式数据中的确认
 * const unified = normalizeConfirmation(chunk.data.confirmation);
 *
 * // 用户点击确认
 * const result = await confirm(unified);
 *
 * // 用户点击取消
 * const result = await cancel(unified);
 * ```
 */
export function useUnifiedConfirmation(): UseUnifiedConfirmationReturn {
  /**
   * 处理 Tool 确认
   *
   * v2.0.0: 使用 ConfirmationService 代替直接 API 调用
   */
  const handleToolConfirmation = useCallback(
    async (
      confirmation: UnifiedConfirmation,
      response: ConfirmationResponse,
    ): Promise<ConfirmationActionResult> => {
      try {
        clientLogger.debug(
          { confirmationId: confirmation.id, confirmed: response.confirmed },
          "handleToolConfirmation: Processing tool confirmation",
        );

        // 使用 ConfirmationService 响应确认
        const success = confirmationService.respondToConfirmation(
          confirmation.id,
          response.selectedOption,
          {
            confirmed: response.confirmed,
            source: "tool",
            originalData: response.data,
          },
        );

        if (!success) {
          clientLogger.warn(
            { confirmationId: confirmation.id },
            "handleToolConfirmation: Confirmation not found or expired",
          );
          return {
            success: false,
            message: "确认请求已过期或不存在",
            error: "CONFIRMATION_NOT_FOUND",
          };
        }

        clientLogger.info(
          {
            confirmationId: confirmation.id,
            selectedOption: response.selectedOption,
          },
          "handleToolConfirmation: Confirmation response sent",
        );

        return {
          success: true,
          message: response.confirmed ? "操作已确认" : "操作已取消",
          data: {
            confirmationId: confirmation.id,
            selectedOption: response.selectedOption,
            confirmed: response.confirmed,
          },
        };
      } catch (err) {
        clientLogger.error(
          { confirmationId: confirmation.id, error: err },
          "handleToolConfirmation: Failed to process confirmation",
        );
        return {
          success: false,
          message: "处理确认时发生错误",
          error: err instanceof Error ? err.message : "未知错误",
        };
      }
    },
    [],
  );

  /**
   * 处理 Skill 确认
   *
   * v2.0.0: 使用 ConfirmationService 统一处理
   * Skill 确认通过 ConfirmationService 响应，OrchestrationEngine 会监听结果
   */
  const handleSkillConfirmation = useCallback(
    async (
      confirmation: UnifiedConfirmation,
      response: ConfirmationResponse,
    ): Promise<ConfirmationActionResult> => {
      try {
        clientLogger.debug(
          { confirmationId: confirmation.id, confirmed: response.confirmed },
          "handleSkillConfirmation: Processing skill confirmation",
        );

        // 使用 ConfirmationService 响应确认
        const success = confirmationService.respondToConfirmation(
          confirmation.id,
          response.selectedOption,
          {
            confirmed: response.confirmed,
            source: "skill",
            contextData: confirmation.contextData,
            originalData: response.data,
          },
        );

        if (!success) {
          clientLogger.warn(
            { confirmationId: confirmation.id },
            "handleSkillConfirmation: Confirmation not found or expired",
          );
          return {
            success: false,
            message: "确认请求已过期或不存在",
            error: "CONFIRMATION_NOT_FOUND",
          };
        }

        clientLogger.info(
          {
            confirmationId: confirmation.id,
            selectedOption: response.selectedOption,
          },
          "handleSkillConfirmation: Confirmation response sent",
        );

        return {
          success: true,
          message: response.confirmed
            ? `已选择: ${response.selectedOption}`
            : "操作已取消",
          data: {
            confirmationId: confirmation.id,
            selectedOption: response.selectedOption,
            confirmed: response.confirmed,
            contextData: confirmation.contextData,
          },
        };
      } catch (err) {
        clientLogger.error(
          { confirmationId: confirmation.id, error: err },
          "handleSkillConfirmation: Failed to process confirmation",
        );
        return {
          success: false,
          message: "处理确认时发生错误",
          error: err instanceof Error ? err.message : "未知错误",
        };
      }
    },
    [],
  );

  /**
   * 统一处理确认操作
   */
  const handleConfirmation = useCallback(
    async (
      confirmation: UnifiedConfirmation,
      response: ConfirmationResponse,
    ): Promise<ConfirmationActionResult> => {
      switch (confirmation.source) {
        case "tool":
          return handleToolConfirmation(confirmation, response);
        case "skill":
          return handleSkillConfirmation(confirmation, response);
        default:
          // 未知来源，尝试 Tool 方式处理
          return handleToolConfirmation(confirmation, response);
      }
    },
    [handleToolConfirmation, handleSkillConfirmation],
  );

  /**
   * 确认操作
   */
  const confirm = useCallback(
    async (
      confirmation: UnifiedConfirmation,
    ): Promise<ConfirmationActionResult> => {
      const primaryOption =
        confirmation.options.find((o) => o.primary) || confirmation.options[0];
      return handleConfirmation(confirmation, {
        confirmed: true,
        selectedOption: primaryOption?.id || "confirm",
      });
    },
    [handleConfirmation],
  );

  /**
   * 取消操作
   */
  const cancel = useCallback(
    async (
      confirmation: UnifiedConfirmation,
    ): Promise<ConfirmationActionResult> => {
      return handleConfirmation(confirmation, {
        confirmed: false,
        selectedOption: "cancel",
      });
    },
    [handleConfirmation],
  );

  return {
    detectSource: detectConfirmationSource,
    normalizeConfirmation: normalizeToUnified,
    handleConfirmation,
    confirm,
    cancel,
  };
}

export default useUnifiedConfirmation;
