/**
 * 注册页面 - Figma 设计版本
 * 与登录页面保持一致的设计风格
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Sparkles, Mail, CheckCircle2, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 验证密码
    if (password !== confirmPassword) {
      toast.error('密码不一致', {
        description: '两次输入的密码不一致',
      })
      setLoading(false)
      return
    }

    if (password.length < 6) {
      toast.error('密码长度不足', {
        description: '密码长度至少6位',
      })
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/home`,
        },
      })

      if (error) {
        toast.error('注册失败', {
          description: error.message,
        })
        return
      }

      setSuccess(true)
      toast.success('注册成功！', {
        description: '请查收验证邮件',
      })
    } catch {
      toast.error('注册失败', {
        description: '请稍后重试',
      })
    } finally {
      setLoading(false)
    }
  }

  // 成功状态页面
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="size-6 text-white" />
            </div>
            <CardTitle className="text-2xl">注册成功！</CardTitle>
            <CardDescription className="text-base">
              我们已向 <span className="font-medium text-gray-900 dark:text-white">{email}</span> 发送了一封验证邮件，请查收并点击链接完成注册。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
              <p className="text-sm text-blue-900 dark:text-blue-300">
                💡 提示：如果没有收到邮件，请检查垃圾箱或稍后重试
              </p>
            </div>
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">
                返回登录
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col lg:flex-row">
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

      {/* 左侧：品牌展示 */}
      <div className="flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-16 py-12 lg:py-0">
        <div className="max-w-xl">
          {/* Logo & 标题 */}
          <div className="mb-8 md:mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Sparkles className="size-6 text-white" />
              </div>
              <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl font-bold">
                AnyKeep
              </h1>
            </div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl text-gray-900 dark:text-white mb-4 font-semibold">
              开始你的智能收藏之旅
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              加入 10,000+ 用户，体验 AI 驱动的内容管理
            </p>
          </div>

          {/* 注册优势列表 */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="size-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-gray-900 dark:text-white font-medium mb-1">
                  永久免费使用
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  核心功能永久免费，无隐藏费用
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="size-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-gray-900 dark:text-white font-medium mb-1">
                  AI 智能整理
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  自动标签、摘要生成，告别手动整理
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="size-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-gray-900 dark:text-white font-medium mb-1">
                  隐私安全保障
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  数据加密存储，仅保存必要的元数据
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：注册表单 */}
      <div className="flex-1 flex items-center justify-center px-6 md:px-12 lg:px-16 py-12">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">创建账号</CardTitle>
            <CardDescription>填写信息，开始使用 AnyKeep</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
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
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="至少6位字符"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? '注册中...' : '创建账号'}
              </Button>
            </form>

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

            {/* 登录链接 */}
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              已有账号？{' '}
              <Link
                href="/login"
                className="text-purple-600 hover:text-purple-700 dark:text-purple-400 font-medium"
              >
                立即登录
              </Link>
            </p>

            {/* 隐私提示 */}
            <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  注册即表示您同意我们的{' '}
                  <Link href="#" className="text-purple-600 hover:underline">
                    服务条款
                  </Link>{' '}
                  和{' '}
                  <Link href="#" className="text-purple-600 hover:underline">
                    隐私政策
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
