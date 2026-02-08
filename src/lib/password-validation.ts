/**
 * 密码验证工具函数
 * 统一注册页面和重置密码页面的密码强度校验逻辑
 *
 * V4.2.31: 提取自 reset-password/page.tsx，统一密码验证标准
 */

/** 密码最低长度要求 */
export const PASSWORD_MIN_LENGTH = 8;

/** 密码强度结果 */
export interface PasswordStrengthResult {
  score: number;
  label: string;
  color: string;
}

/**
 * 检查密码强度（6 维度评分）
 *
 * 评分维度：
 * 1. 长度 >= 8
 * 2. 长度 >= 12
 * 3. 包含小写字母
 * 4. 包含大写字母
 * 5. 包含数字
 * 6. 包含特殊字符
 */
export function checkPasswordStrength(
  password: string,
): PasswordStrengthResult {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: "弱", color: "bg-red-500" };
  if (score <= 4) return { score, label: "中", color: "bg-yellow-500" };
  return { score, label: "强", color: "bg-green-500" };
}

/**
 * 验证密码是否满足最低要求
 *
 * @returns 错误消息，如果通过则返回 null
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `密码长度至少 ${PASSWORD_MIN_LENGTH} 位`;
  }
  return null;
}

/**
 * 验证两次密码输入是否匹配
 *
 * @returns 错误消息，如果匹配则返回 null
 */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string,
): string | null {
  if (password !== confirmPassword) {
    return "两次输入的密码不一致";
  }
  return null;
}
