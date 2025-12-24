/**
 * 数据统计页面客户端组件
 * Phase 3: 完整功能版本
 * - 文件夹分布统计
 * - 时间对比（周环比/月同比）
 * - AI 处理统计
 * - 数据导出
 */

"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Users,
  Bookmark,
  Calendar,
  FolderOpen,
  Download,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Zap,
} from "lucide-react";
import { ClassificationHistoryCard } from "./classification-history-card";
import { useRouter } from "next/navigation";
import type { AnalyticsData, TimeComparison } from "@/lib/analytics";

interface AnalyticsPageClientProps {
  data: AnalyticsData;
  error?: string;
}

// 时间范围选项
type DateRange = "7" | "14" | "30";

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7", label: "最近 7 天" },
  { value: "14", label: "最近 14 天" },
  { value: "30", label: "最近 30 天" },
];

// 文件夹颜色
const FOLDER_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
  "#84cc16",
];

// Skill 名称映射
const SKILL_NAME_MAP: Record<string, string> = {
  knowledge_review: "知识回顾",
  data_export: "数据导出",
  insight_report: "洞察报告",
  batch_organize: "智能整理",
  search: "智能搜索",
  classify: "智能分类",
  tag: "标签生成",
  summary: "摘要生成",
};

/**
 * 格式化 Skill ID 为可读名称
 */
function formatSkillName(skillId: string): string {
  // 优先使用映射表
  if (SKILL_NAME_MAP[skillId]) {
    return SKILL_NAME_MAP[skillId];
  }
  // 将 snake_case 转换为可读格式
  return skillId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Tooltip 类型定义
interface TooltipPayload {
  value: number;
  payload: {
    date: string;
    count: number;
  };
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

interface PieTooltipPayload {
  name: string;
  value: number;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: PieTooltipPayload[];
}

// 自定义 Tooltip 组件
function CustomTooltip({
  active,
  payload,
  formatDate,
}: TooltipProps & { formatDate: (d: string) => string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {formatDate(payload[0].payload.date)}
        </p>
        <p className="text-base font-semibold text-gray-900 dark:text-white">
          {payload[0].value} 篇收藏
        </p>
      </div>
    );
  }
  return null;
}

function CustomPieTooltip({
  active,
  payload,
  totalBookmarks,
}: PieTooltipProps & { totalBookmarks: number }) {
  if (active && payload && payload.length) {
    const percentage = ((payload[0].value / totalBookmarks) * 100).toFixed(1);
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {payload[0].name}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {payload[0].value} 篇 ({percentage}%)
        </p>
      </div>
    );
  }
  return null;
}

// 趋势指示器组件
function TrendIndicator({ comparison }: { comparison: TimeComparison }) {
  const { changePercent, trend } = comparison;

  if (trend === "flat") {
    return (
      <span className="flex items-center text-xs text-gray-500">
        <Minus className="size-3 mr-0.5" />
        持平
      </span>
    );
  }

  const isUp = trend === "up";
  return (
    <span
      className={`flex items-center text-xs ${
        isUp
          ? "text-green-600 dark:text-green-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {isUp ? (
        <ArrowUpRight className="size-3 mr-0.5" />
      ) : (
        <ArrowDownRight className="size-3 mr-0.5" />
      )}
      {Math.abs(changePercent).toFixed(1)}%
    </span>
  );
}

// 统计卡片组件（带对比）
function StatCard({
  title,
  value,
  icon: Icon,
  iconBgClass,
  iconClass,
  comparison,
  comparisonLabel,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  iconBgClass: string;
  iconClass: string;
  comparison?: TimeComparison;
  comparisonLabel?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 ${iconBgClass} rounded-lg flex items-center justify-center`}
          >
            <Icon className={`size-5 sm:size-6 ${iconClass}`} />
          </div>
          <div className="flex-1">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {value}
              </p>
              {comparison && (
                <div className="flex flex-col">
                  <TrendIndicator comparison={comparison} />
                  {comparisonLabel && (
                    <span className="text-[10px] text-gray-400">
                      {comparisonLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsPageClient({ data, error }: AnalyticsPageClientProps) {
  const router = useRouter();
  const {
    stats,
    trendData,
    platformData,
    folderData,
    tagData,
    typeData,
    comparison,
    aiStats,
    skillsStats,
  } = data;

  // 时间范围选择状态
  const [dateRange, setDateRange] = useState<DateRange>("30");

  // 根据时间范围过滤趋势数据
  const filteredTrendData = useMemo(() => {
    const days = parseInt(dateRange);
    // trendData 默认是 30 天，从末尾取最近 N 天
    return trendData.slice(-days);
  }, [trendData, dateRange]);

  // 计算选择时间范围内的新增数量
  const rangeCount = useMemo(() => {
    return filteredTrendData.reduce((sum, item) => sum + item.count, 0);
  }, [filteredTrendData]);

  // 从服务层获取的统计数据
  // 注意：totalBookmarks 包含浏览器书签，contentBookmarks 不包含（与首页"全部"一致）
  const contentBookmarks = stats.contentBookmarks;
  const browserBookmarks = stats.browserBookmarks;
  const todayCount = stats.todayCount;
  const weekCount = stats.weekCount;
  const last30DaysCount = stats.last30DaysCount;

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const handleRetry = () => {
    router.refresh();
  };

  // 数据导出功能
  const handleExport = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      stats,
      trendData,
      platformData,
      folderData,
      tagData,
      typeData,
      comparison,
      aiStats,
      skillsStats,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anykeep-analytics-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 判断是否有数据：内容收藏或浏览器书签任一有数据
  const hasData = contentBookmarks > 0 || browserBookmarks > 0;
  // 总收藏数（用于饼图百分比计算）
  const totalBookmarks = stats.totalBookmarks;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold mb-2">
              数据统计
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {contentBookmarks} 篇内容收藏
              {browserBookmarks > 0 && ` · ${browserBookmarks} 条浏览器书签`}
            </p>
          </div>
          {hasData && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="flex items-center gap-2"
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">导出数据</span>
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-6">
        {error ? (
          <ErrorMessage message={error} retry={handleRetry} />
        ) : hasData ? (
          <div className="space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                title="内容收藏"
                value={contentBookmarks}
                icon={Bookmark}
                iconBgClass="bg-purple-100 dark:bg-purple-900/30"
                iconClass="text-purple-600 dark:text-purple-400"
              />
              <StatCard
                title="今日新增"
                value={todayCount}
                icon={Calendar}
                iconBgClass="bg-blue-100 dark:bg-blue-900/30"
                iconClass="text-blue-600 dark:text-blue-400"
                comparison={comparison?.daily}
                comparisonLabel="较昨日"
              />
              <StatCard
                title="本周新增"
                value={weekCount}
                icon={TrendingUp}
                iconBgClass="bg-green-100 dark:bg-green-900/30"
                iconClass="text-green-600 dark:text-green-400"
                comparison={comparison?.weekly}
                comparisonLabel="较上周"
              />
              <StatCard
                title="近30天"
                value={last30DaysCount}
                icon={Users}
                iconBgClass="bg-orange-100 dark:bg-orange-900/30"
                iconClass="text-orange-600 dark:text-orange-400"
                comparison={comparison?.monthly}
                comparisonLabel="较上月"
              />
            </div>

            {/* AI 处理统计卡片 */}
            {aiStats && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-5 text-violet-600 dark:text-violet-400" />
                    AI 处理统计
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {aiStats.classificationCount}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        分类建议
                      </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {aiStats.classificationAcceptRate}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        采纳率
                      </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {aiStats.summaryCount}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        摘要生成
                      </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {aiStats.tagCount}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        标签生成
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Skills 执行统计卡片 */}
            {skillsStats && skillsStats.totalExecutions > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="size-5 text-amber-600 dark:text-amber-400" />
                    AI Skills 执行统计
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                      （近 {skillsStats.periodDays} 天）
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* 整体统计 */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {skillsStats.totalExecutions}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          总执行次数
                        </p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {skillsStats.successRate}%
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          成功率
                        </p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {skillsStats.avgLatencyMs > 1000
                            ? `${(skillsStats.avgLatencyMs / 1000).toFixed(1)}s`
                            : `${skillsStats.avgLatencyMs}ms`}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          平均延迟
                        </p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {skillsStats.totalTokensUsed > 1000
                            ? `${(skillsStats.totalTokensUsed / 1000).toFixed(1)}K`
                            : skillsStats.totalTokensUsed}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Token 消耗
                        </p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {skillsStats.errorCount}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          错误次数
                        </p>
                      </div>
                    </div>

                    {/* 按 Skill 分组统计 */}
                    {skillsStats.bySkill.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          各 Skill 使用情况
                        </h4>
                        <div className="space-y-2">
                          {skillsStats.bySkill.slice(0, 5).map((skill) => (
                            <div
                              key={skill.skillId}
                              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                            >
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {formatSkillName(skill.skillId)}
                              </span>
                              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span>{skill.executionCount} 次</span>
                                <span className="text-green-600 dark:text-green-400">
                                  {skill.successRate}% 成功
                                </span>
                                <span>
                                  {skill.avgLatencyMs > 1000
                                    ? `${(skill.avgLatencyMs / 1000).toFixed(1)}s`
                                    : `${skill.avgLatencyMs}ms`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 收藏趋势折线图 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-purple-600 dark:text-purple-400" />
                  收藏趋势
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    （{rangeCount} 篇新增）
                  </span>
                </CardTitle>
                <Select
                  value={dateRange}
                  onValueChange={(value: DateRange) => setDateRange(value)}
                >
                  <SelectTrigger className="w-[130px] h-8 text-sm">
                    <SelectValue placeholder="选择时间" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={filteredTrendData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-gray-200 dark:stroke-gray-700"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      className="text-xs text-gray-500 dark:text-gray-400"
                    />
                    <YAxis className="text-xs text-gray-500 dark:text-gray-400" />
                    <Tooltip
                      content={<CustomTooltip formatDate={formatDate} />}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#9333ea"
                      strokeWidth={2}
                      dot={{ fill: "#9333ea", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 平台分布 & 文件夹分布 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 平台分布饼图 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="size-5 text-blue-600 dark:text-blue-400" />
                    平台分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={
                          platformData as unknown as Record<string, unknown>[]
                        }
                        cx="50%"
                        cy="45%"
                        labelLine={false}
                        label={({ percent }) =>
                          (percent || 0) > 0.05
                            ? `${((percent || 0) * 100).toFixed(0)}%`
                            : ""
                        }
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {platformData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={
                          <CustomPieTooltip totalBookmarks={totalBookmarks} />
                        }
                      />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                        wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 文件夹分布饼图 */}
              {folderData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="size-5 text-amber-600 dark:text-amber-400" />
                      文件夹分布
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={
                            folderData as unknown as Record<string, unknown>[]
                          }
                          cx="50%"
                          cy="45%"
                          labelLine={false}
                          label={({ percent }) =>
                            (percent || 0) > 0.05
                              ? `${((percent || 0) * 100).toFixed(0)}%`
                              : ""
                          }
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {folderData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={FOLDER_COLORS[index % FOLDER_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          content={
                            <CustomPieTooltip totalBookmarks={totalBookmarks} />
                          }
                        />
                        <Legend
                          layout="horizontal"
                          verticalAlign="bottom"
                          align="center"
                          wrapperStyle={{
                            fontSize: "12px",
                            paddingTop: "10px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* 内容类型 */}
            {typeData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bookmark className="size-5 text-green-600 dark:text-green-400" />
                    内容类型分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={typeData as unknown as Record<string, unknown>[]}
                        cx="50%"
                        cy="45%"
                        labelLine={false}
                        label={({ percent }) =>
                          (percent || 0) > 0.05
                            ? `${((percent || 0) * 100).toFixed(0)}%`
                            : ""
                        }
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="type"
                      >
                        {typeData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={["#8b5cf6", "#06b6d4", "#f59e0b"][index % 3]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={
                          <CustomPieTooltip totalBookmarks={totalBookmarks} />
                        }
                      />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                        wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* 热门标签排行 & 分类历史 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {tagData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="size-5 text-orange-600 dark:text-orange-400" />
                      热门标签 TOP 10
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-6">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart
                        data={tagData}
                        layout="vertical"
                        margin={{ left: 0, right: 10 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-gray-200 dark:stroke-gray-700"
                        />
                        <XAxis
                          type="number"
                          className="text-xs text-gray-500 dark:text-gray-400"
                        />
                        <YAxis
                          dataKey="tag"
                          type="category"
                          width={70}
                          tick={{ fontSize: 11 }}
                          className="text-xs text-gray-500 dark:text-gray-400"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {payload[0].payload.tag}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {payload[0].value} 次使用
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#f97316"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* 分类建议历史 */}
              <ClassificationHistoryCard />
            </div>
          </div>
        ) : (
          // 无数据空状态
          <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <TrendingUp className="size-8 text-gray-400" />
            </div>
            <h3 className="text-gray-900 dark:text-white text-lg font-medium mb-2">
              暂无统计数据
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              开始收藏内容后，这里将显示详细的数据分析
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
