/**
 * 对话框状态管理 Hook
 * 统一管理首页的所有对话框和下拉菜单状态
 */

import { useState } from "react";

export interface DialogsState {
  // 对话框状态
  showCreateDialog: boolean;
  showImportDialog: boolean;
  showBrowserImportDialog: boolean;
  showExportDialog: boolean;
  showMoveDialog: boolean;

  // 下拉菜单状态
  isDesktopImportMenuOpen: boolean;
  isMobileMoreMenuOpen: boolean;
}

export interface DialogsActions {
  // 对话框操作（简化版）
  openCreateDialog: () => void;
  closeCreateDialog: () => void;
  setShowCreateDialog: (open: boolean) => void;
  openImportDialog: () => void;
  closeImportDialog: () => void;
  setShowImportDialog: (open: boolean) => void;
  openBrowserImportDialog: () => void;
  closeBrowserImportDialog: () => void;
  setShowBrowserImportDialog: (open: boolean) => void;
  openExportDialog: () => void;
  closeExportDialog: () => void;
  setShowExportDialog: (open: boolean) => void;
  openMoveDialog: () => void;
  closeMoveDialog: () => void;
  setShowMoveDialog: (open: boolean) => void;

  // 下拉菜单操作
  setIsDesktopImportMenuOpen: (open: boolean) => void;
  setIsMobileMoreMenuOpen: (open: boolean) => void;
}

export type UseDialogsReturn = DialogsState & DialogsActions;

/**
 * 对话框状态管理 Hook
 */
export function useDialogs(): UseDialogsReturn {
  // 对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showBrowserImportDialog, setShowBrowserImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  // 下拉菜单状态
  const [isDesktopImportMenuOpen, setIsDesktopImportMenuOpen] = useState(false);
  const [isMobileMoreMenuOpen, setIsMobileMoreMenuOpen] = useState(false);

  return {
    // 状态
    showCreateDialog,
    showImportDialog,
    showBrowserImportDialog,
    showExportDialog,
    showMoveDialog,
    isDesktopImportMenuOpen,
    isMobileMoreMenuOpen,

    // 操作
    openCreateDialog: () => setShowCreateDialog(true),
    closeCreateDialog: () => setShowCreateDialog(false),
    setShowCreateDialog,
    openImportDialog: () => setShowImportDialog(true),
    closeImportDialog: () => setShowImportDialog(false),
    setShowImportDialog,
    openBrowserImportDialog: () => setShowBrowserImportDialog(true),
    closeBrowserImportDialog: () => setShowBrowserImportDialog(false),
    setShowBrowserImportDialog,
    openExportDialog: () => setShowExportDialog(true),
    closeExportDialog: () => setShowExportDialog(false),
    setShowExportDialog,
    openMoveDialog: () => setShowMoveDialog(true),
    closeMoveDialog: () => setShowMoveDialog(false),
    setShowMoveDialog,
    setIsDesktopImportMenuOpen,
    setIsMobileMoreMenuOpen,
  };
}
