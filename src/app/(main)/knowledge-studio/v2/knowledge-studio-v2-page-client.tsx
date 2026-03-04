"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  FeedbackDialog,
  ExportResultDialog,
  MultiPlatformDialog,
} from "@/components/knowledge-studio/v2";
import { useBlueprints } from "@/hooks/queries/use-blueprints";
import { useSoundEffect } from "@/hooks/use-sound-effect";
import { useUsageTracking, useKSTTSPlayer } from "@/hooks/knowledge-studio";
import type { PlatformStyle } from "@/lib/knowledge-studio/v2/constants";
import { useKs2Text, useReducedMotion } from "./utils";
import { useGenerationFlow } from "./hooks/use-generation-flow";
import { useMaterialSelection } from "./hooks/use-material-selection";
import { useCondenseFlow } from "./hooks/use-condense-flow";
import { useIterationFlow } from "./hooks/use-iteration-flow";
import { BlueprintStepCard } from "./blueprint-step-card";
import { MaterialsStepCard } from "./materials-step-card";
import { RequirementsCard } from "./requirements-card";
import { AdvancedOptionsCard } from "./advanced-options-card";
import { GeneratingProgressCard } from "./generating-progress-card";
import { ResultSection } from "./result-section";

export function KnowledgeStudioV2PageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const k = useKs2Text();
  const {
    blueprints,
    userTier,
    isLoading: isLoadingBlueprints,
    error: blueprintError,
  } = useBlueprints();
  const { playSuccess, playError } = useSoundEffect();
  const { recordUsage } = useUsageTracking();
  const {
    isLoading: isTTSLoading,
    isPlaying,
    play: playTTS,
    pause: pauseTTS,
  } = useKSTTSPlayer();
  const prefersReducedMotion = useReducedMotion();

  const [selectedBlueprintId, setSelectedBlueprintId] = useState<
    string | undefined
  >(() => {
    if (typeof window !== "undefined") {
      const bp = searchParams?.get("blueprint");
      if (bp) return bp;
    }
    return undefined;
  });
  const [additionalRequirements, setAdditionalRequirements] = useState("");
  const [isRequirementsExpanded, setIsRequirementsExpanded] = useState(false);
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  const [platformStyle, setPlatformStyle] = useState<PlatformStyle>("general");

  const selectedBlueprint = blueprints.find(
    (bp) => bp.blueprintId === selectedBlueprintId,
  );

  const mat = useMaterialSelection({ k });
  const gen = useGenerationFlow({
    selectedBlueprintId,
    selectedMaterials: mat.selectedMaterials,
    additionalRequirements,
    platformStyle,
    playSuccess,
    playError,
    recordUsage,
    k,
  });
  const cond = useCondenseFlow({
    reportId: gen.reportId,
    generatedContent: gen.generatedContent,
    selectedBlueprintId,
    selectedBlueprintDisplayName: selectedBlueprint?.displayName,
    router,
    k,
  });
  const iter = useIterationFlow({
    generatedContent: gen.generatedContent,
    selectedBlueprintId,
    platformStyle,
    outline: gen.outline,
    setGeneratedContent: gen.setGeneratedContent,
    setCondensedContent: cond.setCondensedContent,
    k,
  });

  const handleBlueprintSelect = useCallback(
    (id: string) => {
      setSelectedBlueprintId(id);
      gen.setError(null);
    },
    [gen.setError],
  );

  const handleUpgrade = useCallback(() => router.push("/pricing"), [router]);
  const handleViewReport = useCallback(() => {
    if (gen.reportId) router.push(`/synthesis/${gen.reportId}`);
  }, [gen.reportId, router]);

  const handleRegenerate = useCallback(() => {
    gen.setCurrentStep("materials");
    gen.setGeneratedContent("");
    gen.setStructuredOutput(null);
    gen.setReportId(undefined);
    cond.setCondensedContent("");
    mat.setMaterialsFromRecommendations({});
  }, [
    gen.setCurrentStep,
    gen.setGeneratedContent,
    gen.setStructuredOutput,
    gen.setReportId,
    cond.setCondensedContent,
    mat.setMaterialsFromRecommendations,
  ]);

  if (blueprintError) {
    return (
      <div className="container max-w-6xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{k("loadFailed")}</AlertTitle>
          <AlertDescription>{blueprintError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (gen.error) {
    return (
      <div className="container max-w-6xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{k("errorTitle")}</AlertTitle>
          <AlertDescription>{gen.error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => {
            gen.setError(null);
            gen.setCurrentStep("materials");
          }}
          className="mt-4"
        >
          {k("retryButton")}
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{k("title")}</h1>
          <Badge variant="secondary" className="text-xs">
            {k("badgeV2")}
          </Badge>
        </div>
        {gen.currentStep !== "result" && (
          <p className="text-sm text-muted-foreground">{k("stepsHint")}</p>
        )}
      </div>

      <div className="space-y-6">
        {(gen.currentStep === "blueprint" ||
          gen.currentStep === "materials") && (
          <BlueprintStepCard
            currentStep={gen.currentStep}
            setCurrentStep={gen.setCurrentStep}
            selectedBlueprintId={selectedBlueprintId}
            selectedBlueprint={selectedBlueprint}
            onBlueprintSelect={handleBlueprintSelect}
            isBlueprintExpanded={mat.isBlueprintExpanded}
            setIsBlueprintExpanded={mat.setIsBlueprintExpanded}
            blueprints={blueprints}
            userTier={userTier}
            isLoading={isLoadingBlueprints}
            onUpgradeClick={handleUpgrade}
            k={k}
          />
        )}

        {gen.currentStep === "materials" && (
          <>
            <MaterialsStepCard
              selectedMaterialIds={mat.selectedMaterialIds}
              onMaterialsChange={mat.handleMaterialsChange}
              onAddMaterial={mat.handleAddMaterial}
              isManualSelectExpanded={mat.isManualSelectExpanded}
              setIsManualSelectExpanded={mat.setIsManualSelectExpanded}
              platformFilter={mat.platformFilter}
              setPlatformFilter={mat.setPlatformFilter}
              materialSearchQuery={mat.materialSearchQuery}
              setMaterialSearchQuery={mat.setMaterialSearchQuery}
              allMaterials={mat.allMaterialsForSelector}
              isLoading={mat.isLoadingBookmarks}
              isSearching={mat.isSearching}
              k={k}
            />
            <RequirementsCard
              isExpanded={isRequirementsExpanded}
              setIsExpanded={setIsRequirementsExpanded}
              value={additionalRequirements}
              onChange={setAdditionalRequirements}
              k={k}
            />
            <AdvancedOptionsCard
              isExpanded={isAdvancedExpanded}
              setIsExpanded={setIsAdvancedExpanded}
              platformStyle={platformStyle}
              setPlatformStyle={setPlatformStyle}
              selectedBlueprint={selectedBlueprint}
              outline={gen.outline}
              setOutline={gen.setOutline}
              showOutlineEditor={gen.showOutlineEditor}
              isGeneratingOutline={gen.isGeneratingOutline}
              onGenerateOutline={gen.handleGenerateOutline}
              selectedMaterialsCount={mat.selectedMaterials.length}
              k={k}
            />
            <div className="flex justify-center pt-4">
              <Button
                size="lg"
                onClick={gen.handleGenerate}
                disabled={
                  !selectedBlueprintId || mat.selectedMaterialIds.length < 2
                }
                className="px-8"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                {k("generateButton")}
              </Button>
            </div>
          </>
        )}

        {gen.currentStep === "generating" && (
          <GeneratingProgressCard
            progress={gen.progress}
            generationStartTime={gen.generationStartTime}
            waitingMessageIndex={gen.waitingMessageIndex}
            onCancel={gen.handleCancelGeneration}
            generatedContent={gen.generatedContent}
            prefersReducedMotion={prefersReducedMotion}
            k={k}
          />
        )}

        {gen.currentStep === "result" && (
          <ResultSection
            generatedContent={gen.generatedContent}
            condensedContent={cond.condensedContent}
            structuredOutput={gen.structuredOutput}
            selectedBlueprintDisplayName={selectedBlueprint?.displayName ?? ""}
            reportId={gen.reportId}
            isCondensing={cond.isCondensing}
            condenseProgress={cond.condenseProgress}
            isSavingCondensed={cond.isSavingCondensed}
            onCondense={cond.handleCondense}
            onCopyCondensed={cond.handleCopyCondensed}
            onSaveCondensed={cond.handleSaveCondensed}
            isIterating={iter.isIterating}
            iterationProgress={iter.iterationProgress}
            setIsFeedbackDialogOpen={iter.setIsFeedbackDialogOpen}
            setIsMultiPlatformDialogOpen={iter.setIsMultiPlatformDialogOpen}
            setIsExportDialogOpen={iter.setIsExportDialogOpen}
            setExportContent={iter.setExportContent}
            isTTSLoading={isTTSLoading}
            isPlaying={isPlaying}
            playTTS={playTTS}
            pauseTTS={pauseTTS}
            onViewReport={handleViewReport}
            onRegenerate={handleRegenerate}
            k={k}
          />
        )}
      </div>

      <FeedbackDialog
        open={iter.isFeedbackDialogOpen}
        onOpenChange={iter.setIsFeedbackDialogOpen}
        onSubmit={iter.handleFeedbackSubmit}
        isSubmitting={iter.isIterating}
        wordCount={gen.generatedContent?.length}
      />
      <ExportResultDialog
        open={iter.isExportDialogOpen}
        onOpenChange={iter.setIsExportDialogOpen}
        content={
          iter.exportContent ||
          cond.condensedContent ||
          gen.generatedContent ||
          ""
        }
        blueprintName={
          selectedBlueprint?.displayName || k("generatedContentTitle")
        }
      />
      <MultiPlatformDialog
        open={iter.isMultiPlatformDialogOpen}
        onOpenChange={iter.setIsMultiPlatformDialogOpen}
        content={cond.condensedContent || gen.generatedContent}
        currentStyle={platformStyle}
      />
    </div>
  );
}
