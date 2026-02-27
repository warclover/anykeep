/**
 * AI 学习洞察页面 - 客户端组件
 *
 * 可视化展示 AI 从用户分类行为中学到的偏好和排除规则：
 * - 学习统计概览（事件数、准确率、健康评分）
 * - 排除规则列表（AI 学到的"不应做什么"）
 * - 文件夹偏好排名（AI 理解的内容归属）
 * - 来源偏好（哪些来源偏好哪个文件夹）
 * - 时间段偏好热力图
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BrainCog,
  ShieldBan,
  FolderHeart,
  Globe,
  Clock,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Pencil,
  Activity,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ==================== 常量 ====================

const TEXT = {
  title: "AI 学习洞察",
  subtitle: "查看 AI 从你的分类行为中学到了什么",
  loading: "加载学习数据中...",
  refresh: "刷新",
  noData: "暂无学习数据",
  noDataHint: "当你手动分类收藏时，AI 会自动学习你的偏好",
  tabs: {
    overview: "学习概览",
    exclusions: "排除规则",
    folders: "文件夹偏好",
    sources: "来源偏好",
  },
  stats: {
    totalEvents: "学习事件",
    accuracy: "分类准确率",
    healthScore: "系统健康",
    exclusionCount: "排除规则",
    confirmations: "确认",
    rejections: "拒绝",
    modifications: "修正",
  },
  exclusions: {
    title: "排除规则",
    description: "AI 学到的「不应该做什么」—— 这些内容不应被分到对应文件夹",
    empty: "暂无排除规则",
    emptyHint: "当你将收藏从一个文件夹移到另一个时，AI 会自动创建排除规则",
    tag: "标签",
    source: "来源",
    keyword: "关键词",
    createdFrom: {
      user_move: "手动移动",
      user_reject: "拒绝分类",
      bulk_move: "批量移动",
      auto_learn: "自动学习",
    } as Record<string, string>,
  },
  folders: {
    title: "文件夹偏好",
    description: "AI 理解的每个文件夹最适合什么类型的内容",
    empty: "暂无文件夹偏好数据",
    bookmarks: "收藏",
    topTags: "关联标签",
    topSources: "关联来源",
  },
  sources: {
    title: "来源偏好",
    description: "AI 学到的各内容来源偏好归入哪个文件夹",
    empty: "暂无来源偏好",
    samples: "样本",
    confidence: "置信度",
  },
  health: {
    title: "系统建议",
    accuracy: "分类准确率",
    confirmation: "确认率",
    fastPath: "快速路径命中",
    satisfaction: "满意度",
  },
  trends: {
    improving: "上升中",
    stable: "稳定",
    declining: "下降中",
    increasing: "增长中",
    decreasing: "减少中",
  } as Record<string, string>,
} as const;

// ==================== 类型 ====================

interface ExclusionRecord {
  id: number;
  folder_id: number;
  exclusion_type: string;
  excluded_tag: string | null;
  excluded_source_id: string | null;
  excluded_keyword: string | null;
  weight: number | null;
  created_from: string;
  created_at: string;
}

interface FolderPreference {
  folderId: number;
  folderName: string;
  usageFrequency: number;
  lastUsed: string;
  associatedTags: string[];
  associatedSources: string[];
}

interface SourcePreference {
  sourceId: string;
  sourceName: string;
  preferredFolderId: number;
  sampleCount: number;
  confirmationRate: number;
}

interface TimePreference {
  hour: number;
  topFolders: Array<{ folderId: number; count: number }>;
}

interface LearningStats {
  totalEvents: number;
  confirmations: number;
  rejections: number;
  modifications: number;
  accuracy: number;
  lastLearningTime: string | null;
}

interface HealthReport {
  overallScore: number;
  metrics: {
    classificationAccuracy: number;
    confirmationRate: number;
    fastPathHitRate: number;
    userSatisfaction: number;
  };
  trends: {
    accuracyTrend: string;
    activityTrend: string;
  };
  recommendations: string[];
}

interface InsightsData {
  exclusions: ExclusionRecord[];
  exclusionStats: {
    total: number;
    byType: Record<string, number>;
    byFolder: Record<string, number>;
  };
  preferences: {
    folderPreferences: FolderPreference[];
    sourcePreferences: SourcePreference[];
    timePreferences: TimePreference[];
  } | null;
  learningStats: LearningStats;
  healthReport: HealthReport | null;
  generatedAt: string;
}

interface AILearningPageClientProps {
  error?: string;
}

// ==================== 主组件 ====================

export function AILearningPageClient({ error }: AILearningPageClientProps) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(error ?? null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/learning/insights");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "加载失败");
      setData(json.data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!error) fetchData();
    else setIsLoading(false);
  }, [error, fetchData]);

  if (loadError) {
    return (
      <div className="container max-w-5xl mx-auto p-4 md:p-6">
        <PageHeader />
        <div className="mt-8 flex flex-col items-center gap-4 text-muted-foreground">
          <AlertCircle className="size-12 opacity-40" />
          <p>{loadError}</p>
          {!error && (
            <Button variant="outline" onClick={fetchData}>
              {TEXT.refresh}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto p-4 md:p-6">
        <PageHeader />
        <div className="mt-12 flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p>{TEXT.loading}</p>
        </div>
      </div>
    );
  }

  const hasAnyData =
    data != null &&
    (data.learningStats.totalEvents > 0 ||
      data.exclusions.length > 0 ||
      (data.preferences?.folderPreferences?.length ?? 0) > 0 ||
      (data.preferences?.sourcePreferences?.length ?? 0) > 0);

  return (
    <div className="container max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader />
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchData}
          disabled={isLoading}
        >
          <RefreshCw
            className={cn("size-4 mr-1.5", isLoading && "animate-spin")}
          />
          {TEXT.refresh}
        </Button>
      </div>

      {!data ? (
        <EmptyState />
      ) : (
        <>
          <StatsOverview
            stats={data.learningStats}
            exclusionCount={data.exclusionStats.total}
            healthScore={data.healthReport?.overallScore}
          />

          {!hasAnyData && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-6">
              <BrainCog className="size-10 opacity-20" />
              <p className="text-sm">{TEXT.noDataHint}</p>
            </div>
          )}

          <Tabs
            defaultValue={hasAnyData ? "overview" : "folders"}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">{TEXT.tabs.overview}</TabsTrigger>
              <TabsTrigger value="exclusions">
                {TEXT.tabs.exclusions}
              </TabsTrigger>
              <TabsTrigger value="folders">{TEXT.tabs.folders}</TabsTrigger>
              <TabsTrigger value="sources">{TEXT.tabs.sources}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab
                stats={data.learningStats}
                health={data.healthReport}
                timePreferences={data.preferences?.timePreferences}
              />
            </TabsContent>

            <TabsContent value="exclusions">
              <ExclusionsTab
                exclusions={data.exclusions}
                stats={data.exclusionStats}
                folderPreferences={data.preferences?.folderPreferences}
              />
            </TabsContent>

            <TabsContent value="folders">
              <FoldersTab folders={data.preferences?.folderPreferences ?? []} />
            </TabsContent>

            <TabsContent value="sources">
              <SourcesTab
                sources={data.preferences?.sourcePreferences ?? []}
                folders={data.preferences?.folderPreferences ?? []}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

// ==================== 子组件 ====================

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <BrainCog className="size-6 text-violet-500" />
        {TEXT.title}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">{TEXT.subtitle}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center gap-3 text-muted-foreground">
      <BrainCog className="size-16 opacity-20" />
      <p className="text-lg font-medium">{TEXT.noData}</p>
      <p className="text-sm max-w-md text-center">{TEXT.noDataHint}</p>
    </div>
  );
}

// ==================== 统计概览卡片 ====================

function StatsOverview({
  stats,
  exclusionCount,
  healthScore,
}: {
  stats: LearningStats;
  exclusionCount: number;
  healthScore?: number;
}) {
  const items = [
    {
      label: TEXT.stats.totalEvents,
      value: stats.totalEvents,
      icon: Activity,
      color: "text-blue-500",
    },
    {
      label: TEXT.stats.accuracy,
      value: `${Math.round(stats.accuracy)}%`,
      icon: TrendingUp,
      color: stats.accuracy >= 70 ? "text-emerald-500" : "text-amber-500",
    },
    {
      label: TEXT.stats.healthScore,
      value: healthScore != null ? `${healthScore}分` : "—",
      icon: Activity,
      color:
        (healthScore ?? 0) >= 70
          ? "text-emerald-500"
          : (healthScore ?? 0) >= 40
            ? "text-amber-500"
            : "text-red-500",
    },
    {
      label: TEXT.stats.exclusionCount,
      value: exclusionCount,
      icon: ShieldBan,
      color: "text-violet-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <item.icon className={cn("size-4", item.color)} />
              {item.label}
            </div>
            <p className="text-2xl font-bold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ==================== 概览 Tab ====================

function OverviewTab({
  stats,
  health,
  timePreferences,
}: {
  stats: LearningStats;
  health: HealthReport | null;
  timePreferences?: TimePreference[];
}) {
  const feedbackTotal =
    stats.confirmations + stats.rejections + stats.modifications;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 反馈分布 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="size-4 text-blue-500" />
            反馈分布
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedbackTotal === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              暂无反馈数据
            </p>
          ) : (
            <>
              <FeedbackBar
                icon={<CheckCircle2 className="size-4 text-emerald-500" />}
                label={TEXT.stats.confirmations}
                count={stats.confirmations}
                total={feedbackTotal}
                color="bg-emerald-500"
              />
              <FeedbackBar
                icon={<XCircle className="size-4 text-red-500" />}
                label={TEXT.stats.rejections}
                count={stats.rejections}
                total={feedbackTotal}
                color="bg-red-500"
              />
              <FeedbackBar
                icon={<Pencil className="size-4 text-amber-500" />}
                label={TEXT.stats.modifications}
                count={stats.modifications}
                total={feedbackTotal}
                color="bg-amber-500"
              />
            </>
          )}
          {stats.lastLearningTime && (
            <p className="text-xs text-muted-foreground pt-2 border-t">
              最后学习：
              {new Date(stats.lastLearningTime).toLocaleString("zh-CN")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 系统健康 + 建议 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-500" />
            {TEXT.health.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MetricItem
                  label={TEXT.health.accuracy}
                  value={health.metrics.classificationAccuracy}
                />
                <MetricItem
                  label={TEXT.health.confirmation}
                  value={health.metrics.confirmationRate}
                />
                <MetricItem
                  label={TEXT.health.fastPath}
                  value={health.metrics.fastPathHitRate}
                />
                <MetricItem
                  label={TEXT.health.satisfaction}
                  value={health.metrics.userSatisfaction}
                />
              </div>

              {health.trends && (
                <div className="flex gap-3 text-xs">
                  <span className="text-muted-foreground">
                    准确率趋势：
                    <TrendBadge trend={health.trends.accuracyTrend} />
                  </span>
                  <span className="text-muted-foreground">
                    活跃度：
                    <TrendBadge trend={health.trends.activityTrend} />
                  </span>
                </div>
              )}

              {health.recommendations.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t">
                  {health.recommendations.map((r, i) => (
                    <p
                      key={i}
                      className="text-xs text-muted-foreground flex items-start gap-1.5"
                    >
                      <Lightbulb className="size-3 mt-0.5 shrink-0 text-amber-400" />
                      {r}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              数据不足，暂无系统建议
            </p>
          )}
        </CardContent>
      </Card>

      {/* 时间偏好热力图 */}
      {timePreferences && timePreferences.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="size-4 text-cyan-500" />
              时间段偏好
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TimeHeatmap data={timePreferences} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FeedbackBar({
  icon,
  label,
  count,
  total,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="text-muted-foreground">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <Progress value={value} className="h-2 flex-1" />
        <span className="text-xs font-medium w-9 text-right">
          {Math.round(value)}%
        </span>
      </div>
    </div>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const label = TEXT.trends[trend] || trend;
  const isGood = trend === "improving" || trend === "increasing";
  const isBad = trend === "declining" || trend === "decreasing";

  return (
    <Badge
      variant="outline"
      className={cn(
        "ml-1 text-[10px] px-1.5 py-0",
        isGood && "border-emerald-300 text-emerald-600 dark:text-emerald-400",
        isBad && "border-red-300 text-red-600 dark:text-red-400",
      )}
    >
      {label}
    </Badge>
  );
}

function TimeHeatmap({ data }: { data: TimePreference[] }) {
  const maxCount = useMemo(() => {
    let max = 0;
    for (const tp of data) {
      for (const f of tp.topFolders) {
        if (f.count > max) max = f.count;
      }
    }
    return max || 1;
  }, [data]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: 24 }).map((_, hour) => {
        const tp = data.find((d) => d.hour === hour);
        const total = tp?.topFolders.reduce((s, f) => s + f.count, 0) ?? 0;
        const intensity = total / maxCount;

        return (
          <div
            key={hour}
            className="flex flex-col items-center gap-0.5"
            title={`${hour}:00 — ${total} 条收藏`}
          >
            <div
              className="w-7 h-7 rounded-md border transition-colors"
              style={{
                backgroundColor:
                  total === 0
                    ? "var(--muted)"
                    : `rgba(139, 92, 246, ${0.15 + intensity * 0.75})`,
              }}
            />
            <span className="text-[10px] text-muted-foreground">{hour}</span>
          </div>
        );
      })}
    </div>
  );
}

// ==================== 排除规则 Tab ====================

function ExclusionsTab({
  exclusions,
  stats,
  folderPreferences,
}: {
  exclusions: ExclusionRecord[];
  stats: {
    total: number;
    byType: Record<string, number>;
    byFolder: Record<string, number>;
  };
  folderPreferences?: FolderPreference[];
}) {
  const folderNameMap = useMemo(() => {
    const map = new Map<number, string>();
    folderPreferences?.forEach((f) => map.set(f.folderId, f.folderName));
    return map;
  }, [folderPreferences]);

  // 按文件夹分组 - 必须在条件返回之前调用
  const grouped = useMemo(() => {
    const map = new Map<number, ExclusionRecord[]>();
    for (const ex of exclusions) {
      if (!map.has(ex.folder_id)) map.set(ex.folder_id, []);
      map.get(ex.folder_id)!.push(ex);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [exclusions]);

  const getFolderName = (id: number) =>
    folderNameMap.get(id) ?? `文件夹 #${id}`;

  const typeIcons: Record<string, typeof ShieldBan> = {
    tag: ShieldBan,
    source: Globe,
    keyword: ShieldBan,
  };

  if (exclusions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ShieldBan className="size-10 mx-auto mb-3 opacity-30" />
          <p>{TEXT.exclusions.empty}</p>
          <p className="text-xs mt-1">{TEXT.exclusions.emptyHint}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {TEXT.exclusions.description}
      </p>

      {/* 类型分布 */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(stats.byType).map(([type, count]) => (
          <Badge key={type} variant="secondary" className="gap-1">
            {(TEXT.exclusions[
              type as keyof typeof TEXT.exclusions
            ] as string) ?? type}
            <span className="font-bold">{count}</span>
          </Badge>
        ))}
      </div>

      {/* 按文件夹分组列表 */}
      {grouped.map(([folderId, records]) => (
        <Card key={folderId}>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FolderHeart className="size-4 text-amber-500" />
              {getFolderName(folderId)}
              <Badge variant="outline" className="text-xs ml-auto">
                {records.length} 条规则
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="space-y-1.5">
              {records.map((ex) => {
                const Icon = typeIcons[ex.exclusion_type] ?? ShieldBan;
                const value =
                  ex.excluded_tag ??
                  ex.excluded_source_id ??
                  ex.excluded_keyword ??
                  "—";
                const createdLabel =
                  TEXT.exclusions.createdFrom[ex.created_from] ??
                  ex.created_from;

                return (
                  <div
                    key={ex.id}
                    className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-muted/50"
                  >
                    <Icon className="size-3.5 text-muted-foreground shrink-0" />
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {(TEXT.exclusions[
                        ex.exclusion_type as keyof typeof TEXT.exclusions
                      ] as string) ?? ex.exclusion_type}
                    </Badge>
                    <span className="truncate font-mono text-xs">{value}</span>
                    {ex.weight != null && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        权重 {(ex.weight * 100).toFixed(0)}%
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                      {createdLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ==================== 文件夹偏好 Tab ====================

function FoldersTab({ folders }: { folders: FolderPreference[] }) {
  if (folders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FolderHeart className="size-10 mx-auto mb-3 opacity-30" />
          <p>{TEXT.folders.empty}</p>
        </CardContent>
      </Card>
    );
  }

  const maxFreq = Math.max(...folders.map((f) => f.usageFrequency), 1);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {TEXT.folders.description}
      </p>

      {folders.map((folder, index) => (
        <Card key={folder.folderId}>
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-muted-foreground font-mono w-5">
                #{index + 1}
              </span>
              <FolderHeart className="size-4 text-amber-500 shrink-0" />
              <span className="font-medium truncate">{folder.folderName}</span>
              <span className="ml-auto text-sm text-muted-foreground shrink-0">
                {folder.usageFrequency} {TEXT.folders.bookmarks}
              </span>
            </div>

            <div className="ml-8">
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{
                    width: `${(folder.usageFrequency / maxFreq) * 100}%`,
                  }}
                />
              </div>

              {folder.associatedTags.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs text-muted-foreground mr-2">
                    {TEXT.folders.topTags}:
                  </span>
                  <div className="inline-flex flex-wrap gap-1">
                    {folder.associatedTags.slice(0, 8).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {folder.associatedTags.length > 8 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{folder.associatedTags.length - 8}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {folder.associatedSources.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground mr-2">
                    {TEXT.folders.topSources}:
                  </span>
                  <div className="inline-flex flex-wrap gap-1">
                    {folder.associatedSources.slice(0, 5).map((src) => (
                      <Badge
                        key={src}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {src}
                      </Badge>
                    ))}
                    {folder.associatedSources.length > 5 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{folder.associatedSources.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ==================== 来源偏好 Tab ====================

function SourcesTab({
  sources,
  folders,
}: {
  sources: SourcePreference[];
  folders: FolderPreference[];
}) {
  const folderNameMap = useMemo(() => {
    const map = new Map<number, string>();
    folders.forEach((f) => map.set(f.folderId, f.folderName));
    return map;
  }, [folders]);

  if (sources.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Globe className="size-10 mx-auto mb-3 opacity-30" />
          <p>{TEXT.sources.empty}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {TEXT.sources.description}
      </p>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {sources.map((src) => {
              const folderName =
                folderNameMap.get(src.preferredFolderId) ??
                `文件夹 #${src.preferredFolderId}`;

              return (
                <div
                  key={src.sourceId}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <Globe className="size-4 text-cyan-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {src.sourceName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      → {folderName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {src.sampleCount} {TEXT.sources.samples}
                    </span>
                    <Badge
                      variant={
                        src.confirmationRate >= 0.7 ? "default" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {TEXT.sources.confidence}{" "}
                      {Math.round(src.confirmationRate * 100)}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
