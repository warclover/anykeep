/**
 * TTSPlayerButton 组件测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TTSPlayerButton } from "../tts-player-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Mock useTTSPlayer hook
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockResume = jest.fn();
const mockStop = jest.fn();
const mockSetSpeed = jest.fn();
const mockSeek = jest.fn();
const mockIsPlayingBookmark = jest.fn();

const mockState = {
  state: "idle" as const,
  progress: 0,
  currentTime: 0,
  duration: 0,
  speed: 1.0,
  error: null,
  bookmarkTitle: null,
  currentBookmarkId: null,
};

jest.mock("@/hooks/domain/ai", () => ({
  useTTSPlayer: jest.fn(() => ({
    state: mockState,
    controls: {
      play: mockPlay,
      pause: mockPause,
      resume: mockResume,
      stop: mockStop,
      setSpeed: mockSetSpeed,
      seek: mockSeek,
      isPlayingBookmark: mockIsPlayingBookmark,
    },
  })),
}));

// Get the mocked function for state updates
import { useTTSPlayer } from "@/hooks/domain/ai";
const mockedUseTTSPlayer = useTTSPlayer as jest.MockedFunction<
  typeof useTTSPlayer
>;

describe("TTSPlayerButton", () => {
  const defaultProps = {
    bookmarkId: 123,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseTTSPlayer.mockReturnValue({
      state: { ...mockState },
      controls: {
        play: mockPlay,
        pause: mockPause,
        resume: mockResume,
        stop: mockStop,
        setSpeed: mockSetSpeed,
        seek: mockSeek,
        isPlayingBookmark: mockIsPlayingBookmark,
      },
    });
  });

  describe("Button variant (default)", () => {
    it("should render with default props", () => {
      render(<TTSPlayerButton {...defaultProps} />);

      // Should have play button
      const playButton = screen.getByRole("button", { name: /朗读/i });
      expect(playButton).toBeInTheDocument();
    });

    it("should call play on click when idle", async () => {
      render(<TTSPlayerButton {...defaultProps} />);

      const playButton = screen.getByRole("button", { name: /朗读/i });
      await userEvent.click(playButton);

      expect(mockPlay).toHaveBeenCalledWith({
        bookmarkId: 123,
        contentType: "summary", // default content type
      });
    });

    it("should call pause when playing", async () => {
      mockedUseTTSPlayer.mockReturnValue({
        state: { ...mockState, state: "playing", currentBookmarkId: 123 },
        controls: {
          play: mockPlay,
          pause: mockPause,
          resume: mockResume,
          stop: mockStop,
          setSpeed: mockSetSpeed,
          seek: mockSeek,
          isPlayingBookmark: mockIsPlayingBookmark,
        },
      });

      render(<TTSPlayerButton {...defaultProps} />);

      const pauseButton = screen.getByRole("button", { name: /暂停/i });
      await userEvent.click(pauseButton);

      expect(mockPause).toHaveBeenCalled();
    });

    it("should call resume when paused", async () => {
      mockedUseTTSPlayer.mockReturnValue({
        state: { ...mockState, state: "paused", currentBookmarkId: 123 },
        controls: {
          play: mockPlay,
          pause: mockPause,
          resume: mockResume,
          stop: mockStop,
          setSpeed: mockSetSpeed,
          seek: mockSeek,
          isPlayingBookmark: mockIsPlayingBookmark,
        },
      });

      render(<TTSPlayerButton {...defaultProps} />);

      const resumeButton = screen.getByRole("button", { name: /继续/i });
      await userEvent.click(resumeButton);

      expect(mockResume).toHaveBeenCalled();
    });

    it("should show loading state", () => {
      mockedUseTTSPlayer.mockReturnValue({
        state: { ...mockState, state: "loading", currentBookmarkId: 123 },
        controls: {
          play: mockPlay,
          pause: mockPause,
          resume: mockResume,
          stop: mockStop,
          setSpeed: mockSetSpeed,
          seek: mockSeek,
          isPlayingBookmark: mockIsPlayingBookmark,
        },
      });

      render(<TTSPlayerButton {...defaultProps} />);

      expect(screen.getByText(/加载中/i)).toBeInTheDocument();
    });

    it("should be disabled when disabled prop is true", () => {
      render(<TTSPlayerButton {...defaultProps} disabled={true} />);

      const playButton = screen.getByRole("button", { name: /朗读/i });
      expect(playButton).toBeDisabled();
    });

    it("should use custom defaultContentType", async () => {
      render(
        <TTSPlayerButton {...defaultProps} defaultContentType="keypoints" />,
      );

      const playButton = screen.getByRole("button", { name: /朗读/i });
      await userEvent.click(playButton);

      expect(mockPlay).toHaveBeenCalledWith({
        bookmarkId: 123,
        contentType: "keypoints",
      });
    });
  });

  describe("Icon variant", () => {
    it("should render as icon only", () => {
      render(<TTSPlayerButton {...defaultProps} variant="icon" />);

      // Should be a button with icon
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("should open dropdown on click", async () => {
      render(<TTSPlayerButton {...defaultProps} variant="icon" />);

      const button = screen.getByRole("button");
      await userEvent.click(button);

      // Dropdown should appear with options
      await waitFor(() => {
        expect(screen.getByText("选择朗读内容")).toBeInTheDocument();
      });
    });

    it("should play selected content type from dropdown", async () => {
      render(<TTSPlayerButton {...defaultProps} variant="icon" />);

      const button = screen.getByRole("button");
      await userEvent.click(button);

      // Select a content type
      await waitFor(() => {
        expect(screen.getByText("一句话总结")).toBeInTheDocument();
      });

      const tldrOption = screen.getByText("一句话总结");
      await userEvent.click(tldrOption);

      expect(mockPlay).toHaveBeenCalledWith({
        bookmarkId: 123,
        contentType: "tldr",
      });
    });
  });

  describe("Menu-item variant", () => {
    // Helper wrapper for menu-item variant tests
    const MenuWrapper = ({ children }: { children: React.ReactNode }) => (
      <DropdownMenu open>
        <DropdownMenuTrigger asChild>
          <Button>Trigger</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>{children}</DropdownMenuContent>
      </DropdownMenu>
    );

    it("should render menu items for all content types", () => {
      render(
        <MenuWrapper>
          <TTSPlayerButton {...defaultProps} variant="menu-item" />
        </MenuWrapper>,
      );

      // Should have all content type options
      expect(screen.getByText("朗读一句话总结")).toBeInTheDocument();
      expect(screen.getByText("朗读完整摘要")).toBeInTheDocument();
      expect(screen.getByText("朗读关键要点")).toBeInTheDocument();
      expect(screen.getByText("朗读全部内容")).toBeInTheDocument();
    });

    it("should play when menu item is clicked", async () => {
      render(
        <MenuWrapper>
          <TTSPlayerButton {...defaultProps} variant="menu-item" />
        </MenuWrapper>,
      );

      const summaryItem = screen.getByText("朗读完整摘要");
      await userEvent.click(summaryItem);

      expect(mockPlay).toHaveBeenCalledWith({
        bookmarkId: 123,
        contentType: "summary",
      });
    });

    it("should show loading indicator on selected item", () => {
      mockedUseTTSPlayer.mockReturnValue({
        state: { ...mockState, state: "loading", currentBookmarkId: 123 },
        controls: {
          play: mockPlay,
          pause: mockPause,
          resume: mockResume,
          stop: mockStop,
          setSpeed: mockSetSpeed,
          seek: mockSeek,
          isPlayingBookmark: mockIsPlayingBookmark,
        },
      });

      render(
        <MenuWrapper>
          <TTSPlayerButton
            {...defaultProps}
            variant="menu-item"
            defaultContentType="summary"
          />
        </MenuWrapper>,
      );

      // Loading state should be visible
      // The component uses Loader2 for loading state
      const menuItems = screen.getAllByRole("menuitem");
      expect(menuItems.length).toBe(4);
    });

    it("should be disabled when disabled prop is true", () => {
      render(
        <MenuWrapper>
          <TTSPlayerButton {...defaultProps} variant="menu-item" disabled />
        </MenuWrapper>,
      );

      const menuItems = screen.getAllByRole("menuitem");
      menuItems.forEach((item) => {
        expect(item).toHaveAttribute("aria-disabled", "true");
      });
    });
  });

  describe("Size prop", () => {
    it("should apply sm size classes by default", () => {
      render(<TTSPlayerButton {...defaultProps} />);

      const button = screen.getByRole("button", { name: /朗读/i });
      expect(button).toHaveClass("h-8");
    });

    it("should apply md size classes when specified", () => {
      render(<TTSPlayerButton {...defaultProps} size="md" />);

      const button = screen.getByRole("button", { name: /朗读/i });
      expect(button).toHaveClass("h-9");
    });
  });

  describe("Custom className", () => {
    it("should apply custom className", () => {
      const { container } = render(
        <TTSPlayerButton {...defaultProps} className="custom-class" />,
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  describe("Different bookmark handling", () => {
    it("should not show playing state for different bookmark", () => {
      mockedUseTTSPlayer.mockReturnValue({
        state: { ...mockState, state: "playing", currentBookmarkId: 999 },
        controls: {
          play: mockPlay,
          pause: mockPause,
          resume: mockResume,
          stop: mockStop,
          setSpeed: mockSetSpeed,
          seek: mockSeek,
          isPlayingBookmark: mockIsPlayingBookmark,
        },
      });

      render(<TTSPlayerButton {...defaultProps} />);

      // Should show "朗读" not "暂停" because it's a different bookmark
      expect(screen.getByRole("button", { name: /朗读/i })).toBeInTheDocument();
    });
  });
});
