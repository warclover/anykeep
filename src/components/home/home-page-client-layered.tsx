/**
 * Phase 3: 首页客户端组件（分层架构实现）
 *
 * 架构分层：
 * - 数据层: HomeDataProvider (SWR 缓存 + 数据获取)
 * - 视图层: HomeView (纯展示组件)
 *
 * @version 3.0.0
 * @since 2026-02-05
 */

"use client";

import { useSearchParams } from "next/navigation";
import { HomePageProvider } from "@/contexts/home-page-context";
import { HomeDataProvider } from "./providers/home-data-provider";
import { HomeView } from "./home-view";
import { SmartListView } from "@/components/smart-list";
import type { Bookmark } from "@/types/supabase";
import type { UserSettings } from "@/types/user-settings";

// 扩展的书签类型
type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

export interface HomePageClientLayeredProps {
  initialBookmarks?: BookmarkWithFolder[];
  error?: string;
  urlFolder?: string;
  urlPlatform?: string;
  smartListId?: number | null;
  userSettings?: UserSettings;
}

/**
 * 首页客户端组件（分层架构版本）
 *
 * 职责：
 * - 薄容器组件
 * - 组合数据层和视图层
 * - 处理 URL 参数解析
 */
export function HomePageClientLayered({
  initialBookmarks,
  error,
  urlFolder,
  urlPlatform,
  smartListId,
  userSettings,
}: HomePageClientLayeredProps) {
  const searchParams = useSearchParams();

  // 解析 URL 参数
  const urlPlatformParam = urlPlatform ?? searchParams?.get("platform") ?? "";
  const urlFolderParam = urlFolder ?? searchParams?.get("folder") ?? "";
  const urlUsageTags = searchParams?.get("usageTags") || "";
  const urlSort = searchParams?.get("sort") || "created_desc";

  // 解析用途标签
  const parsedUsageTags = urlUsageTags
    ? urlUsageTags.split(",").filter(Boolean)
    : [];

  // 智能列表模式：直接渲染专用视图
  if (smartListId) {
    return <SmartListView smartListId={smartListId} />;
  }

  // 检查 URL 中的智能列表参数
  const urlSmartListParam = searchParams?.get("smartList");
  const urlSmartListId = urlSmartListParam
    ? parseInt(urlSmartListParam, 10)
    : null;

  if (urlSmartListId && !isNaN(urlSmartListId)) {
    return <SmartListView smartListId={urlSmartListId} />;
  }

  return (
    <HomeDataProvider
      initialBookmarks={initialBookmarks}
      platform={urlPlatformParam}
      folder={urlFolderParam}
      usageTags={parsedUsageTags}
      sort={urlSort}
    >
      <HomePageProvider
        initialPlatform={urlPlatformParam}
        initialFolder={urlFolderParam}
        initialUsageTags={parsedUsageTags}
      >
        <HomeView initialError={error} userSettings={userSettings} />
      </HomePageProvider>
    </HomeDataProvider>
  );
}
