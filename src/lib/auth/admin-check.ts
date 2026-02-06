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
 * @security
 * - 🔒 安全修复 v1.1.0: 移除开发环境绕过逻辑
 * - 所有环境都必须通过 ADMIN_EMAILS 配置管理员
 * - 防止误配置导致的权限提升
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

  // 🔒 安全修复：移除开发环境绕过逻辑
  // 所有环境都必须显式配置 ADMIN_EMAILS
  if (adminEmails.length === 0) {
    // 未配置管理员列表时，记录警告但不授予权限
    if (process.env.NODE_ENV === "development") {
      // 开发环境静默处理，避免日志噪音
    }
    return false;
  }

  return adminEmails.includes(email.toLowerCase());
}
