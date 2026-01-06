/**
 * Platform Style Selector - 平台风格选择器
 * @module knowledge-studio/v2
 *
 * Phase 3.1: 让用户选择生成内容的目标平台风格
 */

"use client";

import { useMemo } from "react";
import { Smartphone } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PLATFORM_STYLE_CONFIG,
  type PlatformStyle,
} from "@/lib/knowledge-studio/v2/constants";

// ============================================================
// Types
// ============================================================

export interface PlatformStyleSelectorProps {
  /** 当前选中的平台风格 */
  value: PlatformStyle;
  /** 变更回调 */
  onChange: (value: PlatformStyle) => void;
  /** 类名 */
  className?: string;
}

// ============================================================
// Component
// ============================================================

export function PlatformStyleSelector({
  value,
  onChange,
  className,
}: PlatformStyleSelectorProps) {
  const platformOptions = useMemo(() => {
    return Object.values(PLATFORM_STYLE_CONFIG);
  }, []);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          平台风格
        </CardTitle>
        <CardDescription>选择目标平台以优化内容风格</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={value}
          onValueChange={(v) => onChange(v as PlatformStyle)}
          className="grid gap-3"
        >
          {platformOptions.map((option) => (
            <Label
              key={option.id}
              htmlFor={`platform-${option.id}`}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                value === option.id
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-primary/50",
              )}
            >
              <RadioGroupItem
                value={option.id}
                id={`platform-${option.id}`}
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
      </CardContent>
    </Card>
  );
}

export default PlatformStyleSelector;
