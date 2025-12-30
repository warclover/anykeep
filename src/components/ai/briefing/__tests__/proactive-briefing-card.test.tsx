/**
 * ProactiveBriefingCard Component Tests
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { ProactiveBriefingCard } from "../proactive-briefing-card";
import type {
  ProactiveBriefing,
  ProactiveInsight,
  SuggestedAction,
} from "@/lib/ai-agent/proactive-briefing";
import type {
  UseBriefingState,
  UseBriefingActions,
} from "@/hooks/domain/ai/use-briefing";

// =============================================================================
// Mocks
// =============================================================================

// Mock useBriefing hook
const mockRefresh = jest.fn();
const mockMarkRead = jest.fn();
const mockMarkAllRead = jest.fn();
const mockDismiss = jest.fn();

let mockState: UseBriefingState = {
  loadState: "idle",
  briefing: null,
  unreadCount: 0,
  error: null,
  isRefreshing: false,
};

const mockActions: UseBriefingActions = {
  refresh: mockRefresh,
  markRead: mockMarkRead,
  markAllRead: mockMarkAllRead,
  dismiss: mockDismiss,
};

jest.mock("@/hooks/domain/ai", () => ({
  useBriefing: () => ({
    state: mockState,
    actions: mockActions,
  }),
}));

// =============================================================================
// Test Helpers
// =============================================================================

function createMockInsight(
  overrides: Partial<ProactiveInsight> = {},
): ProactiveInsight {
  return {
    id: "insight-1",
    type: "topic_emergence",
    title: "新主题发现",
    summary: "测试摘要内容",
    relatedBookmarkIds: [1, 2, 3],
    priority: 8,
    createdAt: "2025-12-30T00:00:00Z",
    isRead: false,
    ...overrides,
  };
}

function createMockAction(
  overrides: Partial<SuggestedAction> = {},
): SuggestedAction {
  return {
    id: "action-1",
    type: "tag_untagged",
    label: "整理无标签书签",
    description: "有 15 条书签需要添加标签",
    affectedCount: 15,
    ...overrides,
  };
}

function createMockBriefing(
  overrides: Partial<ProactiveBriefing> = {},
): ProactiveBriefing {
  return {
    enabled: true,
    lastVisit: "2025-12-27T00:00:00Z",
    daysSinceLastVisit: 3,
    newCollectionsCount: 5,
    topicChangeSummary: "离线 3 天期间，新增了 5 条收藏",
    pendingInsights: [createMockInsight()],
    suggestedActions: [createMockAction()],
    generatedAt: "2025-12-30T00:00:00Z",
    ...overrides,
  };
}

function resetMockState() {
  mockState = {
    loadState: "idle",
    briefing: null,
    unreadCount: 0,
    error: null,
    isRefreshing: false,
  };
  jest.clearAllMocks();
}

// =============================================================================
// Tests
// =============================================================================

describe("ProactiveBriefingCard", () => {
  beforeEach(() => {
    resetMockState();
  });

  // ===========================================================================
  // Rendering Tests
  // ===========================================================================

  describe("rendering states", () => {
    it("should render skeleton when loading", () => {
      mockState.loadState = "loading";

      render(<ProactiveBriefingCard />);

      // BriefingSkeleton should be rendered
      // Check for skeleton structure (animated pulse)
      const container = document.querySelector("[class*='animate-pulse']");
      expect(container).toBeInTheDocument();
    });

    it("should render nothing when briefing is null", () => {
      mockState.loadState = "success";
      mockState.briefing = null;

      const { container } = render(<ProactiveBriefingCard />);

      expect(container).toBeEmptyDOMElement();
    });

    it("should render nothing when briefing has no content", () => {
      mockState.loadState = "success";
      mockState.briefing = createMockBriefing({
        topicChangeSummary: undefined,
        pendingInsights: [],
        suggestedActions: [],
      });

      const { container } = render(<ProactiveBriefingCard />);

      expect(container).toBeEmptyDOMElement();
    });

    it("should render briefing card when data is available", () => {
      mockState.loadState = "success";
      mockState.briefing = createMockBriefing();

      render(<ProactiveBriefingCard />);

      expect(screen.getByText("欢迎回来！")).toBeInTheDocument();
      expect(screen.getByText(/你离开了 3 天/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Header Tests
  // ===========================================================================

  describe("header", () => {
    beforeEach(() => {
      mockState.loadState = "success";
      mockState.briefing = createMockBriefing();
    });

    it("should display days since last visit", () => {
      render(<ProactiveBriefingCard />);

      expect(screen.getByText(/你离开了 3 天/)).toBeInTheDocument();
    });

    it("should show mark all read button when unread count > 0", () => {
      mockState.unreadCount = 5;

      render(<ProactiveBriefingCard />);

      expect(screen.getByText("全部已读")).toBeInTheDocument();
    });

    it("should not show mark all read button when unread count is 0", () => {
      mockState.unreadCount = 0;

      render(<ProactiveBriefingCard />);

      expect(screen.queryByText("全部已读")).not.toBeInTheDocument();
    });

    it("should call markAllRead when button is clicked", () => {
      mockState.unreadCount = 5;

      render(<ProactiveBriefingCard />);

      const markAllButton = screen.getByText("全部已读");
      fireEvent.click(markAllButton);

      expect(mockMarkAllRead).toHaveBeenCalled();
    });

    it("should call refresh when refresh button is clicked", () => {
      render(<ProactiveBriefingCard />);

      // The refresh button is an icon button (size-8) at the end of the header
      const buttons = screen.getAllByRole("button");
      // Filter to find icon buttons (they have size-8 class)
      const iconButtons = buttons.filter((btn) =>
        btn.classList.contains("size-8"),
      );
      // The refresh button should be the last icon button
      const refreshButton = iconButtons[iconButtons.length - 1];
      expect(refreshButton).toBeInTheDocument();
      fireEvent.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalled();
    });

    it("should disable refresh button when refreshing", () => {
      mockState.isRefreshing = true;

      render(<ProactiveBriefingCard />);

      // Find the icon button with size-8 class that's disabled
      const buttons = screen.getAllByRole("button");
      const iconButtons = buttons.filter((btn) =>
        btn.classList.contains("size-8"),
      );
      const refreshButton = iconButtons[iconButtons.length - 1];
      expect(refreshButton).toBeDisabled();
    });
  });

  // ===========================================================================
  // Change Summary Tests
  // ===========================================================================

  describe("change summary", () => {
    beforeEach(() => {
      mockState.loadState = "success";
    });

    it("should display topic change summary when available", () => {
      mockState.briefing = createMockBriefing({
        topicChangeSummary: "离线 3 天期间，新增了 5 条收藏",
      });

      render(<ProactiveBriefingCard />);

      expect(
        screen.getByText("离线 3 天期间，新增了 5 条收藏"),
      ).toBeInTheDocument();
    });

    it("should display fallback summary when no topic summary", () => {
      mockState.briefing = createMockBriefing({
        topicChangeSummary: undefined,
        newCollectionsCount: 10,
        daysSinceLastVisit: 5,
      });

      render(<ProactiveBriefingCard />);

      // Fallback shows "在你离开的 X 天里，新增了 Y 条收藏"
      expect(screen.getByText(/在你离开的 5 天里/)).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
    });

    it("should not display summary section when no new collections", () => {
      mockState.briefing = createMockBriefing({
        topicChangeSummary: undefined,
        newCollectionsCount: 0,
        pendingInsights: [createMockInsight()], // Need at least one insight to render
      });

      render(<ProactiveBriefingCard />);

      // The summary section should not be there
      expect(screen.queryByText(/在你离开的.*天里/)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Insights Tests
  // ===========================================================================

  describe("insights", () => {
    beforeEach(() => {
      mockState.loadState = "success";
    });

    it("should display insight list with count", () => {
      mockState.briefing = createMockBriefing({
        pendingInsights: [
          createMockInsight({ id: "insight-1" }),
          createMockInsight({ id: "insight-2", title: "第二条洞察" }),
        ],
      });

      render(<ProactiveBriefingCard />);

      expect(screen.getByText("洞察 (2)")).toBeInTheDocument();
    });

    it("should display insight title and summary", () => {
      mockState.briefing = createMockBriefing({
        pendingInsights: [
          createMockInsight({
            title: "AI 主题涌现",
            summary: "发现新的 AI 相关收藏模式",
          }),
        ],
      });

      render(<ProactiveBriefingCard />);

      expect(screen.getByText("AI 主题涌现")).toBeInTheDocument();
      expect(screen.getByText("发现新的 AI 相关收藏模式")).toBeInTheDocument();
    });

    it("should show unread indicator for unread insights", () => {
      mockState.briefing = createMockBriefing({
        pendingInsights: [createMockInsight({ isRead: false })],
      });

      render(<ProactiveBriefingCard />);

      // Unread insight has ring-2 ring-purple-200 class
      const insightCard = document.querySelector("[class*='ring-purple-200']");
      expect(insightCard).toBeInTheDocument();
    });

    it("should call markRead when mark read button is clicked", async () => {
      mockState.briefing = createMockBriefing({
        pendingInsights: [
          createMockInsight({ id: "insight-123", isRead: false }),
        ],
      });

      render(<ProactiveBriefingCard />);

      // Hover to show buttons (simulate by finding the button)
      const markReadButton = screen.getByText("标记已读");
      fireEvent.click(markReadButton);

      expect(mockMarkRead).toHaveBeenCalledWith("insight-123");
    });

    it("should call dismiss when dismiss button is clicked", () => {
      mockState.briefing = createMockBriefing({
        pendingInsights: [createMockInsight({ id: "insight-456" })],
      });

      render(<ProactiveBriefingCard />);

      // Find all buttons within insight cards
      // The dismiss button is the h-6 button with just an icon (no text)
      const allButtons = screen.getAllByRole("button");
      // Filter to find small buttons (h-6) that don't have much text content
      const smallButtons = allButtons.filter(
        (btn) =>
          btn.classList.contains("h-6") &&
          btn.textContent?.trim() !== "标记已读",
      );
      expect(smallButtons.length).toBeGreaterThan(0);
      fireEvent.click(smallButtons[0]);

      expect(mockDismiss).toHaveBeenCalledWith("insight-456");
    });

    it("should not show mark read button for already read insights", () => {
      mockState.briefing = createMockBriefing({
        pendingInsights: [createMockInsight({ isRead: true })],
      });

      render(<ProactiveBriefingCard />);

      // Inside the insight card group, there should be no "标记已读" text
      // But there should still be a dismiss button
      expect(screen.queryByText("标记已读")).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Suggested Actions Tests
  // ===========================================================================

  describe("suggested actions", () => {
    beforeEach(() => {
      mockState.loadState = "success";
    });

    it("should display suggested actions section", () => {
      mockState.briefing = createMockBriefing({
        suggestedActions: [createMockAction()],
      });

      render(<ProactiveBriefingCard />);

      expect(screen.getByText("建议操作")).toBeInTheDocument();
    });

    it("should display action label and description", () => {
      mockState.briefing = createMockBriefing({
        suggestedActions: [
          createMockAction({
            label: "清理重复书签",
            description: "发现 5 组重复内容",
          }),
        ],
      });

      render(<ProactiveBriefingCard />);

      expect(screen.getByText("清理重复书签")).toBeInTheDocument();
      expect(screen.getByText("发现 5 组重复内容")).toBeInTheDocument();
    });

    it("should call onActionClick when action is clicked", () => {
      const mockOnActionClick = jest.fn();
      const action = createMockAction({
        id: "action-test",
        type: "organize_topic",
      });
      mockState.briefing = createMockBriefing({
        suggestedActions: [action],
      });

      render(<ProactiveBriefingCard onActionClick={mockOnActionClick} />);

      // Find the action button
      const actionButton = screen.getByText(action.label).closest("button");
      expect(actionButton).toBeInTheDocument();
      if (actionButton) {
        fireEvent.click(actionButton);
      }

      expect(mockOnActionClick).toHaveBeenCalledWith(action);
    });

    it("should not throw when action clicked without onActionClick handler", () => {
      const action = createMockAction();
      mockState.briefing = createMockBriefing({
        suggestedActions: [action],
      });

      render(<ProactiveBriefingCard />);

      const actionButton = screen.getByText(action.label).closest("button");
      expect(actionButton).toBeInTheDocument();

      // Should not throw
      expect(() => {
        if (actionButton) {
          fireEvent.click(actionButton);
        }
      }).not.toThrow();
    });
  });

  // ===========================================================================
  // Insight Type Styling Tests
  // ===========================================================================

  describe("insight type styling", () => {
    beforeEach(() => {
      mockState.loadState = "success";
    });

    it.each([
      ["topic_emergence", "bg-purple-50"],
      ["pattern_detected", "bg-blue-50"],
      ["recommendation", "bg-yellow-50"],
      ["knowledge_gap", "bg-orange-50"],
      ["content_update", "bg-green-50"],
      ["link_health", "bg-red-50"],
    ])(
      "should apply correct color for %s insight type",
      (type, expectedClass) => {
        mockState.briefing = createMockBriefing({
          pendingInsights: [
            createMockInsight({
              type: type as ProactiveInsight["type"],
              title: `${type} 测试`,
            }),
          ],
        });

        render(<ProactiveBriefingCard />);

        const insightCard = screen
          .getByText(`${type} 测试`)
          .closest("[class*='rounded-lg border']");
        expect(insightCard).toHaveClass(expectedClass);
      },
    );
  });

  // ===========================================================================
  // Custom className Tests
  // ===========================================================================

  describe("custom className", () => {
    it("should apply custom className to container", () => {
      mockState.loadState = "success";
      mockState.briefing = createMockBriefing();

      render(<ProactiveBriefingCard className="custom-class" />);

      const container = document.querySelector(".custom-class");
      expect(container).toBeInTheDocument();
    });
  });
});
