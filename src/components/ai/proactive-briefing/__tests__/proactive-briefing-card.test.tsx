/**
 * 主动简报卡片组件测试
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ProactiveBriefingCard,
  CompactBriefingCard,
} from "../proactive-briefing-card";
import { InsightItem } from "../insight-item";
import { ActionButton, ActionButtonGroup } from "../action-button";
import {
  BriefingSkeleton,
  CompactBriefingSkeleton,
} from "../briefing-skeleton";
import type {
  ProactiveBriefing,
  ProactiveInsight,
  SuggestedAction,
} from "@/lib/ai-agent/proactive-briefing";

// ============================================
// Mock 数据
// ============================================

const mockInsight: ProactiveInsight = {
  id: "insight-1",
  type: "topic_emergence",
  title: "发现新主题：AI 架构设计",
  summary: "您最近收藏了多篇关于 AI 架构设计的文章，建议整理为专题",
  relatedBookmarkIds: [1, 2, 3],
  priority: 8,
  createdAt: new Date().toISOString(),
  isRead: false,
};

const mockReadInsight: ProactiveInsight = {
  ...mockInsight,
  id: "insight-2",
  isRead: true,
};

const mockAction: SuggestedAction = {
  id: "action-1",
  type: "organize_topic",
  label: "整理主题",
  description: "将相关文章整理为专题",
  affectedCount: 3,
  executeParams: { skillId: "batch_organize" },
};

const mockBriefing: ProactiveBriefing = {
  enabled: true,
  lastVisit: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  daysSinceLastVisit: 3,
  newCollectionsCount: 5,
  topicChangeSummary: "在您离开的 3 天里，我注意到您收藏了一些 AI 相关的文章。",
  pendingInsights: [mockInsight, mockReadInsight],
  suggestedActions: [mockAction],
  generatedAt: new Date().toISOString(),
};

const emptyBriefing: ProactiveBriefing = {
  enabled: true,
  lastVisit: new Date().toISOString(),
  daysSinceLastVisit: 0,
  newCollectionsCount: 0,
  pendingInsights: [],
  suggestedActions: [],
  generatedAt: new Date().toISOString(),
};

// ============================================
// ProactiveBriefingCard 测试
// ============================================

describe("ProactiveBriefingCard", () => {
  it("should render loading skeleton when loading", () => {
    render(<ProactiveBriefingCard briefing={null} loading={true} />);
    expect(screen.getByTestId("briefing-skeleton")).toBeInTheDocument();
  });

  it("should not render when briefing is null", () => {
    const { container } = render(
      <ProactiveBriefingCard briefing={null} loading={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("should not render when briefing is disabled", () => {
    const disabledBriefing = { ...mockBriefing, enabled: false };
    const { container } = render(
      <ProactiveBriefingCard briefing={disabledBriefing} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("should not render when briefing has no content", () => {
    const { container } = render(
      <ProactiveBriefingCard briefing={emptyBriefing} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("should render briefing card with correct content", () => {
    render(<ProactiveBriefingCard briefing={mockBriefing} />);

    expect(screen.getByTestId("proactive-briefing-card")).toBeInTheDocument();
    expect(screen.getByText("秘书汇报")).toBeInTheDocument();
    expect(screen.getByText("3 天未见")).toBeInTheDocument();
    expect(screen.getByText(/AI 相关的文章/)).toBeInTheDocument();
  });

  it("should display unread count badge", () => {
    render(<ProactiveBriefingCard briefing={mockBriefing} />);
    expect(screen.getByText("1 条新洞察")).toBeInTheDocument();
  });

  it("should display new collections count", async () => {
    render(<ProactiveBriefingCard briefing={mockBriefing} />);
    // 等待动画完成后检查内容（framer-motion 动画会导致初始隐藏）
    await waitFor(
      () => {
        // 使用自定义匹配器处理文本被多个元素分割的情况
        expect(
          screen.getByText((content, element) => {
            return (
              element?.tagName === "P" &&
              content.includes("离线期间新增") === true
            );
          }),
        ).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
    // 检查数字 5 也存在
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("should render insights", () => {
    render(<ProactiveBriefingCard briefing={mockBriefing} />);
    const insightItems = screen.getAllByTestId("insight-item");
    expect(insightItems).toHaveLength(2);
  });

  it("should render action buttons", () => {
    render(<ProactiveBriefingCard briefing={mockBriefing} />);
    expect(screen.getByTestId("action-button")).toBeInTheDocument();
    expect(screen.getByText("整理主题")).toBeInTheDocument();
  });

  it("should call onDismiss when dismiss button is clicked", async () => {
    const onDismiss = jest.fn();
    render(
      <ProactiveBriefingCard briefing={mockBriefing} onDismiss={onDismiss} />,
    );

    await userEvent.click(screen.getByText("稍后再看"));

    await waitFor(
      () => {
        expect(onDismiss).toHaveBeenCalled();
      },
      { timeout: 500 },
    );
  });

  it("should call onInsightClick when insight is clicked", async () => {
    const onInsightClick = jest.fn();
    render(
      <ProactiveBriefingCard
        briefing={mockBriefing}
        onInsightClick={onInsightClick}
      />,
    );

    // 获取第一个 insight item（未读的那个）
    const insightItems = screen.getAllByTestId("insight-item");
    await userEvent.click(insightItems[0]);

    expect(onInsightClick).toHaveBeenCalledWith(mockInsight);
  });

  it("should call onActionClick when action button is clicked", async () => {
    const onActionClick = jest.fn();
    render(
      <ProactiveBriefingCard
        briefing={mockBriefing}
        onActionClick={onActionClick}
      />,
    );

    await userEvent.click(screen.getByText("整理主题"));

    expect(onActionClick).toHaveBeenCalledWith(mockAction);
  });

  it("should toggle expand/collapse", async () => {
    render(<ProactiveBriefingCard briefing={mockBriefing} />);

    // 初始展开，内容应该存在于 DOM 中
    expect(screen.getByText(/AI 相关的文章/)).toBeInTheDocument();

    // 点击收起按钮
    const collapseButton = screen.getByLabelText("收起");
    await userEvent.click(collapseButton);

    // 按钮应该变为"展开"
    await waitFor(
      () => {
        expect(screen.getByLabelText("展开")).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });
});

// ============================================
// CompactBriefingCard 测试
// ============================================

describe("CompactBriefingCard", () => {
  it("should not render when briefing is null", () => {
    const { container } = render(<CompactBriefingCard briefing={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should render compact card", () => {
    render(<CompactBriefingCard briefing={mockBriefing} />);
    expect(screen.getByText("秘书有新汇报")).toBeInTheDocument();
  });

  it("should call onClick when clicked", async () => {
    const onClick = jest.fn();
    render(<CompactBriefingCard briefing={mockBriefing} onClick={onClick} />);

    await userEvent.click(screen.getByText("秘书有新汇报"));

    expect(onClick).toHaveBeenCalled();
  });
});

// ============================================
// InsightItem 测试
// ============================================

describe("InsightItem", () => {
  it("should render insight with correct type icon and label", () => {
    render(<InsightItem insight={mockInsight} />);

    expect(screen.getByText("新主题发现")).toBeInTheDocument();
    expect(screen.getByText("发现新主题：AI 架构设计")).toBeInTheDocument();
  });

  it("should show related bookmark count", () => {
    render(<InsightItem insight={mockInsight} />);
    expect(screen.getByText("关联 3 条收藏")).toBeInTheDocument();
  });

  it("should show read indicator when isRead is true", () => {
    render(<InsightItem insight={mockReadInsight} />);
    const item = screen.getByTestId("insight-item");
    expect(item).toHaveClass("opacity-70");
  });

  it("should call onClick when clicked", async () => {
    const onClick = jest.fn();
    render(<InsightItem insight={mockInsight} onClick={onClick} />);

    await userEvent.click(screen.getByTestId("insight-item"));

    expect(onClick).toHaveBeenCalledWith(mockInsight);
  });

  it("should handle keyboard navigation", async () => {
    const onClick = jest.fn();
    render(<InsightItem insight={mockInsight} onClick={onClick} />);

    const item = screen.getByTestId("insight-item");
    item.focus();
    fireEvent.keyDown(item, { key: "Enter" });

    expect(onClick).toHaveBeenCalled();
  });
});

// ============================================
// ActionButton 测试
// ============================================

describe("ActionButton", () => {
  it("should render action button with label", () => {
    render(<ActionButton action={mockAction} />);
    expect(screen.getByText("整理主题")).toBeInTheDocument();
  });

  it("should display affected count", () => {
    render(<ActionButton action={mockAction} />);
    expect(screen.getByText("(3)")).toBeInTheDocument();
  });

  it("should show loading spinner when loading", () => {
    render(<ActionButton action={mockAction} loading={true} />);
    expect(screen.getByTestId("action-button")).toBeDisabled();
  });

  it("should call onClick when clicked", async () => {
    const onClick = jest.fn();
    render(<ActionButton action={mockAction} onClick={onClick} />);

    await userEvent.click(screen.getByTestId("action-button"));

    expect(onClick).toHaveBeenCalledWith(mockAction);
  });

  it("should be disabled when disabled prop is true", () => {
    render(<ActionButton action={mockAction} disabled={true} />);
    expect(screen.getByTestId("action-button")).toBeDisabled();
  });
});

// ============================================
// ActionButtonGroup 测试
// ============================================

describe("ActionButtonGroup", () => {
  it("should render multiple actions", () => {
    const actions: SuggestedAction[] = [
      mockAction,
      { ...mockAction, id: "action-2", label: "其他操作" },
    ];

    render(<ActionButtonGroup actions={actions} />);

    expect(screen.getByText("整理主题")).toBeInTheDocument();
    expect(screen.getByText("其他操作")).toBeInTheDocument();
  });

  it("should not render when actions is empty", () => {
    const { container } = render(<ActionButtonGroup actions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should disable other buttons when one is executing", () => {
    const actions: SuggestedAction[] = [
      mockAction,
      { ...mockAction, id: "action-2", label: "其他操作" },
    ];

    render(
      <ActionButtonGroup actions={actions} executingActionId="action-1" />,
    );

    const buttons = screen.getAllByTestId("action-button");
    expect(buttons[0]).toBeDisabled(); // loading
    expect(buttons[1]).toBeDisabled(); // disabled
  });
});

// ============================================
// BriefingSkeleton 测试
// ============================================

describe("BriefingSkeleton", () => {
  it("should render skeleton", () => {
    render(<BriefingSkeleton />);
    expect(screen.getByTestId("briefing-skeleton")).toBeInTheDocument();
  });

  it("should render correct number of insight skeletons", () => {
    const { container } = render(<BriefingSkeleton insightCount={5} />);
    const insightSkeletons = container.querySelectorAll(
      ".flex.items-start.gap-3",
    );
    expect(insightSkeletons).toHaveLength(5);
  });
});

// ============================================
// CompactBriefingSkeleton 测试
// ============================================

describe("CompactBriefingSkeleton", () => {
  it("should render compact skeleton", () => {
    const { container } = render(<CompactBriefingSkeleton />);
    expect(container.firstChild).toHaveClass("rounded-lg");
  });
});
