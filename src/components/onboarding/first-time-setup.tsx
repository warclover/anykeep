"use client";

/**
 * 首次使用引导流程组件
 * V4.2 新用户完整引导体验
 *
 * @description 多步骤引导流程，包括：
 * 1. 欢迎页面
 * 2. 托管模式选择
 * 3. 兴趣领域选择
 * 4. 完成确认
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrustModeGuide } from "./trust-mode-guide";
import { InterestSelector } from "./interest-selector";
import { toast } from "sonner";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Rocket,
  Check,
  Loader2,
  BookMarked,
  Folder,
  Wand2,
} from "lucide-react";
import type { TrustMode } from "@/types/trust-mode";
import type { PresetInterestId } from "@/lib/interest-profile";
import { clientLogger } from "@/lib/client-logger";
import { API_CLASSIFICATION, API_USER } from "@/lib/constants/api-paths";

// ============================================================================
// 类型定义
// ============================================================================

interface FirstTimeSetupProps {
  /** 是否打开 */
  open: boolean;
  /** 完成回调 */
  onComplete: () => void;
}

type SetupStep = "welcome" | "trust-mode" | "interests" | "complete";

interface StepConfig {
  id: SetupStep;
  title: string;
  description: string;
}

// ============================================================================
// 步骤配置
// ============================================================================

const STEPS: StepConfig[] = [
  {
    id: "welcome",
    title: "欢迎使用 AnyKeep",
    description: "智能收藏助手，让整理不再繁琐",
  },
  {
    id: "trust-mode",
    title: "选择托管模式",
    description: "决定 AI 如何帮您整理收藏",
  },
  {
    id: "interests",
    title: "选择兴趣领域",
    description: "帮助 AI 更好地理解您的偏好",
  },
  {
    id: "complete",
    title: "设置完成",
    description: "开始您的智能收藏之旅",
  },
];

// ============================================================================
// 子组件
// ============================================================================

/**
 * 欢迎页面
 */
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6 py-4">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center"
      >
        <Sparkles className="h-10 w-10 text-primary" />
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold">👋 欢迎来到 AnyKeep！</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          您的智能收藏助手。只需几步简单设置，AI 就能帮您自动整理所有收藏内容。
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-md mx-auto pt-4">
        <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
          <BookMarked className="h-8 w-8 text-blue-500 mb-2" />
          <span className="text-sm font-medium">一键收藏</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
          <Wand2 className="h-8 w-8 text-purple-500 mb-2" />
          <span className="text-sm font-medium">AI 整理</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
          <Folder className="h-8 w-8 text-green-500 mb-2" />
          <span className="text-sm font-medium">智能分类</span>
        </div>
      </div>

      <Button onClick={onNext} size="lg" className="mt-6">
        开始设置
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * 完成页面
 */
function CompleteStep({
  trustMode,
  interestCount,
  onFinish,
  isLoading,
}: {
  trustMode: TrustMode;
  interestCount: number;
  onFinish: () => void;
  isLoading: boolean;
}) {
  const modeLabels: Record<TrustMode, string> = {
    full_auto: "完全托管",
    semi_auto: "半托管",
    manual: "不托管",
  };

  return (
    <div className="text-center space-y-6 py-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
      >
        <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold">🎉 设置完成！</h2>
        <p className="text-muted-foreground">一切就绪，开始收藏吧</p>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 max-w-sm mx-auto space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">托管模式</span>
          <span className="text-sm font-medium">{modeLabels[trustMode]}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">兴趣领域</span>
          <span className="text-sm font-medium">
            {interestCount > 0 ? `已选择 ${interestCount} 个` : "稍后设置"}
          </span>
        </div>
      </div>

      <Button onClick={onFinish} size="lg" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            正在完成...
          </>
        ) : (
          <>
            <Rocket className="mr-2 h-4 w-4" />
            开始使用
          </>
        )}
      </Button>
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function FirstTimeSetup({ open, onComplete }: FirstTimeSetupProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>("welcome");
  const [trustMode, setTrustMode] = useState<TrustMode>("full_auto");
  const [selectedInterests, setSelectedInterests] = useState<
    PresetInterestId[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  // 计算进度
  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  // 下一步
  const handleNext = useCallback(() => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  }, [stepIndex]);

  // 上一步
  const handleBack = useCallback(() => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  }, [stepIndex]);

  // 托管模式选择完成
  const handleTrustModeComplete = useCallback(
    (mode: TrustMode) => {
      setTrustMode(mode);
      handleNext();
    },
    [handleNext],
  );

  // 兴趣选择确认
  const handleInterestsConfirm = useCallback(async () => {
    // 保存兴趣选择
    if (selectedInterests.length > 0) {
      try {
        await fetch(API_CLASSIFICATION.interests, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetInterests: selectedInterests,
            createFolders: true,
          }),
        });
      } catch (error) {
        clientLogger.error(
          { error },
          "[FirstTimeSetup] Failed to save interests",
        );
        // 继续流程，不阻塞
      }
    }
    handleNext();
  }, [selectedInterests, handleNext]);

  // 跳过兴趣选择
  const handleSkipInterests = useCallback(() => {
    setSelectedInterests([]);
    handleNext();
  }, [handleNext]);

  // 完成设置
  const handleFinish = useCallback(async () => {
    setIsLoading(true);
    try {
      // 标记引导完成
      await fetch(API_USER.onboarding, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });

      toast.success("设置完成，开始使用吧！");
      onComplete();
    } catch (error) {
      clientLogger.error(
        { error },
        "[FirstTimeSetup] Failed to complete onboarding",
      );
      // 即使失败也继续
      onComplete();
    } finally {
      setIsLoading(false);
    }
  }, [onComplete]);

  // 渲染当前步骤
  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return <WelcomeStep onNext={handleNext} />;

      case "trust-mode":
        return (
          <div className="space-y-4">
            <TrustModeGuide
              initialMode={trustMode}
              onComplete={handleTrustModeComplete}
              showSkip={false}
              inDialog={true}
              showDetails={true}
            />
            <Button
              variant="ghost"
              onClick={handleBack}
              className="absolute left-4 bottom-4"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              返回
            </Button>
          </div>
        );

      case "interests":
        return (
          <div className="space-y-4">
            <InterestSelector
              selectedInterests={selectedInterests}
              onSelectionChange={setSelectedInterests}
              onConfirm={handleInterestsConfirm}
              onSkip={handleSkipInterests}
              isLoading={false}
              showPreview={false}
              maxSelection={12}
            />
            <Button
              variant="ghost"
              onClick={handleBack}
              className="absolute left-4 bottom-4"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              返回
            </Button>
          </div>
        );

      case "complete":
        return (
          <CompleteStep
            trustMode={trustMode}
            interestCount={selectedInterests.length}
            onFinish={handleFinish}
            isLoading={isLoading}
          />
        );

      default:
        return null;
    }
  };

  // 获取当前步骤配置
  const currentStepConfig = STEPS.find((s) => s.id === currentStep);

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* noop - prevent close */
      }}
    >
      <DialogContent
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* 进度条 */}
        <div className="absolute top-0 left-0 right-0 h-1">
          <Progress value={progress} className="h-1 rounded-none" />
        </div>

        {/* 步骤指示器 */}
        <div className="flex justify-center gap-2 pt-2 pb-4">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                index <= stepIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <DialogHeader className="text-center pb-2">
          <DialogTitle>{currentStepConfig?.title}</DialogTitle>
          <DialogDescription>
            {currentStepConfig?.description}
          </DialogDescription>
        </DialogHeader>

        {/* 步骤内容 */}
        <div className="relative min-h-[300px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FirstTimeSetup;
