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
  useEffect(() => {
    const dialogType = dialogContext.openDialog;
    if (!dialogType) return;

    switch (dialogType) {
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

    dialogContext.closeDialog();
  }, [
    dialogContext,
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

  const handleCreateSynthesis = useCallback(async () => {
    if (selectedIds.size < 3) return;

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
      });

      if (!response.ok) {
        throw new Error("创建失败");
      }

      const { data } = await response.json();
      router.push(`/synthesis/${data.id}?generate=true`);
    } catch (error) {
      clientLogger.error({ error }, "Create synthesis error:");
      toast.error("创建综述失败");
    } finally {
      setIsCreatingSynthesis(false);
      setShowSynthesisDialog(false);
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
