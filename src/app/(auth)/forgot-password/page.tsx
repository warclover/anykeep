/**
 * 忘记密码页面
 * 用户输入邮箱，发送密码重置邮件
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  Moon,
  Sun,
  Sparkles,
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

export default function ForgotPasswordPage() {
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error("发送失败", {
          description: error.message,
        });
        return;
      }

      setSuccess(true);
      toast.success("邮件已发送！", {
        description: "请查收密码重置邮件",
      });
    } catch (error) {
      console.error("[ForgotPassword] Error:", error);
      toast.error("发送失败", {
        description: "请稍后重试",
      });
    } finally {
      setLoading(false);
    }
  };

  // 成功状态页面
  if (success) {
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
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="size-6 text-white" />
            </div>
            <CardTitle className="text-2xl">邮件已发送</CardTitle>
            <CardDescription className="text-base">
              我们已向{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {email}
              </span>{" "}
              发送了一封密码重置邮件，请查收并点击链接重置密码。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
              <p className="text-sm text-blue-900 dark:text-blue-300">
                💡
                提示：邮件可能需要几分钟才能到达。如果没有收到，请检查垃圾箱或稍后重试。
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
              <p className="text-sm text-amber-900 dark:text-amber-300">
                ⏰ 重置链接将在 24 小时后失效
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSuccess(false)}
              >
                重新发送
              </Button>
              <Link href="/login" className="block">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="size-4 mr-2" />
                  返回登录
                </Button>
              </Link>
            </div>
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
          <CardTitle className="text-2xl">忘记密码</CardTitle>
          <CardDescription>
            输入你的邮箱地址，我们将发送密码重置链接
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱地址</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "发送中..." : "发送重置链接"}
            </Button>
          </form>

          {/* 返回登录 */}
          <div className="mt-6">
            <Link href="/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="size-4 mr-2" />
                返回登录
              </Button>
            </Link>
          </div>

          {/* 帮助提示 */}
          <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600 dark:text-gray-400">
                如果你记得密码，可以直接{" "}
                <Link href="/login" className="text-purple-600 hover:underline">
                  登录
                </Link>
                。如果遇到问题，请联系客服支持。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
