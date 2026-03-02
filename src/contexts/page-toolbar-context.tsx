/**
 * 页面工具栏 Context
 *
 * 允许页面组件在 AppHeader 下方渲染工具栏（整页第二行，全宽）
 *
 * 每次 setToolbar 会记录调用时的 pathname，
 * 消费端只在 pathname 匹配时才返回 toolbar，
 * 从而避免跨页面导航时工具栏残留。
 */

"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { usePathname } from "next/navigation";

interface PageToolbarContextValue {
  toolbar: ReactNode | null;
  setToolbar: (toolbar: ReactNode | null) => void;
}

interface ToolbarState {
  toolbar: ReactNode | null;
  forPathname: string | null;
}

const PageToolbarContext = createContext<PageToolbarContextValue | null>(null);

export function PageToolbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToolbarState>({
    toolbar: null,
    forPathname: null,
  });

  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  // 在 useEffect 中更新 ref，避免渲染期间访问
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const handleSetToolbar = useCallback((newToolbar: ReactNode | null) => {
    setState({
      toolbar: newToolbar,
      forPathname: newToolbar ? pathnameRef.current : null,
    });
  }, []);

  const effectiveToolbar =
    state.toolbar !== null && state.forPathname === pathname
      ? state.toolbar
      : null;

  const value = useMemo(
    () => ({ toolbar: effectiveToolbar, setToolbar: handleSetToolbar }),
    [effectiveToolbar, handleSetToolbar],
  );

  return (
    <PageToolbarContext.Provider value={value}>
      {children}
    </PageToolbarContext.Provider>
  );
}

export function usePageToolbar() {
  return useContext(PageToolbarContext);
}
