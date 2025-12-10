/**
 * v3对比v4 - 状态管理 Hook
 */

"use client";

import { useState, useCallback } from "react";
import type {
  CompareUIState,
  CompareResponse,
  TestBookmarkInput,
  TestScenario,
  SelectedVersions,
} from "../types";

const initialState: CompareUIState = {
  isLoading: false,
  bookmark: {
    url: "",
    title: "",
    description: "",
    tags: [],
  },
  scenario: "learning",
  versions: {
    v3: true,
    v41: true,
    v42: true,
  },
  result: null,
  error: null,
};

export function useVersionCompare() {
  const [state, setState] = useState<CompareUIState>(initialState);

  // 更新书签输入
  const setBookmark = useCallback((bookmark: TestBookmarkInput) => {
    setState((prev) => ({ ...prev, bookmark }));
  }, []);

  // 更新场景
  const setScenario = useCallback((scenario: TestScenario) => {
    setState((prev) => ({ ...prev, scenario }));
  }, []);

  // 更新版本选择
  const setVersions = useCallback((versions: SelectedVersions) => {
    setState((prev) => ({ ...prev, versions }));
  }, []);

  // 切换单个版本
  const toggleVersion = useCallback((version: keyof SelectedVersions) => {
    setState((prev) => ({
      ...prev,
      versions: {
        ...prev.versions,
        [version]: !prev.versions[version],
      },
    }));
  }, []);

  // 执行对比
  const executeCompare = useCallback(async () => {
    // 验证至少选择了两个版本
    const selectedCount = Object.values(state.versions).filter(Boolean).length;
    if (selectedCount < 2) {
      setState((prev) => ({
        ...prev,
        error: "请至少选择两个版本进行对比",
      }));
      return;
    }

    // 验证输入
    if (!state.bookmark.url || !state.bookmark.title) {
      setState((prev) => ({
        ...prev,
        error: "请填写 URL 和标题",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await fetch("/api/dev/version-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookmark: state.bookmark,
          scenario: state.scenario,
          versions: state.versions,
        }),
      });

      const result: CompareResponse = await response.json();

      setState((prev) => ({
        ...prev,
        isLoading: false,
        result,
        error: result.success ? null : result.error || "对比失败",
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "网络错误",
      }));
    }
  }, [state.bookmark, state.scenario, state.versions]);

  // 重置
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    // 状态
    isLoading: state.isLoading,
    bookmark: state.bookmark,
    scenario: state.scenario,
    versions: state.versions,
    result: state.result,
    error: state.error,

    // 操作
    setBookmark,
    setScenario,
    setVersions,
    toggleVersion,
    executeCompare,
    reset,
  };
}
