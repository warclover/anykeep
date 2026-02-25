/**
 * 登录页面 - Figma 设计版本
 * 左右分栏布局，品牌展示 + 多种登录方式
 * i18n: 所有 UI 文本通过 useUiText() 获取
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUiText } from "@/lib/i18n";
import { useOptionalUser } from "@/contexts/user-context";

export default function LoginPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const t = useUiText();
  const userContext = useOptionalUser();
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
          toast.error(t.auth.rateLimited, {
            description: data.error,
          });
          return;
        }

        // 处理登录失败
        setLoginError(data.error || t.auth.defaultLoginError);
        if (data.remaining !== undefined) {
          setRemainingAttempts(data.remaining);
        }
        toast.error(t.auth.loginFailed, {
          description: data.message || data.error,
        });
        return;
      }

      // 登录成功：先将服务端写入的新 session 同步到客户端 UserContext，再导航
      // 背景：/api/auth/login 通过服务端 signInWithPassword 写入 cookie，但客户端
      //       onAuthStateChange 不感知此操作，需要手动调用 refreshSession() 触发同步
      setRemainingAttempts(null);
      await userContext?.refreshSession();
      toast.success(t.auth.loginSuccessToast);
      router.push("/home");
      router.refresh();
    } catch {
      toast.error(t.auth.loginFailed, {
        description: t.auth.networkError,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    // TODO: 接入真实演示账号后启用
    toast.info(t.auth.demoNotAvailable, {
      description: t.auth.demoNotAvailableDesc,
    });
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
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </Button>

      {/* 登录表单 */}
      <div className="w-full max-w-md px-6 py-12 relative z-10 animate-fade-in-up">
        {/* 品牌展示 - 简洁干净 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-cyan-500 bg-clip-text text-transparent">
            AnyKeep
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Keep Smart. Read Anytime.
          </p>
        </div>

        <Card className="w-full max-w-md glass-card shadow-2xl rounded-3xl border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">{t.auth.welcomeBack}</CardTitle>
            <CardDescription>{t.auth.chooseLoginMethod}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="email" className="w-full">
              <TabsList className="login-tabs grid w-full grid-cols-3 mb-6 bg-white/50 dark:bg-gray-800/50 rounded-2xl p-1">
                <TabsTrigger value="phone" disabled className="relative">
                  {t.auth.phoneTab}
                  <span className="ml-1 text-[9px] font-normal text-gray-400 dark:text-gray-500">
                    {t.auth.comingSoon}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="wechat" disabled className="relative">
                  {t.auth.wechatTab}
                  <span className="ml-1 text-[9px] font-normal text-gray-400 dark:text-gray-500">
                    {t.auth.comingSoon}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="email">{t.auth.emailTab}</TabsTrigger>
              </TabsList>

              {/* 手机号登录 */}
              <TabsContent value="phone" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t.auth.phoneLabel}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pink-400" />
                    <Input
                      id="phone"
                      placeholder={t.auth.phonePlaceholder}
                      className="pl-10 login-input"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">{t.auth.codeLabel}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      placeholder={t.auth.codePlaceholder}
                      className="login-input"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                    <Button variant="outline" className="flex-shrink-0">
                      {t.auth.getCode}
                    </Button>
                  </div>
                </div>
                <Button
                  className="w-full gradient-button rounded-xl"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? t.auth.loggingIn : t.auth.login}
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
                        {t.auth.wechatScanTitle}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-4">
                    {t.auth.wechatScanDesc}
                  </p>
                  <Button
                    variant="outline"
                    className="rounded-xl bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50"
                    onClick={handleDemoLogin}
                    disabled={loading}
                  >
                    {loading ? t.auth.loggingIn : t.auth.wechatSimulate}
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
                                {t.auth.remainingAttempts.replace(
                                  "{count}",
                                  String(remainingAttempts),
                                )}
                              </p>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">{t.auth.emailLabel}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pink-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder={t.auth.emailPlaceholder}
                        className="pl-10 login-input"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t.auth.passwordLabel}</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder={t.auth.passwordPlaceholder}
                      className="login-input"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <label
                      htmlFor="remember"
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox id="remember" />
                      <span className="text-gray-600 dark:text-gray-400">
                        {t.auth.rememberMe}
                      </span>
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-pink-500 hover:text-pink-600 dark:text-pink-400"
                    >
                      {t.auth.forgotPasswordLink}
                    </Link>
                  </div>
                  <Button
                    type="submit"
                    className="w-full gradient-button font-medium rounded-xl"
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? t.auth.loggingIn : t.auth.login}
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
                  {t.auth.or}
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
                {t.auth.tryDemo}
              </Button>

              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                {t.auth.noAccount}{" "}
                <Link
                  href="/register"
                  className="text-pink-500 hover:text-pink-600 dark:text-pink-400"
                >
                  {t.auth.registerNow}
                </Link>
              </p>
            </div>

            {/* 隐私提示 */}
            <div className="mt-6 p-3 bg-white/30 dark:bg-gray-800/30 rounded-2xl border border-white/50 dark:border-gray-700/50">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {t.auth.privacyNotice}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
