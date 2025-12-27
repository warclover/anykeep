/**
 * V5.0: 创建收藏 SideSheet 组件
 *
 * 基于统一的 SideSheet 设计系统重构
 * - 使用新的 SideSheet 组件
 * - 简化布局结构（移除 Slogan，合并区块）
 * - 保持所有功能不变
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  Check,
  AlertCircle,
  Link,
  FileText,
  FolderOpen,
  Tags,
  MessageSquare,
  Eye,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAbortableFetch, useDebouncedAbortableFetch } from "@/hooks/core";
import { useClipboardPaste } from "@/components/quick-add/hooks/useClipboardPaste";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SideSheet,
  SideSheetPrimaryZone,
  SideSheetSecondaryZone,
  SideSheetExpandableZone,
} from "@/components/ui/side-sheet";
import { createBookmarkSchema } from "@/lib/validation";
import { extractUrlFromShareText } from "@/lib/utils/url-extractor";
import {
  handleClassificationNotification,
  acceptClassificationSuggestion,
  rejectClassificationSuggestion,
  type ClassificationResponse,
} from "@/lib/utils/classification-notification";
import { UsageTagSelector } from "./usage-tag-selector";
import { FolderQuickSelect } from "@/components/classification/folder-quick-select";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import type { CustomUsageTag } from "@/types/supabase";

// ============================================================================
// 类型定义
// ============================================================================

interface BookmarkCreatedData {
  id: number;
  title: string;
  ai_summary?: string | null;
  ai_tags?: string[] | null;
}

interface CreateBookmarkDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders?: Array<{ id: number; name: string }>;
  onSuccess?: (bookmark: BookmarkCreatedData) => void;
}

interface WebMetadata {
  title: string;
  description: string;
  coverUrl: string;
  sourceName: string;
  author: string;
  publishTime: string;
  platform: string;
  siteName: string;
  wordCount: number;
  imageCount: number;
}

type FetchStatus = "idle" | "loading" | "success" | "error";

// ============================================================================
// 常量
// ============================================================================

const TEXT = {
  SHEET_TITLE: "新建收藏",
  SHEET_DESCRIPTION: "输入链接保存网页内容，支持自动获取标题和摘要",
  SUBMIT_BUTTON: "创建",
  SUBMITTING: "创建中",
  URL_LABEL: "粘贴链接",
  URL_PLACEHOLDER: "粘贴链接或分享文本...",
  URL_HELPER: "输入链接后自动获取网页信息",
  TITLE_LABEL: "标题",
  TITLE_PLACEHOLDER: "可选，保存后自动获取",
  DESCRIPTION_LABEL: "描述",
  DESCRIPTION_PLACEHOLDER: "简单描述这篇内容...",
  FOLDER_LABEL: "保存到",
  FOLDER_PLACEHOLDER: "选择文件夹（可选）",
  USAGE_TAGS_LABEL: "用途标签",
  USAGE_TAGS_HELPER: "方便日后筛选",
  CUSTOM_TAGS_LABEL: "自定义标签",
  CUSTOM_TAGS_PLACEHOLDER: "输入标签后按回车添加",
  CUSTOM_TAGS_HELPER: "可选，保存后自动生成 AI 标签",
  NOTES_LABEL: "个人笔记",
  NOTES_PLACEHOLDER: "记录想法...",
  VISION_LABEL: "深度视觉分析",
  VISION_HELPER: "提取图片文字、分析图表逻辑",
  MORE_OPTIONS: "更多选项",
  MORE_OPTIONS_DESC: "描述、标签、笔记、视觉分析",
  AUTO_FILLED: "已自动填充",
  FETCHING: "正在获取网页信息...",
  FETCH_SUCCESS: "已自动填充网页信息",
  FETCH_ERROR: "获取失败，请手动填写",
  REFETCH: "重新获取",
  RETRY: "重试",
  TAGS_COUNT: (count: number) => `已添加 ${count} 个标签`,
};

// ============================================================================
// 主组件
// ============================================================================

export function CreateBookmarkDrawer({
  open,
  onOpenChange,
  folders = [],
  onSuccess,
}: CreateBookmarkDrawerProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const { debouncedFetch, abortAll } = useDebouncedAbortableFetch(500);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // URL 输入框 ref 和剪贴板自动读取标记
  const urlInputRef = useRef<HTMLInputElement>(null);
  const hasAutoReadRef = useRef(false);

  // 表单状态
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [sourceName, setSourceName] = useState<string>("");
  const [author, setAuthor] = useState<string>("");
  const [publishTime, setPublishTime] = useState<string>("");
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [imageCount, setImageCount] = useState<number | null>(null);

  // 用户输入的标签
  const [userAddedTags, setUserAddedTags] = useState<string[]>([]);

  // 用途标签相关状态
  const [selectedUsageTags, setSelectedUsageTags] = useState<string[]>([]);
  const [customUsageTags, setCustomUsageTags] = useState<CustomUsageTag[]>([]);

  // V10.0新增：视觉分析开关
  const [enableVisionAnalysis, setEnableVisionAnalysis] = useState(false);

  // 换文件夹对话框状态
  const [folderSelectOpen, setFolderSelectOpen] = useState(false);
  const [pendingBookmarkId, setPendingBookmarkId] = useState<number | null>(
    null,
  );
  const [pendingSuggestionId, setPendingSuggestionId] = useState<number | null>(
    null,
  );

  // 元数据获取状态
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchError, setFetchError] = useState<string>("");
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(
    new Set(),
  );

  // 用于跟踪用户是否手动修改过字段
  const userModifiedFieldsRef = useRef<Set<string>>(new Set());

  // 剪贴板检测 hook
  const { readClipboard, extractUrlFromText } = useClipboardPaste({
    onUrlExtracted: (extractedUrl) => {
      // 提取到 URL 时自动填充
      const cleanUrl = extractUrlFromShareText(extractedUrl);
      setUrl(cleanUrl);
    },
  });

  // 表单错误
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setUrl("");
    setTitle("");
    setDescription("");
    setFolderId("");
    setTags("");
    setNotes("");
    setCoverUrl("");
    setSourceName("");
    setAuthor("");
    setPublishTime("");
    setWordCount(null);
    setImageCount(null);
    setErrors({});
    setFetchStatus("idle");
    setFetchError("");
    setAutoFilledFields(new Set());
    userModifiedFieldsRef.current = new Set();
    setUserAddedTags([]);
    setSelectedUsageTags([]);
    setEnableVisionAnalysis(false);
  };

  const isValidUrl = (urlString: string): boolean => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  };

  const showExpandedSections = url && isValidUrl(url);

  const fetchMetadata = useCallback(
    async (urlToFetch: string) => {
      if (!isValidUrl(urlToFetch)) {
        return;
      }

      setFetchStatus("loading");
      setFetchError("");

      try {
        const response = await debouncedFetch(
          `/api/bookmarks/metadata?url=${encodeURIComponent(urlToFetch)}`,
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || "获取网页信息失败");
        }

        const data = await response.json();
        const metadata: WebMetadata = data.data;

        const newAutoFilled = new Set<string>();

        if (metadata.title && !userModifiedFieldsRef.current.has("title")) {
          setTitle(metadata.title);
          newAutoFilled.add("title");
        }

        if (
          metadata.description &&
          !userModifiedFieldsRef.current.has("description")
        ) {
          setDescription(metadata.description);
          newAutoFilled.add("description");
        }

        if (
          metadata.coverUrl &&
          !userModifiedFieldsRef.current.has("coverUrl")
        ) {
          setCoverUrl(metadata.coverUrl);
          newAutoFilled.add("coverUrl");
        }

        if (metadata.sourceName) {
          setSourceName(metadata.sourceName);
        }
        if (metadata.author) {
          setAuthor(metadata.author);
        }
        if (metadata.publishTime) {
          setPublishTime(metadata.publishTime);
        }
        if (metadata.wordCount) {
          setWordCount(metadata.wordCount);
        }
        if (metadata.imageCount) {
          setImageCount(metadata.imageCount);
        }

        setAutoFilledFields(newAutoFilled);
        setFetchStatus("success");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setFetchStatus("error");
        setFetchError(
          error instanceof Error ? error.message : "获取网页信息失败",
        );
      }
    },
    [debouncedFetch],
  );

  useEffect(() => {
    if (url && isValidUrl(url)) {
      fetchMetadata(url);
    } else {
      setFetchStatus("idle");
      setFetchError("");
    }

    return () => {
      abortAll();
    };
  }, [url, fetchMetadata, abortAll]);

  const markFieldAsModified = (field: string) => {
    userModifiedFieldsRef.current.add(field);
    setAutoFilledFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  const handleRefetch = () => {
    if (url && isValidUrl(url)) {
      userModifiedFieldsRef.current.clear();
      fetchMetadata(url);
    }
  };

  // URL 输入框聚焦时自动读取剪贴板
  const handleUrlInputFocus = useCallback(async () => {
    // 只在抽屉打开且输入框为空时自动读取
    if (!hasAutoReadRef.current && !url) {
      hasAutoReadRef.current = true;
      await readClipboard();
    }
  }, [url, readClipboard]);

  // URL 输入框粘贴事件处理
  const handleUrlPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData("text");
      const extractedUrl = extractUrlFromText(pastedText);

      if (extractedUrl) {
        e.preventDefault();
        const cleanUrl = extractUrlFromShareText(extractedUrl);
        setUrl(cleanUrl);
      }
    },
    [extractUrlFromText],
  );

  // 抽屉打开/关闭时重置自动读取标记
  useEffect(() => {
    if (open) {
      // 抽屉打开时重置标记，允许自动读取
      hasAutoReadRef.current = false;
    }
  }, [open]);

  // 处理关闭
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const addUserTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !userAddedTags.includes(trimmed)) {
      setUserAddedTags((prev) => [...prev, trimmed]);
    }
  };

  const removeUserTag = (tag: string) => {
    setUserAddedTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    abortAll();

    try {
      const inputTags = tags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      const finalTags = Array.from(
        new Set([...selectedUsageTags, ...userAddedTags, ...inputTags]),
      );

      const userTags = finalTags.length > 0 ? finalTags : undefined;

      const validation = createBookmarkSchema.safeParse({
        url,
        title,
        description: description || undefined,
        folderId: folderId ? parseInt(folderId) : undefined,
        userTags,
        notes: notes || undefined,
        coverUrl: coverUrl || undefined,
        sourceName: sourceName || undefined,
        author: author || undefined,
        publishTime: publishTime || undefined,
        wordCount: wordCount || undefined,
        imageCount: imageCount || undefined,
      });

      if (!validation.success) {
        const fieldErrors: Record<string, string> = {};
        validation.error.issues.forEach((err) => {
          const field = err.path[0] as string;
          fieldErrors[field] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }

      const res = await fetchWithAbort("/api/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "创建收藏失败");
      }

      toast.success("收藏创建成功！");

      if (enableVisionAnalysis && data.data?.id) {
        fetch("/api/ai/vision-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookmarkId: data.data.id,
            maxImages: 3,
          }),
        })
          .then((res) => res.json())
          .then((result) => {
            if (result.success) {
              toast.success("视觉分析完成", {
                description: "已提取图片内容和视觉标签",
              });
            }
          })
          .catch(() => {
            // Silent fail - vision analysis is optional
          });

        toast.info("正在进行视觉分析...", {
          description: "分析完成后将自动更新",
        });
      }

      if (data.data?.classification) {
        const classification = data.data
          .classification as ClassificationResponse;

        const handleUndoAutoClassification = async () => {
          await fetchWithAbort(`/api/bookmarks/${data.data.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId: null }),
          });
          router.refresh();
        };

        const handleAcceptSuggestion = async (suggestionId: number) => {
          await acceptClassificationSuggestion(suggestionId);
          router.refresh();
        };

        const handleRejectSuggestion = async (suggestionId: number) => {
          await rejectClassificationSuggestion(suggestionId);
        };

        const handleChangeFolder = (
          bookmarkId: number,
          suggestionId: number,
        ) => {
          setPendingBookmarkId(bookmarkId);
          setPendingSuggestionId(suggestionId);
          setFolderSelectOpen(true);
        };

        await handleClassificationNotification(
          classification,
          data.data.id,
          handleAcceptSuggestion,
          handleRejectSuggestion,
          handleUndoAutoClassification,
          handleChangeFolder,
        );
      }

      if (onSuccess && data.data) {
        onSuccess({
          id: data.data.id,
          title: data.data.title,
          ai_summary: data.data.ai_summary,
          ai_tags: data.data.ai_tags,
        });
      }

      resetForm();
      handleClose();

      if (data.data) {
        uiEventBus.emit(UIEvents.BOOKMARK_CREATED, { bookmark: data.data });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : "创建收藏失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderUrlStatus = () => {
    switch (fetchStatus) {
      case "loading":
        return (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
            <Loader2 className="size-3 animate-spin" />
            <span>{TEXT.FETCHING}</span>
          </div>
        );
      case "success":
        return (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="size-3" />
            <span>{TEXT.FETCH_SUCCESS}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs"
              onClick={handleRefetch}
            >
              <RefreshCw className="size-3 mr-1" />
              {TEXT.REFETCH}
            </Button>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-3" />
            <span>{fetchError || TEXT.FETCH_ERROR}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs"
              onClick={handleRefetch}
            >
              <RefreshCw className="size-3 mr-1" />
              {TEXT.RETRY}
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const renderAutoFilledBadge = (field: string) => {
    if (autoFilledFields.has(field)) {
      return (
        <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400 font-normal flex items-center gap-1">
          <Sparkles className="size-3" />
          {TEXT.AUTO_FILLED}
        </span>
      );
    }
    return null;
  };

  const handleFolderSelected = async (folderId: number, folderName: string) => {
    if (!pendingBookmarkId) return;

    const res = await fetchWithAbort(`/api/bookmarks/${pendingBookmarkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });

    if (!res.ok) {
      throw new Error("移动失败");
    }

    if (pendingSuggestionId) {
      try {
        await rejectClassificationSuggestion(pendingSuggestionId);
      } catch {
        // 静默失败
      }
    }

    toast.success(`已移动到「${folderName}」`);
    router.refresh();

    setPendingBookmarkId(null);
    setPendingSuggestionId(null);
  };

  return (
    <>
      <SideSheet
        open={open}
        onOpenChange={onOpenChange}
        size="md"
        title={TEXT.SHEET_TITLE}
        description={TEXT.SHEET_DESCRIPTION}
        headerAction={
          <Button
            type="submit"
            form="create-bookmark-form"
            disabled={isSubmitting || !url}
            size="sm"
            className="h-8 px-4 bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/25 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                {TEXT.SUBMITTING}
              </>
            ) : (
              <>
                <Plus className="size-3.5 mr-1.5" />
                {TEXT.SUBMIT_BUTTON}
              </>
            )}
          </Button>
        }
      >
        <form
          id="create-bookmark-form"
          onSubmit={handleSubmit}
          className="contents"
        >
          {/* ============================================
              Primary Zone: URL 输入
          ============================================ */}
          <SideSheetPrimaryZone index={0}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 size-10 rounded-xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Link className="size-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Label
                    htmlFor="url"
                    className="text-sm font-medium text-slate-800 dark:text-slate-200"
                  >
                    {TEXT.URL_LABEL}
                  </Label>
                  <span className="text-red-500 text-xs">*</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  {TEXT.URL_HELPER}
                </p>
                {renderUrlStatus()}
              </div>
            </div>

            <div className="relative group mt-3">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm" />
              <Input
                ref={urlInputRef}
                id="url"
                type="text"
                placeholder={TEXT.URL_PLACEHOLDER}
                value={url}
                onChange={(e) => {
                  const extractedUrl = extractUrlFromShareText(e.target.value);
                  setUrl(extractedUrl);
                }}
                onFocus={handleUrlInputFocus}
                onPaste={handleUrlPaste}
                required
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className={`relative bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-transparent focus:ring-2 focus:ring-violet-500/50 transition-all ${errors.url ? "border-red-500" : ""} ${fetchStatus === "loading" ? "pr-10" : ""}`}
              />
              {fetchStatus === "loading" && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="size-4 animate-spin text-violet-500" />
                </div>
              )}
            </div>

            {errors.url && (
              <p className="text-xs text-red-500 mt-1">{errors.url}</p>
            )}
          </SideSheetPrimaryZone>

          {/* ============================================
              Secondary Zone: 标题 + 文件夹 + 用途标签
          ============================================ */}
          {showExpandedSections && (
            <SideSheetSecondaryZone index={1}>
              {/* 标题 */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-slate-500" />
                  <Label
                    htmlFor="title"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    {TEXT.TITLE_LABEL}
                  </Label>
                  {renderAutoFilledBadge("title")}
                </div>
                <Input
                  id="title"
                  placeholder={TEXT.TITLE_PLACEHOLDER}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    markFieldAsModified("title");
                  }}
                  className={`bg-white dark:bg-slate-900 ${errors.title ? "border-red-500" : ""}`}
                />
                {errors.title && (
                  <p className="text-xs text-red-500">{errors.title}</p>
                )}
              </div>

              {/* 文件夹 */}
              {folders.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="size-4 text-slate-500" />
                    <Label
                      htmlFor="folder"
                      className="text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      {TEXT.FOLDER_LABEL}
                    </Label>
                  </div>
                  <Select value={folderId} onValueChange={setFolderId}>
                    <SelectTrigger className="bg-white dark:bg-slate-900">
                      <SelectValue placeholder={TEXT.FOLDER_PLACEHOLDER} />
                    </SelectTrigger>
                    <SelectContent>
                      {folders.map((folder) => (
                        <SelectItem
                          key={folder.id}
                          value={folder.id.toString()}
                        >
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 用途标签 */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Tags className="size-4 text-slate-500" />
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {TEXT.USAGE_TAGS_LABEL}
                  </Label>
                  <span className="text-xs text-slate-500">
                    {TEXT.USAGE_TAGS_HELPER}
                  </span>
                </div>
                <UsageTagSelector
                  selectedTags={selectedUsageTags}
                  onSelectedTagsChange={setSelectedUsageTags}
                  customUsageTags={customUsageTags}
                  onCustomTagsChange={setCustomUsageTags}
                  disabled={isSubmitting}
                />
              </div>
            </SideSheetSecondaryZone>
          )}

          {/* ============================================
              Expandable Zone: 更多选项
          ============================================ */}
          {showExpandedSections && (
            <SideSheetExpandableZone
              index={2}
              title={TEXT.MORE_OPTIONS}
              description={TEXT.MORE_OPTIONS_DESC}
              defaultExpanded={false}
            >
              {/* 描述 */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="description"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    {TEXT.DESCRIPTION_LABEL}
                  </Label>
                  {renderAutoFilledBadge("description")}
                </div>
                <Textarea
                  id="description"
                  placeholder={TEXT.DESCRIPTION_PLACEHOLDER}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    markFieldAsModified("description");
                  }}
                  rows={2}
                  className={`bg-white dark:bg-slate-900 ${errors.description ? "border-red-500" : ""}`}
                />
                {errors.description && (
                  <p className="text-xs text-red-500">{errors.description}</p>
                )}
              </div>

              {/* 自定义标签 */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="tags"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    {TEXT.CUSTOM_TAGS_LABEL}
                  </Label>
                  <span className="text-xs text-slate-500">
                    {TEXT.CUSTOM_TAGS_HELPER}
                  </span>
                </div>

                {userAddedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {userAddedTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => removeUserTag(tag)}
                        className="px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1"
                      >
                        {tag}
                        <X className="size-3 opacity-60 hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                )}

                <Input
                  id="tags"
                  placeholder={TEXT.CUSTOM_TAGS_PLACEHOLDER}
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const input = e.currentTarget;
                      if (input.value.trim()) {
                        addUserTag(input.value.trim());
                        setTags("");
                      }
                    }
                  }}
                  className={`bg-white dark:bg-slate-900 ${errors.userTags ? "border-red-500" : ""}`}
                />
                {errors.userTags && (
                  <p className="text-xs text-red-500">{errors.userTags}</p>
                )}
              </div>

              {/* 个人笔记 */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-slate-500" />
                  <Label
                    htmlFor="notes"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    {TEXT.NOTES_LABEL}
                  </Label>
                </div>
                <Textarea
                  id="notes"
                  placeholder={TEXT.NOTES_PLACEHOLDER}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`bg-white dark:bg-slate-900 ${errors.notes ? "border-red-500" : ""}`}
                />
                {errors.notes && (
                  <p className="text-xs text-red-500">{errors.notes}</p>
                )}
              </div>

              {/* 视觉分析开关 */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                    <Eye className="size-4 text-purple-500" />
                  </div>
                  <div>
                    <Label
                      htmlFor="vision-analysis"
                      className="text-sm font-medium cursor-pointer text-slate-700 dark:text-slate-300"
                    >
                      {TEXT.VISION_LABEL}
                    </Label>
                    <p className="text-xs text-slate-500">
                      {TEXT.VISION_HELPER}
                    </p>
                  </div>
                </div>
                <Switch
                  id="vision-analysis"
                  checked={enableVisionAnalysis}
                  onCheckedChange={setEnableVisionAnalysis}
                  disabled={isSubmitting}
                />
              </div>
            </SideSheetExpandableZone>
          )}
        </form>
      </SideSheet>

      {/* 换文件夹对话框 */}
      <FolderQuickSelect
        open={folderSelectOpen}
        onOpenChange={setFolderSelectOpen}
        bookmarkId={pendingBookmarkId || 0}
        onSelect={handleFolderSelected}
        title="选择其他文件夹"
      />
    </>
  );
}
