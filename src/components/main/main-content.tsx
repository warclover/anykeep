/**
 * 主内容区组件
 * 管理服务端渲染内容和客户端导航切换
 *
 * 工作原理：
 * 1. 首次加载：显示服务端渲染的 children（SSR 内容）
 * 2. 客户端导航启用后：使用 PageContainer 管理页面切换
 * 3. 切换到已访问页面：即时显示（0ms）
 * 4. 切换到新页面：懒加载 + 客户端数据获取
 *
 * 重要说明：
 * - Keep-Alive 页面（home/search/folders等）使用 PageContainer 管理
 * - 非 Keep-Alive 页面（batch/export）直接渲染 SSR 内容
 */

"use client";

import { type ReactNode } from "react";
import {
  useSafeNavigation,
  isKeepAlivePage,
} from "@/contexts/navigation-context";
import { PageContainer } from "./page-container";
import { FolderCacheListener } from "@/components/cache/folder-cache-listener";

interface MainContentProps {
  /** 服务端渲染的初始内容 */
  children: ReactNode;
}

/**
 * 主内容区组件
 * 根据导航状态决定显示 SSR 内容还是客户端管理的内容
 */
export function MainContent({ children }: MainContentProps) {
  // 安全获取导航上下文（不抛出错误）
  const navigationContext = useSafeNavigation();

  // 如果 NavigationProvider 不存在，直接显示 children
  if (!navigationContext) {
    return <div className="h-full min-h-0 flex flex-col">{children}</div>;
  }

  const { isClientNavEnabled, activePage, pageStates, isOnMainPage } =
    navigationContext;

  // 检查当前页面是否是 Keep-Alive 管理的页面
  const isCurrentPageKeepAlive = isKeepAlivePage(activePage);

  // 如果不在主页面（如详情页）或不是 Keep-Alive 页面（如 batch/export、知识工坊），
  // 直接渲染 SSR children，让 Next.js 正常处理页面
  // 使用 overflow-y-auto 使超出视口的内容可滚动浏览（如学习中心-草稿工坊）
  if (!isOnMainPage || !isCurrentPageKeepAlive) {
    return (
      <div className="flex-1 min-h-0 relative overflow-x-hidden overflow-y-auto">
        {children}
      </div>
    );
  }

  // 判断是否应该使用 PageContainer
  // 条件：客户端导航已启用 且 当前页面已经被访问过（非首次）
  // activePage 不可能为 null（因为上面已经检查了 isOnMainPage）
  const currentPageState = activePage ? pageStates[activePage] : null;
  const shouldUsePageContainer =
    isClientNavEnabled &&
    currentPageState &&
    (currentPageState.state === "ready" || currentPageState.state === "cached");

  // 如果是首次访问当前页面，显示 SSR 内容
  if (!shouldUsePageContainer) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        {/* 文件夹缓存监听器 */}
        <FolderCacheListener />
        {children}
        {/* 预渲染 PageContainer（隐藏），用于后续客户端导航 */}
        {isClientNavEnabled && (
          <div style={{ display: "none" }}>
            <PageContainer />
          </div>
        )}
      </div>
    );
  }

  // 客户端导航模式，使用 PageContainer
  return (
    <div className="h-full min-h-0 flex flex-col">
      <FolderCacheListener />
      <PageContainer>{children}</PageContainer>
    </div>
  );
}
