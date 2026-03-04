"use client";

import { Sparkles, Loader2, ChevronDown, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  PlatformStyleSelector,
  OutlineEditorV2,
} from "@/components/knowledge-studio/v2";
import type { PlatformStyle } from "@/lib/knowledge-studio/v2/constants";
import type { BlueprintOutline } from "@/lib/knowledge-studio/blueprint/types";
import type { Ks2TextFn } from "./utils";

interface AdvancedOptionsCardProps {
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  platformStyle: PlatformStyle;
  setPlatformStyle: (v: PlatformStyle) => void;
  selectedBlueprint: { supportsOutline?: boolean } | undefined;
  outline: BlueprintOutline | undefined;
  setOutline: (v: BlueprintOutline | undefined) => void;
  showOutlineEditor: boolean;
  isGeneratingOutline: boolean;
  onGenerateOutline: () => void;
  selectedMaterialsCount: number;
  k: Ks2TextFn;
}

export function AdvancedOptionsCard({
  isExpanded,
  setIsExpanded,
  platformStyle,
  setPlatformStyle,
  selectedBlueprint,
  outline,
  setOutline,
  showOutlineEditor,
  isGeneratingOutline,
  onGenerateOutline,
  selectedMaterialsCount,
  k,
}: AdvancedOptionsCardProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">
                  {k("advancedOptions")}
                </CardTitle>
              </div>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {k("platformStyle")}
              </label>
              <PlatformStyleSelector
                value={platformStyle}
                onChange={setPlatformStyle}
              />
            </div>

            {selectedBlueprint?.supportsOutline && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium block">
                    {k("outlineLabel")}
                  </label>
                  {!showOutlineEditor && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onGenerateOutline}
                      disabled={
                        isGeneratingOutline || selectedMaterialsCount < 2
                      }
                    >
                      {isGeneratingOutline ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {k("outlineGenerating")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          {k("outlineGenerate")}
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {showOutlineEditor && outline && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <OutlineEditorV2
                      outline={outline}
                      onChange={setOutline}
                      onConfirm={(confirmedOutline) => {
                        setOutline(confirmedOutline);
                        toast.success(k("outlineUpdated"));
                      }}
                      isRegenerating={isGeneratingOutline}
                      onRegenerate={onGenerateOutline}
                    />
                  </div>
                )}
                {!showOutlineEditor && (
                  <p className="text-sm text-muted-foreground">
                    {k("outlineHint")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
