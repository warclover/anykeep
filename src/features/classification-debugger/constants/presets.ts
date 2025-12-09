/**
 * 智能分类调试工具 - 预设配置
 *
 * 提供常用的分类配置预设，方便快速切换测试
 */

import type { PresetConfigs, PresetConfigKey } from "../types/debugger.types";
import type { V3Config } from "@/lib/classification/v3/config";

/**
 * V3 模拟配置 - 禁用所有 V4 新特性
 *
 * 通过禁用 V4 特性来模拟 V3 行为，而非维护独立代码
 */
export const V3_SIMULATION_CONFIG: Partial<V3Config> = {
  // 禁用 V4.0 新增特性
  enableDynamicWeights: false, // 禁用动态权重（V4 场景权重基础）
  enableFolderFingerprint: false, // 禁用文件夹指纹增强

  // 使用 V3 阈值
  highConfidenceThreshold: 80, // V3 默认值
  mediumConfidenceThreshold: 60, // V3 默认值

  // 保留 V3 核心功能
  enableCoTPrompt: true,
  enableFeedbackLoop: false, // 调试模式禁用反馈记录
  enableKnnDirect: true,
  enableTagMatcher: true,
  enableUniversalCategories: true,
};

/**
 * 预设配置集合
 */
export const PRESET_CONFIGS: PresetConfigs = {
  /**
   * 默认配置 - V4 推荐设置
   */
  default: {
    name: "默认配置",
    description: "V4.0 推荐配置，平衡精度与速度",
    v4Config: {
      enableCoTPrompt: true,
      enableFeedbackLoop: false, // 调试模式禁用
      enableDynamicWeights: true,
      enableFolderFingerprint: true,
      enableKnnDirect: true,
      enableTagMatcher: true,
      enableUniversalCategories: true,
      highConfidenceThreshold: 80,
      mediumConfidenceThreshold: 60,
      knnDirectThreshold: 0.85,
    },
  },

  /**
   * 高精度模式 - 提高阈值，减少误分类
   */
  "high-precision": {
    name: "高精度模式",
    description: "提高置信度阈值，减少误分类，适合重要内容",
    v4Config: {
      enableCoTPrompt: true,
      enableFeedbackLoop: false,
      enableDynamicWeights: true,
      enableFolderFingerprint: true,
      enableKnnDirect: true,
      enableTagMatcher: true,
      enableUniversalCategories: true,
      highConfidenceThreshold: 90, // 提高阈值
      mediumConfidenceThreshold: 70, // 提高阈值
      knnDirectThreshold: 0.92, // 提高 k-NN 阈值
    },
  },

  /**
   * 快速模式 - 降低阈值，提高分类速度
   */
  "fast-mode": {
    name: "快速模式",
    description: "降低阈值，跳过部分计算，适合批量处理",
    v4Config: {
      enableCoTPrompt: true,
      enableFeedbackLoop: false,
      enableDynamicWeights: false, // 跳过动态权重计算
      enableFolderFingerprint: false, // 跳过指纹匹配
      enableKnnDirect: true,
      enableTagMatcher: true,
      enableUniversalCategories: true,
      highConfidenceThreshold: 70, // 降低阈值
      mediumConfidenceThreshold: 50, // 降低阈值
      knnDirectThreshold: 0.75, // 降低 k-NN 阈值
    },
  },

  /**
   * 冷启动优化 - 针对新用户场景
   */
  "cold-start-optimized": {
    name: "冷启动优化",
    description: "针对无历史数据的新用户优化配置",
    v4Config: {
      enableCoTPrompt: true,
      enableFeedbackLoop: false,
      enableDynamicWeights: false, // 无历史数据可用
      enableFolderFingerprint: false, // 无文件夹数据可用
      enableKnnDirect: false, // 无历史可比对
      enableTagMatcher: true,
      enableUniversalCategories: true, // 依赖通用分类
      highConfidenceThreshold: 75, // 适度降低阈值
      mediumConfidenceThreshold: 55,
      knnDirectThreshold: 0.8,
    },
  },
};

/**
 * 获取预设配置
 */
export function getPresetConfig(key: PresetConfigKey): Partial<V3Config> {
  return PRESET_CONFIGS[key].v4Config;
}

/**
 * 获取预设列表（用于 UI 选择）
 */
export function getPresetList(): Array<{
  key: PresetConfigKey;
  name: string;
  description: string;
}> {
  return (Object.keys(PRESET_CONFIGS) as PresetConfigKey[]).map((key) => ({
    key,
    name: PRESET_CONFIGS[key].name,
    description: PRESET_CONFIGS[key].description,
  }));
}

/**
 * 合并配置 - 自定义配置覆盖预设
 */
export function mergeConfig(
  preset: PresetConfigKey,
  customConfig?: Partial<V3Config>,
): Partial<V3Config> {
  const baseConfig = getPresetConfig(preset);
  return customConfig ? { ...baseConfig, ...customConfig } : baseConfig;
}
