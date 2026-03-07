"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import { useDialogs } from "@/hooks/core";
// P0-2: 细粒度 Context 订阅（dialog + selection）
import { useDialog, useSelection } from "@/contexts/home-page";

interface UseHomeDialogsOptions {
  exitSelectionMode: () => void;
  refetch: () => Promise<unknown>;
  selectedIds: Set<number>;
  isSelectionMode: boolean;
  toggleSelectionMode: () => void;
}

export function useHomeDialogs({
  exitSelectionMode,
  refetch,
  selectedIds,
  isSelectionMode,
  toggleSelectionMode,
}: UseHomeDialogsOptions) {
  const router = useRouter();
  // P0-2: 直接订阅细粒度 Context
  const dialogContext = useDialog();
  const selectionContext = useSelection();

  const {
    showCreateDialog,
    showImportDialog,
    showBrowserImportDialog,
    showExportDialog,
    showMoveDialog,
    isMobileMoreMenuOpen,
    openCreateDialog,
    setShowCreateDialog,
    openImportDialog,
    setShowImportDialog,
    openBrowserImportDialog,
    setShowBrowserImportDialog,
    openExportDialog,
    setShowExportDialog,
    openMoveDialog,
    setShowMoveDialog,
    setIsMobileMoreMenuOpen,
  } = useDialogs();

  const [showBatchTagDialog, setShowBatchTagDialog] = useState(false);
  const [showSynthesisDialog, setShowSynthesisDialog] = useState(false);
  const [isCreatingSynthesis, setIsCreatingSynthesis] = useState(false);

  // Context 对话框联动
  const { openDialog: contextOpenDialog, closeDialog: contextCloseDialog } =
    dialogContext;
  useEffect(() => {
    if (!contextOpenDialog) return;

    switch (contextOpenDialog) {
      case "create":
        openCreateDialog();
        break;
      case "batchImport":
        openImportDialog();
        break;
      case "browserImport":
        openBrowserImportDialog();
        break;
      case "export":
        openExportDialog();
        break;
      case "batchMove":
        openMoveDialog();
        break;
    }

    contextCloseDialog();
  }, [
    contextOpenDialog,
    contextCloseDialog,
    openCreateDialog,
    openImportDialog,
    openBrowserImportDialog,
    openExportDialog,
    openMoveDialog,
  ]);

  // Context 选择模式联动
  const prevSelectionModeRef = useRef(selectionContext.isSelectionMode);
  useEffect(() => {
    const contextSelectionMode = selectionContext.isSelectionMode;
    if (
      contextSelectionMode !== prevSelectionModeRef.current &&
      contextSelectionMode !== isSelectionMode
    ) {
      toggleSelectionMode();
    }
    prevSelectionModeRef.current = contextSelectionMode;
  }, [selectionContext.isSelectionMode, isSelectionMode, toggleSelectionMode]);

  const handleMoveSuccess = useCallback(() => {
    exitSelectionMode();
    refetch().catch((error) => {
      clientLogger.error({ error }, "Failed to refetch after batch move");
    });
  }, [exitSelectionMode, refetch]);

  // AbortController 用于组件卸载时取消进行中的 fetch
  const abortControllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleCreateSynthesis = useCallback(async () => {
    if (selectedIds.size < 3) return;

    // 取消前一次未完成的请求
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsCreatingSynthesis(true);
    try {
      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "selection",
          bookmarkIds: Array.from(selectedIds),
          depthMode: "standard",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("创建失败");
      }

      const { data } = await response.json();
      router.push(`/synthesis/${data.id}?generate=true`);
    } catch (error) {
      // 组件卸载导致的 abort 不需要提示用户
      if (error instanceof DOMException && error.name === "AbortError") return;
      clientLogger.error({ error }, "Create synthesis error:");
      toast.error("创建综述失败");
    } finally {
      if (!controller.signal.aborted) {
        setIsCreatingSynthesis(false);
        setShowSynthesisDialog(false);
      }
    }
  }, [selectedIds, router]);

  return {
    showCreateDialog,
    showImportDialog,
    showBrowserImportDialog,
    showExportDialog,
    showMoveDialog,
    isMobileMoreMenuOpen,
    setShowCreateDialog,
    setShowImportDialog,
    setShowBrowserImportDialog,
    setShowExportDialog,
    setShowMoveDialog,
    setIsMobileMoreMenuOpen,
    openCreateDialog,
    openImportDialog,
    openBrowserImportDialog,
    openExportDialog,
    openMoveDialog,
    showBatchTagDialog,
    setShowBatchTagDialog,
    showSynthesisDialog,
    setShowSynthesisDialog,
    isCreatingSynthesis,
    handleCreateSynthesis,
    handleMoveSuccess,
  };
}
