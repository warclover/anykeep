/**
 * AI 设置页面客户端组件
 *
 * 包含 AI Provider 状态、Skills 监控、使用统计等功能
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  Cpu,
  Activity,
  Settings2,
  ChevronLeft,
  RefreshCw,
  Sparkles,
  Clock,
  TrendingUp,
  CheckCircle,
  BarChart3,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AIProviderSettingsCard } from "@/components/settings/ai-provider-settings-card";

// ============================================
// 类型定义
// ============================================

interface AISettingsPageClientProps {
  userId: string;
}

interface SkillInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  executionCount: number;
  successRate: number;
  avgLatencyMs: number;
}

interface UsageStats {
  totalConversations: number;
  totalMessages: number;
  totalSkillExecutions: number;
  tokensUsed: number;
  estimatedCost: number;
  periodDays: number;
}

// ============================================
// Skills 监控卡片
// ============================================

function SkillsMonitorCard() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // 模拟获取 Skills 信息（实际应从 API 获取）
  useEffect(() => {
    // TODO: 替换为实际 API 调用
    const mockSkills: SkillInfo[] = [
      {
        id: "search",
        name: "搜索书签",
        description: "基于语义搜索用户的书签内容",
        category: "understanding",
        version: "1.0.0",
        executionCount: 0,
        successRate: 100,
        avgLatencyMs: 0,
      },
      {
        id: "classify",
        name: "智能分类",
        description: "自动为内容推荐分类和标签",
        category: "organizing",
        version: "1.0.0",
        executionCount: 0,
        successRate: 100,
        avgLatencyMs: 0,
      },
      {
        id: "summary",
        name: "内容摘要",
        description: "生成内容的智能摘要",
        category: "understanding",
        version: "1.0.0",
        executionCount: 0,
        successRate: 100,
        avgLatencyMs: 0,
      },
    ];

    setTimeout(() => {
      setSkills(mockSkills);
      setLoading(false);
    }, 500);
  }, []);

  const categoryLabels: Record<string, string> = {
    understanding: "理解",
    organizing: "整理",
    learning: "学习",
  };

  const categoryColors: Record<string, string> = {
    understanding:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    organizing:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    learning:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-amber-500" />
          AI Skills 状态
        </CardTitle>
        <CardDescription>已注册的 AI 技能及其运行状态</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="size-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">加载中...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="p-4 border rounded-lg bg-gray-50/50 dark:bg-gray-800/50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{skill.name}</span>
                      <Badge variant="outline" className="text-xs">
                        v{skill.version}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${categoryColors[skill.category] || ""}`}
                      >
                        {categoryLabels[skill.category] || skill.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {skill.description}
                    </p>
                  </div>
                  <CheckCircle className="size-5 text-green-500 flex-shrink-0" />
                </div>

                {/* 统计信息 */}
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Activity className="size-3" />
                    执行: {skill.executionCount} 次
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="size-3" />
                    成功率: {skill.successRate}%
                  </span>
                  {skill.avgLatencyMs > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      平均延迟: {skill.avgLatencyMs}ms
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// 使用统计卡片
// ============================================

function UsageStatsCard({ userId }: { userId: string }) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: 替换为实际 API 调用
    const mockStats: UsageStats = {
      totalConversations: 0,
      totalMessages: 0,
      totalSkillExecutions: 0,
      tokensUsed: 0,
      estimatedCost: 0,
      periodDays: 30,
    };

    setTimeout(() => {
      setStats(mockStats);
      setLoading(false);
    }, 500);
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5 text-indigo-500" />
            使用统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="size-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-5 text-indigo-500" />
          使用统计
        </CardTitle>
        <CardDescription>
          最近 {stats.periodDays} 天的 AI 使用情况
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 对话数 */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalConversations}
            </div>
            <div className="text-sm text-muted-foreground">对话数</div>
          </div>

          {/* 消息数 */}
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.totalMessages}
            </div>
            <div className="text-sm text-muted-foreground">消息数</div>
          </div>

          {/* Skill 执行数 */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.totalSkillExecutions}
            </div>
            <div className="text-sm text-muted-foreground">技能调用</div>
          </div>

          {/* Token 使用量 */}
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {(stats.tokensUsed / 1000).toFixed(1)}K
            </div>
            <div className="text-sm text-muted-foreground">Tokens</div>
          </div>
        </div>

        {/* 费用估算 */}
        <Separator className="my-4" />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">预估费用</span>
          <span className="font-medium">¥{stats.estimatedCost.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// AI 偏好设置卡片
// ============================================

function AIPreferencesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="size-5 text-gray-500" />
          AI 偏好设置
        </CardTitle>
        <CardDescription>自定义 AI 助手的行为和响应风格</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 响应风格 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">响应风格</div>
              <div className="text-xs text-muted-foreground">
                AI 回复的详细程度
              </div>
            </div>
            <Badge variant="secondary">简洁</Badge>
          </div>

          <Separator />

          {/* 自动确认 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">操作确认</div>
              <div className="text-xs text-muted-foreground">
                危险操作需要手动确认
              </div>
            </div>
            <Badge variant="secondary">开启</Badge>
          </div>

          <Separator />

          {/* 学习模式 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">个性化学习</div>
              <div className="text-xs text-muted-foreground">
                AI 根据使用习惯优化推荐
              </div>
            </div>
            <Badge variant="secondary">开启</Badge>
          </div>

          <div className="pt-2">
            <p className="text-xs text-muted-foreground text-center">
              更多设置选项即将推出
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// 主组件
// ============================================

export function AISettingsPageClient({ userId }: AISettingsPageClientProps) {
  const [activeTab, setActiveTab] = useState("providers");

  return (
    <div className="container max-w-4xl py-6">
      {/* 头部 */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="size-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="size-6 text-primary" />
            AI 设置
          </h1>
          <p className="text-muted-foreground text-sm">
            管理 AI 服务提供商、技能和使用偏好
          </p>
        </div>
      </div>

      {/* 标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="providers" className="flex items-center gap-1.5">
            <Cpu className="size-4" />
            <span className="hidden sm:inline">服务商</span>
          </TabsTrigger>
          <TabsTrigger value="skills" className="flex items-center gap-1.5">
            <Sparkles className="size-4" />
            <span className="hidden sm:inline">技能</span>
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-1.5">
            <BarChart3 className="size-4" />
            <span className="hidden sm:inline">统计</span>
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            className="flex items-center gap-1.5"
          >
            <Settings2 className="size-4" />
            <span className="hidden sm:inline">偏好</span>
          </TabsTrigger>
        </TabsList>

        {/* Provider 状态 */}
        <TabsContent value="providers" className="space-y-4">
          <AIProviderSettingsCard />
        </TabsContent>

        {/* Skills 监控 */}
        <TabsContent value="skills" className="space-y-4">
          <SkillsMonitorCard />
        </TabsContent>

        {/* 使用统计 */}
        <TabsContent value="usage" className="space-y-4">
          <UsageStatsCard userId={userId} />
        </TabsContent>

        {/* 偏好设置 */}
        <TabsContent value="preferences" className="space-y-4">
          <AIPreferencesCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
