/**
 * AI 能力中心 - Skill 详情面板组件
 */

"use client";

import {
  Sparkles,
  Zap,
  Clock,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CATEGORY_INFO,
  type ExtendedSkillMetadata,
} from "@/lib/ai-skills/get-all-skills-metadata";
import {
  AI_HUB,
  SKILL_PAGE_MAP,
  formatDuration,
  getCategoryStyle,
} from "./ai-hub-constants";

export function SkillDetailSheet({
  skill,
  open,
  onClose,
  onUseNow,
  onGoToPage,
}: {
  skill: ExtendedSkillMetadata | null;
  open: boolean;
  onClose: () => void;
  onUseNow: () => void;
  onGoToPage?: () => void;
}) {
  if (!skill) return null;

  const categoryInfo = CATEGORY_INFO[skill.category];
  const categoryStyle = getCategoryStyle(skill.category);
  const hasPage = SKILL_PAGE_MAP[skill.id];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{categoryInfo.icon}</span>
            <div>
              <SheetTitle className="text-xl">{skill.name}</SheetTitle>
              <SheetDescription className="text-sm">
                {skill.id} · v{skill.version}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* 快捷操作 */}
          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={onUseNow}>
              <MessageCircle className="size-4" />
              {AI_HUB.SKILL_CARD.USE_NOW}
            </Button>
            {hasPage && onGoToPage && (
              <Button variant="outline" className="gap-2" onClick={onGoToPage}>
                <ExternalLink className="size-4" />
                {AI_HUB.SKILL_CARD.GO_TO_PAGE}
              </Button>
            )}
          </div>

          {/* 类型和分类 */}
          <div className="flex flex-wrap gap-2">
            {skill.isOrchestration ? (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                <Sparkles className="size-3 mr-1" />
                {AI_HUB.SKILL_CARD.ORCHESTRATION}型 Skill
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                <Zap className="size-3 mr-1" />
                {AI_HUB.SKILL_CARD.ATOMIC}型 Skill
              </Badge>
            )}
            <Badge className={cn(categoryStyle.bg, categoryStyle.text)}>
              {categoryInfo.name}
            </Badge>
            {skill.requiresConfirmation && (
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-300"
              >
                <AlertCircle className="size-3 mr-1" />
                {AI_HUB.SKILL_CARD.REQUIRES_CONFIRM}
              </Badge>
            )}
          </div>

          {/* 描述 */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              描述
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {skill.description}
            </p>
          </div>

          {/* 能力 */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              {AI_HUB.SKILL_CARD.CAPABILITIES}
            </h4>
            <div className="flex flex-wrap gap-2">
              {skill.capabilities.map((cap) => (
                <Badge
                  key={cap}
                  variant="outline"
                  className={cn(categoryStyle.bg, categoryStyle.text)}
                >
                  {cap}
                </Badge>
              ))}
            </div>
          </div>

          {/* 交付物 */}
          {skill.deliverableTypes && skill.deliverableTypes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                {AI_HUB.SKILL_CARD.DELIVERABLES}
              </h4>
              <ul className="space-y-1">
                {skill.deliverableTypes.map((d: string, i: number) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <CheckCircle2 className="size-4 text-green-500" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 输出格式 */}
          {skill.outputFormats && skill.outputFormats.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                {AI_HUB.SKILL_CARD.OUTPUT_FORMATS}
              </h4>
              <div className="flex flex-wrap gap-2">
                {skill.outputFormats.map((format) => (
                  <Badge key={format} variant="secondary" className="text-xs">
                    {format}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Feature Flag */}
          {skill.featureFlag && (
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                {AI_HUB.SKILL_CARD.FEATURE_FLAG}
              </h4>
              <code className="text-xs bg-purple-100 dark:bg-purple-800 px-2 py-1 rounded">
                {skill.featureFlag}
              </code>
            </div>
          )}

          {/* 预计耗时 */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Clock className="size-4" />
            {AI_HUB.SKILL_CARD.DURATION}:{" "}
            {formatDuration(skill.estimatedDurationMs)}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
