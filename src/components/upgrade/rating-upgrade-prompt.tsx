/**
 * 评级功能升级引导组件
 */

"use client";

import { useState } from "react";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RATING_UPGRADE_MESSAGES } from "@/lib/features/rating-feature";
import { useRouter } from "next/navigation";

interface RatingUpgradePromptProps {
  trigger?: "rating" | "lock" | "marker";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RatingUpgradePrompt({
  trigger: _trigger = "rating",
  open,
  onOpenChange,
}: RatingUpgradePromptProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(open ?? false);

  const handleUpgrade = () => {
    router.push("/pricing");
    setIsOpen(false);
  };

  // 预留：未来可根据 trigger 显示不同图标
  // const triggerIcons = {
  //   rating: Star,
  //   lock: Lock,
  //   marker: Trash2,
  // };
  // const TriggerIcon = triggerIcons[trigger];

  return (
    <Dialog open={open ?? isOpen} onOpenChange={onOpenChange ?? setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500">
              <Crown className="size-5 text-white" />
            </div>
            <DialogTitle className="text-xl">
              {RATING_UPGRADE_MESSAGES.title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
            {RATING_UPGRADE_MESSAGES.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-4">
          {RATING_UPGRADE_MESSAGES.benefits.map((benefit, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
            >
              <div className="mt-0.5">{benefit.split(" ")[0]}</div>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900 dark:text-white">
                  {benefit.split("：")[0].slice(2)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {benefit.split("：")[1]}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button
            onClick={handleUpgrade}
            className="flex-1 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white"
          >
            <Crown className="size-4 mr-2" />
            {RATING_UPGRADE_MESSAGES.cta}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="sm:w-auto"
          >
            稍后再说
          </Button>
        </div>

        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          升级后立即解锁所有高级功能
        </p>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 轻量级升级提示（内联版本）
 */
export function InlineUpgradeHint({ feature: _feature }: { feature: string }) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <div
        onClick={() => setShowDialog(true)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-700 cursor-pointer hover:shadow-sm transition-all"
      >
        <Crown className="size-3 text-yellow-600 dark:text-yellow-400" />
        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
          高级功能
        </span>
      </div>

      <RatingUpgradePrompt open={showDialog} onOpenChange={setShowDialog} />
    </>
  );
}
