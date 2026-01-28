"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { FeedbackStore, OpenFeedbackOptions } from "@/types/user-feedback";
// UserFeedbackDialog 将在 Phase 3 实现，这里先导入，稍后创建
import { UserFeedbackDialog } from "./user-feedback-dialog";

const FeedbackContext = createContext<FeedbackStore | undefined>(undefined);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<OpenFeedbackOptions>({});

  const open = useCallback((opts: OpenFeedbackOptions = {}) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // 延迟清除选项，避免 UI 关闭动画时的闪烁
    setTimeout(() => setOptions({}), 300);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      options,
      open,
      close,
    }),
    [isOpen, options, open, close],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <UserFeedbackDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        defaultOptions={options}
      />
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within a FeedbackProvider");
  }
  return context;
}
