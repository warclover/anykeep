"use client";

/**
 * 智能分类调试工具 - 配置面板
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";
import type { PresetConfigKey } from "../types";
import { getPresetList } from "../constants";

interface ConfigPanelProps {
  value: PresetConfigKey;
  onChange: (value: PresetConfigKey) => void;
  disabled?: boolean;
}

export function ConfigPanel({
  value,
  onChange,
  disabled = false,
}: ConfigPanelProps) {
  const presets = getPresetList();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="w-5 h-5" />
          预设配置
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={value}
          onValueChange={(v) => onChange(v as PresetConfigKey)}
          disabled={disabled}
          className="space-y-3"
        >
          {presets.map((preset) => (
            <div
              key={preset.key}
              className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <RadioGroupItem
                value={preset.key}
                id={`preset-${preset.key}`}
                className="mt-1"
              />
              <Label
                htmlFor={`preset-${preset.key}`}
                className="flex-1 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{preset.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {preset.key}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {preset.description}
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
