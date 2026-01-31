/**
 * UpgradePrompt - 升级提示组件
 * 当用户尝试使用付费功能时显示
 */

"use client";

import { Crown, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FEATURE_DISPLAY_NAMES,
  type FeatureKey,
} from "@/lib/payment/feature-gates";
import type { PlanTier } from "@/lib/payment/types";
import { getPlanDisplayName } from "@/lib/payment/config";

interface UpgradePromptProps {
  feature: FeatureKey;
  requiredPlan: PlanTier;
  variant?: "card" | "inline" | "modal";
  onUpgradeClick?: () => void;
}

export function UpgradePrompt({
  feature,
  requiredPlan,
  variant = "card",
  onUpgradeClick,
}: UpgradePromptProps) {
  const featureName = FEATURE_DISPLAY_NAMES[feature] || feature;
  const planName = getPlanDisplayName(requiredPlan);

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      window.location.href = "/settings?tab=subscription";
    }
  };

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800">
        <Crown className="h-4 w-4 flex-shrink-0" />
        <span>
          <strong>{featureName}</strong> 需要 {planName} 套餐
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-amber-700 dark:text-amber-400"
          onClick={handleUpgrade}
        >
          升级 <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <CardTitle className="text-lg">解锁 {featureName}</CardTitle>
            <CardDescription>升级到 {planName} 即可使用</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleUpgrade}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
        >
          <Crown className="h-4 w-4 mr-2" />
          升级到 {planName}
        </Button>
      </CardContent>
    </Card>
  );
}
