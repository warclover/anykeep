/**
 * 数据统计页面客户端组件
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
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
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrendingUp, Users, Bookmark, Calendar } from "lucide-react";
import { ClassificationHistoryCard } from "./classification-history-card";
import { useRouter } from "next/navigation";

interface AnalyticsData {
  trendData: { date: string; count: number }[];
  platformData: { name: string; value: number; color: string }[];
  tagData: { tag: string; count: number }[];
  typeData: { type: string; count: number }[];
}

interface AnalyticsPageClientProps {
  data: AnalyticsData;
  error?: string;
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

// 自定义 Tooltip 组件（移出主组件以避免每次渲染重新创建）
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

export function AnalyticsPageClient({ data, error }: AnalyticsPageClientProps) {
  const router = useRouter();
  const { trendData, platformData, tagData, typeData } = data;

  // 计算统计数据
  const totalBookmarks = platformData.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const todayCount = trendData[trendData.length - 1]?.count || 0;
  const weekCount = trendData
    .slice(-7)
    .reduce((sum, item) => sum + item.count, 0);
  const monthCount = trendData.reduce((sum, item) => sum + item.count, 0);

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const handleRetry = () => {
    router.refresh();
  };

  const hasData = totalBookmarks > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold mb-2">
          数据统计
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {totalBookmarks} 篇收藏的深度分析
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-6">
        {error ? (
          <ErrorMessage message={error} retry={handleRetry} />
        ) : hasData ? (
          <div className="space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <Bookmark className="size-5 sm:size-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        总收藏
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                        {totalBookmarks}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Calendar className="size-5 sm:size-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        今日新增
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                        {todayCount}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <TrendingUp className="size-5 sm:size-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        本周新增
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                        {weekCount}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                      <Users className="size-5 sm:size-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        本月新增
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                        {monthCount}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 收藏趋势折线图 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-purple-600 dark:text-purple-400" />
                  收藏趋势（最近 30 天）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
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

            {/* 平台分布 & 内容类型 */}
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
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={platformData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${((percent || 0) * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
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
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 内容类型饼图 */}
              {typeData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bookmark className="size-5 text-green-600 dark:text-green-400" />
                      内容类型
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={typeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({
                            payload,
                            percent,
                          }: {
                            payload?: { type: string };
                            percent?: number;
                          }) =>
                            `${payload?.type ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {typeData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                ["#8b5cf6", "#06b6d4", "#f59e0b"][index % 3]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>

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
