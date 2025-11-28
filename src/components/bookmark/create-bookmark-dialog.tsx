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
import { ImageUpload } from "@/components/ui/image-upload";
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
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [imageCount, setImageCount] = useState<number | null>(null);

  // AI 标签相关状态
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // 元数据获取状态
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchError, setFetchError] = useState<string>("");
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(
    new Set(),
  );

  // 用于跟踪用户是否手动修改过字段
  const userModifiedFieldsRef = useRef<Set<string>>(new Set());

  // AI 标签生成的 AbortController
  const tagGenerationAbortControllerRef = useRef<AbortController | null>(null);

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
    setWordCount(null);
    setImageCount(null);
    setErrors({});
    setFetchStatus("idle");
    setFetchError("");
    setAutoFilledFields(new Set());
    userModifiedFieldsRef.current = new Set();
    // 重置 AI 标签
    setAiTags([]);
    setSelectedTags(new Set());
    setIsGeneratingTags(false);
    // 取消AI标签生成请求
    if (tagGenerationAbortControllerRef.current) {
      tagGenerationAbortControllerRef.current.abort();
      tagGenerationAbortControllerRef.current = null;
    }
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

        // 保存来源名称和作者（这些不需要用户修改追踪）
        if (metadata.sourceName) {
          setSourceName(metadata.sourceName);
        }
        if (metadata.author) {
          setAuthor(metadata.author);
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
   * 实时生成 AI 标签
   */
  const generateAITags = useCallback(async () => {
    if (!title || title.length < 3) {
      return;
    }

    // 取消之前的AI标签生成请求
    if (tagGenerationAbortControllerRef.current) {
      tagGenerationAbortControllerRef.current.abort();
    }

    // 创建新的AbortController
    const abortController = new AbortController();
    tagGenerationAbortControllerRef.current = abortController;

    setIsGeneratingTags(true);

    try {
      const response = await fetch("/api/bookmarks/generate-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("生成标签失败");
      }

      const data = await response.json();
      const generatedTags = data.data.tags || [];

      setAiTags(generatedTags);

      // 默认选中所有 AI 标签
      setSelectedTags(new Set(generatedTags));

      toast.success("✨ AI 已生成标签建议");
    } catch (error) {
      // 忽略取消错误
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Generate tags error:", error);
      // 静默失败，不干扰用户体验
    } finally {
      setIsGeneratingTags(false);
      // 清理AbortController引用
      if (tagGenerationAbortControllerRef.current === abortController) {
        tagGenerationAbortControllerRef.current = null;
      }
    }
  }, [title, description]);

  /**
   * 切换标签选中状态
   */
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  /**
   * 添加自定义标签
   */
  const addCustomTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !aiTags.includes(trimmed)) {
      setAiTags((prev) => [...prev, trimmed]);
      setSelectedTags((prev) => new Set([...prev, trimmed]));
    }
  };

  /**
   * 标题/描述变化时自动生成 AI 标签
   */
  useEffect(() => {
    // 标题至少3个字符才触发
    if (title && title.length >= 3) {
      const timer = setTimeout(() => {
        generateAITags();
      }, 1500); // 延迟1.5秒，避免频繁请求

      return () => clearTimeout(timer);
    } else {
      // 标题太短或为空时清空标签
      setAiTags([]);
      setSelectedTags(new Set());
    }
  }, [title, description, generateAITags]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    // 取消所有正在进行的请求
    abortAll();

    // 取消AI标签生成请求
    if (tagGenerationAbortControllerRef.current) {
      tagGenerationAbortControllerRef.current.abort();
      tagGenerationAbortControllerRef.current = null;
    }

    try {
      // 合并用户选中的 AI 标签和手动输入的标签
      const manualTags = tags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      // 最终标签 = 选中的 AI 标签 + 手动输入的标签（去重）
      const finalTags = Array.from(
        new Set([...Array.from(selectedTags), ...manualTags]),
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
        sourceName: sourceName || undefined, // 来源名称
        author: author || undefined, // 文章作者
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

      // 刷新页面数据
      router.refresh();
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
              标题 <span className="text-red-500">*</span>
              {renderAutoFilledBadge("title")}
            </Label>
            <Input
              id="title"
              placeholder="输入收藏标题"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                markFieldAsModified("title");
              }}
              required
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title}</p>
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

          {/* 标签选择区域 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="tags">标签</Label>
              {isGeneratingTags && (
                <span className="text-xs text-blue-600 flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  AI 生成中（可随时提交）
                </span>
              )}
            </div>

            {/* AI 生成的标签（可选择） */}
            {aiTags.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <Sparkles className="size-3" />
                  AI 建议标签（点击选择/取消）
                </p>
                <div className="flex flex-wrap gap-2">
                  {aiTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`
                        px-3 py-1.5 rounded-full text-sm transition-all
                        ${
                          selectedTags.has(tag)
                            ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                            : "bg-gray-100 text-gray-700 border border-gray-300 hover:border-gray-400"
                        }
                      `}
                    >
                      {selectedTags.has(tag) && (
                        <Check className="size-3 inline mr-1" />
                      )}
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 手动添加标签 */}
            <div>
              <Input
                id="tags"
                placeholder="输入自定义标签，按回车添加"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const input = e.currentTarget;
                    if (input.value.trim()) {
                      addCustomTag(input.value.trim());
                      setTags("");
                    }
                  }
                }}
                className={errors.userTags ? "border-red-500" : ""}
              />
              {errors.userTags && (
                <p className="text-xs text-red-500">{errors.userTags}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                已选中 {selectedTags.size} 个标签
              </p>
            </div>
          </div>

          {/* 备注输入 */}
          <div className="space-y-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              placeholder="记录一些个人想法..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={errors.notes ? "border-red-500" : ""}
            />
            {errors.notes && (
              <p className="text-xs text-red-500">{errors.notes}</p>
            )}
          </div>

          {/* 自定义封面上传 */}
          <div className="space-y-2">
            <Label htmlFor="cover" className="flex items-center">
              自定义封面（可选）
              {renderAutoFilledBadge("coverUrl")}
            </Label>
            <ImageUpload
              bucket="covers"
              onUploadSuccess={(uploadedUrl) => {
                setCoverUrl(uploadedUrl);
                markFieldAsModified("coverUrl");
              }}
              onUploadError={(error) => {
                toast.error(`封面上传失败: ${error}`);
              }}
              defaultImageUrl={coverUrl}
              className="w-full"
            />
            {errors.coverUrl && (
              <p className="text-xs text-red-500">{errors.coverUrl}</p>
            )}
            <p className="text-xs text-gray-500">
              上传自定义封面图片，将覆盖爬取的封面。支持
              JPG、PNG、WebP、GIF，最大 5MB
            </p>
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
