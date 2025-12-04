/**
 * 主内容区组件
 * 管理服务端渲染内容和客户端导航切换
 *
 * 工作原理：
 * 1. 首次加载：显示服务端渲染的 children（SSR 内容）
 * 2. 客户端导航启用后：使用 PageContainer 管理页面切换
 * 3. 切换到已访问页面：即时显示（0ms）
 * 4. 切换到新页面：懒加载 + 客户端数据获取
 */

"use client";

import { type ReactNode, useContext } from "react";
import { NavigationContext } from "@/contexts/navigation-context";
import { PageContainer } from "./page-container";

/**
 * 安全获取导航上下文（不抛出错误）
 */
function useSafeNavigation() {
  const context = useContext(NavigationContext);
  return context;
}

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
    return <>{children}</>;
  }

  const { isClientNavEnabled, activePage, pageStates } = navigationContext;

  // 判断是否应该使用 PageContainer
  // 条件：客户端导航已启用 且 当前页面已经被访问过（非首次）
  const currentPageState = pageStates[activePage];
  const shouldUsePageContainer =
    isClientNavEnabled &&
    currentPageState &&
    (currentPageState.state === "ready" || currentPageState.state === "cached");

  // 如果是首次访问当前页面，显示 SSR 内容
  if (!shouldUsePageContainer) {
    return (
      <>
        {children}
        {/* 预渲染 PageContainer（隐藏），用于后续客户端导航 */}
        {isClientNavEnabled && (
          <div style={{ display: "none" }}>
            <PageContainer />
          </div>
        )}
      </>
    );
  }

  // 客户端导航模式，使用 PageContainer
  return <PageContainer>{children}</PageContainer>;
}
