/**
 * 管理员权限检查工具
 *
 * @module auth/admin-check
 * @description 统一的管理员权限验证逻辑
 */

/**
 * 检查用户是否为管理员
 * 通过环境变量 ADMIN_EMAILS 配置，逗号分隔
 *
 * @param email - 用户邮箱
 * @returns 是否为管理员
 *
 * @example
 * ```typescript
 * if (!isAdminUser(user.email)) {
 *   return NextResponse.json({ error: '权限不足' }, { status: 403 });
 * }
 * ```
 */
export function isAdminUser(email: string | undefined): boolean {
  if (!email) return false;

  const adminEmails =
    process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) ||
    [];

  // 开发环境默认允许所有用户访问（便于调试）
  if (process.env.NODE_ENV === "development" && adminEmails.length === 0) {
    return true;
  }

  return adminEmails.includes(email.toLowerCase());
}
