/**
 * AI 推断画像展示区
 *
 * 从 persona-settings-card.tsx 提取
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Sparkles, BookOpen } from "lucide-react";
import { PERSONA_METADATA } from "@/lib/ai-agent/personas/types";
import type { PersonaGroup, PersonaType } from "@/lib/ai-agent/personas/types";
import { UI_TEXT, PERSONA_GROUPS } from "./persona-constants";

// =============================================================================
// 类型定义
// =============================================================================

interface InferredPersonaData {
  primaryType: PersonaType;
  group: PersonaGroup;
}

interface PersonaInferredSectionProps {
  inferredPersona: InferredPersonaData | null;
  inferredGroup: PersonaGroup | null;
  confidence: number;
  alternatives: { persona: PersonaType; confidence: number }[];
  bookmarkCount: number;
  onRefresh: () => void;
}

// =============================================================================
// 主组件
// =============================================================================

export function PersonaInferredSection({
  inferredPersona,
  inferredGroup,
  confidence,
  alternatives,
  bookmarkCount,
  onRefresh,
}: PersonaInferredSectionProps) {
  // 数据不足提示
  if (!inferredPersona && bookmarkCount < 10) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
        <BookOpen className="mx-auto size-8 mb-2 opacity-50" />
        <p className="text-sm">{UI_TEXT.insufficientData}</p>
      </div>
    );
  }

  if (!inferredPersona) return null;

  // 直接从常量数组访问 icon 属性（避免函数调用触发 react-hooks/static-components）
  const groupConfig = PERSONA_GROUPS.find(
    (g) => g.id === (inferredGroup ?? "academic"),
  );
  const Icon = groupConfig?.icon ?? BookOpen;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="size-4 text-purple-500" />
          {UI_TEXT.inferredSection}
        </Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRefresh()}
          className="text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          刷新
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        {UI_TEXT.basedOn.replace("{count}", bookmarkCount.toLocaleString())}
      </div>

      {/* 主画像 */}
      <div className="rounded-lg border p-4 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/20 dark:to-pink-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="size-6 text-purple-500" />
            <div>
              <span className="font-medium">
                {PERSONA_METADATA[inferredPersona.primaryType]?.displayName}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {PERSONA_METADATA[inferredPersona.primaryType]?.description}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {confidence}% {UI_TEXT.confidence}
            </Badge>
            <Badge className="bg-purple-500">{UI_TEXT.primaryPersona}</Badge>
          </div>
        </div>
      </div>

      {/* 次要特征 */}
      {alternatives.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            {UI_TEXT.secondaryTraits}
          </Label>
          <div className="flex flex-wrap gap-2">
            {alternatives.slice(0, 3).map((alt) => (
              <Badge key={alt.persona} variant="outline" className="text-xs">
                {PERSONA_METADATA[alt.persona]?.displayName} ({alt.confidence}%)
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
