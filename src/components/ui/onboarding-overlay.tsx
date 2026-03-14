"use client";

/**
 * 通用引导覆盖层组件
 *
 * SVG mask 聚焦效果 + tooltip 导航。
 * 从 quick-add/onboarding 提取为通用 UI 组件，
 * 供拖放引导、QuickAdd 引导等多个流程复用。
 */

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { OnboardingStep } from "@/hooks/onboarding/types";

export interface OnboardingOverlayProps {
  step: OnboardingStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

interface Position {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingOverlay({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: OnboardingOverlayProps) {
  const [targetPosition, setTargetPosition] = useState<Position | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hasTarget = Boolean(step.target);

  // Find and track target element position
  useEffect(() => {
    if (!hasTarget) {
      return;
    }

    const updatePosition = () => {
      const element = step.target ? document.querySelector(step.target) : null;
      if (element) {
        const rect = element.getBoundingClientRect();
        const padding = 8;

        setTargetPosition({
          top: rect.top - padding + window.scrollY,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        });

        // Calculate tooltip position based on step.position
        if (tooltipRef.current) {
          const tooltipRect = tooltipRef.current.getBoundingClientRect();
          let tooltipTop = 0;
          let tooltipLeft = 0;

          switch (step.position) {
            case "bottom":
              tooltipTop = rect.bottom + 16 + window.scrollY;
              tooltipLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
              break;
            case "top":
              tooltipTop = rect.top - tooltipRect.height - 16 + window.scrollY;
              tooltipLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
              break;
            case "left":
              tooltipTop =
                rect.top +
                rect.height / 2 -
                tooltipRect.height / 2 +
                window.scrollY;
              tooltipLeft = rect.left - tooltipRect.width - 16;
              break;
            case "right":
              tooltipTop =
                rect.top +
                rect.height / 2 -
                tooltipRect.height / 2 +
                window.scrollY;
              tooltipLeft = rect.right + 16;
              break;
          }

          // Keep tooltip within viewport
          tooltipLeft = Math.max(
            16,
            Math.min(tooltipLeft, window.innerWidth - tooltipRect.width - 16),
          );

          setTooltipPosition({ top: tooltipTop, left: tooltipLeft });
        }
      } else {
        setTargetPosition(null);
        setTooltipPosition(null);
      }
    };

    const timeoutId = requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    return () => {
      cancelAnimationFrame(timeoutId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [step, hasTarget]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const isCentered = step.position === "center";

  return (
    <div className="fixed inset-0 z-[1000]">
      {/* Dark overlay with spotlight */}
      <div className="absolute inset-0">
        {targetPosition ? (
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <mask id="spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={targetPosition.left}
                  y={targetPosition.top}
                  width={targetPosition.width}
                  height={targetPosition.height}
                  rx="12"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.5)"
              mask="url(#spotlight-mask)"
            />
          </svg>
        ) : (
          <div className="absolute inset-0 bg-black/50" />
        )}
      </div>

      {/* Spotlight highlight ring */}
      {targetPosition && (
        <div
          className="absolute border-2 border-purple-400 rounded-xl pointer-events-none animate-pulse"
          style={{
            top: targetPosition.top,
            left: targetPosition.left,
            width: targetPosition.width,
            height: targetPosition.height,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          "absolute bg-white rounded-xl shadow-2xl p-5 max-w-[320px]",
          "animate-in fade-in slide-in-from-bottom-2 duration-300",
          isCentered && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        )}
        style={
          !isCentered && tooltipPosition
            ? { top: tooltipPosition.top, left: tooltipPosition.left }
            : undefined
        }
      >
        {/* Close button */}
        <button
          onClick={onSkip}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="跳过引导"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 pr-6">
          {step.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 whitespace-pre-line">
          {step.description}
        </p>

        {/* Step indicators */}
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-2 rounded-full transition-all duration-200",
                idx === currentStep ? "w-5 bg-purple-500" : "w-2 bg-gray-200",
              )}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center mt-4">
          <div>
            {!isFirstStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrev}
                className="text-gray-500"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一步
              </Button>
            )}
            {isFirstStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="text-gray-400"
              >
                跳过
              </Button>
            )}
          </div>

          <Button
            size="sm"
            onClick={onNext}
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            {isLastStep ? "开始使用" : "下一步"}
            {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
