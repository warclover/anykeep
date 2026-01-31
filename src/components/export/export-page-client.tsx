/**
 * 数据导出页面 - 客户端组件
 * 提供完整的数据导出功能界面
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExportFormatSelector } from "./export-format-selector";
import { ExportFieldSelector } from "./export-field-selector";
import { ExportPreview } from "./export-preview";
import { ExportPreviewModal } from "./export-preview-modal";
import { ExportDialogV2 } from "./export-dialog-v2";
import {
  estimateFileSize,
  generatePreviewContent,
} from "@/lib/export/utils/preview.utils";
import { DEFAULT_CSV_FIELDS, EXPORT_PAGE_TEXT } from "@/lib/export/constants";
import { exportAnalytics } from "@/lib/export/analytics";
import { useBookmarksSWR } from "@/lib/cache/hooks/use-bookmarks-swr";
import { useFolders } from "@/hooks/data";
import type {
  BookmarkWithFolder,
  ExportFormat,
  ExportScope,
  ExportPreviewData,
} from "@/lib/export/types";
import type { Bookmark } from "@/types/supabase";

/** 页面状态 */
type PageState = "idle" | "loading" | "ready" | "error";

interface ExportPageClientProps {
  /** 嵌入模式：隐藏页面标题 */
  embedded?: boolean;
}

/**
 * 预定义平台选项
 * 值必须与 validation.ts 中 getBookmarksQuerySchema.platform 枚举匹配
 * 允许值: "WECHAT_OFFICIAL_ACCOUNT", "BILIBILI", "XIAOHONGSHU", "UNKNOWN", "browser"
 */
const PLATFORM_OPTIONS = [
  { value: "all", label: "全部平台" },
  { value: "WECHAT_OFFICIAL_ACCOUNT", label: "微信公众号" },
  { value: "BILIBILI", label: "B站" },
  { value: "XIAOHONGSHU", label: "小红书" },
  { value: "browser", label: "浏览器书签" },
  { value: "UNKNOWN", label: "其他" },
] as const;

export function ExportPageClient({ embedded = false }: ExportPageClientProps) {
  // ==================== URL 参数 ====================
  const searchParams = useSearchParams();
  const urlFolderId = searchParams?.get("folder") || "";

  // ==================== 状态 ====================

  // 导出配置
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [csvFields, setCsvFields] = useState<string[]>([...DEFAULT_CSV_FIELDS]);
  const [scope, setScope] = useState<ExportScope>("all");
  // 初始值从 URL 参数读取
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    urlFolderId || "all",
  );
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");

  // 弹窗状态
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // ==================== 数据获取 ====================

  // 获取书签列表
  const {
    data: bookmarksData,
    isLoading: isLoadingBookmarks,
    error: bookmarksError,
    refetch: refetchBookmarks,
  } = useBookmarksSWR({
    platform: selectedPlatform !== "all" ? selectedPlatform : "",
    sort: "created_desc",
    folder: selectedFolderId !== "all" ? selectedFolderId : "",
  });

  // 获取文件夹列表
  const { folders, isLoading: isLoadingFolders } = useFolders();

  // 处理后的书签数据（根据 scope 过滤浏览器书签）
  const bookmarks = useMemo<BookmarkWithFolder[]>(() => {
    if (!bookmarksData) return [];

    // 浏览器平台列表
    const browserPlatforms = [
      "BROWSER_CHROME",
      "BROWSER_EDGE",
      "BROWSER_FIREFOX",
      "BROWSER_SAFARI",
    ];

    return bookmarksData
      .filter((b: Bookmark & { folders?: { name: string } | null }) => {
        // 如果 scope 是 all，排除浏览器书签
        if (
          scope === "all" &&
          b.platform &&
          browserPlatforms.includes(b.platform)
        ) {
          return false;
        }
        return true;
      })
      .map((b: Bookmark & { folders?: { name: string } | null }) => ({
        ...b,
        folders: b.folders || null,
      }));
  }, [bookmarksData, scope]);

  // ==================== 副作用 ====================

  // 页面访问埋点
  useEffect(() => {
    exportAnalytics.pageViewed();
  }, []);

  // ==================== 计算属性 ====================

  // 页面状态（派生自数据加载状态）
  const pageState = useMemo<PageState>(() => {
    if (isLoadingBookmarks || isLoadingFolders) {
      return "loading";
    }
    if (bookmarksError) {
      return "error";
    }
    return "ready";
  }, [isLoadingBookmarks, isLoadingFolders, bookmarksError]);

  // 预览数据
  const previewData = useMemo<ExportPreviewData>(() => {
    return {
      totalCount: bookmarks.length,
      estimatedSize: estimateFileSize(bookmarks, format),
      previewItems: bookmarks.slice(0, 3),
    };
  }, [bookmarks, format]);

  // ==================== 事件处理 ====================

  // 格式变更
  const handleFormatChange = (newFormat: ExportFormat) => {
    setFormat(newFormat);
    exportAnalytics.formatSelected(newFormat);
  };

  // 查看预览
  const handleViewPreview = () => {
    const content = generatePreviewContent(bookmarks, format, 3);
    setPreviewContent(content);
    setPreviewModalOpen(true);
    exportAnalytics.previewViewed(format, bookmarks.length);
  };

  // 开始导出
  const handleStartExport = () => {
    if (bookmarks.length === 0) {
      toast.error("没有可导出的数据");
      return;
    }
    setExportDialogOpen(true);
  };

  // 导出成功
  const handleExportSuccess = () => {
    setExportDialogOpen(false);
    toast.success("导出成功！");
  };

  // 刷新数据
  const handleRefresh = () => {
    refetchBookmarks();
  };

  // ==================== 渲染 ====================

  return (
    <div className={embedded ? "" : "container max-w-4xl mx-auto px-4 py-6"}>
      {/* 页面标题 - 嵌入模式下隐藏 */}
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{EXPORT_PAGE_TEXT.title}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={pageState === "loading"}
            >
              <RefreshCw
                className={`size-4 mr-2 ${pageState === "loading" ? "animate-spin" : ""}`}
              />
              刷新
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* 格式选择 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              📊 {EXPORT_PAGE_TEXT.formatSection.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExportFormatSelector
              value={format}
              onChange={handleFormatChange}
            />
          </CardContent>
        </Card>

        {/* 筛选条件 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              🔍 {EXPORT_PAGE_TEXT.filterSection.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 范围选择 */}
              <div className="space-y-2">
                <Label>{EXPORT_PAGE_TEXT.filterSection.scopeLabel}</Label>
                <Select
                  value={scope}
                  onValueChange={(v) => setScope(v as ExportScope)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {EXPORT_PAGE_TEXT.filterSection.scopeOptions.all}
                    </SelectItem>
                    <SelectItem value="all_with_browser">
                      {
                        EXPORT_PAGE_TEXT.filterSection.scopeOptions
                          .all_with_browser
                      }
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 文件夹选择 */}
              <div className="space-y-2">
                <Label>{EXPORT_PAGE_TEXT.filterSection.folderLabel}</Label>
                <Select
                  value={selectedFolderId}
                  onValueChange={setSelectedFolderId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部文件夹" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部文件夹</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id.toString()}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 平台选择 */}
              <div className="space-y-2">
                <Label>{EXPORT_PAGE_TEXT.filterSection.platformLabel}</Label>
                <Select
                  value={selectedPlatform}
                  onValueChange={setSelectedPlatform}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部平台" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CSV 高级选项 */}
        {format === "csv" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                ⚙️ {EXPORT_PAGE_TEXT.csvOptionsSection.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ExportFieldSelector
                value={csvFields}
                onChange={setCsvFields}
                defaultOpen
              />
            </CardContent>
          </Card>
        )}

        {/* 导出预览 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              📋 {EXPORT_PAGE_TEXT.previewSection.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExportPreview
              data={previewData}
              format={format}
              onViewSample={handleViewPreview}
              isLoading={pageState === "loading"}
            />
          </CardContent>
        </Card>

        {/* 导出按钮 */}
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={handleStartExport}
            disabled={pageState !== "ready" || bookmarks.length === 0}
          >
            <Download className="size-5 mr-2" />
            {EXPORT_PAGE_TEXT.exportButton}
          </Button>
        </div>
      </div>

      {/* 预览弹窗 */}
      <ExportPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        content={previewContent}
        format={format}
      />

      {/* 导出对话框 */}
      <ExportDialogV2
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        mode="full"
        bookmarks={bookmarks}
        onSuccess={handleExportSuccess}
      />
    </div>
  );
}
