/**
 * 移动端检测 Hook
 *
 * 检测当前设备是否为移动端
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * 检测是否为移动端设备
 * @returns 是否为移动端
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 初始检测
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // 初始化
    checkMobile();

    // 监听窗口大小变化
    const mediaQuery = window.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
    );

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    // 使用 addEventListener 替代 deprecated 的 addListener
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return isMobile;
}

export default useIsMobile;
