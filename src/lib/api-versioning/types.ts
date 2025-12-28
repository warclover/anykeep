/**
 * API 版本化类型定义
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

/**
 * 语义化版本号
 */
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * API 版本状态
 */
export type VersionStatus = "stable" | "deprecated" | "sunset";

/**
 * RPC 函数版本元数据
 */
export interface RPCVersionMeta {
  /** 版本号（如 "v1", "v2"） */
  version: string;
  /** 语义化版本 */
  semanticVersion: SemanticVersion;
  /** 版本状态 */
  status: VersionStatus;
  /** 发布日期 */
  releasedAt: string;
  /** 废弃日期（如果已废弃） */
  deprecatedAt?: string;
  /** 日落日期（停止服务日期） */
  sunsetAt?: string;
  /** 变更说明 */
  changelog?: string;
  /** 迁移指南（从上一版本） */
  migrationGuide?: string;
}

/**
 * RPC 函数定义
 */
export interface RPCFunctionDef<TParams = unknown, TResult = unknown> {
  /** 函数名称（数据库中的名称） */
  name: string;
  /** 版本元数据 */
  meta: RPCVersionMeta;
  /** 参数 Schema 描述 */
  paramsSchema?: string;
  /** 返回值 Schema 描述 */
  resultSchema?: string;
  /** 参数转换器（适配旧版本参数格式） */
  transformParams?: (params: unknown) => TParams;
  /** 结果转换器（适配旧版本返回格式） */
  transformResult?: (result: TResult) => unknown;
}

/**
 * RPC 函数注册表
 */
export interface RPCRegistry {
  /** 函数族名称 -> 版本 -> 函数定义 */
  [functionFamily: string]: {
    [version: string]: RPCFunctionDef;
  };
}

/**
 * API 版本协商结果
 */
export interface VersionNegotiationResult {
  /** 请求的版本 */
  requestedVersion: string | null;
  /** 实际使用的版本 */
  resolvedVersion: string;
  /** 是否使用了降级 */
  isFallback: boolean;
  /** 废弃警告（如果有） */
  deprecationWarning?: string;
}

/**
 * API 版本请求头
 */
export const VERSION_HEADERS = {
  /** 客户端请求的 API 版本 */
  ACCEPT_VERSION: "Accept-Version",
  /** 实际使用的 API 版本 */
  CONTENT_VERSION: "X-API-Version",
  /** 废弃警告 */
  DEPRECATION: "Deprecation",
  /** 日落日期 */
  SUNSET: "Sunset",
  /** 链接到迁移文档 */
  LINK: "Link",
} as const;

/**
 * 默认版本配置
 */
export const DEFAULT_VERSION_CONFIG = {
  /** 默认版本（当客户端未指定时） */
  defaultVersion: "v1",
  /** 是否允许降级到旧版本 */
  allowFallback: true,
  /** 废弃版本警告阈值（天） */
  deprecationWarningDays: 30,
} as const;
