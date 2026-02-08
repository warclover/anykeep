/**
 * 服务端认证辅助函数
 * 从 Middleware 预验证的 header 获取用户信息
 * 避免重复调用 supabase.auth.getUser()
 *
 * @performance
 * - 传统 getUser() 调用: ~500-1000ms (网络请求)
 * - Header 读取: ~1ms (内存操作)
 * - 预期收益: 每页面节省 500-1000ms
 *
 * @security
 * - UUID 格式验证防止 header 注入攻击
 * - 依赖 Middleware 预验证 (x-user-verified 标志)
 * - 不信任客户端传入的 header (仅由 Middleware 设置)
 *
 * V4.2.31: 统一认证入口，消除各页面重复的认证回退逻辑
 * - 新增 getAuthenticatedUserIdWithFallback: 带 session 回退的认证（解决登录后同步延迟）
 * - 新增 getAuthenticatedUserIdFromCookies: 从 cookies 读取（RSC payload 场景）
 * - 导出 UUID_REGEX 供外部复用
 */

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/** UUID 正则表达式 (RFC 4122) - 统一导出，各页面不再重复定义 */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 获取当前用户 ID（从 Middleware 预验证 header）
 *
 * @throws 重定向到登录页（如果未认证）
 * @returns 用户 ID
 *
 * @example
 * ```ts
 * export default async function MyPage() {
 *   const userId = await getAuthenticatedUserId();
 *   // 直接使用 userId 查询数据，无需再次认证
 * }
 * ```
 */
export async function getAuthenticatedUserId(): Promise<string> {
  const headersList = await headers();
  const userId = headersList.get("x-user-id");
  const isVerified = headersList.get("x-user-verified") === "true";

  // 验证 userId 是否为有效的 UUID 格式（防止 header 注入攻击）
  if (!isVerified || !userId || !UUID_REGEX.test(userId)) {
    redirect("/login");
  }

  return userId;
}

/**
 * 获取当前用户 ID（带 session 回退机制）
 *
 * 优先从 Middleware header 读取（快速路径 ~1ms），
 * 如果失败则回退到 getSession()（慢速路径 ~500ms）。
 * 解决登录后首次请求时 session 同步延迟的问题。
 *
 * @returns 用户 ID 或 null（如果未认证）
 *
 * @example
 * ```ts
 * async function getData() {
 *   const userId = await getAuthenticatedUserIdWithFallback();
 *   if (!userId) return { error: "请先登录" };
 * }
 * ```
 */
export async function getAuthenticatedUserIdWithFallback(): Promise<
  string | null
> {
  const headersList = await headers();
  const userId = headersList.get("x-user-id");
  const isVerified = headersList.get("x-user-verified") === "true";

  if (isVerified && userId && UUID_REGEX.test(userId)) {
    return userId;
  }

  // 回退机制: header 验证失败时，尝试直接获取 session
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      logger.debug(
        { userId: session.user.id },
        "[Auth] Header fallback to getSession",
      );
      return session.user.id;
    }
  } catch (error) {
    logger.error({ error }, "[Auth] Session fallback failed");
  }

  return null;
}

/**
 * 获取当前用户 ID（从 cookies 读取，适用于 RSC payload 场景）
 *
 * 某些场景（如 cache() 内部）需要从 cookies 而非 headers 读取。
 * 带 session 回退机制。
 *
 * @returns 用户 ID 或 null（如果未认证）
 */
export async function getAuthenticatedUserIdFromCookies(): Promise<
  string | null
> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("x-user-id")?.value;
  const isVerified = cookieStore.get("x-user-verified")?.value === "true";

  if (isVerified && userId && UUID_REGEX.test(userId)) {
    return userId;
  }

  // 回退机制
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch (error) {
    logger.error({ error }, "[Auth] Cookie fallback failed");
    return null;
  }
}

/**
 * 可选地获取用户 ID（不强制登录）
 *
 * @returns 用户 ID 或 null（如果未认证）
 *
 * @example
 * ```ts
 * export default async function PublicPage() {
 *   const userId = await getOptionalUserId();
 *   // userId 可能为 null，需要处理
 * }
 * ```
 */
export async function getOptionalUserId(): Promise<string | null> {
  const headersList = await headers();
  const userId = headersList.get("x-user-id");
  const isVerified = headersList.get("x-user-verified") === "true";

  if (!isVerified || !userId || !UUID_REGEX.test(userId)) {
    return null;
  }

  return userId;
}

/**
 * 类型守卫：检查是否为认证错误
 *
 * @param error - 未知错误对象
 * @returns 是否为认证相关错误
 *
 * @example
 * ```ts
 * try {
 *   const userId = await getAuthenticatedUserId();
 * } catch (error) {
 *   if (isAuthError(error)) {
 *     // 处理认证错误
 *   }
 * }
 * ```
 */
export function isAuthError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("auth") ||
      error.message.includes("登录") ||
      error.message.includes("authenticated"))
  );
}

/**
 * 获取用户 ID 或返回默认值
 *
 * @param defaultValue - 未认证时的默认值
 * @returns 用户 ID 或默认值
 *
 * @example
 * ```ts
 * export default async function Page() {
 *   const userId = await getUserIdOrDefault("anonymous");
 * }
 * ```
 */
export async function getUserIdOrDefault(
  defaultValue: string,
): Promise<string> {
  const userId = await getOptionalUserId();
  return userId ?? defaultValue;
}
