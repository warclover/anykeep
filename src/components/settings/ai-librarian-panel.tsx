/**
 * V3.0 整理大师面板组件
 *
 * 显示 AI 对文件夹结构的分析结果：
 * - 健康评分
 * - 重复文件夹检测
 * - 空文件夹检测
 * - 过大文件夹检测
 * - 命名问题检测
 * - 缺失分类建议
 */

"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
// Progress 组件暂未使用
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BookOpen,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Folder,
  FolderX,
  FolderPlus,
  Merge,
  Split,
  Edit3,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  useLibrarianAnalysis,
  type LibrarianAnalysis as _LibrarianAnalysis,
  type DuplicateFolderGroup,
  type OversizedFolder,
  type PoorlyNamedFolder,
  type MissingCategory,
  type Folder as FolderType,
} from "@/hooks/domain/folder";

// ============================================================================
// 辅助组件
// ============================================================================

/**
 * 健康评分展示
 */
function HealthScoreDisplay({ score }: { score: number }) {
  const getScoreColor = () => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = () => {
    if (score >= 80) return "优秀";
    if (score >= 60) return "良好";
    if (score >= 40) return "一般";
    return "需优化";
  };

  const getProgressColor = () => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-blue-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className={cn("size-5", getScoreColor())} />
          <span className="text-sm font-medium">文件夹健康度</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-2xl font-bold", getScoreColor())}>
            {score}
          </span>
          <Badge variant="outline" className={cn("text-xs", getScoreColor())}>
            {getScoreLabel()}
          </Badge>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            getProgressColor(),
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

/**
 * 问题分类卡片
 */
function IssueSection({
  icon: Icon,
  title,
  count,
  children,
  defaultOpen = false,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (count === 0) {
    return (
      <div className="flex items-center gap-2 py-2 text-muted-foreground">
        <CheckCircle className="size-4 text-green-500" />
        <span className="text-sm">{title}：无问题</span>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 py-2 h-auto"
        >
          {isOpen ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          <Icon className="size-4 text-orange-500" />
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="secondary" className="ml-auto">
            {count}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-8 space-y-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * 重复文件夹列表项
 */
function DuplicateFolderItem({ group }: { group: DuplicateFolderGroup }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <Merge className="size-4 text-orange-500" />
        <span>建议合并为：</span>
        <Badge variant="outline">{group.suggestedMerge}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {group.folders.map((folder) => (
          <Badge key={folder.id} variant="secondary" className="text-xs">
            <Folder className="size-3 mr-1" />
            {folder.name}
            {folder.bookmarkCount !== undefined && (
              <span className="ml-1 text-muted-foreground">
                ({folder.bookmarkCount})
              </span>
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/**
 * 空文件夹列表项
 */
function EmptyFolderItem({ folder }: { folder: FolderType }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
      <FolderX className="size-4 text-gray-400" />
      <span className="text-sm">{folder.name}</span>
    </div>
  );
}

/**
 * 过大文件夹列表项
 */
function OversizedFolderItem({ item }: { item: OversizedFolder }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="size-4 text-orange-500" />
          <span className="text-sm font-medium">{item.folder.name}</span>
        </div>
        <Badge variant="destructive" className="text-xs">
          {item.bookmarkCount} 条
        </Badge>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Split className="size-3" />
        <span>建议拆分为：</span>
        {item.suggestedSplits.slice(0, 3).map((split, i) => (
          <Badge key={i} variant="outline" className="text-xs">
            {split}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/**
 * 命名问题文件夹列表项
 */
function PoorlyNamedFolderItem({ item }: { item: PoorlyNamedFolder }) {
  const issueLabels: Record<string, string> = {
    too_short: "名称过短",
    too_vague: "名称模糊",
    contains_special: "含特殊字符",
    duplicate_style: "命名风格重复",
  };

  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
      <div className="flex items-center gap-2">
        <Edit3 className="size-4 text-yellow-500" />
        <span className="text-sm">{item.folder.name}</span>
        <Badge variant="outline" className="text-xs">
          {issueLabels[item.issue]}
        </Badge>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="text-xs cursor-help">
              建议：{item.suggestedName}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>点击应用建议的名称</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

/**
 * 缺失分类列表项
 */
function MissingCategoryItem({ item }: { item: MissingCategory }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderPlus className="size-4 text-blue-500" />
          <span className="text-sm font-medium">{item.category}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {item.bookmarkCount} 条待分类
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{item.reason}</p>
      {item.sampleTitles.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span>示例：</span>
          {item.sampleTitles.slice(0, 2).join("、")}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

interface AILibrarianPanelProps {
  className?: string;
}

export function AILibrarianPanel({ className }: AILibrarianPanelProps) {
  const {
    analysis,
    isLoading,
    isAnalyzing,
    error,
    runAnalysis,
    refresh,
    clearError,
  } = useLibrarianAnalysis();

  // 加载状态
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card className={cn("border-red-200 dark:border-red-800", className)}>
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="size-8 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-600">{error}</p>
              <p className="text-xs text-muted-foreground mt-1">请稍后重试</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearError}>
                关闭
              </Button>
              <Button size="sm" onClick={refresh}>
                重试
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 无分析数据
  if (!analysis) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-purple-500" />
            整理大师
            <Badge
              variant="outline"
              className="ml-1 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300 text-xs"
            >
              <Sparkles className="size-3 mr-1" />
              AI
            </Badge>
          </CardTitle>
          <CardDescription>
            智能分析你的文件夹结构，提供优化建议
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-6">
            <BookOpen className="size-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium">尚未进行分析</p>
              <p className="text-xs text-muted-foreground mt-1">
                点击下方按钮，让 AI 分析你的文件夹结构
              </p>
            </div>
            <Button onClick={runAnalysis} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  开始分析
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 显示分析结果
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-purple-500" />
            整理大师
            <Badge
              variant="outline"
              className="ml-1 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300 text-xs"
            >
              <Sparkles className="size-3 mr-1" />
              AI
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={runAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
        </div>
        <CardDescription>
          上次分析：
          {formatDistanceToNow(analysis.analyzedAt, {
            addSuffix: true,
            locale: zhCN,
          })}
          {analysis.totalSuggestions > 0 && (
            <span className="ml-2 text-orange-600">
              · {analysis.totalSuggestions} 条建议
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 健康评分 */}
        <HealthScoreDisplay score={analysis.healthScore} />

        <Separator />

        {/* 问题列表 */}
        <div className="space-y-1">
          {/* 重复文件夹 */}
          <IssueSection
            icon={Merge}
            title="重复文件夹"
            count={analysis.duplicateFolders.length}
            defaultOpen={analysis.duplicateFolders.length > 0}
          >
            <div className="space-y-2">
              {analysis.duplicateFolders.map((group, i) => (
                <DuplicateFolderItem key={i} group={group} />
              ))}
            </div>
          </IssueSection>

          {/* 空文件夹 */}
          <IssueSection
            icon={FolderX}
            title="空文件夹"
            count={analysis.emptyFolders.length}
          >
            <div className="grid grid-cols-2 gap-2">
              {analysis.emptyFolders.map((folder) => (
                <EmptyFolderItem key={folder.id} folder={folder} />
              ))}
            </div>
          </IssueSection>

          {/* 过大文件夹 */}
          <IssueSection
            icon={Split}
            title="过大文件夹"
            count={analysis.oversizedFolders.length}
          >
            <div className="space-y-2">
              {analysis.oversizedFolders.map((item, i) => (
                <OversizedFolderItem key={i} item={item} />
              ))}
            </div>
          </IssueSection>

          {/* 命名问题 */}
          <IssueSection
            icon={Edit3}
            title="命名问题"
            count={analysis.poorlyNamedFolders.length}
          >
            <div className="space-y-2">
              {analysis.poorlyNamedFolders.map((item, i) => (
                <PoorlyNamedFolderItem key={i} item={item} />
              ))}
            </div>
          </IssueSection>

          {/* 缺失分类 */}
          <IssueSection
            icon={FolderPlus}
            title="建议创建"
            count={analysis.missingCategories.length}
            defaultOpen={analysis.missingCategories.length > 0}
          >
            <div className="space-y-2">
              {analysis.missingCategories.map((item, i) => (
                <MissingCategoryItem key={i} item={item} />
              ))}
            </div>
          </IssueSection>
        </div>

        {/* 全部健康 */}
        {analysis.totalSuggestions === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle className="size-8 text-green-500" />
            <p className="text-sm font-medium text-green-600">
              太棒了！你的文件夹结构非常健康
            </p>
            <p className="text-xs text-muted-foreground">
              继续保持良好的整理习惯
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AILibrarianPanel;
