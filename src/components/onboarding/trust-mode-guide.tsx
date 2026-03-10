"use client";

/**
 * 托管模式引导组件
 * V4.2 新用户托管模式选择引导
 *
 * @description 帮助用户了解并选择合适的托管模式
 * - Full Auto: 完全托管（默认推荐）
 * - Semi Auto: 半托管
 * - Manual: 不托管
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Sparkles,
  MessageCircle,
  Hand,
  Check,
  ChevronRight,
  Loader2,
  Info,
  Zap,
  Shield,
  Brain,
} from "lucide-react";
import type { TrustMode } from "@/types/trust-mode";
import { clientLogger } from "@/lib/client-logger";
import { API_USER } from "@/lib/constants/api-paths";

// ============================================================================
// 类型定义
// ============================================================================

interface TrustModeGuideProps {
  /** 初始选中的模式 */
  initialMode?: TrustMode;
  /** 选择完成回调 */
  onComplete?: (mode: TrustMode) => void;
  /** 是否显示跳过按钮 */
  showSkip?: boolean;
  /** 跳过回调 */
  onSkip?: () => void;
  /** 是否在对话框中使用（影响样式） */
  inDialog?: boolean;
  /** 是否显示详细说明 */
  showDetails?: boolean;
}

interface ModeOption {
  mode: TrustMode;
  label: string;
  shortDescription: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
  recommended?: boolean;
  badge?: string;
}

// ============================================================================
// 模式配置
// ============================================================================

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: "full_auto",
    label: "完全托管",
    shortDescription: "AI 全权负责，您只管收藏",
    description:
      "最省心的模式。AI 会自动分类、整理您的收藏内容，包括自动创建文件夹、智能合并和拆分。您可以专注于发现和收藏有价值的内容。",
    icon: Sparkles,
    features: [
      "自动分类到合适的文件夹",
      "智能创建新文件夹",
      "自动合并相似内容",
      "后台持续优化组织",
    ],
    recommended: true,
    badge: "推荐",
  },
  {
    mode: "semi_auto",
    label: "半托管",
    shortDescription: "AI 处理大部分，不确定时询问您",
    description:
      "平衡的模式。AI 会自动处理高置信度的分类，当不确定时会通过消息询问您的意见。您可以保持对重要决策的控制权。",
    icon: MessageCircle,
    features: [
      "高置信度自动分类",
      "低置信度发消息确认",
      "文件夹操作需您同意",
      "从您的反馈中学习",
    ],
  },
  {
    mode: "manual",
    label: "不托管",
    shortDescription: "您完全掌控，AI 仅辅助",
    description:
      "完全控制的模式。所有收藏默认进入待整理，由您手动分类。AI 仅在您请求时提供建议和摘要。适合喜欢亲自整理的用户。",
    icon: Hand,
    features: [
      "收藏默认进入待整理",
      "按需获取 AI 建议",
      "完全手动管理文件夹",
      "AI 仅生成摘要和标签",
    ],
  },
];

// ============================================================================
// 子组件
// ============================================================================

/**
 * 模式卡片组件
 */
function ModeCard({
  option,
  selected,
  onSelect,
  showDetails,
}: {
  option: ModeOption;
  selected: boolean;
  onSelect: () => void;
  showDetails: boolean;
}) {
  const Icon = option.icon;

  return (
    <Card
      className={cn(
        "relative cursor-pointer transition-all duration-200 hover:shadow-md",
        selected
          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
          : "border-border hover:border-primary/50",
      )}
      onClick={onSelect}
    >
      {/* 推荐标签 */}
      {option.badge && (
        <Badge
          variant="default"
          className="absolute -top-2 -right-2 bg-primary text-primary-foreground"
        >
          {option.badge}
        </Badge>
      )}

      {/* 选中标记 */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute top-3 right-3"
          >
            <div className="rounded-full bg-primary p-1">
              <Check className="h-4 w-4 text-primary-foreground" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "rounded-lg p-2",
              selected ? "bg-primary/10" : "bg-muted",
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                selected ? "text-primary" : "text-muted-foreground",
              )}
            />
          </div>
          <div>
            <CardTitle className="text-lg">{option.label}</CardTitle>
            <CardDescription className="text-sm mt-0.5">
              {option.shortDescription}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {showDetails && (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              {option.description}
            </p>
            <ul className="space-y-1.5">
              {option.features.map((feature, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 特性亮点组件
 */
function FeatureHighlights() {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50">
        <Zap className="h-6 w-6 text-yellow-500 mb-2" />
        <span className="text-sm font-medium">智能分类</span>
        <span className="text-xs text-muted-foreground">AI 自动整理</span>
      </div>
      <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50">
        <Brain className="h-6 w-6 text-purple-500 mb-2" />
        <span className="text-sm font-medium">持续学习</span>
        <span className="text-xs text-muted-foreground">越用越准确</span>
      </div>
      <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50">
        <Shield className="h-6 w-6 text-blue-500 mb-2" />
        <span className="text-sm font-medium">随时调整</span>
        <span className="text-xs text-muted-foreground">设置可改</span>
      </div>
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function TrustModeGuide({
  initialMode = "full_auto",
  onComplete,
  showSkip = true,
  onSkip,
  inDialog = false,
  showDetails = true,
}: TrustModeGuideProps) {
  const [selectedMode, setSelectedMode] = useState<TrustMode>(initialMode);
  const [isLoading, setIsLoading] = useState(false);

  // 处理确认
  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_USER.trustMode, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "设置失败");
      }

      const modeLabel =
        MODE_OPTIONS.find((o) => o.mode === selectedMode)?.label ||
        selectedMode;
      toast.success(`已设置为「${modeLabel}」模式`);
      onComplete?.(selectedMode);
    } catch (error) {
      clientLogger.error(
        { error },
        "[TrustModeGuide] Failed to set trust mode",
      );
      toast.error("设置失败，请重试");
    } finally {
      setIsLoading(false);
    }
  }, [selectedMode, onComplete]);

  // 处理跳过
  const handleSkip = useCallback(() => {
    // 跳过时使用默认的完全托管模式
    onSkip?.();
  }, [onSkip]);

  return (
    <div className={cn("space-y-6", inDialog ? "px-1" : "max-w-2xl mx-auto")}>
      {/* 标题和说明 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">选择您的托管模式</h2>
        <p className="text-muted-foreground">
          决定 AI 如何帮您整理收藏。您可以随时在设置中更改。
        </p>
      </div>

      {/* 特性亮点 */}
      {!inDialog && <FeatureHighlights />}

      {/* 模式选项 */}
      <div className="grid gap-4">
        {MODE_OPTIONS.map((option) => (
          <ModeCard
            key={option.mode}
            option={option}
            selected={selectedMode === option.mode}
            onSelect={() => setSelectedMode(option.mode)}
            showDetails={showDetails}
          />
        ))}
      </div>

      {/* 提示信息 */}
      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>
          不确定选哪个？我们推荐<strong>「完全托管」</strong>
          模式，让 AI 帮您处理繁琐的整理工作。您可以随时在设置中切换到其他模式。
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3 pt-2">
        {showSkip && (
          <Button variant="ghost" onClick={handleSkip} disabled={isLoading}>
            跳过
          </Button>
        )}
        <Button onClick={handleConfirm} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              设置中...
            </>
          ) : (
            <>
              开始使用
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default TrustModeGuide;
