import { useMemo, useCallback } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Bookmark } from "@/types/bookmark";
import type { PredictionResult } from "../../types";
import { predictionEngine } from "../../prediction/prediction-engine";

interface UsePredictionOptions {
  limit?: number;
  debounceMs?: number;
}

interface UsePredictionReturn {
  predictions: PredictionResult[];
  isLoading: boolean;
  recordFeedback: (ruleId: string, accepted: boolean) => Promise<void>;
}

export function usePrediction(
  selection: Bookmark[],
  options: UsePredictionOptions = {},
): UsePredictionReturn {
  const { limit = 3, debounceMs = 100 } = options;

  // 防抖处理选择变化
  const debouncedSelection = useDebouncedValue(selection, debounceMs);

  // 计算预测结果
  const predictions = useMemo(() => {
    if (debouncedSelection.length === 0) {
      return [];
    }
    return predictionEngine.predict(debouncedSelection, limit);
  }, [debouncedSelection, limit]);

  // 记���反馈
  const recordFeedback = useCallback(
    async (ruleId: string, accepted: boolean) => {
      await predictionEngine.recordFeedback(ruleId, accepted);
    },
    [],
  );

  return {
    predictions,
    isLoading: selection !== debouncedSelection,
    recordFeedback,
  };
}
