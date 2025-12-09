/**
 * AI 文件夹推荐 Hook
 * 管理文件夹推荐状态和操作
 *
 * V4.2 更新：集成置信度分层自动分类
 * - ≥80% 置信度：自动归类（不显示 toast）
 * - 60-79% 置信度：显示推荐 toast
 * - <60% 置信度：自动放入"待整理"（不显示 toast）
 *
 * @deprecated V3.1 - 此 Hook 已废弃
 * 请使用 useClassificationPolling 替代
 * 分类逻辑已移至后端 V3 系统 (classifyBookmarkV2)
 * 保留此 Hook 是为了向后兼容，将在未来版本中移除
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FolderRecommendation } from "@/components/bookmark/folder-recommendation-toast";

/**
 * 自动分类 API 响应类型
 */
interface AutoClassifyResponse {
  action: "auto" | "recommend" | "inbox";
  folderId?: number | null;
  folderName?: string;
  message?: string;
  recommendation?: FolderRecommendation;
}

interface UseFolderRecommendationReturn {
  recommendation: FolderRecommendation | null;
  bookmarkId: number | null;
  isLoading: boolean;
  fetchRecommendation: (
    bookmarkId: number,
    title: string,
    summary?: string,
    tags?: string[],
  ) => Promise<void>;
  applyRecommendation: (
    folderId: number | null,
    createNew: boolean,
    newFolderName?: string,
  ) => Promise<void>;
  dismissRecommendation: () => void;
}

export function useFolderRecommendation(): UseFolderRecommendationReturn {
  const router = useRouter();
  const [recommendation, setRecommendation] =
    useState<FolderRecommendation | null>(null);
  const [bookmarkId, setBookmarkId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 获取文件夹推荐并自动处理置信度分层
   */
  const fetchRecommendation = useCallback(
    async (
      id: number,
      title: string,
      summary: string = "",
      tags: string[] = [],
    ) => {
      setIsLoading(true);
      setBookmarkId(id);

      try {
        // 1. 获取 AI 推荐
        const recommendResponse = await fetch("/api/ai/recommend-folder", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            summary,
            tags,
          }),
        });

        let recommendData: FolderRecommendation | null = null;

        if (recommendResponse.ok) {
          const result = await recommendResponse.json();
          recommendData = result.data;
        }

        // 2. 调用自动分类 API 处理置信度分层
        const classifyResponse = await fetch("/api/bookmarks/auto-classify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookmarkId: id,
            recommendation: recommendData,
          }),
        });

        if (!classifyResponse.ok) {
          throw new Error("自动分类失败");
        }

        const classifyResult = await classifyResponse.json();
        const classifyData: AutoClassifyResponse = classifyResult.data;

        // 3. 根据分类结果处理 UI
        switch (classifyData.action) {
          case "auto":
            // 高置信度自动归类：显示成功 toast，不显示推荐卡片
            toast.success(
              classifyData.message ||
                `已自动归类到「${classifyData.folderName}」`,
              {
                icon: "✨",
                description: "AI 智能分类",
              },
            );
            setRecommendation(null);
            setBookmarkId(null);
            router.refresh();
            break;

          case "inbox":
            // 低置信度放入待整理：显示信息 toast，不显示推荐卡片
            toast.info(classifyData.message || '已移动到"待整理"文件夹', {
              icon: "📥",
              description: "稍后可手动整理",
            });
            setRecommendation(null);
            setBookmarkId(null);
            router.refresh();
            break;

          case "recommend":
            // 中等置信度：显示推荐卡片让用户确认
            if (classifyData.recommendation) {
              setRecommendation(classifyData.recommendation);
            } else if (recommendData) {
              setRecommendation(recommendData);
            }
            break;

          default:
            // 未知情况，静默处理
            setRecommendation(null);
            setBookmarkId(null);
        }
      } catch (error) {
        // 推荐失败不影响用户体验，静默失败
        if (process.env.NODE_ENV === "development") {
          console.error("Folder recommendation failed:", error);
        }
        setRecommendation(null);
        setBookmarkId(null);
      } finally {
        setIsLoading(false);
      }
    },
    [router],
  );

  /**
   * 应用推荐（移动到文件夹或创建新文件夹）
   */
  const applyRecommendation = useCallback(
    async (
      folderId: number | null,
      createNew: boolean,
      newFolderName?: string,
    ) => {
      if (!bookmarkId) return;

      try {
        let targetFolderId = folderId;

        // 如果需要新建文件夹
        if (createNew && newFolderName) {
          const createResponse = await fetch("/api/folders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: newFolderName,
            }),
          });

          if (!createResponse.ok) {
            throw new Error("创建文件夹失败");
          }

          const createData = await createResponse.json();
          targetFolderId = createData.data.id;
          toast.success(`已创建文件夹「${newFolderName}」`);
        }

        // 移动收藏到文件夹
        if (targetFolderId !== null) {
          const moveResponse = await fetch("/api/bookmarks/batch-move", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ids: [bookmarkId],
              folderId: targetFolderId,
            }),
          });

          if (!moveResponse.ok) {
            throw new Error("移动收藏失败");
          }

          const folderName = createNew
            ? newFolderName
            : recommendation?.folderName;
          toast.success(`已移动到「${folderName}」`);
        }

        // 刷新页面数据
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "操作失败");
      }
    },
    [bookmarkId, recommendation, router],
  );

  /**
   * 关闭推荐
   */
  const dismissRecommendation = useCallback(() => {
    setRecommendation(null);
    setBookmarkId(null);
  }, []);

  return {
    recommendation,
    bookmarkId,
    isLoading,
    fetchRecommendation,
    applyRecommendation,
    dismissRecommendation,
  };
}
