/**
 * AI Skills 参数提取模块
 *
 * 提供统一的槽位（Slot）提取能力，用于从自然语言中提取结构化参数
 *
 * @module ai-skills/extraction
 * @version 1.0.0
 * @since 2026-01-10
 */

export {
  // 类型
  type SlotValueType,
  type TimeRangeValue,
  type DateRangeValue,
  type SlotDefinition,
  type SlotExtractionResult,
  type ExtractionContext,
  type SlotExtractorConfig,
  type PredefinedSlotName,

  // 预定义槽位
  COUNT_SLOT,
  TIME_RANGE_SLOT,
  AUTO_EXECUTE_SLOT,
  DETAIL_LEVEL_SLOT,
  DIFFICULTY_SLOT,
  SORT_BY_SLOT,
  GROUP_BY_SLOT,
  EXPORT_FORMAT_SLOT,
  PREDEFINED_SLOTS,

  // 槽位提取器
  SlotExtractor,

  // 工厂函数
  createSlotExtractor,
  extractSlot,
  mergeWithDefaults,
  defineSlot,
} from "./slot-extractor";
