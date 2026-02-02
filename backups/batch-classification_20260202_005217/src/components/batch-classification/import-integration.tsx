/**
 * 批量分类选项组件
 *
 * 集成到导入流程，提供批量分类选项
 *
 * @module components/batch-classification/import-integration
 * @version 1.0.0
 * @since 2026-02-01
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FolderTree, Zap, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StructureMode } from "@/lib/classification/services/batch-classification";

// ============================================
// Props
// ============================================

interface BatchClassificationOptionsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  structureMode: StructureMode;
  onStructureModeChange: (mode: StructureMode) => void;
  bookmarkCount: number;
  structureAnalysis?: {
    folderCount: number;
    validFolderCount: number;
    classifiedRatio: number;
    structureQuality: number;
    recommendedMode: StructureMode;
  };
  className?: string;
}

// ============================================
// 常量
// ============================================

const STRUCTURE_MODE_INFO: Record<StructureMode, {
  label: string;
  description: string;
  icon: React.ReactNode;
}> = {
  preserve: {
    label: "保留原结构",
    description: "保留浏览器中的原始文件夹结构，AI 仅处理未分类书签",
    icon: <FolderTree className="h-4 w-4" />,
  },
  hybrid: {
    label: "智能优化",
    description: "保留有效分类，合并碎片文件夹，AI 优化剩余书签",
    icon: <Sparkles className="h-4 w-4" />,
  },
  rebuild: {
    label: "全新整理",
    description: "忽略原有结构，让 AI 重新组织所有书签",
    icon: <Zap className="h-4 w-4" />,
  },
  auto: {
    label: "自动选择",
    description: "根据原始结构质量自动选择最佳模式",
    icon: <Sparkles className="h-4 w-4" />,
  },
};

// ============================================
// 组件
// ============================================

export function BatchClassificationOptions({
  enabled,
  onEnabledChange,
  structureMode,
  onStructureModeChange,
  bookmarkCount,
  structureAnalysis,
  className,
}: BatchClassificationOptionsProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI 智能分类
              <Badge variant="secondary" className="ml-2">Beta</Badge>
            </CardTitle>
            <CardDescription>
              导入后自动分析并整理 {bookmarkCount} 个书签
            </CardDescription>
          </div>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </div>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-6">
          {/* 结构分析结果 */}
          {structureAnalysis && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FolderTree className="h-4 w-4" />
                原始结构分析
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">文件夹数:</span>
                  <span className="ml-2">{structureAnalysis.folderCount}</span>
                  <span className="text-muted-foreground ml-1">
                    (有效: {structureAnalysis.validFolderCount})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">已分类:</span>
                  <span className="ml-2">
                    {Math.round(structureAnalysis.classifiedRatio * 100)}%
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">结构质量:</span>
                  <span className={`ml-2 font-medium ${
                    structureAnalysis.structureQuality > 0.7 ? "text-green-600" :
                    structureAnalysis.structureQuality > 0.3 ? "text-amber-600" : "text-red-600"
                  }`}>
                    {structureAnalysis.structureQuality > 0.7 ? "良好" :
                     structureAnalysis.structureQuality > 0.3 ? "一般" : "较差"}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    (推荐: {STRUCTURE_MODE_INFO[structureAnalysis.recommendedMode].label})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 处理模式选择 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>处理模式</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>选择如何处理浏览器书签的原始文件夹结构</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <RadioGroup
              value={structureMode}
              onValueChange={(v) => onStructureModeChange(v as StructureMode)}
              className="space-y-2"
            >
              {(["auto", "preserve", "hybrid", "rebuild"] as StructureMode[]).map((mode) => {
                const info = STRUCTURE_MODE_INFO[mode];
                const isRecommended = structureAnalysis?.recommendedMode === mode;

                return (
                  <div
                    key={mode}
                    className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      structureMode === mode
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => onStructureModeChange(mode)}
                  >
                    <RadioGroupItem value={mode} id={mode} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={mode} className="flex items-center gap-2 cursor-pointer">
                        {info.icon}
                        <span className="font-medium">{info.label}</span>
                        {isRecommended && (
                          <Badge variant="outline" className="text-xs">推荐</Badge>
                        )}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {info.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* 预估信息 */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
            <div className="flex items-center gap-2 text-blue-800 mb-1">
              <Sparkles className="h-4 w-4" />
              <span className="font-medium">预估处理时间</span>
            </div>
            <p className="text-blue-700">
              {bookmarkCount} 个书签约需 {Math.ceil(bookmarkCount / 100)} 分钟，
              处理完成后您可以预览并确认分类结果
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ============================================
// 导入结果中的分类入口
// ============================================

interface ClassificationEntryProps {
  transactionId?: string;
  bookmarkCount: number;
  onStartClassification: () => void;
  onViewResults: () => void;
  status: "idle" | "processing" | "ready" | "completed";
}

export function ClassificationEntry({
  transactionId: _transactionId,
  bookmarkCount,
  onStartClassification,
  onViewResults,
  status,
}: ClassificationEntryProps) {
  if (status === "idle") {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">智能分类</p>
              <p className="text-sm text-muted-foreground">
                让 AI 帮您整理 {bookmarkCount} 个书签
              </p>
            </div>
          </div>
          <button
            onClick={onStartClassification}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            开始分类
          </button>
        </CardContent>
      </Card>
    );
  }

  if (status === "processing") {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">正在分类...</p>
            <p className="text-sm text-muted-foreground">
              AI 正在分析您的书签，请稍候
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === "ready") {
    return (
      <Card className="border-green-500/50 bg-green-50/50">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-800">分类完成</p>
              <p className="text-sm text-green-700">
                请查看并确认 AI 的分类建议
              </p>
            </div>
          </div>
          <button
            onClick={onViewResults}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            查看结果
          </button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
