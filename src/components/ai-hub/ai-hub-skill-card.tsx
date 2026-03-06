/**
 * AI 能力中心 - Skill 卡片组件
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function SkillCard({
  skill,
  onClick,
  onUseNow,
  onGoToPage,
}: {
  skill: ExtendedSkillMetadata;
  onClick: () => void;
  onUseNow: () => void;
  onGoToPage?: () => void;
}) {
  const categoryInfo = CATEGORY_INFO[skill.category];
  const categoryStyle = getCategoryStyle(skill.category);
  const hasPage = SKILL_PAGE_MAP[skill.id];

  return (
    <Card
      className={cn(
        "group transition-all duration-200",
        "hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600",
        "border",
        categoryStyle.border,
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={onClick}
          >
            <span className="text-xl">{categoryInfo.icon}</span>
            <CardTitle className="text-base font-semibold hover:text-primary transition-colors">
              {skill.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {skill.isOrchestration ? (
              <Badge
                variant="secondary"
                className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
              >
                <Sparkles className="size-3 mr-1" />
                {AI_HUB.SKILL_CARD.ORCHESTRATION}
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
              >
                <Zap className="size-3 mr-1" />
                {AI_HUB.SKILL_CARD.ATOMIC}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p
          className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 cursor-pointer"
          onClick={onClick}
        >
          {skill.description}
        </p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(skill.estimatedDurationMs)}
          </span>
          {skill.requiresConfirmation && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertCircle className="size-3" />
              {AI_HUB.SKILL_CARD.REQUIRES_CONFIRM}
            </span>
          )}
          {skill.featureFlag && (
            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
              <CheckCircle2 className="size-3" />
              Flag
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {skill.capabilities.slice(0, 3).map((cap) => (
            <Badge
              key={cap}
              variant="outline"
              className={cn("text-xs", categoryStyle.text, categoryStyle.bg)}
            >
              {cap}
            </Badge>
          ))}
          {skill.capabilities.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{skill.capabilities.length - 3}
            </Badge>
          )}
        </div>

        {/* 快捷操作按钮 */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="default"
            className="flex-1 gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onUseNow();
            }}
          >
            <MessageCircle className="size-3" />
            {AI_HUB.SKILL_CARD.USE_NOW}
          </Button>
          {hasPage && onGoToPage && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onGoToPage();
              }}
            >
              <ExternalLink className="size-3" />
              {AI_HUB.SKILL_CARD.GO_TO_PAGE}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
