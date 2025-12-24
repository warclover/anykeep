/**
 * 邮箱验证确认页面
 * 处理邮箱验证链接的结果展示
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CheckCircle2,
  XCircle,
  Moon,
  Sun,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { clientLogger } from "@/lib/client-logger";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const checkVerification = async () => {
      try {
        const supabase = createClient();

        // 检查 URL 参数中是否有错误
        const error = searchParams?.get("error");
        const errorDescription = searchParams?.get("error_description");

        if (error) {
          setStatus("error");
          setErrorMessage(errorDescription || "验证失败，请重试");
          return;
        }

        // 检查当前用户状态
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          setStatus("error");
          setErrorMessage("验证失败：" + authError.message);
          return;
        }

        if (user) {
          // 用户已验证
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage("验证链接无效或已过期");
        }
      } catch (err) {
        clientLogger.error({ error: err }, "Verification check error");
        setStatus("error");
        setErrorMessage("验证过程中发生错误");
      }
    };

    checkVerification();
  }, [searchParams]);

  // 成功后倒计时跳转
  useEffect(() => {
    if (status === "success" && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (status === "success" && countdown === 0) {
      router.push("/home");
    }
  }, [status, countdown, router]);

  // 加载中
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">正在验证邮箱...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 验证成功
  if (status === "success") {
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
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle2 className="size-8 text-white" />
            </div>
            <CardTitle className="text-2xl">邮箱验证成功！</CardTitle>
            <CardDescription className="text-base">
              恭喜，你的邮箱已成功验证
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700 text-center">
              <p className="text-green-900 dark:text-green-300">
                🎉 欢迎加入 AnyKeep！
              </p>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                {countdown} 秒后自动跳转到首页...
              </p>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => router.push("/home")}
            >
              立即开始使用
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 验证失败
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
          <div className="mx-auto mb-4 w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <XCircle className="size-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">验证失败</CardTitle>
          <CardDescription className="text-base">
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
            <p className="text-sm text-amber-900 dark:text-amber-300">
              💡 可能的原因：
            </p>
            <ul className="text-sm text-amber-800 dark:text-amber-400 mt-2 space-y-1 list-disc list-inside">
              <li>验证链接已过期</li>
              <li>链接已被使用过</li>
              <li>链接不完整或被修改</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Link href="/register" className="block">
              <Button className="w-full">
                <Sparkles className="size-4 mr-2" />
                重新注册
              </Button>
            </Link>
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">
                返回登录
              </Button>
            </Link>
          </div>

          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            如果问题持续存在，请联系客服支持
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="py-12 text-center">
              <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">加载中...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
