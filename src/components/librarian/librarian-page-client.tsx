"use client";

/**
 * AI 整理大师页面客户端组件
 * 展示文件夹结构分析和优化建议
 */

import { useRouter } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  FolderSync,
  FolderX,
  FolderOpen,
  GitMerge,
  Loader2,
  RefreshCw,
  XCircle,
  Sparkles,
  PenLine,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useLibrarianAnalysis,
  type DuplicateFolderGroup,
  type OversizedFolder,
  type PoorlyNamedFolder,
  type MissingCategory,
  type Folder,
} from "@/hooks/domain/folder/use-librarian-analysis";

// ============================================================================
// 主组件
// ============================================================================

export function LibrarianPageClient() {
  const router = useRouter();
  const { analysis, isLoading, isAnalyzing, error, runAnalysis, refresh } =
    useLibrarianAnalysis();

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            正在加载分析数据...
          </p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <p className="mt-4 text-lg font-medium">加载失败</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button onClick={refresh} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 无分析结果
  if (!analysis) {
    return (
      <div className="container max-w-4xl py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">AI 整理大师</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            智能分析文件夹结构，提供整理优化建议
          </p>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-purple-500" />
            <p className="mt-4 text-lg font-medium">开始智能分析</p>
            <p className="mt-2 text-sm text-muted-foreground">
              AI 将分析您的文件夹结构，发现重复、命名问题、缺失分类等
            </p>
            <Button
              onClick={runAnalysis}
              className="mt-6"
              disabled={isAnalyzing}
            >
              {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Sparkles className="mr-2 h-4 w-4" />
              开始分析
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalIssues =
    analysis.duplicateFolders.length +
    analysis.emptyFolders.length +
    analysis.oversizedFolders.length +
    analysis.poorlyNamedFolders.length +
    analysis.missingCategories.length;

  return (
    <div className="container max-w-4xl py-6">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI 整理大师</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            智能分析文件夹结构，提供整理优化建议
          </p>
        </div>
        <Button variant="outline" onClick={runAnalysis} disabled={isAnalyzing}>
          {isAnalyzing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          重新分析
        </Button>
      </div>

      {/* 健康分数卡片 */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              整理健康度
            </CardTitle>
            <Badge
              variant="secondary"
              className={
                analysis.healthScore >= 80
                  ? "bg-green-100 text-green-800"
                  : analysis.healthScore >= 60
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
              }
            >
              {analysis.healthScore} 分
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={analysis.healthScore} className="h-3" />

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {analysis.totalSuggestions}
                </p>
                <p className="text-xs text-muted-foreground">优化建议</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {totalIssues}
                </p>
                <p className="text-xs text-muted-foreground">问题数量</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {Math.round(analysis.healthScore)}%
                </p>
                <p className="text-xs text-muted-foreground">健康度</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              最后分析时间：{analysis.analyzedAt.toLocaleString("zh-CN")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 无问题时的提示 */}
      {totalIssues === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-4 text-lg font-medium">文件夹结构非常健康！</p>
            <p className="mt-2 text-sm text-muted-foreground">
              暂无需要优化的问题
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/folders")}
            >
              <FolderSync className="mr-2 h-4 w-4" />
              查看所有文件夹
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 问题分类标签页 */}
      {totalIssues > 0 && (
        <Tabs defaultValue="duplicates" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="duplicates" className="relative">
              重复
              {analysis.duplicateFolders.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {analysis.duplicateFolders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="empty">
              空文件夹
              {analysis.emptyFolders.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {analysis.emptyFolders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="oversized">
              过大
              {analysis.oversizedFolders.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {analysis.oversizedFolders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="naming">
              命名
              {analysis.poorlyNamedFolders.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {analysis.poorlyNamedFolders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="missing">
              缺失
              {analysis.missingCategories.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {analysis.missingCategories.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 重复文件夹 */}
          <TabsContent value="duplicates">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitMerge className="h-5 w-5" />
                  重复文件夹
                </CardTitle>
                <CardDescription>这些文件夹内容相似，建议合并</CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.duplicateFolders.length === 0 ? (
                  <EmptyState message="没有发现重复文件夹" />
                ) : (
                  <div className="space-y-3">
                    {analysis.duplicateFolders.map((group, index) => (
                      <DuplicateCard key={index} group={group} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 空文件夹 */}
          <TabsContent value="empty">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderX className="h-5 w-5" />
                  空文件夹
                </CardTitle>
                <CardDescription>
                  这些文件夹没有任何书签，建议删除或添加内容
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.emptyFolders.length === 0 ? (
                  <EmptyState message="没有空文件夹" />
                ) : (
                  <div className="space-y-2">
                    {analysis.emptyFolders.map((folder) => (
                      <EmptyFolderCard key={folder.id} folder={folder} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 过大文件夹 */}
          <TabsContent value="oversized">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  过大文件夹
                </CardTitle>
                <CardDescription>
                  这些文件夹书签过多，建议拆分为更细的分类
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.oversizedFolders.length === 0 ? (
                  <EmptyState message="没有过大的文件夹" />
                ) : (
                  <div className="space-y-3">
                    {analysis.oversizedFolders.map((item) => (
                      <OversizedCard key={item.folder.id} item={item} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 命名问题 */}
          <TabsContent value="naming">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenLine className="h-5 w-5" />
                  命名问题
                </CardTitle>
                <CardDescription>
                  这些文件夹命名可以改进，以提高辨识度
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.poorlyNamedFolders.length === 0 ? (
                  <EmptyState message="所有文件夹命名都很好" />
                ) : (
                  <div className="space-y-3">
                    {analysis.poorlyNamedFolders.map((item) => (
                      <NamingCard key={item.folder.id} item={item} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 缺失分类 */}
          <TabsContent value="missing">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5" />
                  缺失分类
                </CardTitle>
                <CardDescription>
                  根据您的书签内容，建议创建这些分类
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.missingCategories.length === 0 ? (
                  <EmptyState message="分类已经很完善" />
                ) : (
                  <div className="space-y-3">
                    {analysis.missingCategories.map((item, index) => (
                      <MissingCategoryCard key={index} item={item} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============================================================================
// 子组件
// ============================================================================

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function DuplicateCard({ group }: { group: DuplicateFolderGroup }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {group.folders.map((folder, i) => (
            <span key={folder.id}>
              {i > 0 && <span className="text-muted-foreground mx-1">≈</span>}
              <span className="font-medium">{folder.name}</span>
            </span>
          ))}
          <Badge variant="outline">
            {(group.similarity * 100).toFixed(0)}% 相似
          </Badge>
        </div>
        <Button size="sm" variant="outline" disabled>
          合并
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        建议：{group.suggestedMerge}
      </p>
    </div>
  );
}

function EmptyFolderCard({ folder }: { folder: Folder }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <FolderX className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{folder.name}</span>
      </div>
      <Button size="sm" variant="ghost" disabled>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function OversizedCard({ item }: { item: OversizedFolder }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.folder.name}</span>
          <Badge variant="secondary">{item.bookmarkCount} 条书签</Badge>
        </div>
        <Button size="sm" variant="outline" disabled>
          拆分
        </Button>
      </div>
      {item.suggestedSplits.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          建议拆分为：{item.suggestedSplits.join("、")}
        </p>
      )}
    </div>
  );
}

function NamingCard({ item }: { item: PoorlyNamedFolder }) {
  const issueLabels: Record<string, string> = {
    too_short: "名称太短",
    too_vague: "含义模糊",
    contains_special: "包含特殊字符",
    duplicate_style: "命名风格重复",
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.folder.name}</span>
          <Badge variant="outline" className="text-yellow-600">
            {issueLabels[item.issue] || item.issue}
          </Badge>
        </div>
        <Button size="sm" variant="outline" disabled>
          重命名
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        建议：{item.suggestedName}
      </p>
    </div>
  );
}

function MissingCategoryCard({ item }: { item: MissingCategory }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.category}</span>
          <Badge variant="secondary">{item.bookmarkCount} 条相关书签</Badge>
        </div>
        <Button size="sm" variant="outline" disabled>
          创建
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
      {item.sampleTitles.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          示例：{item.sampleTitles.slice(0, 3).join("、")}
          {item.sampleTitles.length > 3 && "..."}
        </p>
      )}
    </div>
  );
}

export default LibrarianPageClient;
