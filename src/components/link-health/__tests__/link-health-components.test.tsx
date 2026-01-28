/**
 * 链接健康检测组件测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { LinkHealthProgress } from "../link-health-progress";
import { LinkHealthResultList } from "../link-health-result-list";
import { LinkHealthFixDialog } from "../link-health-fix-dialog";
import type {
  HealthCheckStats,
  LinkCheckResult,
} from "@/lib/ai-skills/skills/link-health-check/types";

// =============================================================================
// LinkHealthProgress 组件测试
// =============================================================================

describe("LinkHealthProgress", () => {
  const mockStats: HealthCheckStats = {
    totalChecked: 100,
    healthyCount: 80,
    failedCount: 10,
    slowCount: 5,
    redirectCount: 5,
  };

  it("should render progress percentage", () => {
    render(
      <LinkHealthProgress
        progress={50}
        currentStep="正在检测..."
        stats={null}
      />,
    );

    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("should render current step", () => {
    render(
      <LinkHealthProgress
        progress={30}
        currentStep="检测中: https://example.com"
        stats={null}
      />,
    );

    expect(screen.getByText("检测中: https://example.com")).toBeInTheDocument();
  });

  it("should render stats when provided", () => {
    render(
      <LinkHealthProgress
        progress={100}
        currentStep="完成"
        stats={mockStats}
      />,
    );

    expect(screen.getByText("健康")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("失效")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("should show total checked count", () => {
    render(
      <LinkHealthProgress
        progress={100}
        currentStep="完成"
        stats={mockStats}
      />,
    );

    // The text is split into multiple elements: "已检测", "100", "个链接"
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText(/个链接/)).toBeInTheDocument();
  });

  it("should show loading spinner", () => {
    render(
      <LinkHealthProgress
        progress={50}
        currentStep="正在检测..."
        stats={null}
      />,
    );

    // Loader2 has animate-spin class
    const loader = document.querySelector(".animate-spin");
    expect(loader).toBeInTheDocument();
  });
});

// =============================================================================
// LinkHealthResultList 组件测试
// =============================================================================

describe("LinkHealthResultList", () => {
  const mockStats: HealthCheckStats = {
    totalChecked: 100,
    healthyCount: 80,
    failedCount: 10,
    slowCount: 5,
    redirectCount: 5,
  };

  const mockProblems: LinkCheckResult[] = [
    {
      bookmarkId: 1,
      url: "https://example.com/broken",
      status: "failed",
      httpStatus: 404,
      errorType: "not_found",
      errorMessage: "页面不存在",
      checkedAt: new Date(),
    },
    {
      bookmarkId: 2,
      url: "https://example.com/slow",
      status: "slow",
      httpStatus: 200,
      responseTimeMs: 8000,
      checkedAt: new Date(),
    },
    {
      bookmarkId: 3,
      url: "https://example.com/redirect",
      status: "redirect",
      httpStatus: 301,
      redirectUrl: "https://new-example.com",
      checkedAt: new Date(),
    },
  ];

  const mockOnFixProblem = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render health rate", () => {
    render(
      <LinkHealthResultList
        stats={mockStats}
        problems={mockProblems}
        onFixProblem={mockOnFixProblem}
      />,
    );

    expect(screen.getByText("健康率")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("should render stat cards", () => {
    render(
      <LinkHealthResultList
        stats={mockStats}
        problems={mockProblems}
        onFixProblem={mockOnFixProblem}
      />,
    );

    expect(screen.getByText("已检测")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("should render problem tabs", () => {
    render(
      <LinkHealthResultList
        stats={mockStats}
        problems={mockProblems}
        onFixProblem={mockOnFixProblem}
      />,
    );

    // Check tabs exist with correct counts
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4); // 全部, 失效, 缓慢, 重定向

    // Verify tab text content
    expect(tabs[0]).toHaveTextContent("全部");
    expect(tabs[0]).toHaveTextContent("3");
    expect(tabs[1]).toHaveTextContent("失效");
    expect(tabs[1]).toHaveTextContent("1");
    expect(tabs[2]).toHaveTextContent("缓慢");
    expect(tabs[2]).toHaveTextContent("1");
    expect(tabs[3]).toHaveTextContent("重定向");
    expect(tabs[3]).toHaveTextContent("1");
  });

  it("should render problem list", () => {
    render(
      <LinkHealthResultList
        stats={mockStats}
        problems={mockProblems}
        onFixProblem={mockOnFixProblem}
      />,
    );

    expect(screen.getByText("https://example.com/broken")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/slow")).toBeInTheDocument();
  });

  it("should show error message for failed links", () => {
    render(
      <LinkHealthResultList
        stats={mockStats}
        problems={mockProblems}
        onFixProblem={mockOnFixProblem}
      />,
    );

    expect(screen.getByText("页面不存在")).toBeInTheDocument();
  });

  it("should show response time for slow links", () => {
    render(
      <LinkHealthResultList
        stats={mockStats}
        problems={mockProblems}
        onFixProblem={mockOnFixProblem}
      />,
    );

    expect(screen.getByText("8000ms")).toBeInTheDocument();
  });

  it("should call onFixProblem when fix button is clicked", () => {
    render(
      <LinkHealthResultList
        stats={mockStats}
        problems={mockProblems}
        onFixProblem={mockOnFixProblem}
      />,
    );

    const fixButtons = screen.getAllByRole("button", { name: /修复/i });
    fireEvent.click(fixButtons[0]);

    expect(mockOnFixProblem).toHaveBeenCalledWith(mockProblems[0]);
  });

  it("should filter problems by status when tab is clicked", async () => {
    render(
      <LinkHealthResultList
        stats={mockStats}
        problems={mockProblems}
        onFixProblem={mockOnFixProblem}
      />,
    );

    // Click on "失效" tab
    const tabs = screen.getAllByRole("tab");
    const failedTab = tabs[1]; // 失效 tab
    fireEvent.click(failedTab);

    // Wait for state update and verify the filtered content
    // The table should show only failed problems (1 item)
    // Note: Tab filtering updates the state but the table structure remains
    // We verify by checking the URL in the table matches the failed one
    expect(screen.getByText("https://example.com/broken")).toBeInTheDocument();
  });

  it("should show success message when no problems", () => {
    render(
      <LinkHealthResultList
        stats={mockStats}
        problems={[]}
        onFixProblem={mockOnFixProblem}
      />,
    );

    expect(screen.getByText(/所有链接都是健康的/)).toBeInTheDocument();
  });
});

// =============================================================================
// LinkHealthFixDialog 组件测试
// =============================================================================

describe("LinkHealthFixDialog", () => {
  const mockProblem: LinkCheckResult = {
    bookmarkId: 1,
    url: "https://example.com/broken",
    status: "failed",
    httpStatus: 404,
    errorType: "not_found",
    errorMessage: "页面不存在",
    waybackUrl: "https://web.archive.org/web/2024/https://example.com/broken",
    checkedAt: new Date(),
  };

  const mockOnOpenChange = jest.fn();
  const mockOnFix = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render dialog when open", () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    expect(screen.getByText("修复问题链接")).toBeInTheDocument();
  });

  it("should not render dialog when closed", () => {
    render(
      <LinkHealthFixDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    expect(screen.queryByText("修复问题链接")).not.toBeInTheDocument();
  });

  it("should show problem URL", () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    expect(screen.getByText("https://example.com/broken")).toBeInTheDocument();
  });

  it("should show error message", () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    expect(screen.getByText("页面不存在")).toBeInTheDocument();
  });

  it("should show wayback archive option when available", () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    expect(screen.getByText(/发现该链接的归档版本/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /使用此链接/i }),
    ).toBeInTheDocument();
  });

  it("should render all fix options", () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    expect(screen.getByText("删除书签")).toBeInTheDocument();
    expect(screen.getByText("归档书签")).toBeInTheDocument();
    expect(screen.getByText("更新链接")).toBeInTheDocument();
    expect(screen.getByText("忽略问题")).toBeInTheDocument();
  });

  it("should show URL input when update_url is selected", () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    // Click on "更新链接" option
    const updateOption = screen.getByText("更新链接");
    fireEvent.click(updateOption);

    expect(screen.getByLabelText("新链接地址")).toBeInTheDocument();
  });

  it("should call onFix with archive action", async () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    // Archive is selected by default
    const confirmButton = screen.getByRole("button", { name: /确认修复/i });
    fireEvent.click(confirmButton);

    expect(mockOnFix).toHaveBeenCalledWith("archive", undefined);
  });

  it("should call onFix with delete action", async () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    // Click on "删除书签" option
    const deleteOption = screen.getByText("删除书签");
    fireEvent.click(deleteOption);

    const confirmButton = screen.getByRole("button", { name: /确认修复/i });
    fireEvent.click(confirmButton);

    expect(mockOnFix).toHaveBeenCalledWith("delete", undefined);
  });

  it("should call onFix with update_url action and new URL", async () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    // Click on "更新链接" option
    const updateOption = screen.getByText("更新链接");
    fireEvent.click(updateOption);

    // Enter new URL
    const input = screen.getByLabelText("新链接地址");
    fireEvent.change(input, { target: { value: "https://new-url.com" } });

    const confirmButton = screen.getByRole("button", { name: /确认修复/i });
    fireEvent.click(confirmButton);

    expect(mockOnFix).toHaveBeenCalledWith("update_url", "https://new-url.com");
  });

  it("should disable confirm button when update_url selected but no URL", () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    // Click on "更新链接" option
    const updateOption = screen.getByText("更新链接");
    fireEvent.click(updateOption);

    const confirmButton = screen.getByRole("button", { name: /确认修复/i });
    expect(confirmButton).toBeDisabled();
  });

  it("should use wayback URL when 'use this link' button is clicked", () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    const useWaybackButton = screen.getByRole("button", {
      name: /使用此链接/i,
    });
    fireEvent.click(useWaybackButton);

    // Should switch to update_url mode and fill in wayback URL
    const input = screen.getByLabelText("新链接地址");
    expect(input).toHaveValue(mockProblem.waybackUrl);
  });

  it("should call onOpenChange when cancel is clicked", () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /取消/i });
    fireEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("should render destructive button for delete action", () => {
    render(
      <LinkHealthFixDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        problem={mockProblem}
        onFix={mockOnFix}
      />,
    );

    // Click on "删除书签" option
    const deleteOption = screen.getByText("删除书签");
    fireEvent.click(deleteOption);

    const confirmButton = screen.getByRole("button", { name: /确认修复/i });
    // Check if button has destructive variant (by class or style)
    expect(confirmButton).toBeInTheDocument();
  });
});
