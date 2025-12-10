/**
 * v3对比v4 - 配置卡片（场景+版本选择）
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2, Snowflake, GraduationCap, Crown } from "lucide-react";
import type { TestScenario, SelectedVersions } from "../types";

interface ConfigCardProps {
  scenario: TestScenario;
  versions: SelectedVersions;
  onScenarioChange: (scenario: TestScenario) => void;
  onVersionToggle: (version: keyof SelectedVersions) => void;
  disabled?: boolean;
}

const scenarios: {
  value: TestScenario;
  label: string;
  description: string;
  icon: typeof Snowflake;
}[] = [
  {
    value: "cold-start",
    label: "冷启动",
    description: "无历史数据的新用户",
    icon: Snowflake,
  },
  {
    value: "learning",
    label: "学习期",
    description: "少量历史数据",
    icon: GraduationCap,
  },
  {
    value: "mature",
    label: "成熟用户",
    description: "丰富的历史数据",
    icon: Crown,
  },
];

const versionOptions: {
  key: keyof SelectedVersions;
  label: string;
  badge: string;
  color: string;
}[] = [
  { key: "v3", label: "V3 基础版", badge: "基准", color: "text-gray-600" },
  { key: "v41", label: "V4.1 简化版", badge: "生产", color: "text-blue-600" },
  { key: "v42", label: "V4.2 增强版", badge: "最新", color: "text-green-600" },
];

export function ConfigCard({
  scenario,
  versions,
  onScenarioChange,
  onVersionToggle,
  disabled = false,
}: ConfigCardProps) {
  const selectedCount = Object.values(versions).filter(Boolean).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          对比配置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 场景选择 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">测试场景</Label>
          <RadioGroup
            value={scenario}
            onValueChange={(v) => onScenarioChange(v as TestScenario)}
            disabled={disabled}
            className="grid grid-cols-3 gap-3"
          >
            {scenarios.map((s) => {
              const Icon = s.icon;
              return (
                <label
                  key={s.value}
                  className={`
                    flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${
                      scenario === s.value
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }
                    ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  <RadioGroupItem value={s.value} className="sr-only" />
                  <Icon
                    className={`w-5 h-5 mb-1 ${scenario === s.value ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground text-center">
                    {s.description}
                  </span>
                </label>
              );
            })}
          </RadioGroup>
        </div>

        {/* 版本选择 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">对比版本</Label>
            <span className="text-xs text-muted-foreground">
              已选 {selectedCount}/3
            </span>
          </div>
          <div className="space-y-2">
            {versionOptions.map((v) => (
              <label
                key={v.key}
                className={`
                  flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all
                  ${versions[v.key] ? "border-primary/50 bg-primary/5" : "border-muted hover:border-muted-foreground/30"}
                  ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={versions[v.key]}
                    onCheckedChange={() => onVersionToggle(v.key)}
                    disabled={disabled}
                  />
                  <span className="text-sm font-medium">{v.label}</span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full bg-muted ${v.color}`}
                >
                  {v.badge}
                </span>
              </label>
            ))}
          </div>
          {selectedCount < 2 && (
            <p className="text-xs text-amber-600">请至少选择两个版本进行对比</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
