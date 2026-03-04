"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CLASSIFICATION_WEIGHTS,
  CLASSIFICATION_THRESHOLDS,
} from "@/lib/classification/constants/limits";
import type { WeightConfig, ThresholdConfig, FeatureConfig } from "../types";

export function useClassificationConfig() {
  const [weights, setWeights] = useState<WeightConfig>({
    vector: CLASSIFICATION_WEIGHTS.VECTOR * 100,
    history: CLASSIFICATION_WEIGHTS.HISTORY * 100,
    ai: CLASSIFICATION_WEIGHTS.AI * 100,
  });

  const [thresholds, setThresholds] = useState<ThresholdConfig>({
    high: CLASSIFICATION_THRESHOLDS.HIGH_CONFIDENCE,
    medium: CLASSIFICATION_THRESHOLDS.MEDIUM_CONFIDENCE,
  });

  const [features, setFeatures] = useState<FeatureConfig>({
    tieredOptimization: true,
    knnDirect: true,
    universalCategories: true,
    tagMatcher: true,
  });

  const adjustWeight = (key: keyof WeightConfig, value: number) => {
    setWeights((prev) => {
      const newWeights = { ...prev, [key]: value };

      const otherKeys = Object.keys(prev).filter(
        (k) => k !== key,
      ) as (keyof WeightConfig)[];
      const remaining = 100 - value;
      const currentOtherTotal = otherKeys.reduce((sum, k) => sum + prev[k], 0);

      if (currentOtherTotal > 0) {
        otherKeys.forEach((k) => {
          newWeights[k] = Math.round((prev[k] / currentOtherTotal) * remaining);
        });
      }

      return newWeights;
    });
  };

  const saveWeights = async () => {
    const total = weights.vector + weights.history + weights.ai;
    if (Math.abs(total - 100) > 0.1) {
      toast.error("权重总和必须为 100%");
      return;
    }

    try {
      await fetch("/api/classification/weights", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      });
      toast.success("权重配置已保存");
    } catch {
      toast.error("保存失败");
    }
  };

  const updateThreshold = (key: keyof ThresholdConfig, value: number) => {
    setThresholds((prev) => ({ ...prev, [key]: value }));
  };

  const updateFeature = (key: keyof FeatureConfig, value: boolean) => {
    setFeatures((prev) => ({ ...prev, [key]: value }));
  };

  return {
    weights,
    thresholds,
    features,
    adjustWeight,
    saveWeights,
    updateThreshold,
    updateFeature,
  };
}
