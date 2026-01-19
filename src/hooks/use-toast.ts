/**
 * Toast Hook
 * 包装 toastService，提供 React Hook 接口
 */

import { useCallback } from "react";
import { toastService } from "@/lib/notifications/toast/toast.service";

interface ToastOptions {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

export function useToast() {
  const toast = useCallback((options: ToastOptions) => {
    const { title, description, variant = "default" } = options;

    if (variant === "destructive") {
      return toastService.error(title, description);
    }

    return toastService.success(title, description);
  }, []);

  return { toast };
}
