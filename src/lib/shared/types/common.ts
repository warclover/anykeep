/**
 * 共享通用类型定义
 *
 * 跨模块使用的通用工具类型
 *
 * @module @/lib/shared/types/common
 * @version 1.0.0
 * @since 2025-12-25
 */

// ============================================
// 基础结果类型
// ============================================

/**
 * 操作结果
 *
 * 通用的操作结果包装类型
 */
export interface OperationResult<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  errorCode?: string;
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  /** 数据列表 */
  items: T[];
  /** 总数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
}

// ============================================
// 时间相关类型
// ============================================

/**
 * 时间范围
 */
export interface TimeRange {
  /** 开始时间 */
  start: Date;
  /** 结束时间 */
  end: Date;
}

/**
 * 带时间戳的实体
 */
export interface TimestampedEntity {
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

// ============================================
// ID 类型
// ============================================

/**
 * 实体 ID（数字类型，用于书签、文件夹等）
 */
export type EntityId = number;

/**
 * UUID（字符串类型，用于用户、会话等）
 */
export type UUID = string;

/**
 * 生成的 ID（带前缀的字符串，如 confirm_xxx, msg_xxx）
 */
export type GeneratedId = string;

// ============================================
// 回调类型
// ============================================

/**
 * 进度回调
 */
export type ProgressCallback = (
  step: string,
  percent: number,
  message?: string,
) => void;

/**
 * 错误回调
 */
export type ErrorCallback = (error: Error) => void;

/**
 * 完成回调
 */
export type CompleteCallback<T = void> = (result: T) => void;

// ============================================
// 工具类型
// ============================================

/**
 * 使所有属性可选（深度）
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * 使指定属性必选
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * 排除指定属性
 */
export type OmitFields<T, K extends keyof T> = Omit<T, K>;

/**
 * 字符串字面量到联合类型
 */
export type ValueOf<T> = T[keyof T];
