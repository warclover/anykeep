"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import type { ClassificationStats, ClassificationHistoryItem } from "../types";

const INITIAL_STATS: ClassificationStats = {
  totalBookmarks: 0,
  classifiedCount: 0,
  pendingCount: 0,
  acceptanceRate: 0,
  autoClassificationRate: 0,
};

export function useClassificationData() {
  const [stats, setStats] = useState<ClassificationStats>(INITIAL_STATS);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ClassificationHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "/api/classification/analytics?type=overview",
      );
      const data = await response.json();

      if (data.success && data.data) {
        setStats({
          totalBookmarks: data.data.bookmarks?.total || 0,
          classifiedCount: data.data.bookmarks?.classified || 0,
          pendingCount: data.data.bookmarks?.unclassified || 0,
          acceptanceRate: data.data.learning?.acceptanceRate || 0,
          autoClassificationRate: data.data.bookmarks?.classificationRate || 0,
        });
      }
    } catch (error) {
      clientLogger.error({ error }, "Failed to load stats:");
      toast.error("加载统计数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(
        "/api/classification/analytics?type=history&limit=20",
      );
      const data = await response.json();

      if (data.success && data.data?.items) {
        setHistory(data.data.items);
      }
    } catch (error) {
      clientLogger.error({ error }, "Failed to load history:");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadHistory();
  }, [loadStats, loadHistory]);

  return { stats, loading, history, historyLoading, loadStats, loadHistory };
}
