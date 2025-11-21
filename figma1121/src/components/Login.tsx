import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Sparkles, Mail, Phone, CheckCircle2, Zap, Shield, Search, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import { useTheme } from '../contexts/ThemeContext';

export function Login() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (method: string) => {
    setIsLoading(true);
    
    // Simulate login
    setTimeout(() => {
      setIsLoading(false);
      // Set auth token for demo
      localStorage.setItem('anykeep_auth', 'demo_token_' + Date.now());
      toast.success('登录成功！', {
        description: '欢迎回到 AnyKeep',
      });
      navigate('/');
    }, 1500);
  };

  const features = [
    {
      icon: Sparkles,
      title: 'AI 智能标签',
      description: '自动分析内容并生成精准标签',
      color: 'text-purple-600 bg-purple-50',
    },
    {
      icon: Search,
      title: '语义搜索',
      description: '理解搜索意图，快速找到内容',
      color: 'text-blue-600 bg-blue-50',
    },
    {
      icon: Zap,
      title: '跨平台聚合',
      description: '统一管理所有平台收藏',
      color: 'text-orange-600 bg-orange-50',
    },
    {
      icon: Shield,
      title: '隐私保护',
      description: '仅存储元数据，安全可靠',
      color: 'text-green-600 bg-green-50',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col lg:flex-row">
      {/* Theme Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        className="fixed top-4 right-4 z-50"
        onClick={toggleTheme}
      >
        {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </Button>

      {/* Left Section - Branding & Features */}
      <div className="flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-16 py-12 lg:py-0">
        <div className="max-w-xl">
          {/* Logo & Title */}
          <div className="mb-8 md:mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Sparkles className="size-6 text-white" />
              </div>
              <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl">AnyKeep</h1>
            </div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl text-gray-900 dark:text-white mb-4">
              智能收藏管理工具
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              跨平台聚合你的收藏内容，AI 赋能智能管理
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex gap-4">
                  <div className={`w-12 h-12 rounded-lg ${feature.color} dark:opacity-80 flex items-center justify-center flex-shrink-0`}>
                    <Icon className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 dark:text-white mb-1">{feature.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 hidden lg:flex gap-12">
            <div>
              <p className="text-3xl text-gray-900 dark:text-white mb-1">10,000+</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">活跃用户</p>
            </div>
            <div>
              <p className="text-3xl text-gray-900 dark:text-white mb-1">5</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">平台支持</p>
            </div>
            <div>
              <p className="text-3xl text-gray-900 dark:text-white mb-1">94%</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">效率提升</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 md:px-12 lg:px-16 py-12">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">欢迎回来</CardTitle>
            <CardDescription>
              选择你喜欢的方式登录 AnyKeep
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="phone" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="phone">手机号</TabsTrigger>
                <TabsTrigger value="wechat">微信</TabsTrigger>
                <TabsTrigger value="email">邮箱</TabsTrigger>
              </TabsList>

              {/* Phone Login */}
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
                    />
                    <Button variant="outline" className="flex-shrink-0">
                      获取验证码
                    </Button>
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => handleLogin('phone')}
                  disabled={isLoading}
                >
                  {isLoading ? '登录中...' : '登录'}
                </Button>
              </TabsContent>

              {/* WeChat Login */}
              <TabsContent value="wechat" className="space-y-4">
                <div className="flex flex-col items-center py-8">
                  <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-center">
                      <div className="w-32 h-32 bg-white rounded-lg flex items-center justify-center mb-3 mx-auto border-2 border-gray-200">
                        <span className="text-4xl">📱</span>
                      </div>
                      <p className="text-gray-500 text-sm">微信扫码登录</p>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm text-center mb-4">
                    使用微信扫描二维码即可快速登录
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => handleLogin('wechat')}
                    disabled={isLoading}
                  >
                    {isLoading ? '登录中...' : '模拟微信登录'}
                  </Button>
                </div>
              </TabsContent>

              {/* Email Login */}
              <TabsContent value="email" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱地址</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="请输入邮箱地址"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded" />
                    <span className="text-gray-600">记住我</span>
                  </label>
                  <a href="#" className="text-purple-600 hover:text-purple-700">
                    忘记密码？
                  </a>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => handleLogin('email')}
                  disabled={isLoading}
                >
                  {isLoading ? '登录中...' : '登录'}
                </Button>
              </TabsContent>
            </Tabs>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">或</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleLogin('demo')}
                disabled={isLoading}
              >
                <Sparkles className="size-4 mr-2" />
                体验演示账号
              </Button>
              
              <p className="text-center text-sm text-gray-600">
                还没有账号？{' '}
                <a href="#" className="text-purple-600 hover:text-purple-700">
                  立即注册
                </a>
              </p>
            </div>

            {/* Privacy Notice */}
            <div className="mt-6 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600">
                  登录即表示您同意我们的服务条款和隐私政策。我们承诺保护您的隐私，仅存储必要的元数据信息。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Toaster />
    </div>
  );
}