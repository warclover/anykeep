/**
 * useDialogs Hook 单元测试
 * @description 测试对话框状态管理的核心功能
 */

import { renderHook, act } from "@testing-library/react";
import { useDialogs } from "../use-dialogs";

describe("useDialogs", () => {
  describe("初始状态", () => {
    it("所有对话框默认关闭", () => {
      const { result } = renderHook(() => useDialogs());

      expect(result.current.showCreateDialog).toBe(false);
      expect(result.current.showImportDialog).toBe(false);
      expect(result.current.showBrowserImportDialog).toBe(false);
      expect(result.current.showExportDialog).toBe(false);
      expect(result.current.showMoveDialog).toBe(false);
    });

    it("所有下拉菜单默认关闭", () => {
      const { result } = renderHook(() => useDialogs());

      expect(result.current.isDesktopImportMenuOpen).toBe(false);
      expect(result.current.isMobileMoreMenuOpen).toBe(false);
    });
  });

  describe("创建对话框操作", () => {
    it("openCreateDialog 打开对话框", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.openCreateDialog();
      });

      expect(result.current.showCreateDialog).toBe(true);
    });

    it("closeCreateDialog 关闭对话框", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.openCreateDialog();
      });
      act(() => {
        result.current.closeCreateDialog();
      });

      expect(result.current.showCreateDialog).toBe(false);
    });

    it("setShowCreateDialog 直接设置状态", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.setShowCreateDialog(true);
      });
      expect(result.current.showCreateDialog).toBe(true);

      act(() => {
        result.current.setShowCreateDialog(false);
      });
      expect(result.current.showCreateDialog).toBe(false);
    });
  });

  describe("导入对话框操作", () => {
    it("openImportDialog 打开对话框", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.openImportDialog();
      });

      expect(result.current.showImportDialog).toBe(true);
    });

    it("closeImportDialog 关闭对话框", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.openImportDialog();
        result.current.closeImportDialog();
      });

      expect(result.current.showImportDialog).toBe(false);
    });
  });

  describe("浏览器导入对话框操作", () => {
    it("openBrowserImportDialog 打开对话框", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.openBrowserImportDialog();
      });

      expect(result.current.showBrowserImportDialog).toBe(true);
    });

    it("closeBrowserImportDialog 关闭对话框", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.openBrowserImportDialog();
        result.current.closeBrowserImportDialog();
      });

      expect(result.current.showBrowserImportDialog).toBe(false);
    });
  });

  describe("导出对话框操作", () => {
    it("openExportDialog 打开对话框", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.openExportDialog();
      });

      expect(result.current.showExportDialog).toBe(true);
    });

    it("closeExportDialog 关闭对话框", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.openExportDialog();
        result.current.closeExportDialog();
      });

      expect(result.current.showExportDialog).toBe(false);
    });
  });

  describe("移动对话框操作", () => {
    it("openMoveDialog 打开对话框", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.openMoveDialog();
      });

      expect(result.current.showMoveDialog).toBe(true);
    });

    it("closeMoveDialog 关闭对话框", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.openMoveDialog();
        result.current.closeMoveDialog();
      });

      expect(result.current.showMoveDialog).toBe(false);
    });
  });

  describe("下拉菜单操作", () => {
    it("setIsDesktopImportMenuOpen 设置桌面导入菜单状态", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.setIsDesktopImportMenuOpen(true);
      });
      expect(result.current.isDesktopImportMenuOpen).toBe(true);

      act(() => {
        result.current.setIsDesktopImportMenuOpen(false);
      });
      expect(result.current.isDesktopImportMenuOpen).toBe(false);
    });

    it("setIsMobileMoreMenuOpen 设置移动端更多菜单状态", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.setIsMobileMoreMenuOpen(true);
      });
      expect(result.current.isMobileMoreMenuOpen).toBe(true);

      act(() => {
        result.current.setIsMobileMoreMenuOpen(false);
      });
      expect(result.current.isMobileMoreMenuOpen).toBe(false);
    });
  });

  describe("状态独立性", () => {
    it("打开一个对话框不影响其他对话框", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.openCreateDialog();
      });

      expect(result.current.showCreateDialog).toBe(true);
      expect(result.current.showImportDialog).toBe(false);
      expect(result.current.showBrowserImportDialog).toBe(false);
      expect(result.current.showExportDialog).toBe(false);
      expect(result.current.showMoveDialog).toBe(false);
    });

    it("可以同时打开多个对话框", () => {
      const { result } = renderHook(() => useDialogs());

      act(() => {
        result.current.openCreateDialog();
        result.current.openImportDialog();
      });

      expect(result.current.showCreateDialog).toBe(true);
      expect(result.current.showImportDialog).toBe(true);
    });
  });
});
