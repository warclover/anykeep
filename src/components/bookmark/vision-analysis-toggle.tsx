"use client";

import { Eye } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface VisionAnalysisToggleProps {
  enableVisionAnalysis: boolean;
  setEnableVisionAnalysis: (v: boolean) => void;
  isSubmitting: boolean;
  showExpandedSections: boolean;
}

export function VisionAnalysisToggle({
  enableVisionAnalysis,
  setEnableVisionAnalysis,
  isSubmitting,
  showExpandedSections,
}: VisionAnalysisToggleProps) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 bg-muted/30 transition-all duration-300 ease-out ${
        showExpandedSections
          ? "opacity-100 max-h-20"
          : "opacity-0 max-h-0 overflow-hidden p-0 border-0"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
          <Eye className="size-4 text-purple-500" />
        </div>
        <div>
          <Label
            htmlFor="vision-analysis"
            className="text-sm font-medium cursor-pointer"
          >
            深度视觉分析
          </Label>
          <p className="text-xs text-muted-foreground">
            提取图片文字、分析图表逻辑、生成视觉标签
          </p>
        </div>
      </div>
      <Switch
        id="vision-analysis"
        checked={enableVisionAnalysis}
        onCheckedChange={setEnableVisionAnalysis}
        disabled={isSubmitting}
      />
    </div>
  );
}
