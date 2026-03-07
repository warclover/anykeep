/**
 * 响应偏好表单
 *
 * 从 persona-settings-card.tsx 提取
 */

"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import type { PersonaPreferences } from "@/lib/ai-agent/personas/types";
import { UI_TEXT } from "./persona-constants";

interface PersonaPreferencesFormProps {
  preferences: PersonaPreferences;
  onPreferenceChange: <K extends keyof PersonaPreferences>(
    key: K,
    value: PersonaPreferences[K],
  ) => void;
}

export function PersonaPreferencesForm({
  preferences,
  onPreferenceChange,
}: PersonaPreferencesFormProps) {
  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">
        {UI_TEXT.preferencesSection}
      </Label>

      <div className="grid gap-4">
        {/* 响应风格 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm">{UI_TEXT.responseStyle}</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">控制 AI 响应的详细程度</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select
            value={preferences.responseStyle}
            onValueChange={(value) =>
              onPreferenceChange(
                "responseStyle",
                value as PersonaPreferences["responseStyle"],
              )
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="concise">简洁</SelectItem>
              <SelectItem value="detailed">详细</SelectItem>
              <SelectItem value="auto">自动</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Emoji 风格 */}
        <div className="flex items-center justify-between">
          <Label className="text-sm">{UI_TEXT.emojiStyle}</Label>
          <Select
            value={preferences.emojiStyle}
            onValueChange={(value) =>
              onPreferenceChange(
                "emojiStyle",
                value as PersonaPreferences["emojiStyle"],
              )
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">不使用</SelectItem>
              <SelectItem value="minimal">适度</SelectItem>
              <SelectItem value="rich">丰富</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 主动提醒 */}
        <div className="flex items-center justify-between">
          <Label className="text-sm">{UI_TEXT.proactiveReminders}</Label>
          <Switch
            checked={preferences.proactiveReminders}
            onCheckedChange={(checked) =>
              onPreferenceChange("proactiveReminders", checked)
            }
          />
        </div>

        {/* 学术引用 */}
        <div className="flex items-center justify-between">
          <Label className="text-sm">{UI_TEXT.academicCitations}</Label>
          <Switch
            checked={preferences.academicCitations}
            onCheckedChange={(checked) =>
              onPreferenceChange("academicCitations", checked)
            }
          />
        </div>
      </div>
    </div>
  );
}
