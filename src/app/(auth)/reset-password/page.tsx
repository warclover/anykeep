/**
 * 重置密码页面
 * 用户通过邮件链接访问，设置新密码
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Lock,
  CheckCircle2,
  Moon,
  Sun,
  Sparkles,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

// 密码强度检查
function checkPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const passwordStrength = checkPasswordStrength(password);

  // 检查是否有有效的重置会话
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // 检查 URL 中是否有 token 参数（Supabase 会自动处理）
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1),
        );
        const accessToken = hashParams.get("access_token");
        const type = hashParams.get("type");

        if (type === "recovery" && accessToken) {
          // 有恢复 token，Supabase 会自动设置会话
          setIsValidSession(true);
        } else if (session) {
          // 已有会话（可能是从邮件链接跳转）
          setIsValidSession(true);
        } else {
          setError("重置链接无效或已过期，请重新申请");
        }
      } catch (err) {
        console.error("Session check error:", err);
        setError("验证失败，请重新申请重置链接");
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 验证密码
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (password.length < 8) {
      setError("密码长度至少 8 位");
      return;
    }

    if (passwordStrength.score <= 2) {
      setError("密码强度太弱，请使用更复杂的密码");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      toast.success("密码重置成功！", {
        description: "3 秒后跳转到登录页面",
      });

      // 3 秒后跳转到登录页
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch {
      setError("重置失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 检查会话中
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="py-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">验证重置链接...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 无效会话
  if (!isValidSession && !success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
        <Button
          variant="outline"
          size="sm"
          className="fixed top-4 right-4 z-50"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
              <AlertCircle className="size-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-2xl">链接无效</CardTitle>
            <CardDescription className="text-base">
              {error || "重置链接无效或已过期"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
              <p className="text-sm text-amber-900 dark:text-amber-300">
                💡 可能的原因：链接已使用、链接已过期（24小时）、或链接不完整
              </p>
            </div>
            <Link href="/forgot-password" className="block">
              <Button className="w-full">重新申请重置链接</Button>
            </Link>
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">
                返回登录
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 成功状态页面
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
        <Button
          variant="outline"
          size="sm"
          className="fixed top-4 right-4 z-50"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="size-6 text-white" />
            </div>
            <CardTitle className="text-2xl">密码已重置</CardTitle>
            <CardDescription className="text-base">
              你的密码已成功更新，正在跳转到登录页面...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="animate-spin w-6 h-6 border-4 border-purple-600 border-t-transparent rounded-full"></div>
            </div>
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">
                立即登录
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
      {/* 主题切换按钮 */}
      <Button
        variant="outline"
        size="sm"
        className="fixed top-4 right-4 z-50"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>

      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <Sparkles className="size-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              AnyKeep
            </span>
          </div>
          <CardTitle className="text-2xl">设置新密码</CardTitle>
          <CardDescription>请输入你的新密码，密码至少 8 位</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-900 dark:text-red-300">
                    {error}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">新密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="至少 8 位字符"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>

              {/* 密码强度指示器 */}
              {password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= passwordStrength.score
                            ? passwordStrength.color
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    密码强度：
                    <span
                      className={
                        passwordStrength.score <= 2
                          ? "text-red-500"
                          : passwordStrength.score <= 4
                            ? "text-yellow-500"
                            : "text-green-500"
                      }
                    >
                      {passwordStrength.label}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="再次输入新密码"
                  className="pl-10 pr-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>

              {/* 密码匹配提示 */}
              {confirmPassword && (
                <p
                  className={`text-xs ${password === confirmPassword ? "text-green-500" : "text-red-500"}`}
                >
                  {password === confirmPassword ? "✓ 密码匹配" : "✗ 密码不匹配"}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading || !password || !confirmPassword}
            >
              {loading ? "重置中..." : "重置密码"}
            </Button>
          </form>

          {/* 密码要求提示 */}
          <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-2">
              密码要求：
            </p>
            <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <li className={password.length >= 8 ? "text-green-500" : ""}>
                {password.length >= 8 ? "✓" : "○"} 至少 8 个字符
              </li>
              <li
                className={
                  /[a-z]/.test(password) && /[A-Z]/.test(password)
                    ? "text-green-500"
                    : ""
                }
              >
                {/[a-z]/.test(password) && /[A-Z]/.test(password) ? "✓" : "○"}{" "}
                包含大小写字母
              </li>
              <li className={/[0-9]/.test(password) ? "text-green-500" : ""}>
                {/[0-9]/.test(password) ? "✓" : "○"} 包含数字
              </li>
              <li
                className={
                  /[^a-zA-Z0-9]/.test(password) ? "text-green-500" : ""
                }
              >
                {/[^a-zA-Z0-9]/.test(password) ? "✓" : "○"} 包含特殊字符（推荐）
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
