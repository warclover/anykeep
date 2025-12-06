/**
 * 创建收藏对话框组件
 * 提供表单让用户手动输入 URL、标题、描述等信息
 * 支持粘贴 URL 后自动获取网页元数据
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
  Tags,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAbortableFetch,
  useDebouncedAbortableFetch,
} from "@/hooks/use-abortable-fetch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  handleClassificationNotification,
  acceptClassificationSuggestion,
  rejectClassificationSuggestion,
  type ClassificationResponse,
} from "@/lib/utils/classification-notification";
import { UsageTagSelector } from "./usage-tag-selector";
import type { CustomUsageTag } from "@/types/supabase";

interface BookmarkCreatedData {
  id: number;
  title: string;
  ai_summary?: string | null;
  ai_tags?: string[] | null;
}

interface CreateBookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders?: Array<{ id: number; name: string }>;
  onSuccess?: (bookmark: BookmarkCreatedData) => void;
}

interface WebMetadata {
  title: string;
  description: string;
  coverUrl: string;
  sourceName: string; // 来源名称（公众号名称等）
  author: string; // 文章作者
  publishTime: string; // 原文发布时间
  platform: string;
  siteName: string;
  wordCount: number;
  imageCount: number;
}

type FetchStatus = "idle" | "loading" | "success" | "error";

export function CreateBookmarkDialog({
  open,
  onOpenChange,
  folders = [],
  onSuccess,
}: CreateBookmarkDialogProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const { debouncedFetch, abortAll } = useDebouncedAbortableFetch(500);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 表单状态
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [sourceName, setSourceName] = useState<string>(""); // 来源名称
  const [author, setAuthor] = useState<string>(""); // 文章作者
  const [publishTime, setPublishTime] = useState<string>(""); // 发布时间
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
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isClassificationExpanded, setIsClassificationExpanded] =
    useState(true);
  const [isCustomTagsExpanded, setIsCustomTagsExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

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
    // 重置用户标签
    setUserAddedTags([]);
    // 重置用途标签
    setSelectedUsageTags([]);
    // 重置折叠状态
    setIsDescriptionExpanded(false);
    setIsClassificationExpanded(true);
    setIsCustomTagsExpanded(false);
    setIsNotesExpanded(false);
  };

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

  // 是否显示扩展区域（输入有效 URL 后显示）
  const showExpandedSections = url && isValidUrl(url);

  /**
   * 获取网页元数据
   */
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

        // 自动填充未被用户修改的字段
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

        // 保存来源名称、作者和发布时间（这些不需要用户修改追踪）
        if (metadata.sourceName) {
          setSourceName(metadata.sourceName);
        }
        if (metadata.author) {
          setAuthor(metadata.author);
        }
        if (metadata.publishTime) {
          setPublishTime(metadata.publishTime);
        }

        // 保存字数和图片数（这些不需要用户修改追踪）
        if (metadata.wordCount) {
          setWordCount(metadata.wordCount);
        }
        if (metadata.imageCount) {
          setImageCount(metadata.imageCount);
        }

        setAutoFilledFields(newAutoFilled);
        setFetchStatus("success");
      } catch (error) {
        // 忽略取消错误
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

  /**
   * URL 变化时自动获取元数据
   */
  useEffect(() => {
    if (url && isValidUrl(url)) {
      fetchMetadata(url);
    } else {
      // URL 无效时重置状态
      setFetchStatus("idle");
      setFetchError("");
    }

    // 组件卸载或 URL 变化时取消之前的请求
    return () => {
      abortAll();
    };
  }, [url, fetchMetadata, abortAll]);

  /**
   * 标记字段被用户修改
   */
  const markFieldAsModified = (field: string) => {
    userModifiedFieldsRef.current.add(field);
    // 从自动填充集合中移除
    setAutoFilledFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  /**
   * 手动重新获取元数据
   */
  const handleRefetch = () => {
    if (url && isValidUrl(url)) {
      // 清除用户修改标记，允许覆盖
      userModifiedFieldsRef.current.clear();
      fetchMetadata(url);
    }
  };

  /**
   * 添加用户标签
   */
  const addUserTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !userAddedTags.includes(trimmed)) {
      setUserAddedTags((prev) => [...prev, trimmed]);
    }
  };

  /**
   * 移除用户标签
   */
  const removeUserTag = (tag: string) => {
    setUserAddedTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    // 取消所有正在进行的元数据请求
    abortAll();

    try {
      // 合并用户添加的标签和输入框中的标签
      const inputTags = tags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      // 最终用户标签 = 用途标签 + 已添加的标签 + 输入框标签（去重）
      // 用途标签放在最前面，便于展示时优先显示
      const finalTags = Array.from(
        new Set([...selectedUsageTags, ...userAddedTags, ...inputTags]),
      );

      const userTags = finalTags.length > 0 ? finalTags : undefined;

      // 验证输入
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
        // 注意：AI 内容将在后台异步生成，不再从前端传递
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

      // 调用创建 API
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

      // 处理 AI 分类通知（高置信度/中置信度）
      if (data.data?.classification) {
        const classification = data.data
          .classification as ClassificationResponse;

        // 撤销自动归类的处理函数
        const handleUndoAutoClassification = async () => {
          // 将收藏移回"待整理"文件夹
          await fetchWithAbort(`/api/bookmarks/${data.data.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId: null }), // null 会触发移到待整理
          });
          router.refresh();
        };

        // 接受建议的处理函数
        const handleAcceptSuggestion = async (suggestionId: number) => {
          await acceptClassificationSuggestion(suggestionId);
          router.refresh();
        };

        // 拒绝建议的处理函数
        const handleRejectSuggestion = async (suggestionId: number) => {
          await rejectClassificationSuggestion(suggestionId);
          // 拒绝不刷新页面
        };

        await handleClassificationNotification(
          classification,
          data.data.id,
          handleAcceptSuggestion,
          handleRejectSuggestion,
          handleUndoAutoClassification,
        );
      }

      // 触发成功回调（用于 AI 文件夹推荐）
      if (onSuccess && data.data) {
        onSuccess({
          id: data.data.id,
          title: data.data.title,
          ai_summary: data.data.ai_summary,
          ai_tags: data.data.ai_tags,
        });
      }

      resetForm();
      onOpenChange(false);

      // 发送自定义事件通知首页更新（乐观更新，避免 SWR 缓存问题）
      // 首页监听此事件后会将新书签插入列表头部
      if (data.data) {
        window.dispatchEvent(
          new CustomEvent("bookmarkCreated", { detail: data.data }),
        );
      }
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : "创建收藏失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 渲染 URL 输入框后的状态指示器
   */
  const renderUrlStatus = () => {
    switch (fetchStatus) {
      case "loading":
        return (
          <div className="flex items-center gap-1.5 text-xs text-blue-600">
            <Loader2 className="size-3 animate-spin" />
            <span>正在获取网页信息...</span>
          </div>
        );
      case "success":
        return (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <Check className="size-3" />
            <span>已自动填充网页信息</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs"
              onClick={handleRefetch}
            >
              <RefreshCw className="size-3 mr-1" />
              重新获取
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
              重试
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  /**
   * 渲染自动填充标记
   */
  const renderAutoFilledBadge = (field: string) => {
    if (autoFilledFields.has(field)) {
      return (
        <span className="ml-2 text-xs text-green-600 font-normal flex items-center gap-1">
          <Sparkles className="size-3" />
          已自动填充
        </span>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加收藏</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* ══════════════════════════════════════════════════════════════
              📎 核心信息区块 - 始终显示（品牌视觉焦点）
          ══════════════════════════════════════════════════════════════ */}
          <div className="rounded-xl bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50 p-4 space-y-3 border border-violet-100/50">
            <div className="flex items-center gap-3">
              {/* 渐变图标徽章 - 品牌视觉锚点 */}
              <div className="flex-shrink-0 size-9 rounded-xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Link className="size-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label
                    htmlFor="url"
                    className="text-sm font-medium text-gray-800"
                  >
                    粘贴链接
                  </Label>
                  <span className="text-red-500 text-xs">*</span>
                  {renderUrlStatus()}
                </div>
                <p className="text-xs text-muted-foreground">
                  输入链接后自动获取网页信息，支持微信公众号、B站、小红书、抖音等平台
                </p>
              </div>
            </div>

            {/* 输入框 - 聚焦时渐变边框 */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm" />
              <Input
                id="url"
                type="text"
                placeholder="粘贴链接或分享文本..."
                value={url}
                onChange={(e) => {
                  const extractedUrl = extractUrlFromShareText(e.target.value);
                  setUrl(extractedUrl);
                }}
                required
                className={`relative bg-white border-gray-200 focus:border-transparent focus:ring-2 focus:ring-violet-500/50 transition-all ${errors.url ? "border-red-500" : ""} ${fetchStatus === "loading" ? "pr-8" : ""}`}
              />
              {fetchStatus === "loading" && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="size-4 animate-spin text-violet-500" />
                </div>
              )}
            </div>

            {errors.url && <p className="text-xs text-red-500">{errors.url}</p>}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              📄 内容信息区块 - 输入链接后展开
          ══════════════════════════════════════════════════════════════ */}
          <div
            className={`rounded-lg bg-blue-50/50 p-3 space-y-3 transition-all duration-300 ease-out ${
              showExpandedSections
                ? "opacity-100 max-h-[500px]"
                : "opacity-0 max-h-0 overflow-hidden p-0"
            }`}
          >
            {/* 区块标题 */}
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 flex-wrap">
              <FileText className="size-4" />
              <span>标题与内容</span>
              {autoFilledFields.has("title") && (
                <span className="text-xs text-green-600 font-normal flex items-center gap-1">
                  <Sparkles className="size-3" />
                  已自动填充
                </span>
              )}
              <span className="text-xs text-muted-foreground font-normal">
                留空时自动获取
              </span>
            </div>

            {/* 标题输入 */}
            <div className="space-y-1.5">
              <Input
                id="title"
                placeholder="可选，保存后自动获取"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markFieldAsModified("title");
                }}
                className={`bg-white ${errors.title ? "border-red-500" : ""}`}
              />
              {errors.title && (
                <p className="text-xs text-red-500">{errors.title}</p>
              )}
            </div>

            {/* 描述输入 - 可折叠 */}
            <div className="space-y-1.5">
              {!isDescriptionExpanded ? (
                /* 折叠状态：显示展开按钮或描述预览 */
                <button
                  type="button"
                  onClick={() => setIsDescriptionExpanded(true)}
                  className="w-full flex items-center justify-between py-2 px-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-blue-100/50 rounded-lg transition-colors border border-dashed border-gray-300 hover:border-gray-400"
                >
                  <div className="flex items-center gap-2">
                    <span>
                      {description ? (
                        <span className="text-gray-700 line-clamp-1">
                          {description.length > 50
                            ? description.slice(0, 50) + "..."
                            : description}
                        </span>
                      ) : (
                        "添加描述（可选）"
                      )}
                    </span>
                    {autoFilledFields.has("description") && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Sparkles className="size-3" />
                        已自动填充
                      </span>
                    )}
                  </div>
                  <ChevronDown className="size-4" />
                </button>
              ) : (
                /* 展开状态：显示输入框 */
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="description"
                        className="flex items-center text-gray-600"
                      >
                        描述
                        {renderAutoFilledBadge("description")}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        保存后自动生成 AI 摘要
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDescriptionExpanded(false)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      收起
                    </button>
                  </div>
                  <Textarea
                    id="description"
                    placeholder="简单描述这篇内容..."
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      markFieldAsModified("description");
                    }}
                    rows={2}
                    className={`bg-white ${errors.description ? "border-red-500" : ""}`}
                  />
                  {errors.description && (
                    <p className="text-xs text-red-500">{errors.description}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              🏷️ 分类整理区块 - 输入链接后展开，可折叠
          ══════════════════════════════════════════════════════════════ */}
          <div
            className={`rounded-lg bg-amber-50/50 transition-all duration-300 ease-out ${
              showExpandedSections
                ? "opacity-100 max-h-[800px]"
                : "opacity-0 max-h-0 overflow-hidden"
            }`}
          >
            {/* 可折叠的区块头部 */}
            <button
              type="button"
              onClick={() =>
                setIsClassificationExpanded(!isClassificationExpanded)
              }
              className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 hover:bg-amber-100/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <Tags className="size-4" />
                <span>分类整理</span>
                <span className="text-xs text-muted-foreground font-normal">
                  标签与文件夹
                </span>
              </div>
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${
                  isClassificationExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* 折叠内容 */}
            <div
              className={`px-3 pb-3 space-y-3 transition-all duration-200 ease-out ${
                isClassificationExpanded
                  ? "opacity-100 max-h-[600px]"
                  : "opacity-0 max-h-0 overflow-hidden"
              }`}
            >
              {/* 文件夹选择 */}
              {folders.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="folder" className="text-gray-600">
                    文件夹
                  </Label>
                  <Select value={folderId} onValueChange={setFolderId}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="选择文件夹（可选）" />
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

              {/* 用途标签选择 */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-gray-600">用途标签</Label>
                  <span className="text-xs text-muted-foreground">
                    方便日后筛选
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

              {/* 自定义标签输入 - 可折叠 */}
              <div className="space-y-1.5">
                {!isCustomTagsExpanded ? (
                  /* 折叠状态：显示展开按钮或已添加标签预览 */
                  <button
                    type="button"
                    onClick={() => setIsCustomTagsExpanded(true)}
                    className="w-full flex items-center justify-between py-2 px-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-amber-100/50 rounded-lg transition-colors border border-dashed border-gray-300 hover:border-gray-400"
                  >
                    <div className="flex items-center gap-2">
                      <span>
                        {userAddedTags.length > 0 ? (
                          <span className="text-gray-700">
                            已添加 {userAddedTags.length} 个标签
                          </span>
                        ) : (
                          "添加自定义标签（可选）"
                        )}
                      </span>
                    </div>
                    <ChevronDown className="size-4" />
                  </button>
                ) : (
                  /* 展开状态：显示输入框 */
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="tags" className="text-gray-600">
                          自定义标签
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          可选，保存后自动生成 AI 标签
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCustomTagsExpanded(false)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        收起
                      </button>
                    </div>

                    {userAddedTags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {userAddedTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => removeUserTag(tag)}
                            className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 transition-colors flex items-center gap-1"
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
                      placeholder="输入标签后按回车添加"
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
                      className={`bg-white ${errors.userTags ? "border-red-500" : ""}`}
                    />
                    {errors.userTags && (
                      <p className="text-xs text-red-500">{errors.userTags}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              💭 个人笔记区块 - 输入链接后展开，默认收起
          ══════════════════════════════════════════════════════════════ */}
          <div
            className={`rounded-lg bg-purple-50/50 transition-all duration-300 ease-out ${
              showExpandedSections
                ? "opacity-100 max-h-[400px]"
                : "opacity-0 max-h-0 overflow-hidden"
            }`}
          >
            {/* 可折叠的区块头部 */}
            <button
              type="button"
              onClick={() => setIsNotesExpanded(!isNotesExpanded)}
              className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 hover:bg-purple-100/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4" />
                <span>个人笔记</span>
                <span className="text-xs text-muted-foreground font-normal">
                  记录想法
                </span>
              </div>
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${
                  isNotesExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* 折叠内容 */}
            <div
              className={`px-3 pb-3 transition-all duration-200 ease-out ${
                isNotesExpanded
                  ? "opacity-100 max-h-[300px]"
                  : "opacity-0 max-h-0 overflow-hidden"
              }`}
            >
              <Textarea
                id="notes"
                placeholder="记录想法..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={`bg-white ${errors.notes ? "border-red-500" : ""}`}
              />
              {errors.notes && (
                <p className="text-xs text-red-500">{errors.notes}</p>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              操作按钮 + 品牌 Slogan
          ══════════════════════════════════════════════════════════════ */}
          <DialogFooter className="flex-row justify-between items-end sm:justify-between">
            {/* 品牌 Slogan - 输入链接后隐藏 */}
            <div
              className={`transition-all duration-500 ease-out ${
                showExpandedSections
                  ? "opacity-0 -translate-x-4 pointer-events-none"
                  : "opacity-100 translate-x-0"
              }`}
            >
              <div className="flex items-baseline gap-3 select-none">
                <span
                  className="text-4xl font-bold bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400 bg-clip-text text-transparent tracking-wide"
                  style={{
                    fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
                  }}
                >
                  Just
                </span>
                <span
                  className="text-5xl font-bold bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400 bg-clip-text text-transparent tracking-tight"
                  style={{
                    fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
                  }}
                >
                  Keep!
                </span>
              </div>
              <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400 rounded-full mt-0.5" />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : (
                  "创建收藏"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
