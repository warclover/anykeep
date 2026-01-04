/**
 * Briefing 对话框 (Story 1.7)
 * @module knowledge-studio/components
 *
 * 用于在增强蓝图生成前收集用户上下文信息。
 * AC:
 * - 问题以卡片形式展示
 * - 支持单选、多选、文本输入、刻度类型
 * - 显示跳过按钮（快速模式）
 * - 完成后自动关闭并触发生成
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { Sparkles, SkipForward, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  BriefingQuestion,
  BriefingContext,
} from "@/lib/knowledge-studio/blueprint/types";

// ============================================================
// Types
// ============================================================

export interface BriefingDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变更回调 */
  onOpenChange: (open: boolean) => void;
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
  /** 是否正在加载 */
  isLoading?: boolean;
}

type AnswerValue = string | string[] | number;

// ============================================================
// 问题渲染组件
// ============================================================

interface QuestionCardProps {
  question: BriefingQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  index: number;
}

function QuestionCard({ question, value, onChange, index }: QuestionCardProps) {
  const renderInput = () => {
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
                className="min-h-[80px] resize-none"
              />
            ) : (
              <Input
                placeholder={question.placeholder}
                value={(value as string) ?? ""}
                onChange={(e) => onChange(e.target.value)}
              />
            )}
          </div>
        );

      case "single_choice":
        return (
          <RadioGroup
            value={(value as string) ?? ""}
            onValueChange={onChange}
            className="space-y-2"
          >
            {question.options?.map((option) => (
              <div
                key={option.value}
                className={cn(
                  "flex items-start space-x-3 rounded-lg border p-3 transition-colors",
                  value === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50",
                )}
              >
                <RadioGroupItem
                  value={option.value}
                  id={`${question.id}-${option.value}`}
                />
                <div className="flex-1">
                  <Label
                    htmlFor={`${question.id}-${option.value}`}
                    className="cursor-pointer font-medium"
                  >
                    {option.label}
                  </Label>
                  {option.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
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
          <div className="space-y-2">
            {question.options?.map((option) => {
              const isChecked = selectedValues.includes(option.value);
              return (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-start space-x-3 rounded-lg border p-3 transition-colors",
                    isChecked
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50",
                  )}
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
                      className="cursor-pointer font-medium"
                    >
                      {option.label}
                    </Label>
                    {option.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
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
        const {
          min = 1,
          max = 5,
          step = 1,
          labels,
        } = question.scaleConfig ?? {};
        return (
          <div className="space-y-4">
            <Slider
              value={[scaleValue]}
              min={min}
              max={max}
              step={step}
              onValueChange={([v]) => onChange(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
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
                  <span className="font-medium text-foreground">
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
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
          {index + 1}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground">{question.question}</h4>
            {question.required && <span className="text-destructive">*</span>}
            {question.isConditional && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                动态
              </Badge>
            )}
          </div>
          {question.helpText && (
            <p className="text-xs text-muted-foreground mt-1">
              {question.helpText}
            </p>
          )}
        </div>
      </div>
      <div className="pl-9">{renderInput()}</div>
    </div>
  );
}

// ============================================================
// BriefingDialog 组件
// ============================================================

/**
 * Briefing 对话框组件
 *
 * @example
 * ```tsx
 * <BriefingDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   blueprintName="论文解码器"
 *   blueprintIcon="📄"
 *   questions={questions}
 *   onSubmit={(context) => handleGenerate(context)}
 *   onSkip={() => handleGenerate()}
 * />
 * ```
 */
export function BriefingDialog({
  open,
  onOpenChange,
  blueprintName,
  blueprintIcon = "✨",
  questions,
  onSubmit,
  onSkip,
  isLoading = false,
}: BriefingDialogProps) {
  // 用户输入的答案（不含默认值）
  const [userAnswers, setUserAnswers] = useState<Record<string, AnswerValue>>(
    {},
  );

  // 计算默认值
  const defaultAnswers = useMemo(() => {
    const defaults: Record<string, AnswerValue> = {};
    questions.forEach((q) => {
      if (q.defaultValue !== undefined) {
        defaults[q.id] = q.defaultValue;
      }
    });
    return defaults;
  }, [questions]);

  // 合并默认值和用户输入（用户输入优先）
  const answers = useMemo(
    () => ({
      ...defaultAnswers,
      ...userAnswers,
    }),
    [defaultAnswers, userAnswers],
  );

  // 更新答案
  const handleAnswerChange = useCallback((id: string, value: AnswerValue) => {
    setUserAnswers((prev) => ({
      ...prev,
      [id]: value,
    }));
  }, []);

  // 验证必填问题
  const isValid = useMemo(() => {
    return questions.every((q) => {
      if (!q.required) return true;
      const answer = answers[q.id];
      if (answer === undefined || answer === "") return false;
      if (Array.isArray(answer) && answer.length === 0) return false;
      return true;
    });
  }, [questions, answers]);

  // 提交处理
  const handleSubmit = useCallback(() => {
    const context: BriefingContext = {
      answers,
      answeredAt: new Date(),
    };
    onSubmit(context);
  }, [answers, onSubmit]);

  // 跳过处理
  const handleSkip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  // 关闭时清空状态
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setUserAnswers({});
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{blueprintIcon}</span>
            <span>{blueprintName}</span>
          </DialogTitle>
          <DialogDescription>
            回答以下问题，帮助 AI 生成更精准的内容
          </DialogDescription>
        </DialogHeader>

        {/* 问题列表 */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 -mx-6 px-6">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={(value) => handleAnswerChange(question.id, value)}
              index={index}
            />
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <SkipForward className="mr-2 h-4 w-4" />
            跳过，使用默认设置
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                生成中...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                确认并生成
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BriefingDialog;
