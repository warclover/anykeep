/**
 * 创建收藏抽屉组件
 * 右侧滑入的抽屉式表单，用于手动创建收藏
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
  Eye,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAbortableFetch,
  useDebouncedAbortableFetch,
} from "@/hooks/use-abortable-fetch";
import { useClipboardPaste } from "@/components/quick-add/hooks/useClipboardPaste";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import type { CustomUsageTag } from "@/types/supabase";

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

/**
 * 渐变流光 Slogan 组件
 */
function GradientSlogan() {
  return (
    <div className="flex flex-col items-center select-none">
      {/* 单行: Keep Smart. Read Anytime. */}
      <div className="flex items-baseline gap-1.5 flex-wrap justify-center">
        <span
          className="text-xl font-bold animate-gradient-flow bg-gradient-to-r from-violet-600 via-blue-500 via-cyan-400 via-blue-500 to-violet-600 bg-[length:200%_100%] bg-clip-text text-transparent tracking-wide"
          style={{
            fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
          }}
        >
          Keep
        </span>
        <span
          className="text-2xl font-bold animate-gradient-flow bg-gradient-to-r from-violet-600 via-blue-500 via-cyan-400 via-blue-500 to-violet-600 bg-[length:200%_100%] bg-clip-text text-transparent tracking-tight"
          style={{
            fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
          }}
        >
          Smart.
        </span>
        <span
          className="text-xl font-bold animate-gradient-flow bg-gradient-to-r from-cyan-400 via-blue-500 via-violet-600 via-blue-500 to-cyan-400 bg-[length:200%_100%] bg-clip-text text-transparent tracking-wide"
          style={{
            fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
            animationDelay: "0.3s",
          }}
        >
          Read
        </span>
        <span
          className="text-2xl font-bold animate-gradient-flow bg-gradient-to-r from-cyan-400 via-blue-500 via-violet-600 via-blue-500 to-cyan-400 bg-[length:200%_100%] bg-clip-text text-transparent tracking-tight"
          style={{
            fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
            animationDelay: "0.3s",
          }}
        >
          Anytime.
        </span>
      </div>
      <div className="h-1 w-52 animate-gradient-flow bg-gradient-to-r from-violet-500 via-blue-500 via-cyan-400 via-blue-500 to-violet-500 bg-[length:200%_100%] rounded-full mt-1" />
    </div>
  );
}

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

  // 关闭动画状态
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    setUserAddedTags([]);
    setSelectedUsageTags([]);
    setEnableVisionAnalysis(false);
    setIsDescriptionExpanded(false);
    setIsClassificationExpanded(true);
    setIsCustomTagsExpanded(false);
    setIsNotesExpanded(false);
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

  // URL 输入框失焦时重置自动读取标记
  const handleUrlInputBlur = useCallback(() => {
    // 不需要重置，因为我们只想在每次打开抽屉时自动读取一次
  }, []);

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
      // 重置关闭状态
      setIsClosing(false);
    }
    // 清理定时器
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [open]);

  // 带动画的关闭处理
  const handleClose = useCallback(() => {
    if (isClosing) return; // 防止重复触发
    setIsClosing(true);
    // 延迟关闭，等待动画完成 (350ms CSS 动画 + 50ms 缓冲)
    closeTimeoutRef.current = setTimeout(() => {
      onOpenChange(false);
      setIsClosing(false);
    }, 400);
  }, [isClosing, onOpenChange]);

  // 处理 Drawer 的 onOpenChange
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        onOpenChange(true);
      } else {
        handleClose();
      }
    },
    [onOpenChange, handleClose],
  );

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
        window.dispatchEvent(
          new CustomEvent("bookmarkCreated", { detail: data.data }),
        );
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
      <div className={isClosing ? "drawer-closing" : ""}>
        <Drawer open={open} onOpenChange={handleOpenChange} direction="right">
          <DrawerContent
            className={`h-full w-full sm:w-[520px] sm:max-w-[520px] p-0 flex flex-col gap-0 rounded-none ${isClosing ? "drawer-slide-out" : "drawer-slide-in"}`}
          >
            {/* 隐藏的无障碍标题 */}
            <DrawerTitle className="sr-only">手动创建收藏</DrawerTitle>
            <DrawerDescription className="sr-only">
              输入链接保存网页内容，支持自动获取标题和摘要
            </DrawerDescription>

            {/* ══════════════════════════════════════════════════════════════
              顶部固定区域：Slogan + 操作按钮
          ══════════════════════════════════════════════════════════════ */}
            <div className="sticky top-0 z-10 bg-gradient-to-b from-violet-50/90 via-blue-50/80 to-transparent backdrop-blur-sm border-b border-violet-100/50 px-6 pt-6 pb-4">
              {/* Slogan with gradient flow animation */}
              <GradientSlogan />

              {/* 操作按钮 */}
              <div className="flex items-center justify-between mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting || isClosing}
                  className="w-24"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  form="create-bookmark-form"
                  disabled={isSubmitting}
                  className="w-28 bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/25"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 mr-1.5 animate-spin" />
                      创建中
                    </>
                  ) : (
                    <>
                      <Plus className="size-4 mr-1.5" />
                      创建收藏
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
              可滚动的表单区域
          ══════════════════════════════════════════════════════════════ */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <form
                id="create-bookmark-form"
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {/* 📎 核心信息区块 */}
                <div className="rounded-xl bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50 p-4 space-y-3 border border-violet-100/50">
                  <div className="flex items-center gap-3">
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
                        输入链接后自动获取网页信息
                      </p>
                    </div>
                  </div>

                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm" />
                    <Input
                      ref={urlInputRef}
                      id="url"
                      type="text"
                      placeholder="粘贴链接或分享文本..."
                      value={url}
                      onChange={(e) => {
                        const extractedUrl = extractUrlFromShareText(
                          e.target.value,
                        );
                        setUrl(extractedUrl);
                      }}
                      onFocus={handleUrlInputFocus}
                      onBlur={handleUrlInputBlur}
                      onPaste={handleUrlPaste}
                      required
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className={`relative bg-white border-gray-200 focus:border-transparent focus:ring-2 focus:ring-violet-500/50 transition-all ${errors.url ? "border-red-500" : ""} ${fetchStatus === "loading" ? "pr-8" : ""}`}
                    />
                    {fetchStatus === "loading" && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="size-4 animate-spin text-violet-500" />
                      </div>
                    )}
                  </div>

                  {errors.url && (
                    <p className="text-xs text-red-500">{errors.url}</p>
                  )}
                </div>

                {/* 📄 内容信息区块 */}
                <div
                  className={`rounded-lg bg-blue-50/50 p-3 space-y-3 transition-all duration-300 ease-out ${
                    showExpandedSections
                      ? "opacity-100 max-h-[500px]"
                      : "opacity-0 max-h-0 overflow-hidden p-0"
                  }`}
                >
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

                  <div className="space-y-1.5">
                    {!isDescriptionExpanded ? (
                      <button
                        type="button"
                        onClick={() => setIsDescriptionExpanded(true)}
                        className="w-full flex items-center justify-between py-2 px-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-blue-100/50 rounded-lg transition-colors border border-dashed border-gray-300 hover:border-gray-400"
                      >
                        <div className="flex items-center gap-2">
                          <span>
                            {description ? (
                              <span className="text-gray-700 line-clamp-1">
                                {description.length > 40
                                  ? description.slice(0, 40) + "..."
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
                          <p className="text-xs text-red-500">
                            {errors.description}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 🏷️ 分类整理区块 */}
                <div
                  className={`rounded-lg bg-amber-50/50 transition-all duration-300 ease-out ${
                    showExpandedSections
                      ? "opacity-100 max-h-[800px]"
                      : "opacity-0 max-h-0 overflow-hidden"
                  }`}
                >
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

                  <div
                    className={`px-3 pb-3 space-y-3 transition-all duration-200 ease-out ${
                      isClassificationExpanded
                        ? "opacity-100 max-h-[600px]"
                        : "opacity-0 max-h-0 overflow-hidden"
                    }`}
                  >
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

                    <div className="space-y-1.5">
                      {!isCustomTagsExpanded ? (
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
                            <p className="text-xs text-red-500">
                              {errors.userTags}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 💭 个人笔记区块 */}
                <div
                  className={`rounded-lg bg-purple-50/50 transition-all duration-300 ease-out ${
                    showExpandedSections
                      ? "opacity-100 max-h-[400px]"
                      : "opacity-0 max-h-0 overflow-hidden"
                  }`}
                >
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

                {/* 视觉分析开关 */}
                <div
                  className={`flex items-center justify-between rounded-lg border p-3 bg-muted/30 transition-all duration-300 ease-out ${
                    showExpandedSections
                      ? "opacity-100 max-h-20"
                      : "opacity-0 max-h-0 overflow-hidden p-0 border-0"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                      <Eye className="size-4 text-purple-500" />
                    </div>
                    <div>
                      <Label
                        htmlFor="vision-analysis"
                        className="text-sm font-medium cursor-pointer"
                      >
                        深度视觉分析
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        提取图片文字、分析图表逻辑
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
              </form>
            </div>

            {/* 底部关闭按钮 */}
            <div className="sticky bottom-0 p-4 flex justify-center bg-gradient-to-t from-white via-white to-transparent">
              <button
                type="button"
                onClick={handleClose}
                disabled={isClosing}
                className="size-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <X className="size-5 text-gray-500" />
              </button>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

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
