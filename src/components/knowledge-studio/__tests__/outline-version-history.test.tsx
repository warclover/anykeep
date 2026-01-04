/**
 * 大纲版本历史组件测试 (Story 2.5)
 * @module components/knowledge-studio/__tests__
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OutlineVersionHistory } from "../outline-version-history";
import type { OutlineVersion } from "@/lib/knowledge-studio/blueprint/outline-version-manager";

// ============================================================
// Test Data
// ============================================================

const createMockVersion = (
  id: string,
  version: number,
  title: string,
  timestamp: number,
): OutlineVersion => ({
  id,
  version,
  timestamp,
  outline: {
    title,
    summary: `Summary for ${title}`,
    nodes: [
      { id: "s1", title: "章节1", level: 1, estimatedWords: 500 },
      { id: "s2", title: "章节2", level: 1, estimatedWords: 300 },
    ],
    totalEstimatedWords: 800,
    generatedBy: "deepseek",
  },
});

const mockVersions: OutlineVersion[] = [
  createMockVersion("v3", 3, "版本3", Date.now() - 1000),
  createMockVersion("v2", 2, "版本2", Date.now() - 60000),
  createMockVersion("v1", 1, "版本1", Date.now() - 3600000),
];

// ============================================================
// Tests
// ============================================================

describe("OutlineVersionHistory", () => {
  const mockOnRestoreVersion = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render version history button with count", () => {
      render(
        <OutlineVersionHistory
          versions={mockVersions}
          onRestoreVersion={mockOnRestoreVersion}
        />,
      );

      expect(screen.getByText("版本历史")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument(); // Badge count
    });

    it("should not render when versions array is empty", () => {
      const { container } = render(
        <OutlineVersionHistory
          versions={[]}
          onRestoreVersion={mockOnRestoreVersion}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("should expand to show version list when clicked", async () => {
      const user = userEvent.setup();
      render(
        <OutlineVersionHistory
          versions={mockVersions}
          onRestoreVersion={mockOnRestoreVersion}
        />,
      );

      await user.click(screen.getByText("版本历史"));

      expect(screen.getByText("版本 1")).toBeInTheDocument();
      expect(screen.getByText("版本 2")).toBeInTheDocument();
      expect(screen.getByText("版本 3")).toBeInTheDocument();
    });

    it("should show current badge for current version", async () => {
      const user = userEvent.setup();
      render(
        <OutlineVersionHistory
          versions={mockVersions}
          currentVersionId="v3"
          onRestoreVersion={mockOnRestoreVersion}
        />,
      );

      await user.click(screen.getByText("版本历史"));

      expect(screen.getByText("当前")).toBeInTheDocument();
    });

    it("should show version info (chapters and words)", async () => {
      const user = userEvent.setup();
      render(
        <OutlineVersionHistory
          versions={mockVersions}
          onRestoreVersion={mockOnRestoreVersion}
        />,
      );

      await user.click(screen.getByText("版本历史"));

      // Each version should show "2 章节 · 800字"
      const infoElements = screen.getAllByText(/2 章节 · 800字/);
      expect(infoElements.length).toBe(3);
    });
  });

  describe("Restore Action", () => {
    it("should show confirmation dialog when restore button clicked", async () => {
      const user = userEvent.setup();
      render(
        <OutlineVersionHistory
          versions={mockVersions}
          currentVersionId="v3"
          onRestoreVersion={mockOnRestoreVersion}
        />,
      );

      // Expand the list
      await user.click(screen.getByText("版本历史"));

      // Click restore on v1 (not current)
      const restoreButtons = screen.getAllByRole("button", {
        name: "恢复版本",
      });
      expect(restoreButtons.length).toBe(2); // v1 and v2 (not v3 which is current)

      await user.click(restoreButtons[1]); // v1

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText("恢复版本")).toBeInTheDocument();
      });
    });

    it("should call onRestoreVersion when confirmed", async () => {
      const user = userEvent.setup();
      render(
        <OutlineVersionHistory
          versions={mockVersions}
          currentVersionId="v3"
          onRestoreVersion={mockOnRestoreVersion}
        />,
      );

      await user.click(screen.getByText("版本历史"));

      const restoreButtons = screen.getAllByRole("button", {
        name: "恢复版本",
      });
      await user.click(restoreButtons[1]); // v1

      await waitFor(() => {
        expect(screen.getByText("恢复版本")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "恢复" }));

      expect(mockOnRestoreVersion).toHaveBeenCalledWith("v1");
    });

    it("should not call onRestoreVersion when cancelled", async () => {
      const user = userEvent.setup();
      render(
        <OutlineVersionHistory
          versions={mockVersions}
          currentVersionId="v3"
          onRestoreVersion={mockOnRestoreVersion}
        />,
      );

      await user.click(screen.getByText("版本历史"));

      const restoreButtons = screen.getAllByRole("button", {
        name: "恢复版本",
      });
      await user.click(restoreButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("恢复版本")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "取消" }));

      expect(mockOnRestoreVersion).not.toHaveBeenCalled();
    });

    it("should not show restore button for current version", async () => {
      const user = userEvent.setup();
      render(
        <OutlineVersionHistory
          versions={mockVersions}
          currentVersionId="v3"
          onRestoreVersion={mockOnRestoreVersion}
        />,
      );

      await user.click(screen.getByText("版本历史"));

      // Should only have 2 restore buttons (for v1 and v2, not v3)
      const restoreButtons = screen.getAllByRole("button", {
        name: "恢复版本",
      });
      expect(restoreButtons.length).toBe(2);
    });
  });

  describe("Disabled State", () => {
    it("should disable button when disabled prop is true", () => {
      render(
        <OutlineVersionHistory
          versions={mockVersions}
          onRestoreVersion={mockOnRestoreVersion}
          disabled={true}
        />,
      );

      const button = screen.getByRole("button", { name: /版本历史/ });
      expect(button).toBeDisabled();
    });

    it("should disable restore buttons when disabled", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <OutlineVersionHistory
          versions={mockVersions}
          currentVersionId="v3"
          onRestoreVersion={mockOnRestoreVersion}
          disabled={false}
        />,
      );

      await user.click(screen.getByText("版本历史"));

      // Re-render with disabled
      rerender(
        <OutlineVersionHistory
          versions={mockVersions}
          currentVersionId="v3"
          onRestoreVersion={mockOnRestoreVersion}
          disabled={true}
        />,
      );

      const restoreButtons = screen.getAllByRole("button", {
        name: "恢复版本",
      });
      restoreButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });
});
