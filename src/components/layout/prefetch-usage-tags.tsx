/**
 * P2: 用途标签预取
 *
 * 在主布局挂载时后台预取 usage-tags，使筛选/标签等组件命中缓存，
 * 避免 content-analysis 等页面首屏等待该请求。
 *
 * @version 1.0.0
 * @since 2026-03-03
 */

"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchCustomUsageTags } from "@/hooks/data/use-custom-usage-tags";

export function PrefetchUsageTags() {
  const queryClient = useQueryClient();

  useEffect(() => {
    prefetchCustomUsageTags(queryClient);
  }, [queryClient]);

  return null;
}
