"use client";

/**
 * Knowledge Studio - 学习统计客户端组件
 * @description Phase 3 存根 - 内化率追踪与学习统计
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Target,
  Flame,
  TrendingUp,
  BookOpen,
  Clock,
} from "lucide-react";

export function LearningPageClient() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">学习统计</h1>
          <p className="text-muted-foreground">
            追踪知识内化率，基于 SM-2 算法优化复习计划
          </p>
        </div>
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          Phase 3 开发中
        </Badge>
      </div>

      {/* 内化率概览 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">整体内化率</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--%</div>
            <Progress value={0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日待复习</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">知识点</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">连续学习</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-- 天</div>
            <p className="text-xs text-muted-foreground">最长 -- 天</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本周学习</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-- 分钟</div>
            <p className="text-xs text-muted-foreground">Phase 3 实现</p>
          </CardContent>
        </Card>
      </div>

      {/* 掌握度分布 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            掌握度分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">精通</span>
              <div className="flex items-center gap-2">
                <Progress value={0} className="w-40" />
                <span className="text-sm text-muted-foreground">-- 个</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">熟练</span>
              <div className="flex items-center gap-2">
                <Progress value={0} className="w-40" />
                <span className="text-sm text-muted-foreground">-- 个</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">熟悉</span>
              <div className="flex items-center gap-2">
                <Progress value={0} className="w-40" />
                <span className="text-sm text-muted-foreground">-- 个</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">学习中</span>
              <div className="flex items-center gap-2">
                <Progress value={0} className="w-40" />
                <span className="text-sm text-muted-foreground">-- 个</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 学习趋势占位 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            学习趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">学习曲线分析开发中</h3>
            <p className="text-muted-foreground mt-2">
              Phase 3 将实现完整的学习趋势图表和知识图谱可视化
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
