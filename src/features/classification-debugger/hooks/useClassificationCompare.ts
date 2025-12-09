/**
 * 智能分类调试工具 - 对比 Hook
 *
 * 管理对比请求状态和执行逻辑
 */

import { useState, useCallback } from "react";
import type {
  CompareRequest,
  CompareResponse,
  DebugScenario,
  PresetConfigKey,
  DebugBookmarkInput,
  DebuggerUIState,
} from "../types";

/**
 * 对比 Hook
 */
export function useClassificationCompare() {
  // UI 状态
  const [state, setState] = useState<DebuggerUIState>({
    isLoading: false,
    selectedScenario: "learning",
    selectedPreset: "default",
    isCustomConfig: false,
    lastResult: null,
    error: null,
  });

  /**
   * 执行对比
   */
  const executeCompare = useCallback(
    async (bookmark: DebugBookmarkInput): Promise<CompareResponse | null> => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const request: CompareRequest = {
          bookmark,
          scenario: state.selectedScenario,
          preset: state.selectedPreset,
        };

        const response = await fetch("/api/dev/classification-compare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        });

        const result: CompareResponse = await response.json();

        setState((prev) => ({
          ...prev,
          isLoading: false,
          lastResult: result,
          error: result.success ? null : result.error || "对比执行失败",
        }));

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "网络错误";

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        return null;
      }
    },
    [state.selectedScenario, state.selectedPreset],
  );

  /**
   * 设置场景
   */
  const setScenario = useCallback((scenario: DebugScenario) => {
    setState((prev) => ({
      ...prev,
      selectedScenario: scenario,
    }));
  }, []);

  /**
   * 设置预设
   */
  const setPreset = useCallback((preset: PresetConfigKey) => {
    setState((prev) => ({
      ...prev,
      selectedPreset: preset,
      isCustomConfig: false,
    }));
  }, []);

  /**
   * 清除结果
   */
  const clearResult = useCallback(() => {
    setState((prev) => ({
      ...prev,
      lastResult: null,
      error: null,
    }));
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      selectedScenario: "learning",
      selectedPreset: "default",
      isCustomConfig: false,
      lastResult: null,
      error: null,
    });
  }, []);

  return {
    // 状态
    isLoading: state.isLoading,
    selectedScenario: state.selectedScenario,
    selectedPreset: state.selectedPreset,
    lastResult: state.lastResult,
    error: state.error,

    // 操作
    executeCompare,
    setScenario,
    setPreset,
    clearResult,
    reset,
  };
}
