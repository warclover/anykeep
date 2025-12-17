/**
 * 登录页面 - Figma 设计版本
 * 左右分栏布局，品牌展示 + 多种登录方式
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Sparkles,
  Mail,
  Phone,
  CheckCircle2,
  Moon,
  Sun,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null,
  );

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);

    try {
      // 使用带速率限制的 API
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 处理速率限制
        if (response.status === 429) {
          setLoginError(data.error);
          setRemainingAttempts(0);
          toast.error("登录受限", {
            description: data.error,
          });
          return;
        }

        // 处理登录失败
        setLoginError(data.error || "邮箱或密码错误");
        if (data.remaining !== undefined) {
          setRemainingAttempts(data.remaining);
        }
        toast.error("登录失败", {
          description: data.message || data.error,
        });
        return;
      }

      // 登录成功，需要刷新 Supabase 客户端会话
      const supabase = createClient();
      const { error: sessionError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (sessionError) {
        toast.error("会话创建失败", {
          description: sessionError.message,
        });
        return;
      }

      setRemainingAttempts(null);
      toast.success("登录成功！");
      router.push("/home");
      router.refresh();
    } catch {
      toast.error("登录失败", {
        description: "网络错误，请稍后重试",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);

    // 演示账号快速登录
    setTimeout(() => {
      toast.success("欢迎体验 AnyKeep！", {
        description: "演示账号已登录",
      });
      setLoading(false);
      router.push("/home");
    }, 1500);
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* 柔和极光背景 */}
      <div
        className="absolute inset-0 animate-soft-aurora bg-[length:400%_400%]"
        style={{
          background:
            "linear-gradient(135deg, #e9d5ff 0%, #fbcfe8 25%, #e0f2fe 50%, #fbcfe8 75%, #e9d5ff 100%)",
          backgroundSize: "400% 400%",
        }}
      />

      {/* 暗色模式背景 */}
      <div
        className="absolute inset-0 animate-soft-aurora bg-[length:400%_400%] opacity-0 dark:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #1e3a5f 50%, #312e81 75%, #1e1b4b 100%)",
          backgroundSize: "400% 400%",
        }}
      />

      {/* 装饰光晕 - 左上 */}
      <div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl animate-orb-breathe pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(167,139,250,0.5) 0%, transparent 70%)",
        }}
      />

      {/* 装饰光晕 - 右下 */}
      <div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl animate-orb-breathe-delayed pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(6,182,212,0.4) 0%, transparent 70%)",
        }}
      />

      {/* 主题切换按钮 */}
      <Button
        variant="outline"
        size="sm"
        className="fixed top-4 right-4 z-50 glass-card rounded-full"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>

      {/* 登录表单 */}
      <div className="w-full max-w-md px-6 py-12 relative z-10 animate-fade-in-up">
        {/* Slogan - K 和 R 首字母放大突出 */}
        <div className="flex flex-col items-center select-none mb-8">
          <div className="flex items-baseline gap-0.5 flex-wrap justify-center">
            {/* Keep - K 放大 */}
            <span className="flex items-baseline">
              <span
                className="text-3xl font-bold animate-gradient-flow bg-gradient-to-r from-violet-600 via-blue-500 via-cyan-400 via-blue-500 to-violet-600 bg-[length:200%_100%] bg-clip-text text-transparent"
                style={{
                  fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
                }}
              >
                K
              </span>
              <span
                className="text-lg font-bold animate-gradient-flow bg-gradient-to-r from-violet-600 via-blue-500 via-cyan-400 via-blue-500 to-violet-600 bg-[length:200%_100%] bg-clip-text text-transparent tracking-wide"
                style={{
                  fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
                }}
              >
                eep
              </span>
            </span>
            <span
              className="text-2xl font-bold animate-gradient-flow bg-gradient-to-r from-violet-600 via-blue-500 via-cyan-400 via-blue-500 to-violet-600 bg-[length:200%_100%] bg-clip-text text-transparent tracking-tight ml-1"
              style={{
                fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
              }}
            >
              Smart.
            </span>
            {/* Read - R 放大 */}
            <span className="flex items-baseline ml-2">
              <span
                className="text-3xl font-bold animate-gradient-flow bg-gradient-to-r from-cyan-400 via-blue-500 via-violet-600 via-blue-500 to-cyan-400 bg-[length:200%_100%] bg-clip-text text-transparent"
                style={{
                  fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
                  animationDelay: "0.3s",
                }}
              >
                R
              </span>
              <span
                className="text-lg font-bold animate-gradient-flow bg-gradient-to-r from-cyan-400 via-blue-500 via-violet-600 via-blue-500 to-cyan-400 bg-[length:200%_100%] bg-clip-text text-transparent tracking-wide"
                style={{
                  fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
                  animationDelay: "0.3s",
                }}
              >
                ead
              </span>
            </span>
            <span
              className="text-2xl font-bold animate-gradient-flow bg-gradient-to-r from-cyan-400 via-blue-500 via-violet-600 via-blue-500 to-cyan-400 bg-[length:200%_100%] bg-clip-text text-transparent tracking-tight ml-1"
              style={{
                fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
                animationDelay: "0.3s",
              }}
            >
              Anytime.
            </span>
          </div>
          <div className="h-1 w-52 animate-gradient-flow bg-gradient-to-r from-violet-500 via-blue-500 via-cyan-400 via-blue-500 to-violet-500 bg-[length:200%_100%] rounded-full mt-1" />
        </div>

        <Card className="w-full max-w-md glass-card shadow-2xl rounded-3xl border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">欢迎回来</CardTitle>
            <CardDescription>选择你喜欢的方式登录 AnyKeep</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="email" className="w-full">
              <TabsList className="login-tabs grid w-full grid-cols-3 mb-6 bg-white/50 dark:bg-gray-800/50 rounded-2xl p-1">
                <TabsTrigger value="phone">手机号</TabsTrigger>
                <TabsTrigger value="wechat">微信</TabsTrigger>
                <TabsTrigger value="email">邮箱</TabsTrigger>
              </TabsList>

              {/* 手机号登录 */}
              <TabsContent value="phone" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">手机号</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pink-400" />
                    <Input
                      id="phone"
                      placeholder="请输入手机号"
                      className="pl-10 login-input"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">验证码</Label>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      placeholder="请输入验证码"
                      className="login-input"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                    <Button variant="outline" className="flex-shrink-0">
                      获取验证码
                    </Button>
                  </div>
                </div>
                <Button
                  className="w-full gradient-button rounded-xl"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? "登录中..." : "登录"}
                </Button>
              </TabsContent>

              {/* 微信登录 */}
              <TabsContent value="wechat" className="space-y-4">
                <div className="flex flex-col items-center py-6">
                  <div className="w-44 h-44 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl flex items-center justify-center mb-4 border border-pink-100 dark:border-gray-600">
                    <div className="text-center">
                      <div className="w-28 h-28 bg-white dark:bg-gray-600 rounded-xl flex items-center justify-center mb-2 mx-auto shadow-sm">
                        <div className="text-4xl">💬</div>
                      </div>
                      <p className="text-pink-500 dark:text-pink-300 text-xs font-medium">
                        扫码登录
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-4">
                    打开微信扫一扫，快速安全登录
                  </p>
                  <Button
                    variant="outline"
                    className="rounded-xl bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50"
                    onClick={handleDemoLogin}
                    disabled={loading}
                  >
                    {loading ? "登录中..." : "模拟微信登录"}
                  </Button>
                </div>
              </TabsContent>

              {/* 邮箱登录 */}
              <TabsContent value="email" className="space-y-4">
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  {/* 错误提示 */}
                  {loginError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="size-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-red-900 dark:text-red-300">
                            {loginError}
                          </p>
                          {remainingAttempts !== null &&
                            remainingAttempts > 0 && (
                              <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                                还可尝试 {remainingAttempts} 次
                              </p>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱地址</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pink-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="请输入邮箱地址"
                        className="pl-10 login-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">密码</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="请输入密码"
                      className="login-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded accent-pink-400"
                      />
                      <span className="text-gray-600 dark:text-gray-400">
                        记住我
                      </span>
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-pink-500 hover:text-pink-600 dark:text-pink-400"
                    >
                      忘记密码？
                    </Link>
                  </div>
                  <Button
                    type="submit"
                    className="w-full gradient-button font-medium rounded-xl"
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? "登录中..." : "登录"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* 分隔线 */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  或
                </span>
              </div>
            </div>

            {/* 快速操作 */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-700/50 transition-all"
                onClick={handleDemoLogin}
                disabled={loading}
              >
                <Sparkles className="size-4 mr-2 text-pink-400" />
                体验演示账号
              </Button>

              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                还没有账号？{" "}
                <Link
                  href="/register"
                  className="text-pink-500 hover:text-pink-600 dark:text-pink-400"
                >
                  立即注册
                </Link>
              </p>
            </div>

            {/* 隐私提示 */}
            <div className="mt-6 p-3 bg-white/30 dark:bg-gray-800/30 rounded-2xl border border-white/50 dark:border-gray-700/50">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  登录即表示您同意我们的服务条款和隐私政策。我们承诺保护您的隐私，仅存储必要的元数据信息。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
