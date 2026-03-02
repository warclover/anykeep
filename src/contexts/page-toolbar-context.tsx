/**
 * 页面工具栏 Context
 *
 * 允许页面组件在 AppHeader 下方渲染工具栏（整页第二行，全宽）
 *
 * setToolbar 会记录调用时的 pathname（forPathname），
 * 由消费端（AppHeader）根据当前 pathname 与 forPathname 是否一致决定是否展示，
 * 避免跨页面导航时工具栏残留。
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

export interface PageToolbarContextValue {
  toolbar: ReactNode | null;
  /** 注入该 toolbar 时的 pathname，仅当与当前路由一致时才应显示 */
  forPathname: string | null;
  setToolbar: (toolbar: ReactNode | null) => void;
}

interface ToolbarState {
  toolbar: ReactNode | null;
  forPathname: string | null;
}

const PageToolbarContext = createContext<PageToolbarContextValue | null>(null);

export function PageToolbarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  // 在 useEffect 中更新 ref，避免渲染期间访问
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const [state, setState] = useState<ToolbarState>({
    toolbar: null,
    forPathname: null,
  });

  const handleSetToolbar = useCallback((newToolbar: ReactNode | null) => {
    setState({
      toolbar: newToolbar,
      forPathname: newToolbar ? pathnameRef.current : null,
    });
  }, []);

  const value = useMemo<PageToolbarContextValue>(
    () => ({
      toolbar: state.toolbar,
      forPathname: state.forPathname,
      setToolbar: handleSetToolbar,
    }),
    [state.toolbar, state.forPathname, handleSetToolbar],
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
