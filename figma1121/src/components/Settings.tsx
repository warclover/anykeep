import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { platforms } from '../utils/mockData';
import { CheckCircle2, XCircle, Link as LinkIcon, Sparkles, Shield, Bell } from 'lucide-react';

export function Settings() {
  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <h2 className="text-gray-900 dark:text-white">设置</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">管理你的账号、授权和偏好设置</p>
      </header>

      <div className="px-4 md:px-8 py-4 md:py-6 max-w-4xl">
        {/* Platform Connections */}
        <Card className="mb-4 md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <LinkIcon className="size-5" />
              平台授权管理
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4">
            {platforms.map((platform) => (
              <div key={platform.id} className="flex items-center justify-between p-3 md:p-4 border border-gray-200 dark:border-gray-700 rounded-lg gap-3">
                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                  <span className="text-xl md:text-2xl flex-shrink-0">{platform.icon}</span>
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white text-sm md:text-base">{platform.name}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">
                      {platform.connected
                        ? `已收藏 ${platform.count} 条内容`
                        : '未连接'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {platform.connected ? (
                    <>
                      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 hidden md:flex">
                        <CheckCircle2 className="size-3 mr-1" />
                        已连接
                      </Badge>
                      <Button variant="outline" size="sm" className="hidden md:flex">
                        重新授权
                      </Button>
                      <Button variant="ghost" size="sm">
                        断开
                      </Button>
                    </>
                  ) : (
                    <Button size="sm">连接</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI Features */}
        <Card className="mb-4 md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Sparkles className="size-5" />
              AI智能功能
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-sm md:text-base">自动生成标签</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">AI自动分析内容并生成相关标签</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-sm md:text-base">智能摘要</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">自动生成内容核心摘要</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-sm md:text-base">语义搜索</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">理解搜索意图，提供更精准的结果</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-sm md:text-base">内容推荐</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">基于收藏习惯推荐相关内容</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card className="mb-4 md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Shield className="size-5" />
              隐私与安全
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-sm md:text-base">仅存储元数据</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">不缓存完整内容，保护隐私</p>
              </div>
              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 flex-shrink-0 text-xs">
                已启用
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-sm md:text-base">本地数据加密</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">敏感信息加密存储</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-sm md:text-base">收藏隐私</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">默认收藏内容为私密</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="mb-4 md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Bell className="size-5" />
              通知设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-sm md:text-base">收藏成功通知</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">收藏内容后显示确认提示</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-sm md:text-base">同步完成通知</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">跨设备同步完成后提醒</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-sm md:text-base">AI分析完成通知</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">标签和摘要生成完成后通知</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card className="mb-4 md:mb-6">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">订阅计划</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-900 dark:text-white text-sm md:text-base">当前计划</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">免费版</p>
              </div>
              <Badge variant="outline" className="text-xs">基础功能</Badge>
            </div>
            <Button className="w-full">
              升级到专业版 ¥19/月
            </Button>
            <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mt-2 text-center">
              解锁 AI 功能、无限收藏和高级搜索
            </p>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">账号操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full text-sm md:text-base">
              导出数据
            </Button>
            <Button variant="outline" className="w-full text-sm md:text-base">
              清空缓存
            </Button>
            <Button variant="outline" className="w-full text-red-600 hover:text-red-700 text-sm md:text-base">
              注销账号
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}