/**
 * Multi Platform Dialog - 一稿多发对话框（P1-1）
 *
 * 支持将生成内容适配到不同平台风格
 *
 * @module knowledge-studio/v2
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Smartphone,
  ArrowRight,
  Copy,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  PLATFORM_STYLE_CONFIG,
  type PlatformStyle,
} from "@/lib/knowledge-studio/v2/constants";
import { useAdaptStyle } from "@/hooks/knowledge-studio";

// ============================================================
// Types
// ============================================================

export interface MultiPlatformDialogProps {
  /** 是否打开对话框 */
  open: boolean;
  /** 打开状态变更回调 */
  onOpenChange: (open: boolean) => void;
  /** 原始内容 */
  content: string;
  /** 当前平台风格 */
  currentStyle: PlatformStyle;
}

// ============================================================
// Component
// ============================================================

export function MultiPlatformDialog({
  open,
  onOpenChange,
  content,
  currentStyle,
}: MultiPlatformDialogProps) {
  const [targetStyle, setTargetStyle] = useState<PlatformStyle | null>(null);
  const [activeTab, setActiveTab] = useState<"select" | "preview">("select");
  const [copied, setCopied] = useState(false);

  const { state, isAdapting, isSuccess, adaptStyle, reset } = useAdaptStyle();

  // 获取可选的目标平台（排除当前平台）
  const availableStyles = useMemo(() => {
    return Object.values(PLATFORM_STYLE_CONFIG).filter(
      (style) => style.id !== currentStyle,
    );
  }, [currentStyle]);

  // 当前风格配置
  const currentStyleConfig = PLATFORM_STYLE_CONFIG[currentStyle];

  // 目标风格配置
  const targetStyleConfig = targetStyle
    ? PLATFORM_STYLE_CONFIG[targetStyle]
    : null;

  // 处理对话框打开/关闭（关闭时重置状态）
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setTargetStyle(null);
        setActiveTab("select");
        setCopied(false);
        reset();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, reset],
  );

  /**
   * 开始适配
   */
  const handleAdapt = useCallback(async () => {
    if (!targetStyle) {
      toast.error("请选择目标平台");
      return;
    }

    const success = await adaptStyle({
      content,
      sourceStyle: currentStyle,
      targetStyle,
    });

    if (success) {
      setActiveTab("preview");
    }
  }, [content, currentStyle, targetStyle, adaptStyle]);

  /**
   * 复制适配后的内容
   */
  const handleCopy = useCallback(async () => {
    if (!state.adaptedContent) return;

    try {
      await navigator.clipboard.writeText(state.adaptedContent);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  }, [state.adaptedContent]);

  /**
   * 重新适配
   */
  const handleRetry = useCallback(() => {
    setActiveTab("select");
    reset();
  }, [reset]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            一稿多发
          </DialogTitle>
          <DialogDescription>
            将内容适配到不同平台风格，优化阅读体验
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "select" | "preview")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select">选择平台</TabsTrigger>
            <TabsTrigger value="preview" disabled={!isSuccess}>
              预览结果
            </TabsTrigger>
          </TabsList>

          {/* 平台选择 */}
          <TabsContent value="select" className="mt-4">
            {/* 当前平台显示 */}
            <div className="mb-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>当前平台：</span>
                <span className="text-lg">{currentStyleConfig.icon}</span>
                <span className="font-medium text-foreground">
                  {currentStyleConfig.label}
                </span>
                <ArrowRight className="h-4 w-4 mx-2" />
                {targetStyleConfig ? (
                  <>
                    <span className="text-lg">{targetStyleConfig.icon}</span>
                    <span className="font-medium text-foreground">
                      {targetStyleConfig.label}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">选择目标平台</span>
                )}
              </div>
            </div>

            {/* 平台选择列表 */}
            <RadioGroup
              value={targetStyle || ""}
              onValueChange={(v) => setTargetStyle(v as PlatformStyle)}
              className="space-y-3"
            >
              {availableStyles.map((option) => (
                <Label
                  key={option.id}
                  htmlFor={`target-${option.id}`}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    targetStyle === option.id
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50",
                  )}
                >
                  <RadioGroupItem
                    value={option.id}
                    id={`target-${option.id}`}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{option.icon}</span>
                      <span className="font-medium">{option.label}</span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {option.minWords}-{option.maxWords}字
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {option.features.map((feature, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-xs font-normal"
                        >
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Label>
              ))}
            </RadioGroup>

            {/* 适配进度 */}
            {isAdapting && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在适配到 {targetStyleConfig?.label}...
                  </span>
                  <span className="text-muted-foreground">
                    {state.progress}%
                  </span>
                </div>
                <Progress value={state.progress} className="h-2" />
              </div>
            )}
          </TabsContent>

          {/* 预览结果 */}
          <TabsContent value="preview" className="mt-4">
            {isSuccess && (
              <div className="space-y-4">
                {/* 统计信息 */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">原文字数：</span>
                      <span className="font-medium">{state.originalWords}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground">适配后：</span>
                      <span className="font-medium">{state.finalWords}</span>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {targetStyleConfig?.icon} {targetStyleConfig?.label}
                  </Badge>
                </div>

                {/* 内容预览 */}
                <ScrollArea className="h-[300px] rounded-lg border p-4">
                  <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                    {state.adaptedContent}
                  </div>
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 mt-4">
          {activeTab === "select" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                onClick={handleAdapt}
                disabled={!targetStyle || isAdapting}
              >
                {isAdapting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    适配中...
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    开始适配
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                重新选择
              </Button>
              <Button onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    复制内容
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MultiPlatformDialog;
