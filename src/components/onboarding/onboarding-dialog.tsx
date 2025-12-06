"use client";

/**
 * 新用户引导对话框
 * 首次登录时展示兴趣选择，帮助用户快速上手
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InterestSelector } from "./interest-selector";
import { toast } from "sonner";
import type { PresetInterestId } from "@/lib/classification";

interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const [selectedInterests, setSelectedInterests] = useState<
    PresetInterestId[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  // 确认并创建文件夹
  const handleConfirm = useCallback(async () => {
    if (selectedInterests.length === 0) {
      toast.error("请至少选择一个兴趣领域");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/classification/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetInterests: selectedInterests,
          createFolders: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "设置失败");
      }

      const result = await response.json();
      const folderCount = result.data?.createdFolders?.length || 0;

      toast.success(`已创建 ${folderCount} 个文件夹，开始使用吧！`);
      onComplete();
    } catch (error) {
      console.error("Failed to save interests:", error);
      toast.error("保存失败，请重试");
    } finally {
      setIsLoading(false);
    }
  }, [selectedInterests, onComplete]);

  // 跳过引导
  const handleSkip = useCallback(async () => {
    setIsLoading(true);
    try {
      // 标记已完成引导（不创建文件夹）
      await fetch("/api/classification/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetInterests: [],
          createFolders: false,
        }),
      });

      toast.info("已跳过引导，你可以在设置中随时配置兴趣领域");
      onComplete();
    } catch (error) {
      console.error("Failed to skip onboarding:", error);
      // 即使失败也继续
      onComplete();
    } finally {
      setIsLoading(false);
    }
  }, [onComplete]);

  // 允许关闭对话框（关闭时自动标记引导完成）
  const handleOpenChange = useCallback(
    async (newOpen: boolean) => {
      if (!newOpen) {
        // 用户关闭对话框，自动跳过引导
        await handleSkip();
      }
    },
    [handleSkip],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-2">
          <DialogTitle className="text-2xl">👋 欢迎来到 AnyKeep！</DialogTitle>
          <DialogDescription className="text-base">
            为了帮你更好地整理收藏，请选择你感兴趣的领域（可多选）
          </DialogDescription>
        </DialogHeader>

        <InterestSelector
          selectedInterests={selectedInterests}
          onSelectionChange={setSelectedInterests}
          onConfirm={handleConfirm}
          onSkip={handleSkip}
          isLoading={isLoading}
          showPreview={true}
          maxSelection={12}
        />
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingDialog;
