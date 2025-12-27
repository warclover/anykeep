/**
 * 手动创建书签嵌入式面板
 *
 * 基于 EmbeddedSidePanel 的书签创建面板
 * 复用 CreateBookmarkDialog 的核心逻辑，但使用挤压式布局
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  Check,
  AlertCircle,
  Link,
  FileText,
  Tags,
  MessageSquare,
  ChevronDown,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAbortableFetch,
  useDebouncedAbortableFetch,
} from "@/hooks/use-abortable-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBookmarkSchema } from "@/lib/validation";
import { extractUrlFromShareText } from "@/lib/utils/url-extractor";
import { UsageTagSelector } from "@/components/bookmark/usage-tag-selector";
import { EmbeddedSidePanel } from "@/components/ui/embedded-side-panel";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import { useFolders } from "@/hooks/use-folders";
import type { CustomUsageTag } from "@/types/supabase";

// ============================================================================
// 常量
// ============================================================================

const TEXT = {
  PANEL_TITLE: "添加收藏",
  URL_LABEL: "粘贴链接",
  URL_PLACEHOLDER: "粘贴链接或分享文本...",
  TITLE_PLACEHOLDER: "可选，保存后自动获取",
  DESC_PLACEHOLDER: "简单描述这篇内容...",
  NOTES_PLACEHOLDER: "记录想法...",
  TAGS_PLACEHOLDER: "输入标签后按回车添加",
  FETCHING: "正在获取网页信息...",
  FETCHED: "已自动填充网页信息",
  REFETCH: "重新获取",
  RETRY: "重试",
  CREATE: "创建收藏",
  CREATING: "创建中...",
  CANCEL: "取消",
  CONTENT_SECTION: "标题与内容",
  CLASSIFY_SECTION: "分类整理",
  NOTES_SECTION: "个人笔记",
  FOLDER_LABEL: "文件夹",
  FOLDER_PLACEHOLDER: "选择文件夹（可选）",
  USAGE_TAGS_LABEL: "用途标签",
  USAGE_TAGS_HINT: "方便日后筛选",
  CUSTOM_TAGS_LABEL: "自定义标签",
  CUSTOM_TAGS_HINT: "可选，保存后自动生成 AI 标签",
};

// ============================================================================
// 类型
// ============================================================================

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

interface CreatePanelEmbeddedProps {
  /** 是否展开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

// ============================================================================
// 组件
// ============================================================================

export function CreatePanelEmbedded({
  open,
  onClose,
}: CreatePanelEmbeddedProps) {
  const { fetchWithAbort } = useAbortableFetch();
  const { debouncedFetch, abortAll } = useDebouncedAbortableFetch(500);
  const { folders = [] } = useFolders();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // 元数据获取状态
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchError, setFetchError] = useState<string>("");
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(
    new Set(),
  );

  // 用于跟踪用户是否手动修改过字段
  const userModifiedFieldsRef = useRef<Set<string>>(new Set());

  // 表单错误
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 折叠状态
  const [isContentExpanded, setIsContentExpanded] = useState(true);
  const [isClassifyExpanded, setIsClassifyExpanded] = useState(true);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  const resetForm = useCallback(() => {
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
    setIsContentExpanded(true);
    setIsClassifyExpanded(true);
    setIsNotesExpanded(false);
  }, []);

  // 关闭时重置表单
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  /**
   * 验证 URL 格式
   */
  const isValidUrl = (urlString: string): boolean => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  };

  const showExpandedSections = url && isValidUrl(url);

  /**
   * 获取网页元数据
   */
  const fetchMetadata = useCallback(
    async (urlToFetch: string) => {
      if (!isValidUrl(urlToFetch)) return;

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

        if (metadata.sourceName) setSourceName(metadata.sourceName);
        if (metadata.author) setAuthor(metadata.author);
        if (metadata.publishTime) setPublishTime(metadata.publishTime);
        if (metadata.wordCount) setWordCount(metadata.wordCount);
        if (metadata.imageCount) setImageCount(metadata.imageCount);

        setAutoFilledFields(newAutoFilled);
        setFetchStatus("success");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        setFetchStatus("error");
        setFetchError(
          error instanceof Error ? error.message : "获取网页信息失败",
        );
      }
    },
    [debouncedFetch],
  );

  // URL 变化时自动获取元数据
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "创建收藏失败");
      }

      toast.success("收藏创建成功！");

      resetForm();
      onClose();

      if (data.data) {
        uiEventBus.emit(UIEvents.BOOKMARK_CREATED, { bookmark: data.data });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "创建收藏失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderUrlStatus = () => {
    switch (fetchStatus) {
      case "loading":
        return (
          <div className="flex items-center gap-1.5 text-xs text-blue-600">
            <Loader2 className="size-3 animate-spin" />
            <span>{TEXT.FETCHING}</span>
          </div>
        );
      case "success":
        return (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <Check className="size-3" />
            <span>{TEXT.FETCHED}</span>
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
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertCircle className="size-3" />
            <span>{fetchError || "获取失败，请手动填写"}</span>
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

  return (
    <EmbeddedSidePanel
      open={open}
      onClose={onClose}
      title={TEXT.PANEL_TITLE}
      titleIcon={
        <div className="size-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/25">
          <Plus className="size-4 text-white" />
        </div>
      }
      width={400}
      headerClassName="bg-gradient-to-r from-pink-50 via-rose-50 to-white dark:from-pink-950/30 dark:via-rose-950/20 dark:to-gray-900 border-pink-100 dark:border-pink-900/30"
      titleClassName="text-pink-700 dark:text-pink-300"
      closeButtonClassName="text-pink-400 hover:text-pink-600 hover:bg-pink-100/50 dark:hover:bg-pink-900/30"
      footer={
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {TEXT.CANCEL}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !url}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                {TEXT.CREATING}
              </>
            ) : (
              TEXT.CREATE
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* URL 输入区 */}
        <div className="rounded-xl bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50 p-3 space-y-2 border border-violet-100/50">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 size-7 rounded-lg bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Link className="size-3.5 text-white" />
            </div>
            <div className="flex-1">
              <Label
                htmlFor="url"
                className="text-sm font-medium text-gray-800"
              >
                {TEXT.URL_LABEL}
                <span className="text-red-500 ml-1">*</span>
              </Label>
            </div>
          </div>

          <div className="relative">
            <Input
              id="url"
              type="text"
              placeholder={TEXT.URL_PLACEHOLDER}
              value={url}
              onChange={(e) => setUrl(extractUrlFromShareText(e.target.value))}
              required
              className={`bg-white text-sm ${errors.url ? "border-red-500" : ""}`}
            />
            {fetchStatus === "loading" && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="size-4 animate-spin text-violet-500" />
              </div>
            )}
          </div>

          {renderUrlStatus()}
          {errors.url && <p className="text-xs text-red-500">{errors.url}</p>}
        </div>

        {/* 内容区 - 可折叠 */}
        {showExpandedSections && (
          <div className="rounded-lg bg-blue-50/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsContentExpanded(!isContentExpanded)}
              className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 hover:bg-blue-100/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="size-4" />
                <span>{TEXT.CONTENT_SECTION}</span>
                {autoFilledFields.has("title") && (
                  <span className="text-xs text-green-600 font-normal flex items-center gap-1">
                    <Sparkles className="size-3" />
                  </span>
                )}
              </div>
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${isContentExpanded ? "rotate-180" : ""}`}
              />
            </button>

            {isContentExpanded && (
              <div className="px-3 pb-3 space-y-3">
                <div className="space-y-1.5">
                  <Input
                    id="title"
                    placeholder={TEXT.TITLE_PLACEHOLDER}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      markFieldAsModified("title");
                    }}
                    className={`bg-white text-sm ${errors.title ? "border-red-500" : ""}`}
                  />
                  {errors.title && (
                    <p className="text-xs text-red-500">{errors.title}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Textarea
                    id="description"
                    placeholder={TEXT.DESC_PLACEHOLDER}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      markFieldAsModified("description");
                    }}
                    rows={2}
                    className={`bg-white text-sm ${errors.description ? "border-red-500" : ""}`}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 分类区 - 可折叠 */}
        {showExpandedSections && (
          <div className="rounded-lg bg-amber-50/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsClassifyExpanded(!isClassifyExpanded)}
              className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 hover:bg-amber-100/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Tags className="size-4" />
                <span>{TEXT.CLASSIFY_SECTION}</span>
              </div>
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${isClassifyExpanded ? "rotate-180" : ""}`}
              />
            </button>

            {isClassifyExpanded && (
              <div className="px-3 pb-3 space-y-3">
                {/* 文件夹选择 */}
                {folders.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600">
                      {TEXT.FOLDER_LABEL}
                    </Label>
                    <Select value={folderId} onValueChange={setFolderId}>
                      <SelectTrigger className="bg-white text-sm h-9">
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
                    <Label className="text-xs text-gray-600">
                      {TEXT.USAGE_TAGS_LABEL}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {TEXT.USAGE_TAGS_HINT}
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

                {/* 自定义标签 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-gray-600">
                      {TEXT.CUSTOM_TAGS_LABEL}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {TEXT.CUSTOM_TAGS_HINT}
                    </span>
                  </div>

                  {userAddedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {userAddedTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => removeUserTag(tag)}
                          className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 transition-colors flex items-center gap-1"
                        >
                          {tag}
                          <span className="text-blue-500 hover:text-blue-700">
                            ×
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <Input
                    id="tags"
                    placeholder={TEXT.TAGS_PLACEHOLDER}
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (tags.trim()) {
                          addUserTag(tags.trim());
                          setTags("");
                        }
                      }
                    }}
                    className={`bg-white text-sm ${errors.userTags ? "border-red-500" : ""}`}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 笔记区 - 可折叠 */}
        {showExpandedSections && (
          <div className="rounded-lg bg-purple-50/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsNotesExpanded(!isNotesExpanded)}
              className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 hover:bg-purple-100/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4" />
                <span>{TEXT.NOTES_SECTION}</span>
              </div>
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${isNotesExpanded ? "rotate-180" : ""}`}
              />
            </button>

            {isNotesExpanded && (
              <div className="px-3 pb-3">
                <Textarea
                  id="notes"
                  placeholder={TEXT.NOTES_PLACEHOLDER}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`bg-white text-sm ${errors.notes ? "border-red-500" : ""}`}
                />
              </div>
            )}
          </div>
        )}
      </form>
    </EmbeddedSidePanel>
  );
}

export default CreatePanelEmbedded;
