/**
 * MD 收藏详情页面 - 客户端组件
 * P2-007: Markdown 内容收藏 - 专业阅读视图
 */

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect } from "react";
import { MdReaderView } from "@/features/md-collections/components";
import type { MdCollection } from "@/features/md-collections";

// SSR 安全的 useLayoutEffect
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface MdCollectionDetailClientProps {
  collection: MdCollection;
}

export function MdCollectionDetailClient({
  collection,
}: MdCollectionDetailClientProps) {
  const router = useRouter();

  const handleBack = useCallback(() => {
    router.push("/md-collections");
  }, [router]);

  // 在浏览器绘制前同步覆盖主布局背景色，消除白→色闪烁
  // useLayoutEffect 在 DOM 变更后、浏览器绘制前执行
  useIsomorphicLayoutEffect(() => {
    // 标记阅读器页面（供 CSS 规则匹配）
    document.documentElement.setAttribute("data-reader-page", "");

    // 向上遍历找到主布局容器并覆盖背景色
    const shell = document.querySelector(".main-layout-shell") as HTMLElement;
    const originalBg = shell?.style.backgroundColor;
    if (shell) {
      shell.style.backgroundColor = "var(--reader-bg, #ffffff)";
    }

    return () => {
      // 离开时恢复
      document.documentElement.removeAttribute("data-reader-page");
      document.getElementById("reader-theme-preload")?.remove();
      if (shell) {
        shell.style.backgroundColor = originalBg || "";
      }
    };
  }, []);

  return <MdReaderView collection={collection} onBack={handleBack} />;
}
