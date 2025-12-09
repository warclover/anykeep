"use client";

/**
 * 智能分类调试工具 - 场景选择器
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TestTube2 } from "lucide-react";
import type { DebugScenario } from "../types";
import { getScenarioList } from "../constants";

interface ScenarioSelectorProps {
  value: DebugScenario;
  onChange: (value: DebugScenario) => void;
  disabled?: boolean;
}

export function ScenarioSelector({
  value,
  onChange,
  disabled = false,
}: ScenarioSelectorProps) {
  const scenarios = getScenarioList();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TestTube2 className="w-5 h-5" />
          测试场景
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={value}
          onValueChange={(v) => onChange(v as DebugScenario)}
          disabled={disabled}
          className="space-y-3"
        >
          {scenarios.map((scenario) => (
            <div
              key={scenario.key}
              className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <RadioGroupItem
                value={scenario.key}
                id={`scenario-${scenario.key}`}
                className="mt-1"
              />
              <Label
                htmlFor={`scenario-${scenario.key}`}
                className="flex-1 cursor-pointer"
              >
                <div className="font-medium">{scenario.name}</div>
                <div className="text-sm text-muted-foreground">
                  {scenario.description}
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
