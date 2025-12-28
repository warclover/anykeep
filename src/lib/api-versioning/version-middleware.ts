/**
 * API 版本协商中间件
 *
 * 处理 API 请求的版本协商，支持：
 * - Accept-Version 请求头
 * - 查询参数 ?version=v1
 * - 自动降级
 * - 废弃警告
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import {
  VERSION_HEADERS,
  DEFAULT_VERSION_CONFIG,
  type VersionNegotiationResult,
} from "./types";
import { rpcRegistry } from "./rpc-registry";
import { logger } from "@/lib/logger";

const log = logger.child({ namespace: "api-version" });

/**
 * 从请求中提取版本号
 */
export function extractVersion(request: NextRequest): string | null {
  // 1. 优先从 Accept-Version 头获取
  const headerVersion = request.headers.get(VERSION_HEADERS.ACCEPT_VERSION);
  if (headerVersion) {
    return normalizeVersion(headerVersion);
  }

  // 2. 从查询参数获取
  const urlVersion = request.nextUrl.searchParams.get("version");
  if (urlVersion) {
    return normalizeVersion(urlVersion);
  }

  // 3. 从 URL 路径获取 (如 /api/v2/bookmarks)
  const pathMatch = request.nextUrl.pathname.match(/\/api\/(v\d+)\//);
  if (pathMatch) {
    return pathMatch[1];
  }

  return null;
}

/**
 * 标准化版本号
 */
function normalizeVersion(version: string): string {
  // 去除空格，转小写
  const normalized = version.trim().toLowerCase();

  // 添加 v 前缀（如果没有）
  if (/^\d/.test(normalized)) {
    return `v${normalized}`;
  }

  return normalized;
}

/**
 * 添加版本响应头
 */
export function addVersionHeaders(
  response: NextResponse,
  negotiation: VersionNegotiationResult,
): NextResponse {
  // 设置实际使用的版本
  response.headers.set(
    VERSION_HEADERS.CONTENT_VERSION,
    negotiation.resolvedVersion,
  );

  // 如果是降级，添加警告
  if (negotiation.isFallback) {
    response.headers.set(
      "Warning",
      `299 - "Requested version ${negotiation.requestedVersion} not found, using ${negotiation.resolvedVersion}"`,
    );
  }

  // 添加废弃警告
  if (negotiation.deprecationWarning) {
    response.headers.set(VERSION_HEADERS.DEPRECATION, "true");
    response.headers.set(
      "Warning",
      `299 - "${negotiation.deprecationWarning}"`,
    );
  }

  return response;
}

/**
 * 版本化 RPC 调用包装器
 *
 * @example
 * ```typescript
 * const result = await versionedRPC(supabase, request, {
 *   family: "batch_add_tags",
 *   params: { p_bookmark_ids: ids, p_tags: tags },
 * });
 * ```
 */
export async function versionedRPC<TResult = unknown>(
  supabase: {
    rpc: (
      name: string,
      params?: unknown,
    ) => Promise<{ data: TResult; error: unknown }>;
  },
  request: NextRequest,
  options: {
    family: string;
    params?: unknown;
    defaultVersion?: string;
  },
): Promise<{
  data: TResult | null;
  error: unknown;
  negotiation: VersionNegotiationResult;
}> {
  const { family, params, defaultVersion } = options;

  // 提取请求版本
  const requestedVersion = extractVersion(request);

  // 版本协商
  const negotiation = rpcRegistry.negotiate(family, requestedVersion);

  if (!negotiation) {
    log.warn({ family }, "RPC function family not found in registry");
    // 如果注册表中没有，使用默认行为
    const fallbackNegotiation: VersionNegotiationResult = {
      requestedVersion,
      resolvedVersion: defaultVersion || DEFAULT_VERSION_CONFIG.defaultVersion,
      isFallback: true,
    };

    // 直接调用原始函数名
    const { data, error } = await supabase.rpc(family, params);
    return { data, error, negotiation: fallbackNegotiation };
  }

  // 获取数据库函数名
  const dbFunctionName = rpcRegistry.getDBFunctionName(
    family,
    negotiation.resolvedVersion,
  );

  // 获取函数定义（用于参数转换）
  const funcDef = rpcRegistry.get(family, negotiation.resolvedVersion);

  // 转换参数（如果有转换器）
  let transformedParams = params;
  if (funcDef?.transformParams) {
    transformedParams = funcDef.transformParams(params);
  }

  log.debug(
    {
      family,
      requestedVersion,
      resolvedVersion: negotiation.resolvedVersion,
      dbFunctionName,
    },
    "Executing versioned RPC",
  );

  // 执行 RPC 调用
  const { data, error } = await supabase.rpc(dbFunctionName, transformedParams);

  // 转换结果（如果有转换器）
  let transformedResult = data;
  if (funcDef?.transformResult && data !== null) {
    transformedResult = funcDef.transformResult(data) as TResult;
  }

  return { data: transformedResult, error, negotiation };
}

/**
 * 创建版本化 API 处理器的高阶函数
 *
 * @example
 * ```typescript
 * export const POST = withVersioning(async (request, { version, negotiation }) => {
 *   // 根据 version 执行不同逻辑
 *   return successResponse(result);
 * });
 * ```
 */
export function withVersioning<T extends NextResponse>(
  handler: (
    request: NextRequest,
    context: {
      version: string;
      negotiation: VersionNegotiationResult;
    },
  ) => Promise<T>,
) {
  return async (request: NextRequest): Promise<T> => {
    const requestedVersion = extractVersion(request);
    const version = requestedVersion || DEFAULT_VERSION_CONFIG.defaultVersion;

    const negotiation: VersionNegotiationResult = {
      requestedVersion,
      resolvedVersion: version,
      isFallback: false,
    };

    const response = await handler(request, { version, negotiation });

    // 添加版本头
    addVersionHeaders(response, negotiation);

    return response;
  };
}

/**
 * 检查版本是否在支持范围内
 */
export function isVersionSupported(
  version: string,
  options: { minVersion?: string; maxVersion?: string } = {},
): boolean {
  const { minVersion, maxVersion } = options;

  // 简单的版本比较（假设格式为 v1, v2, v3...）
  const vNum = parseInt(version.replace(/^v/, ""), 10);

  if (minVersion) {
    const minNum = parseInt(minVersion.replace(/^v/, ""), 10);
    if (vNum < minNum) return false;
  }

  if (maxVersion) {
    const maxNum = parseInt(maxVersion.replace(/^v/, ""), 10);
    if (vNum > maxNum) return false;
  }

  return true;
}
