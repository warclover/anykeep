/**
 * Trust Mode Stats API
 * V4.2 托管模式统计 API
 *
 * @description 提供托管模式详细统计数据
 * - GET: 获取详细统计（自动决策数、用户纠正数、待确认数、效率指标等）
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import { TRUST_MODE_INFO } from "@/types/trust-mode";

// ============================================================================
// 类型定义
// ============================================================================

interface TrustModeStats {
  /** 当前模式 */
  mode: string;
  /** 模式显示信息 */
  modeInfo: {
    label: string;
    description: string;
  };
  /** 核心统计 */
  core: {
    /** AI 自动决策次数 */
    autoDecisions: number;
    /** 用户手动纠正次数 */
    userCorrections: number;
    /** 待确认消息数量 */
    pendingConfirmations: number;
    /** 纠正率（用户纠正 / 总决策） */
    correctionRate: number;
    /** AI 准确率（1 - 纠正率） */
    accuracyRate: number;
  };
  /** 效率指标 */
  efficiency: {
    /** AI 节省的手动操作次数（估算） */
    savedOperations: number;
    /** 节省的时间（分钟，估算每次操作 30 秒） */
    savedTimeMinutes: number;
    /** 自动化率 */
    automationRate: number;
  };
  /** 趋势数据（可选，需要更多数据支持） */
  trend?: {
    /** 近 7 天的纠正率变化 */
    weeklyCorrection: number[];
    /** 近 7 天的自动决策数 */
    weeklyAutoDecisions: number[];
  };
}

// ============================================================================
// GET - 获取托管模式详细统计
// ============================================================================

export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const effectiveConfig = await trustModeService.getEffectiveConfig(userId);
  const { mode, stats } = effectiveConfig;

  // 计算效率指标
  const totalDecisions = stats.autoDecisions + stats.userCorrections;
  const accuracyRate = totalDecisions > 0 ? 1 - stats.correctionRate : 1;

  // 估算节省的操作次数（仅自动决策中未被纠正的）
  const effectiveAutoDecisions = Math.max(
    0,
    stats.autoDecisions - stats.userCorrections,
  );
  // 每次手动分类估计需要 30 秒
  const savedTimeMinutes = (effectiveAutoDecisions * 30) / 60;

  // 自动化率
  const automationRate =
    totalDecisions > 0 ? stats.autoDecisions / totalDecisions : 0;

  const statsResponse: TrustModeStats = {
    mode,
    modeInfo: {
      label: TRUST_MODE_INFO[mode].label,
      description: TRUST_MODE_INFO[mode].description,
    },
    core: {
      autoDecisions: stats.autoDecisions,
      userCorrections: stats.userCorrections,
      pendingConfirmations: stats.pendingConfirmations,
      correctionRate: Math.round(stats.correctionRate * 100) / 100,
      accuracyRate: Math.round(accuracyRate * 100) / 100,
    },
    efficiency: {
      savedOperations: effectiveAutoDecisions,
      savedTimeMinutes: Math.round(savedTimeMinutes * 10) / 10,
      automationRate: Math.round(automationRate * 100) / 100,
    },
  };

  return NextResponse.json({
    success: true,
    data: statsResponse,
  });
});
