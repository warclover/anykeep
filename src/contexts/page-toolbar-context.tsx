/**
 * 页面工具栏 Context
 *
 * 允许页面组件在 AppHeader 下方渲染工具栏（整页第二行，全宽）
 */

"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback } from "react";

interface PageToolbarContextValue {
  toolbar: ReactNode | null;
  setToolbar: (toolbar: ReactNode | null) => void;
}

const PageToolbarContext = createContext<PageToolbarContextValue | null>(null);

export function PageToolbarProvider({ children }: { children: ReactNode }) {
  const [toolbar, setToolbar] = useState<ReactNode | null>(null);
  const handleSetToolbar = useCallback((newToolbar: ReactNode | null) => {
    setToolbar(newToolbar);
  }, []);

  return (
    <PageToolbarContext.Provider
      value={{ toolbar, setToolbar: handleSetToolbar }}
    >
      {children}
    </PageToolbarContext.Provider>
  );
}

export function usePageToolbar() {
  return useContext(PageToolbarContext);
}
