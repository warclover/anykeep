/**
 * 用户画像 React Hooks
 *
 * 提供画像推断和设置管理功能
 *
 * @version 2.0.0 - 迁移到 TanStack Query
 * @since 2025-12-28
 */

"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { personaKeys } from "@/hooks/queries/keys";
import type {
  PersonaType,
  PersonaGroup,
  PersonaPreferences,
} from "@/lib/ai-agent/personas/types";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 存储的画像设置
 */
export interface StoredPersonaSettings {
  primaryType: PersonaType;
  group: PersonaGroup;
  preferences: PersonaPreferences;
  source: "registration" | "settings" | "inferred";
  createdAt: string;
  updatedAt: string;
}

/**
 * 推断的画像结果
 */
export interface InferredPersona {
  primaryType: PersonaType;
  group: PersonaGroup;
  confidence: number;
  alternatives: Array<{
    persona: PersonaType;
    group: PersonaGroup;
    confidence: number;
  }>;
}

/**
 * API 响应结构
 */
export interface PersonaApiResponse {
  stored: StoredPersonaSettings | null;
  inferred: InferredPersona | null;
  bookmarkCount: number;
  featureEnabled: boolean;
}

/**
 * 画像推断 Hook 返回类型
 */
export interface UsePersonaInferenceResult {
  /** 推断的画像 */
  inferredPersona: InferredPersona | null;
  /** 存储的设置 */
  storedSettings: StoredPersonaSettings | null;
  /** 收藏数量 */
  bookmarkCount: number;
  /** 功能是否启用 */
  featureEnabled: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 置信度（0-100） */
  confidence: number;
  /** 备选画像列表 */
  alternatives: InferredPersona["alternatives"];
  /** 刷新推断 */
  refresh: () => Promise<void>;
}

/**
 * 画像设置 Hook 返回类型
 */
export interface UsePersonaSettingsResult {
  /** 当前设置 */
  settings: StoredPersonaSettings | null;
  /** 是否正在保存 */
  isSaving: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 保存设置 */
  saveSettings: (settings: Partial<StoredPersonaSettings>) => Promise<boolean>;
  /** 重置为 AI 推断 */
  resetToInferred: () => Promise<boolean>;
}

/**
 * 画像模式 Hook 返回类型
 */
export interface UsePersonaModeResult {
  /** 当前模式 */
  mode: "inferred" | "manual";
  /** 当前画像类型 */
  currentPersona: PersonaType | null;
  /** 当前画像分组 */
  currentGroup: PersonaGroup | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 切换到手动模式 */
  switchToManual: (type: PersonaType, group: PersonaGroup) => Promise<boolean>;
  /** 切换到推断模式 */
  switchToInferred: () => Promise<boolean>;
}

// =============================================================================
// 常量
// =============================================================================

const API_URL = "/api/user/persona";

/** 缓存时间：5 分钟 */
const STALE_TIME = 5 * 60 * 1000;

// =============================================================================
// Fetcher
// =============================================================================

async function personaFetcher(): Promise<PersonaApiResponse> {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error("Failed to fetch persona data");
  }
  const result = await response.json();
  return result.data;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * 画像推断 Hook
 *
 * 获取 AI 推断的用户画像和存储的设置
 */
export function usePersonaInference(): UsePersonaInferenceResult {
  const _queryClient = useQueryClient();

  const { data, error, isLoading, refetch } = useQuery<PersonaApiResponse>({
    queryKey: personaKeys.current(),
    queryFn: personaFetcher,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    inferredPersona: data?.inferred ?? null,
    storedSettings: data?.stored ?? null,
    bookmarkCount: data?.bookmarkCount ?? 0,
    featureEnabled: data?.featureEnabled ?? false,
    isLoading,
    error: error ?? null,
    confidence: data?.inferred?.confidence ?? 0,
    alternatives: data?.inferred?.alternatives ?? [],
    refresh,
  };
}

/**
 * 画像设置 Hook
 *
 * 管理用户画像设置的保存和重置
 */
export function usePersonaSettings(): UsePersonaSettingsResult {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { storedSettings } = usePersonaInference();

  const saveSettings = useCallback(
    async (newSettings: Partial<StoredPersonaSettings>): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(API_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...storedSettings,
            ...newSettings,
            source: "settings",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save settings");
        }

        // 刷新缓存
        await queryClient.invalidateQueries({ queryKey: personaKeys.all });
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [queryClient, storedSettings],
  );

  const resetToInferred = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(API_URL, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to reset settings");
      }

      // 刷新缓存
      await queryClient.invalidateQueries({ queryKey: personaKeys.all });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [queryClient]);

  return {
    settings: storedSettings,
    isSaving,
    error,
    saveSettings,
    resetToInferred,
  };
}

/**
 * 画像模式 Hook
 *
 * 管理推断模式和手动模式的切换
 */
export function usePersonaMode(): UsePersonaModeResult {
  const { inferredPersona, storedSettings, isLoading } = usePersonaInference();
  const { saveSettings, resetToInferred } = usePersonaSettings();

  // 确定当前模式
  const mode: "inferred" | "manual" =
    storedSettings?.source === "settings" ? "manual" : "inferred";

  // 确定当前画像
  const currentPersona: PersonaType | null =
    mode === "manual"
      ? (storedSettings?.primaryType ?? null)
      : (inferredPersona?.primaryType ?? null);

  const currentGroup: PersonaGroup | null =
    mode === "manual"
      ? (storedSettings?.group ?? null)
      : (inferredPersona?.group ?? null);

  const switchToManual = useCallback(
    async (type: PersonaType, group: PersonaGroup): Promise<boolean> => {
      return saveSettings({
        primaryType: type,
        group,
        source: "settings",
      });
    },
    [saveSettings],
  );

  const switchToInferred = useCallback(async (): Promise<boolean> => {
    return resetToInferred();
  }, [resetToInferred]);

  return {
    mode,
    currentPersona,
    currentGroup,
    isLoading,
    switchToManual,
    switchToInferred,
  };
}
