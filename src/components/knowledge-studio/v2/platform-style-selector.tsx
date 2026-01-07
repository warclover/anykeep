/**
 * Platform Style Selector - 平台风格选择器
 * @module knowledge-studio/v2
 *
 * Phase 3.1: 让用户选择生成内容的目标平台风格
 * P2-5: 风格预览示例
 */

"use client";

import { useMemo, useState } from "react";
import { Smartphone, Eye } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  // P2-5: 预览展开状态
  const [previewOpen, setPreviewOpen] = useState(false);

  const platformOptions = useMemo(() => {
    return Object.values(PLATFORM_STYLE_CONFIG);
  }, []);

  // P2-5: 当前选中风格的预览内容
  const currentPreview = useMemo(() => {
    return PLATFORM_STYLE_CONFIG[value].preview;
  }, [value]);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          平台风格
        </CardTitle>
        <CardDescription>选择目标平台以优化内容风格</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* P2-5: 风格预览示例 */}
        <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Eye className="h-4 w-4" />
              {previewOpen ? "收起预览" : "查看风格示例"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">
                  {PLATFORM_STYLE_CONFIG[value].icon}
                </span>
                <span className="text-sm font-medium">
                  {PLATFORM_STYLE_CONFIG[value].label}示例
                </span>
              </div>
              <ScrollArea className="h-[200px]">
                <div className="text-sm whitespace-pre-wrap leading-relaxed pr-4">
                  {currentPreview}
                </div>
              </ScrollArea>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export default PlatformStyleSelector;
