"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BlueprintSelectorV2,
  ScenarioQuickEntry,
} from "@/components/knowledge-studio/v2";
import type { WorkflowStep, Ks2TextFn } from "./utils";

interface BlueprintStepCardProps {
  currentStep: WorkflowStep;
  setCurrentStep: (step: WorkflowStep) => void;
  selectedBlueprintId: string | undefined;
  selectedBlueprint: { icon: string; displayName: string } | undefined;
  onBlueprintSelect: (id: string) => void;
  isBlueprintExpanded: boolean;
  setIsBlueprintExpanded: (v: boolean) => void;
  blueprints: React.ComponentProps<typeof BlueprintSelectorV2>["blueprints"];
  userTier: React.ComponentProps<typeof BlueprintSelectorV2>["userTier"];
  isLoading: boolean;
  onUpgradeClick: () => void;
  k: Ks2TextFn;
}

export function BlueprintStepCard({
  currentStep,
  setCurrentStep,
  selectedBlueprintId,
  selectedBlueprint,
  onBlueprintSelect,
  isBlueprintExpanded,
  setIsBlueprintExpanded,
  blueprints,
  userTier,
  isLoading,
  onUpgradeClick,
  k,
}: BlueprintStepCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              1
            </span>
            <CardTitle>{k("step1Title")}</CardTitle>
            {selectedBlueprint && (
              <Badge variant="outline" className="ml-2">
                {k("selectedBlueprint", {
                  icon: selectedBlueprint.icon,
                  name: selectedBlueprint.displayName,
                })}
              </Badge>
            )}
          </div>
          {currentStep === "materials" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep("blueprint")}
            >
              {k("step1Change")}
            </Button>
          )}
        </div>
      </CardHeader>
      {currentStep === "blueprint" && (
        <CardContent className="space-y-4">
          <ScenarioQuickEntry
            onSelect={(blueprintId) => {
              onBlueprintSelect(blueprintId);
              setIsBlueprintExpanded(false);
            }}
          />

          <Collapsible
            open={isBlueprintExpanded}
            onOpenChange={setIsBlueprintExpanded}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-center"
                size="sm"
              >
                {isBlueprintExpanded ? (
                  <>
                    {k("step1CollapseAll")}
                    <ChevronDown className="ml-2 h-4 w-4 rotate-180 transition-transform" />
                  </>
                ) : (
                  <>
                    {k("step1ExpandMore")}
                    <ChevronDown className="ml-2 h-4 w-4 transition-transform" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <BlueprintSelectorV2
                blueprints={blueprints}
                value={selectedBlueprintId}
                onChange={onBlueprintSelect}
                userTier={userTier}
                onUpgradeClick={onUpgradeClick}
                isLoading={isLoading}
              />
            </CollapsibleContent>
          </Collapsible>

          {selectedBlueprintId && (
            <div className="flex justify-end pt-2">
              <Button onClick={() => setCurrentStep("materials")}>
                {k("step1Next")}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
