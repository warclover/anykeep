/**
 * RPC 函数注册表
 *
 * 管理版本化的 RPC 函数，支持：
 * - 多版本共存
 * - 版本协商
 * - 优雅降级
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type {
  RPCFunctionDef,
  RPCRegistry,
  RPCVersionMeta,
  SemanticVersion,
  VersionNegotiationResult,
} from "./types";
import { logger } from "@/lib/logger";

/**
 * 解析版本字符串为语义化版本
 */
export function parseVersion(version: string): SemanticVersion | null {
  // 支持格式: v1, v1.0, v1.0.0, 1, 1.0, 1.0.0
  const match = version.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2] ?? "0", 10),
    patch: parseInt(match[3] ?? "0", 10),
  };
}

/**
 * 比较两个版本
 * @returns 负数表示 a < b，正数表示 a > b，0 表示相等
 */
export function compareVersions(
  a: SemanticVersion,
  b: SemanticVersion,
): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * 格式化版本号
 */
export function formatVersion(version: SemanticVersion): string {
  return `v${version.major}.${version.minor}.${version.patch}`;
}

/**
 * RPC 函数注册表类
 */
class RPCFunctionRegistry {
  private registry: RPCRegistry = {};
  private defaultVersions: Map<string, string> = new Map();
  private log = logger.child({ namespace: "rpc-registry" });

  /**
   * 注册 RPC 函数
   *
   * @param family - 函数族名称（如 "batch_add_tags"）
   * @param def - 函数定义
   */
  register(family: string, def: RPCFunctionDef): void {
    if (!this.registry[family]) {
      this.registry[family] = {};
    }

    const version = def.meta.version;
    this.registry[family][version] = def;

    // 更新默认版本（取最新的稳定版本）
    this.updateDefaultVersion(family);

    this.log.debug(
      { family, version, status: def.meta.status },
      "RPC function registered",
    );
  }

  /**
   * 批量注册 RPC 函数
   */
  registerMany(
    definitions: Array<{ family: string; def: RPCFunctionDef }>,
  ): void {
    for (const { family, def } of definitions) {
      this.register(family, def);
    }
  }

  /**
   * 获取函数定义
   *
   * @param family - 函数族名称
   * @param version - 请求的版本（可选）
   */
  get(family: string, version?: string): RPCFunctionDef | null {
    const familyDefs = this.registry[family];
    if (!familyDefs) return null;

    if (version && familyDefs[version]) {
      return familyDefs[version];
    }

    // 返回默认版本
    const defaultVersion = this.defaultVersions.get(family);
    if (defaultVersion && familyDefs[defaultVersion]) {
      return familyDefs[defaultVersion];
    }

    return null;
  }

  /**
   * 版本协商
   *
   * @param family - 函数族名称
   * @param requestedVersion - 客户端请求的版本
   */
  negotiate(
    family: string,
    requestedVersion: string | null,
  ): VersionNegotiationResult | null {
    const familyDefs = this.registry[family];
    if (!familyDefs) return null;

    const defaultVersion = this.defaultVersions.get(family) || "v1";

    // 如果没有请求特定版本，使用默认版本
    if (!requestedVersion) {
      return {
        requestedVersion: null,
        resolvedVersion: defaultVersion,
        isFallback: false,
      };
    }

    // 检查请求的版本是否存在
    if (familyDefs[requestedVersion]) {
      const def = familyDefs[requestedVersion];
      const result: VersionNegotiationResult = {
        requestedVersion,
        resolvedVersion: requestedVersion,
        isFallback: false,
      };

      // 添加废弃警告
      if (def.meta.status === "deprecated") {
        result.deprecationWarning = this.buildDeprecationWarning(def.meta);
      }

      return result;
    }

    // 版本不存在，尝试降级到默认版本
    this.log.warn(
      { family, requestedVersion, fallbackVersion: defaultVersion },
      "Requested version not found, falling back to default",
    );

    return {
      requestedVersion,
      resolvedVersion: defaultVersion,
      isFallback: true,
    };
  }

  /**
   * 获取函数的实际数据库名称
   *
   * 根据版本返回对应的数据库函数名
   * 例如：batch_add_tags_v2
   */
  getDBFunctionName(family: string, version: string): string {
    const def = this.get(family, version);
    if (def) {
      return def.name;
    }
    // 默认返回原始名称（无版本后缀）
    return family;
  }

  /**
   * 获取所有已注册的函数族
   */
  getFamilies(): string[] {
    return Object.keys(this.registry);
  }

  /**
   * 获取函数族的所有版本
   */
  getVersions(family: string): string[] {
    const familyDefs = this.registry[family];
    if (!familyDefs) return [];
    return Object.keys(familyDefs).sort((a, b) => {
      const va = parseVersion(a);
      const vb = parseVersion(b);
      if (!va || !vb) return 0;
      return compareVersions(va, vb);
    });
  }

  /**
   * 获取函数族的默认版本
   */
  getDefaultVersion(family: string): string | undefined {
    return this.defaultVersions.get(family);
  }

  /**
   * 检查版本是否已废弃
   */
  isDeprecated(family: string, version: string): boolean {
    const def = this.get(family, version);
    return def?.meta.status === "deprecated" || def?.meta.status === "sunset";
  }

  /**
   * 获取注册表统计信息
   */
  getStats(): {
    totalFamilies: number;
    totalVersions: number;
    deprecatedVersions: number;
  } {
    let totalVersions = 0;
    let deprecatedVersions = 0;

    for (const family of Object.values(this.registry)) {
      for (const def of Object.values(family)) {
        totalVersions++;
        if (def.meta.status !== "stable") {
          deprecatedVersions++;
        }
      }
    }

    return {
      totalFamilies: Object.keys(this.registry).length,
      totalVersions,
      deprecatedVersions,
    };
  }

  /**
   * 更新默认版本（选择最新的稳定版本）
   */
  private updateDefaultVersion(family: string): void {
    const versions = this.getVersions(family);
    const stableVersions = versions.filter((v) => {
      const def = this.registry[family][v];
      return def.meta.status === "stable";
    });

    if (stableVersions.length > 0) {
      // 选择最新的稳定版本
      this.defaultVersions.set(
        family,
        stableVersions[stableVersions.length - 1],
      );
    } else if (versions.length > 0) {
      // 没有稳定版本，选择最新版本
      this.defaultVersions.set(family, versions[versions.length - 1]);
    }
  }

  /**
   * 构建废弃警告消息
   */
  private buildDeprecationWarning(meta: RPCVersionMeta): string {
    let warning = `Version ${meta.version} is deprecated`;

    if (meta.deprecatedAt) {
      warning += ` since ${meta.deprecatedAt}`;
    }

    if (meta.sunsetAt) {
      warning += `. It will be removed on ${meta.sunsetAt}`;
    }

    if (meta.migrationGuide) {
      warning += `. Migration guide: ${meta.migrationGuide}`;
    }

    return warning;
  }
}

// 导出单例
export const rpcRegistry = new RPCFunctionRegistry();

/**
 * 创建 RPC 函数定义的便捷方法
 */
export function defineRPCFunction<TParams = unknown, TResult = unknown>(
  name: string,
  meta: RPCVersionMeta,
  options?: {
    paramsSchema?: string;
    resultSchema?: string;
    transformParams?: (params: unknown) => TParams;
    transformResult?: (result: TResult) => unknown;
  },
): RPCFunctionDef<TParams, TResult> {
  return {
    name,
    meta,
    ...options,
  };
}
