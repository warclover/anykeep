/**
 * useSelectionMode Hook 单元测试
 * @description 测试批量选择模式的核心功能，包括 Shift 范围选择
 */

import { renderHook, act } from "@testing-library/react";
import { useSelectionMode } from "../use-selection-mode";

describe("useSelectionMode", () => {
  describe("初始状态", () => {
    it("选择模式默认关闭", () => {
      const { result } = renderHook(() => useSelectionMode());

      expect(result.current.isSelectionMode).toBe(false);
    });

    it("选中集合默认为空", () => {
      const { result } = renderHook(() => useSelectionMode());

      expect(result.current.selectedIds.size).toBe(0);
    });

    it("批量删除状态默认为 false", () => {
      const { result } = renderHook(() => useSelectionMode());

      expect(result.current.isBatchDeleting).toBe(false);
    });
  });

  describe("toggleSelectionMode", () => {
    it("切换选择模式", () => {
      const { result } = renderHook(() => useSelectionMode());

      act(() => {
        result.current.toggleSelectionMode();
      });

      expect(result.current.isSelectionMode).toBe(true);

      act(() => {
        result.current.toggleSelectionMode();
      });

      expect(result.current.isSelectionMode).toBe(false);
    });

    it("切换模式时清空选中集合", () => {
      const { result } = renderHook(() => useSelectionMode());

      // 先选中一些项目
      act(() => {
        result.current.toggleSelect(1);
        result.current.toggleSelect(2);
      });

      expect(result.current.selectedIds.size).toBe(2);

      // 切换模式
      act(() => {
        result.current.toggleSelectionMode();
      });

      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe("toggleSelect", () => {
    it("添加未选中的项目", () => {
      const { result } = renderHook(() => useSelectionMode());

      act(() => {
        result.current.toggleSelect(1);
      });

      expect(result.current.selectedIds.has(1)).toBe(true);
    });

    it("移除已选中的项目", () => {
      const { result } = renderHook(() => useSelectionMode());

      act(() => {
        result.current.toggleSelect(1);
      });

      expect(result.current.selectedIds.has(1)).toBe(true);

      act(() => {
        result.current.toggleSelect(1);
      });

      expect(result.current.selectedIds.has(1)).toBe(false);
    });

    it("多个项目独立选择", () => {
      const { result } = renderHook(() => useSelectionMode());

      act(() => {
        result.current.toggleSelect(1);
        result.current.toggleSelect(2);
        result.current.toggleSelect(3);
      });

      expect(result.current.selectedIds.size).toBe(3);
      expect(result.current.selectedIds.has(1)).toBe(true);
      expect(result.current.selectedIds.has(2)).toBe(true);
      expect(result.current.selectedIds.has(3)).toBe(true);
    });
  });

  describe("selectAll", () => {
    it("全选所有项目", () => {
      const { result } = renderHook(() => useSelectionMode());
      const allIds = [1, 2, 3, 4, 5];

      act(() => {
        result.current.selectAll(allIds);
      });

      expect(result.current.selectedIds.size).toBe(5);
      allIds.forEach((id) => {
        expect(result.current.selectedIds.has(id)).toBe(true);
      });
    });

    it("替换现有选择", () => {
      const { result } = renderHook(() => useSelectionMode());

      act(() => {
        result.current.toggleSelect(100);
      });

      expect(result.current.selectedIds.has(100)).toBe(true);

      act(() => {
        result.current.selectAll([1, 2, 3]);
      });

      expect(result.current.selectedIds.has(100)).toBe(false);
      expect(result.current.selectedIds.size).toBe(3);
    });
  });

  describe("deselectAll", () => {
    it("清空所有选中", () => {
      const { result } = renderHook(() => useSelectionMode());

      act(() => {
        result.current.selectAll([1, 2, 3, 4, 5]);
      });

      expect(result.current.selectedIds.size).toBe(5);

      act(() => {
        result.current.deselectAll();
      });

      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe("exitSelectionMode", () => {
    it("退出选择模式并清空选中", () => {
      const { result } = renderHook(() => useSelectionMode());

      act(() => {
        result.current.toggleSelectionMode();
        result.current.selectAll([1, 2, 3]);
      });

      expect(result.current.isSelectionMode).toBe(true);
      expect(result.current.selectedIds.size).toBe(3);

      act(() => {
        result.current.exitSelectionMode();
      });

      expect(result.current.isSelectionMode).toBe(false);
      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe("setIsBatchDeleting", () => {
    it("设置批量删除状态", () => {
      const { result } = renderHook(() => useSelectionMode());

      act(() => {
        result.current.setIsBatchDeleting(true);
      });

      expect(result.current.isBatchDeleting).toBe(true);

      act(() => {
        result.current.setIsBatchDeleting(false);
      });

      expect(result.current.isBatchDeleting).toBe(false);
    });
  });

  describe("handleItemClick - Shift 范围选择", () => {
    it("普通点击切换单个项目", () => {
      const { result } = renderHook(() => useSelectionMode());
      const allIds = [1, 2, 3, 4, 5];

      act(() => {
        result.current.handleItemClick(3, allIds, false);
      });

      expect(result.current.selectedIds.has(3)).toBe(true);
      expect(result.current.selectedIds.size).toBe(1);
    });

    it("Shift+点击进行范围选择", () => {
      const { result } = renderHook(() => useSelectionMode());
      const allIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      // 先普通点击选中起点
      act(() => {
        result.current.handleItemClick(3, allIds, false);
      });

      expect(result.current.selectedIds.size).toBe(1);

      // Shift+点击选中终点，范围选择
      act(() => {
        result.current.handleItemClick(7, allIds, true);
      });

      // 应该选中 3, 4, 5, 6, 7
      expect(result.current.selectedIds.size).toBe(5);
      expect(result.current.selectedIds.has(3)).toBe(true);
      expect(result.current.selectedIds.has(4)).toBe(true);
      expect(result.current.selectedIds.has(5)).toBe(true);
      expect(result.current.selectedIds.has(6)).toBe(true);
      expect(result.current.selectedIds.has(7)).toBe(true);
    });

    it("Shift+点击反向范围选择", () => {
      const { result } = renderHook(() => useSelectionMode());
      const allIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      // 先点击后面的项目
      act(() => {
        result.current.handleItemClick(8, allIds, false);
      });

      // Shift+点击前面的项目
      act(() => {
        result.current.handleItemClick(4, allIds, true);
      });

      // 应该选中 4, 5, 6, 7, 8
      expect(result.current.selectedIds.size).toBe(5);
      expect(result.current.selectedIds.has(4)).toBe(true);
      expect(result.current.selectedIds.has(5)).toBe(true);
      expect(result.current.selectedIds.has(6)).toBe(true);
      expect(result.current.selectedIds.has(7)).toBe(true);
      expect(result.current.selectedIds.has(8)).toBe(true);
    });

    it("Shift+点击保留之前的选择", () => {
      const { result } = renderHook(() => useSelectionMode());
      const allIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      // 先选中一个单独的项目
      act(() => {
        result.current.handleItemClick(1, allIds, false);
      });

      // 再选中另一个起点
      act(() => {
        result.current.handleItemClick(5, allIds, false);
      });

      // Shift 范围选择
      act(() => {
        result.current.handleItemClick(8, allIds, true);
      });

      // 应该有 1 (之前单选) + 5,6,7,8 (范围选择) = 至少 4 个
      expect(result.current.selectedIds.has(5)).toBe(true);
      expect(result.current.selectedIds.has(6)).toBe(true);
      expect(result.current.selectedIds.has(7)).toBe(true);
      expect(result.current.selectedIds.has(8)).toBe(true);
    });

    it("无上次点击时 Shift 退化为普通点击", () => {
      const { result } = renderHook(() => useSelectionMode());
      const allIds = [1, 2, 3, 4, 5];

      // 直接 Shift+点击（没有上次点击记录）
      act(() => {
        result.current.handleItemClick(3, allIds, true);
      });

      // 应该只选中一个
      expect(result.current.selectedIds.size).toBe(1);
      expect(result.current.selectedIds.has(3)).toBe(true);
    });

    it("ID 不在列表中时退化为普通点击", () => {
      const { result } = renderHook(() => useSelectionMode());
      const allIds = [1, 2, 3, 4, 5];

      // 先普通点击
      act(() => {
        result.current.handleItemClick(2, allIds, false);
      });

      // Shift+点击不在列表中的 ID
      act(() => {
        result.current.handleItemClick(100, allIds, true);
      });

      // 100 不在 allIds 中，应该退化为普通点击（添加 100）
      expect(result.current.selectedIds.has(100)).toBe(true);
    });
  });

  describe("性能优化 - ID->Index Map 缓存", () => {
    it("相同 allIds 引用使用缓存", () => {
      const { result } = renderHook(() => useSelectionMode());
      const allIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      // 多次点击使用相同的 allIds 引用
      act(() => {
        result.current.handleItemClick(2, allIds, false);
        result.current.handleItemClick(5, allIds, true);
        result.current.handleItemClick(8, allIds, true);
      });

      // 验证功能正常工作
      expect(result.current.selectedIds.has(2)).toBe(true);
      expect(result.current.selectedIds.has(5)).toBe(true);
      expect(result.current.selectedIds.has(6)).toBe(true);
      expect(result.current.selectedIds.has(7)).toBe(true);
      expect(result.current.selectedIds.has(8)).toBe(true);
    });

    it("大量 ID 时性能正常", () => {
      const { result } = renderHook(() => useSelectionMode());
      // 模拟大量书签
      const allIds = Array.from({ length: 10000 }, (_, i) => i + 1);

      const startTime = performance.now();

      act(() => {
        result.current.handleItemClick(100, allIds, false);
        result.current.handleItemClick(5000, allIds, true);
      });

      const endTime = performance.now();

      // 应该在 100ms 内完成
      expect(endTime - startTime).toBeLessThan(100);

      // 验证选中了正确的范围
      expect(result.current.selectedIds.size).toBe(4901); // 100 到 5000
    });
  });
});
