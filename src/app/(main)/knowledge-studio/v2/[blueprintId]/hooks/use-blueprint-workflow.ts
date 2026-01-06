/**
 * Blueprint Workflow Hook - 工作流状态与逻辑
 * @module knowledge-studio/v2/hooks
 *
 * 从 blueprint-workflow-client.tsx 提取的核心工作流逻辑
 */

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import type {
  BriefingQuestion,
  BriefingContext,
  BlueprintOutline,
  MaterialInput,
} from "@/lib/knowledge-studio/blueprint/types";
import type { PlatformStyle } from "@/lib/knowledge-studio/v2/constants";
import {
  DraftVersionManager,
  type DraftVersion,
} from "@/lib/knowledge-studio/iteration";
import { useSoundEffect } from "@/hooks/use-sound-effect";
import { useUsageTracking } from "@/hooks/knowledge-studio";
import type { BlueprintListItem } from "@/components/knowledge-studio/v2";

// ============================================================
// Types
// ============================================================

export type WorkflowStep = "briefing" | "outline" | "generating" | "result";

export interface GenerationProgress {
  step: string;
  percent: number;
  message?: string;
  /** Phase 2.3: 已生成字数 */
  generatedWords?: number;
}

export interface BlueprintWorkflowState {
  // Core state
  blueprint: BlueprintListItem | null;
  questions: BriefingQuestion[];
  materials: MaterialInput[];
  isLoading: boolean;
  error: string | null;

  // Workflow state
  currentStep: WorkflowStep;
  briefingContext: BriefingContext | undefined;
  outline: BlueprintOutline | undefined;
  progress: GenerationProgress;
  generatedContent: string;
  reportId: string | null;
  isRegenerating: boolean;

  // Phase 2.3: Generation stats
  currentWordCount: number;
  generationStartTime: number | null;

  // Phase 3.1: Platform style
  platformStyle: PlatformStyle;

  // Phase 3.2: Condense state
  isCondensing: boolean;
  condensedContent: string | null;

  // Phase 4: Draft iteration
  isIterating: boolean;
  isFeedbackDialogOpen: boolean;
  draftVersionManager: DraftVersionManager;
  currentVersionId: string | null;
  draftVersions: DraftVersion[];
}

export interface BlueprintWorkflowActions {
  setBlueprint: (blueprint: BlueprintListItem | null) => void;
  setQuestions: (questions: BriefingQuestion[]) => void;
  setMaterials: (materials: MaterialInput[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentStep: (step: WorkflowStep) => void;
  setBriefingContext: (context: BriefingContext | undefined) => void;
  setOutline: (outline: BlueprintOutline | undefined) => void;
  setProgress: (progress: GenerationProgress) => void;
  setGeneratedContent: (content: string) => void;
  setReportId: (id: string | null) => void;
  setIsRegenerating: (regenerating: boolean) => void;
  setCurrentWordCount: (count: number) => void;
  setGenerationStartTime: (time: number | null) => void;
  setPlatformStyle: (style: PlatformStyle) => void;
  setIsCondensing: (condensing: boolean) => void;
  setCondensedContent: (content: string | null) => void;
  setIsIterating: (iterating: boolean) => void;
  setIsFeedbackDialogOpen: (open: boolean) => void;
  setCurrentVersionId: (id: string | null) => void;
  setDraftVersions: (versions: DraftVersion[]) => void;
}

// ============================================================
// Session Storage Keys
// ============================================================

export const CACHE_KEYS = {
  BRIEFING_CONTEXT: (blueprintId: string) =>
    `ks:v2:${blueprintId}:briefingContext`,
  OUTLINE: (blueprintId: string) => `ks:v2:${blueprintId}:outline`,
  CONTENT: (blueprintId: string) => `ks:v2:${blueprintId}:content`,
  REPORT_ID: (blueprintId: string) => `ks:v2:${blueprintId}:reportId`,
  CURRENT_STEP: (blueprintId: string) => `ks:v2:${blueprintId}:currentStep`,
  PLATFORM_STYLE: (blueprintId: string) => `ks:v2:${blueprintId}:platformStyle`,
};

// ============================================================
// Cache Utilities
// ============================================================

export function saveToCache(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently ignore storage errors
  }
}

export function loadFromCache<T>(key: string): T | null {
  try {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

export function clearCache(blueprintId: string): void {
  try {
    Object.values(CACHE_KEYS).forEach((keyFn) => {
      if (typeof keyFn === "function") {
        sessionStorage.removeItem(keyFn(blueprintId));
      }
    });
  } catch {
    // Silently ignore storage errors
  }
}

// ============================================================
// Validation Schemas
// ============================================================

export const MaterialInputSchema = z.object({
  bookmarkId: z.string().min(1),
  title: z.string(),
  content: z.string(),
  url: z.string().url(),
  platform: z.string().optional(),
});

export const StoredMaterialsSchema = z.array(MaterialInputSchema).min(1);

// ============================================================
// Hook Implementation
// ============================================================

export interface UseBlueprintWorkflowOptions {
  blueprintId: string;
}

export interface UseBlueprintWorkflowReturn {
  state: BlueprintWorkflowState;
  actions: BlueprintWorkflowActions;
  refs: {
    abortControllerRef: React.MutableRefObject<AbortController | null>;
  };
  utils: {
    router: ReturnType<typeof useRouter>;
    playSuccess: () => void;
    playError: () => void;
    recordUsage: ReturnType<typeof useUsageTracking>["recordUsage"];
    saveToCache: (key: string, value: unknown) => void;
    loadFromCache: <T>(key: string) => T | null;
    clearCache: () => void;
    getCacheKey: (key: keyof typeof CACHE_KEYS) => string;
  };
}

/**
 * Custom hook for blueprint workflow state management
 *
 * Extracts all state and basic utilities from BlueprintWorkflowClient
 * for better separation of concerns and testability.
 */
export function useBlueprintWorkflow({
  blueprintId,
}: UseBlueprintWorkflowOptions): UseBlueprintWorkflowReturn {
  const router = useRouter();
  const { playSuccess, playError } = useSoundEffect();
  const { recordUsage } = useUsageTracking();

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);

  // Core state
  const [blueprint, setBlueprint] = useState<BlueprintListItem | null>(null);
  const [questions, setQuestions] = useState<BriefingQuestion[]>([]);
  const [materials, setMaterials] = useState<MaterialInput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workflow state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("briefing");
  const [briefingContext, setBriefingContext] = useState<
    BriefingContext | undefined
  >();
  const [outline, setOutline] = useState<BlueprintOutline | undefined>();
  const [progress, setProgress] = useState<GenerationProgress>({
    step: "",
    percent: 0,
  });
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Phase 2.3: Generation stats
  const [currentWordCount, setCurrentWordCount] = useState(0);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(
    null,
  );

  // Phase 3.1: Platform style with cache restoration
  const [platformStyle, setPlatformStyle] = useState<PlatformStyle>(() => {
    const cached = loadFromCache<PlatformStyle>(
      CACHE_KEYS.PLATFORM_STYLE(blueprintId),
    );
    return cached || "general";
  });

  // Phase 3.2: Condense state
  const [isCondensing, setIsCondensing] = useState(false);
  const [condensedContent, setCondensedContent] = useState<string | null>(null);

  // Phase 4: Draft iteration
  const [isIterating, setIsIterating] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [draftVersionManager] = useState(() => new DraftVersionManager());
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [draftVersions, setDraftVersions] = useState<DraftVersion[]>([]);

  // Cache key helper
  const getCacheKey = useCallback(
    (key: keyof typeof CACHE_KEYS) => CACHE_KEYS[key](blueprintId),
    [blueprintId],
  );

  // Clear cache helper
  const clearCacheForBlueprint = useCallback(() => {
    clearCache(blueprintId);
  }, [blueprintId]);

  return {
    state: {
      blueprint,
      questions,
      materials,
      isLoading,
      error,
      currentStep,
      briefingContext,
      outline,
      progress,
      generatedContent,
      reportId,
      isRegenerating,
      currentWordCount,
      generationStartTime,
      platformStyle,
      isCondensing,
      condensedContent,
      isIterating,
      isFeedbackDialogOpen,
      draftVersionManager,
      currentVersionId,
      draftVersions,
    },
    actions: {
      setBlueprint,
      setQuestions,
      setMaterials,
      setIsLoading,
      setError,
      setCurrentStep,
      setBriefingContext,
      setOutline,
      setProgress,
      setGeneratedContent,
      setReportId,
      setIsRegenerating,
      setCurrentWordCount,
      setGenerationStartTime,
      setPlatformStyle,
      setIsCondensing,
      setCondensedContent,
      setIsIterating,
      setIsFeedbackDialogOpen,
      setCurrentVersionId,
      setDraftVersions,
    },
    refs: {
      abortControllerRef,
    },
    utils: {
      router,
      playSuccess,
      playError,
      recordUsage,
      saveToCache,
      loadFromCache,
      clearCache: clearCacheForBlueprint,
      getCacheKey,
    },
  };
}
