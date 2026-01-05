/**
 * Briefing Wizard v2 - 步骤式问答向导
 * @module knowledge-studio/v2
 *
 * 功能:
 * - 步骤指示器（1/3 → 2/3 → 3/3）
 * - 问题类型渲染：single_choice, multi_choice, text, scale
 * - 跳过按钮（快速模式）
 * - 答案验证
 * - 上下文预览
 */

"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  BriefingQuestion,
  BriefingContext,
} from "@/lib/knowledge-studio/blueprint/types";

// ============================================================
// Types
// ============================================================

export interface BriefingWizardProps {
  /** 蓝图名称 */
  blueprintName: string;
  /** 蓝图图标 */
  blueprintIcon?: string;
  /** 问题列表 */
  questions: BriefingQuestion[];
  /** 提交回调 */
  onSubmit: (context: BriefingContext) => void;
  /** 跳过回调 */
  onSkip: () => void;
  /** 返回回调 */
  onBack?: () => void;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 是否允许跳过 */
  skipAllowed?: boolean;
  /** 类名 */
  className?: string;
}

type AnswerValue = string | string[] | number;

// ============================================================
// Question Renderer
// ============================================================

interface QuestionRendererProps {
  question: BriefingQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}

/**
 * Question Renderer - memoized to prevent unnecessary re-renders
 */
const QuestionRenderer = React.memo(function QuestionRenderer({
  question,
  value,
  onChange,
}: QuestionRendererProps) {
  switch (question.type) {
    case "text":
      return (
        <div className="space-y-2">
          {question.placeholder?.includes("\n") ||
          (question.placeholder?.length ?? 0) > 50 ? (
            <Textarea
              placeholder={question.placeholder}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[120px] resize-none text-base"
            />
          ) : (
            <Input
              placeholder={question.placeholder}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className="text-base h-12"
            />
          )}
        </div>
      );

    case "single_choice":
      return (
        <RadioGroup
          value={(value as string) ?? ""}
          onValueChange={onChange}
          className="space-y-3"
        >
          {question.options?.map((option) => (
            <div
              key={option.value}
              className={cn(
                "flex items-start space-x-4 rounded-xl border-2 p-4 transition-all cursor-pointer",
                value === option.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50",
              )}
              onClick={() => onChange(option.value)}
            >
              <RadioGroupItem
                value={option.value}
                id={`${question.id}-${option.value}`}
              />
              <div className="flex-1">
                <Label
                  htmlFor={`${question.id}-${option.value}`}
                  className="cursor-pointer font-medium text-base"
                >
                  {option.label}
                </Label>
                {option.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </RadioGroup>
      );

    case "multi_choice":
      const selectedValues = (value as string[]) ?? [];
      return (
        <div className="space-y-3">
          {question.options?.map((option) => {
            const isChecked = selectedValues.includes(option.value);
            return (
              <div
                key={option.value}
                className={cn(
                  "flex items-start space-x-4 rounded-xl border-2 p-4 transition-all cursor-pointer",
                  isChecked
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50",
                )}
                onClick={() => {
                  if (isChecked) {
                    onChange(selectedValues.filter((v) => v !== option.value));
                  } else {
                    onChange([...selectedValues, option.value]);
                  }
                }}
              >
                <Checkbox
                  id={`${question.id}-${option.value}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selectedValues, option.value]);
                    } else {
                      onChange(
                        selectedValues.filter((v) => v !== option.value),
                      );
                    }
                  }}
                />
                <div className="flex-1">
                  <Label
                    htmlFor={`${question.id}-${option.value}`}
                    className="cursor-pointer font-medium text-base"
                  >
                    {option.label}
                  </Label>
                  {option.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );

    case "scale":
      const scaleValue = (value as number) ?? question.scaleConfig?.min ?? 1;
      const { min = 1, max = 5, step = 1, labels } = question.scaleConfig ?? {};
      return (
        <div className="space-y-6 py-4">
          <Slider
            value={[scaleValue]}
            min={min}
            max={max}
            step={step}
            onValueChange={([v]) => onChange(v)}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            {labels ? (
              <>
                <span>{labels[min]}</span>
                {labels[Math.floor((min + max) / 2)] && (
                  <span>{labels[Math.floor((min + max) / 2)]}</span>
                )}
                <span>{labels[max]}</span>
              </>
            ) : (
              <>
                <span>{min}</span>
                <span className="font-bold text-foreground text-lg">
                  {scaleValue}
                </span>
                <span>{max}</span>
              </>
            )}
          </div>
        </div>
      );

    default:
      return null;
  }
});

// ============================================================
// BriefingWizard Component
// ============================================================

export function BriefingWizard({
  blueprintName,
  blueprintIcon = "✨",
  questions,
  onSubmit,
  onSkip,
  onBack,
  isLoading = false,
  skipAllowed = true,
  className,
}: BriefingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
    // 初始化默认值
    const defaults: Record<string, AnswerValue> = {};
    questions.forEach((q) => {
      if (q.defaultValue !== undefined) {
        defaults[q.id] = q.defaultValue;
      }
    });
    return defaults;
  });

  const totalSteps = questions.length;
  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // 当前问题是否已回答
  const isCurrentAnswered = useMemo(() => {
    const answer = answers[currentQuestion?.id];
    if (answer === undefined || answer === "") return false;
    if (Array.isArray(answer) && answer.length === 0) return false;
    return true;
  }, [answers, currentQuestion]);

  // 是否可以继续下一步
  const canProceed = useMemo(() => {
    if (!currentQuestion) return false;
    if (!currentQuestion.required) return true;
    return isCurrentAnswered;
  }, [currentQuestion, isCurrentAnswered]);

  // 更新答案
  const handleAnswerChange = useCallback(
    (value: AnswerValue) => {
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: value,
      }));
    },
    [currentQuestion],
  );

  // 上一步
  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else {
      onBack?.();
    }
  }, [currentStep, onBack]);

  // 下一步
  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // 最后一步，提交
      const context: BriefingContext = {
        answers,
        answeredAt: new Date(),
      };
      onSubmit(context);
    }
  }, [currentStep, totalSteps, answers, onSubmit]);

  // 跳过
  const handleSkip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className={cn("max-w-2xl mx-auto", className)}>
      <Card>
        <CardHeader className="space-y-4">
          {/* 蓝图信息 */}
          <div className="flex items-center gap-3">
            <span className="text-3xl">{blueprintIcon}</span>
            <div>
              <CardTitle className="text-xl">{blueprintName}</CardTitle>
              <CardDescription>
                回答以下问题，帮助 AI 生成更精准的内容
              </CardDescription>
            </div>
          </div>

          {/* 进度条 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                步骤 {currentStep + 1} / {totalSteps}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 问题 */}
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <h3 className="text-lg font-semibold">
                {currentQuestion.question}
              </h3>
              {currentQuestion.required && (
                <span className="text-destructive">*</span>
              )}
              {currentQuestion.isConditional && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  动态
                </Badge>
              )}
            </div>
            {currentQuestion.helpText && (
              <p className="text-sm text-muted-foreground">
                {currentQuestion.helpText}
              </p>
            )}
          </div>

          {/* 答案输入 */}
          <QuestionRenderer
            question={currentQuestion}
            value={answers[currentQuestion.id]}
            onChange={handleAnswerChange}
          />

          {/* 操作按钮 */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={isLoading}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                {currentStep === 0 ? "返回" : "上一步"}
              </Button>

              {skipAllowed && (
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={isLoading}
                >
                  <SkipForward className="mr-1 h-4 w-4" />
                  跳过全部
                </Button>
              )}
            </div>

            <Button
              onClick={handleNext}
              disabled={(!canProceed && currentQuestion.required) || isLoading}
            >
              {isLoading ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                  处理中...
                </>
              ) : currentStep === totalSteps - 1 ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  完成并生成
                </>
              ) : (
                <>
                  下一步
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 步骤指示器 */}
      <div className="flex justify-center gap-2 mt-6">
        {questions.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentStep(index)}
            className={cn(
              "w-3 h-3 rounded-full transition-all",
              index === currentStep
                ? "bg-primary w-6"
                : index < currentStep
                  ? "bg-primary/50"
                  : "bg-muted",
            )}
            disabled={index > currentStep}
          />
        ))}
      </div>
    </div>
  );
}

export default BriefingWizard;
