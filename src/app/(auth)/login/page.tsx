/**
 * 登录页面 - Figma 设计版本
 * 左右分栏布局，品牌展示 + 多种登录方式
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Sparkles, Mail, Phone, CheckCircle2, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error('登录失败', {
          description: error.message,
        })
        return
      }

      toast.success('登录成功！')
      router.push('/home')
      router.refresh()
    } catch {
      toast.error('登录失败', {
        description: '请稍后重试',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setLoading(true)

    // 演示账号快速登录
    setTimeout(() => {
      toast.success('欢迎体验 AnyKeep！', {
        description: '演示账号已登录',
      })
      setLoading(false)
      router.push('/home')
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
      {/* 主题切换按钮 */}
      <Button
        variant="outline"
        size="sm"
        className="fixed top-4 right-4 z-50"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>

      {/* 登录表单 */}
      <div className="w-full max-w-md px-6 py-12">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">欢迎回来</CardTitle>
            <CardDescription>选择你喜欢的方式登录 AnyKeep</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="email" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="phone">手机号</TabsTrigger>
                <TabsTrigger value="wechat">微信</TabsTrigger>
                <TabsTrigger value="email">邮箱</TabsTrigger>
              </TabsList>

              {/* 手机号登录 */}
              <TabsContent value="phone" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">手机号</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      id="phone"
                      placeholder="请输入手机号"
                      className="pl-10"
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
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                    <Button variant="outline" className="flex-shrink-0">
                      获取验证码
                    </Button>
                  </div>
                </div>
                <Button className="w-full" size="lg" disabled={loading}>
                  {loading ? '登录中...' : '登录'}
                </Button>
              </TabsContent>

              {/* 微信登录 */}
              <TabsContent value="wechat" className="space-y-4">
                <div className="flex flex-col items-center py-8">
                  <div className="w-48 h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-center">
                      <div className="w-32 h-32 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center mb-3 mx-auto border-2 border-gray-200 dark:border-gray-600">
                        <span className="text-4xl">📱</span>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        微信扫码登录
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm text-center mb-4">
                    使用微信扫描二维码即可快速登录
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleDemoLogin}
                    disabled={loading}
                  >
                    {loading ? '登录中...' : '模拟微信登录'}
                  </Button>
                </div>
              </TabsContent>

              {/* 邮箱登录 */}
              <TabsContent value="email" className="space-y-4">
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱地址</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="请输入邮箱地址"
                        className="pl-10"
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
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded" />
                      <span className="text-gray-600 dark:text-gray-400">
                        记住我
                      </span>
                    </label>
                    <Link
                      href="#"
                      className="text-purple-600 hover:text-purple-700 dark:text-purple-400"
                    >
                      忘记密码？
                    </Link>
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? '登录中...' : '登录'}
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
                className="w-full"
                onClick={handleDemoLogin}
                disabled={loading}
              >
                <Sparkles className="size-4 mr-2" />
                体验演示账号
              </Button>

              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                还没有账号？{' '}
                <Link
                  href="/register"
                  className="text-purple-600 hover:text-purple-700 dark:text-purple-400"
                >
                  立即注册
                </Link>
              </p>
            </div>

            {/* 隐私提示 */}
            <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  登录即表示您同意我们的服务条款和隐私政策。我们承诺保护您的隐私，仅存储必要的元数据信息。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
