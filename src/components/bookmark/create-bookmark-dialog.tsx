/**
 * 创建收藏对话框组件
 * 提供表单让用户手动输入 URL、标题、描述等信息
 * 支持粘贴 URL 后自动获取网页元数据
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, RefreshCw, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  useAbortableFetch,
  useDebouncedAbortableFetch,
} from "@/hooks/use-abortable-fetch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

      // 最终用户标签 = 已添加的标签 + 输入框标签（去重）
      const finalTags = Array.from(new Set([...userAddedTags, ...inputTags]));

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
        return (
          <p className="text-xs text-gray-500">
            支持微信公众号、B站、小红书等平台链接
          </p>
        );
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
          <DialogDescription>
            输入链接后自动获取网页信息，稍后可以继续完善内容
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL 输入 */}
          <div className="space-y-2">
            <Label htmlFor="url">
              链接 <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="url"
                type="text"
                placeholder="粘贴链接或分享文本..."
                value={url}
                onChange={(e) => {
                  // 智能提取 URL（支持小红书、抖音等分享文本格式）
                  const extractedUrl = extractUrlFromShareText(e.target.value);
                  setUrl(extractedUrl);
                }}
                required
                className={`${errors.url ? "border-red-500" : ""} ${fetchStatus === "loading" ? "pr-8" : ""}`}
              />
              {fetchStatus === "loading" && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="size-4 animate-spin text-gray-400" />
                </div>
              )}
            </div>
            {errors.url && <p className="text-xs text-red-500">{errors.url}</p>}
            {renderUrlStatus()}
          </div>

          {/* 标题输入 */}
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center">
              标题
              {renderAutoFilledBadge("title")}
            </Label>
            <Input
              id="title"
              placeholder="可选，保存后自动获取"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                markFieldAsModified("title");
              }}
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title}</p>
            )}
            {!title && (
              <p className="text-xs text-gray-500">
                留空时系统会自动获取网页标题
              </p>
            )}
          </div>

          {/* 描述输入 */}
          <div className="space-y-2">
            <Label htmlFor="description" className="flex items-center">
              描述
              {renderAutoFilledBadge("description")}
            </Label>
            <Textarea
              id="description"
              placeholder="简单描述这篇内容..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markFieldAsModified("description");
              }}
              rows={3}
              className={errors.description ? "border-red-500" : ""}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description}</p>
            )}
            <p className="text-xs text-gray-500">
              保存后系统会自动生成 AI 摘要
            </p>
          </div>

          {/* 文件夹选择 */}
          {folders.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="folder">文件夹</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择文件夹（可选）" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id.toString()}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 标签输入区域 */}
          <div className="space-y-2">
            <Label htmlFor="tags">标签</Label>

            {/* 已添加的标签展示 */}
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
                    <span className="text-blue-500 hover:text-blue-700">×</span>
                  </button>
                ))}
              </div>
            )}

            {/* 标签输入框 */}
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
              className={errors.userTags ? "border-red-500" : ""}
            />
            {errors.userTags && (
              <p className="text-xs text-red-500">{errors.userTags}</p>
            )}
            <p className="text-xs text-gray-500">
              {userAddedTags.length > 0
                ? `已添加 ${userAddedTags.length} 个标签，保存后会自动生成 AI 标签`
                : "可选，保存后系统会自动生成 AI 标签"}
            </p>
          </div>

          {/* 备注输入 */}
          <div className="space-y-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              placeholder="记录想法..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`resize-none ${errors.notes ? "border-red-500" : ""}`}
            />
            {errors.notes && (
              <p className="text-xs text-red-500">{errors.notes}</p>
            )}
          </div>

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
