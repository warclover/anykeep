/**
 * 问题详情抽屉组件
 *
 * 显示完整的问题列表，支持批量操作
 * 复用原整理大师的 Tab 视图设计
 *
 * @version 1.0.0
 * @since 2026-01-31
 */

"use client";

import {
  CheckCircle2,
  GitMerge,
  FolderX,
  FolderOpen,
  PenLine,
  PlusCircle,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  DuplicateFolderGroup,
  OversizedFolder,
  PoorlyNamedFolder,
  MissingCategory,
  Folder,
} from "@/hooks/domain/folder/use-librarian-analysis";

// ============================================================================
// 类型定义
// ============================================================================

interface IssueDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateFolders: DuplicateFolderGroup[];
  emptyFolders: Folder[];
  oversizedFolders: OversizedFolder[];
  poorlyNamedFolders: PoorlyNamedFolder[];
  missingCategories: MissingCategory[];
  onMerge?: (groupIndex: number) => void;
  onDelete?: (folderId: number) => void;
  onSplit?: (folderId: number) => void;
  onRename?: (folderId: number, newName: string) => void;
  onCreate?: (categoryIndex: number) => void;
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

function DuplicateCard({
  group,
  onMerge,
}: {
  group: DuplicateFolderGroup;
  onMerge?: () => void;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
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
        <Button
          size="sm"
          variant="outline"
          onClick={onMerge}
          disabled={!onMerge}
        >
          合并
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        建议：{group.suggestedMerge}
      </p>
    </div>
  );
}

function EmptyFolderCard({
  folder,
  onDelete,
}: {
  folder: Folder;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <FolderX className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{folder.name}</span>
      </div>
      <Button size="sm" variant="ghost" onClick={onDelete} disabled={!onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function OversizedCard({
  item,
  onSplit,
}: {
  item: OversizedFolder;
  onSplit?: () => void;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.folder.name}</span>
          <Badge variant="secondary">{item.bookmarkCount} 条书签</Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onSplit}
          disabled={!onSplit}
        >
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

function NamingCard({
  item,
  onRename,
}: {
  item: PoorlyNamedFolder;
  onRename?: () => void;
}) {
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
        <Button
          size="sm"
          variant="outline"
          onClick={onRename}
          disabled={!onRename}
        >
          重命名
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        建议：{item.suggestedName}
      </p>
    </div>
  );
}

function MissingCategoryCard({
  item,
  onCreate,
}: {
  item: MissingCategory;
  onCreate?: () => void;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.category}</span>
          <Badge variant="secondary">{item.bookmarkCount} 条相关书签</Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onCreate}
          disabled={!onCreate}
        >
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

// ============================================================================
// 主组件
// ============================================================================

export function IssueDetailDrawer({
  open,
  onOpenChange,
  duplicateFolders,
  emptyFolders,
  oversizedFolders,
  poorlyNamedFolders,
  missingCategories,
  onMerge,
  onDelete,
  onSplit,
  onRename,
  onCreate,
}: IssueDetailDrawerProps) {
  const totalIssues =
    duplicateFolders.length +
    emptyFolders.length +
    oversizedFolders.length +
    poorlyNamedFolders.length +
    missingCategories.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>全部问题 ({totalIssues})</SheetTitle>
          <SheetDescription>文件夹结构分析发现的所有优化机会</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Tabs defaultValue="duplicates">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="duplicates" className="text-xs px-1">
                重复
                {duplicateFolders.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">
                    {duplicateFolders.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="empty" className="text-xs px-1">
                空
                {emptyFolders.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">
                    {emptyFolders.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="oversized" className="text-xs px-1">
                过大
                {oversizedFolders.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">
                    {oversizedFolders.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="naming" className="text-xs px-1">
                命名
                {poorlyNamedFolders.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">
                    {poorlyNamedFolders.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="missing" className="text-xs px-1">
                缺失
                {missingCategories.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">
                    {missingCategories.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* 重复文件夹 */}
            <TabsContent value="duplicates" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GitMerge className="h-5 w-5" />
                    重复文件夹
                  </CardTitle>
                  <CardDescription>
                    这些文件夹内容相似，建议合并
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {duplicateFolders.length === 0 ? (
                    <EmptyState message="没有发现重复文件夹" />
                  ) : (
                    <div className="space-y-3">
                      {duplicateFolders.map((group, index) => (
                        <DuplicateCard
                          key={index}
                          group={group}
                          onMerge={onMerge ? () => onMerge(index) : undefined}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 空文件夹 */}
            <TabsContent value="empty" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FolderX className="h-5 w-5" />
                    空文件夹
                  </CardTitle>
                  <CardDescription>
                    这些文件夹没有任何书签，建议删除或添加内容
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {emptyFolders.length === 0 ? (
                    <EmptyState message="没有空文件夹" />
                  ) : (
                    <div className="space-y-2">
                      {emptyFolders.map((folder) => (
                        <EmptyFolderCard
                          key={folder.id}
                          folder={folder}
                          onDelete={
                            onDelete ? () => onDelete(folder.id) : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 过大文件夹 */}
            <TabsContent value="oversized" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FolderOpen className="h-5 w-5" />
                    过大文件夹
                  </CardTitle>
                  <CardDescription>
                    这些文件夹书签过多，建议拆分为更细的分类
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {oversizedFolders.length === 0 ? (
                    <EmptyState message="没有过大的文件夹" />
                  ) : (
                    <div className="space-y-3">
                      {oversizedFolders.map((item) => (
                        <OversizedCard
                          key={item.folder.id}
                          item={item}
                          onSplit={
                            onSplit ? () => onSplit(item.folder.id) : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 命名问题 */}
            <TabsContent value="naming" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PenLine className="h-5 w-5" />
                    命名问题
                  </CardTitle>
                  <CardDescription>
                    这些文件夹命名可以改进，以提高辨识度
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {poorlyNamedFolders.length === 0 ? (
                    <EmptyState message="所有文件夹命名都很好" />
                  ) : (
                    <div className="space-y-3">
                      {poorlyNamedFolders.map((item) => (
                        <NamingCard
                          key={item.folder.id}
                          item={item}
                          onRename={
                            onRename
                              ? () =>
                                  onRename(item.folder.id, item.suggestedName)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 缺失分类 */}
            <TabsContent value="missing" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PlusCircle className="h-5 w-5" />
                    缺失分类
                  </CardTitle>
                  <CardDescription>
                    根据您的书签内容，建议创建这些分类
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {missingCategories.length === 0 ? (
                    <EmptyState message="分类已经很完善" />
                  ) : (
                    <div className="space-y-3">
                      {missingCategories.map((item, index) => (
                        <MissingCategoryCard
                          key={index}
                          item={item}
                          onCreate={
                            onCreate ? () => onCreate(index) : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
