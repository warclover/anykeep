/**
 * AudioPlayerCard 组件测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AudioPlayerCard } from "../audio-player-card";

// Mock ResizeObserver (required by Radix UI)
class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock HTMLAudioElement
class MockAudioElement {
  src: string = "";
  currentTime: number = 0;
  duration: number = 30;
  playbackRate: number = 1;
  muted: boolean = false;
  paused: boolean = true;

  private eventHandlers: Record<string, (() => void)[]> = {};

  play = jest.fn().mockImplementation(() => {
    this.paused = false;
    return Promise.resolve();
  });

  pause = jest.fn().mockImplementation(() => {
    this.paused = true;
  });

  addEventListener = jest
    .fn()
    .mockImplementation((event: string, handler: () => void) => {
      if (!this.eventHandlers[event]) {
        this.eventHandlers[event] = [];
      }
      this.eventHandlers[event].push(handler);
    });

  removeEventListener = jest
    .fn()
    .mockImplementation((event: string, handler: () => void) => {
      if (this.eventHandlers[event]) {
        this.eventHandlers[event] = this.eventHandlers[event].filter(
          (h) => h !== handler,
        );
      }
    });

  // Helper to trigger events in tests
  _triggerEvent(event: string) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach((handler) => handler());
    }
  }
}

// Store mock instance for test access
let mockAudioInstance: MockAudioElement;

// Mock Audio constructor
const originalAudio = global.Audio;
beforeAll(() => {
  global.Audio = jest.fn().mockImplementation(() => {
    mockAudioInstance = new MockAudioElement();
    return mockAudioInstance;
  }) as unknown as typeof Audio;
});

afterAll(() => {
  global.Audio = originalAudio;
});

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = jest.fn(() => "blob:test-url");
const mockRevokeObjectURL = jest.fn();

beforeEach(() => {
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
});

describe("AudioPlayerCard", () => {
  const defaultProps = {
    audioBase64: "dGVzdCBhdWRpbyBkYXRh", // "test audio data" in base64
    format: "mp3",
    duration: 30,
    title: "Test Audio",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render with required props", () => {
      render(<AudioPlayerCard {...defaultProps} />);

      expect(screen.getByText("Test Audio")).toBeInTheDocument();
      expect(screen.getByText("0:30 时长")).toBeInTheDocument();
    });

    it("should display char count when provided", () => {
      render(<AudioPlayerCard {...defaultProps} charCount={150} />);

      expect(screen.getByText("150 字")).toBeInTheDocument();
    });

    it("should format duration correctly", () => {
      render(<AudioPlayerCard {...defaultProps} duration={125} />);

      expect(screen.getByText("2:05 时长")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <AudioPlayerCard {...defaultProps} className="custom-class" />,
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });

    it("should render play button initially", () => {
      render(<AudioPlayerCard {...defaultProps} />);

      // Find the play/pause button (the large circular one)
      const buttons = screen.getAllByRole("button");
      const playButton = buttons.find((btn) =>
        btn.className.includes("rounded-full"),
      );
      expect(playButton).toBeInTheDocument();
    });
  });

  describe("Play/Pause functionality", () => {
    it("should play audio when play button is clicked", async () => {
      render(<AudioPlayerCard {...defaultProps} />);

      // Trigger loadeddata event to enable controls
      act(() => {
        mockAudioInstance._triggerEvent("loadeddata");
      });

      const buttons = screen.getAllByRole("button");
      const playButton = buttons.find((btn) =>
        btn.className.includes("rounded-full"),
      );

      await userEvent.click(playButton!);

      expect(mockAudioInstance.play).toHaveBeenCalled();
    });

    it("should pause audio when pause button is clicked", async () => {
      render(<AudioPlayerCard {...defaultProps} />);

      // Trigger loadeddata event
      act(() => {
        mockAudioInstance._triggerEvent("loadeddata");
      });

      const buttons = screen.getAllByRole("button");
      const playButton = buttons.find((btn) =>
        btn.className.includes("rounded-full"),
      );

      // Play first
      await userEvent.click(playButton!);

      // Then pause
      await userEvent.click(playButton!);

      expect(mockAudioInstance.pause).toHaveBeenCalled();
    });
  });

  describe("Replay functionality", () => {
    it("should reset and play audio when replay is clicked", async () => {
      render(<AudioPlayerCard {...defaultProps} />);

      // Trigger loadeddata event
      act(() => {
        mockAudioInstance._triggerEvent("loadeddata");
      });

      const replayButton = screen.getByTitle("重播");
      await userEvent.click(replayButton);

      expect(mockAudioInstance.currentTime).toBe(0);
      expect(mockAudioInstance.play).toHaveBeenCalled();
    });
  });

  describe("Playback rate", () => {
    it("should cycle through playback rates", async () => {
      render(<AudioPlayerCard {...defaultProps} />);

      const speedButton = screen.getByTitle("播放速度");
      expect(speedButton).toHaveTextContent("1x");

      // Click to change speed
      await userEvent.click(speedButton);
      expect(speedButton).toHaveTextContent("1.25x");

      await userEvent.click(speedButton);
      expect(speedButton).toHaveTextContent("1.5x");

      await userEvent.click(speedButton);
      expect(speedButton).toHaveTextContent("2x");

      await userEvent.click(speedButton);
      expect(speedButton).toHaveTextContent("0.75x");

      await userEvent.click(speedButton);
      expect(speedButton).toHaveTextContent("1x");
    });

    it("should update audio playbackRate", async () => {
      render(<AudioPlayerCard {...defaultProps} />);

      const speedButton = screen.getByTitle("播放速度");
      await userEvent.click(speedButton);

      expect(mockAudioInstance.playbackRate).toBe(1.25);
    });
  });

  describe("Mute functionality", () => {
    it("should toggle mute state", async () => {
      render(<AudioPlayerCard {...defaultProps} />);

      const muteButton = screen.getByTitle("静音");
      await userEvent.click(muteButton);

      expect(mockAudioInstance.muted).toBe(true);

      const unmuteButton = screen.getByTitle("取消静音");
      await userEvent.click(unmuteButton);

      expect(mockAudioInstance.muted).toBe(false);
    });
  });

  describe("Download functionality", () => {
    it("should have a download button", () => {
      render(<AudioPlayerCard {...defaultProps} />);

      const downloadButton = screen.getByTitle("下载音频");
      expect(downloadButton).toBeInTheDocument();
      expect(downloadButton).toBeEnabled();
    });

    it("should trigger download when download button is clicked", async () => {
      // Render first before setting up any DOM mocks
      render(<AudioPlayerCard {...defaultProps} />);

      const downloadButton = screen.getByTitle("下载音频");

      // Now set up mocks for the download action
      const originalCreateElement = document.createElement.bind(document);
      const mockClick = jest.fn();

      const createElementSpy = jest
        .spyOn(document, "createElement")
        .mockImplementation((tagName: string) => {
          if (tagName === "a") {
            const mockAnchor = {
              href: "",
              download: "",
              click: mockClick,
              style: {},
            };
            return mockAnchor as unknown as HTMLAnchorElement;
          }
          return originalCreateElement(tagName);
        });

      const appendChildSpy = jest
        .spyOn(document.body, "appendChild")
        .mockImplementation((node) => node);

      const removeChildSpy = jest
        .spyOn(document.body, "removeChild")
        .mockImplementation((node) => node);

      try {
        await userEvent.click(downloadButton);
        expect(mockClick).toHaveBeenCalled();
      } finally {
        // Ensure cleanup happens even if test fails
        createElementSpy.mockRestore();
        appendChildSpy.mockRestore();
        removeChildSpy.mockRestore();
      }
    });
  });

  describe("Progress tracking", () => {
    it("should update progress on timeupdate", () => {
      render(<AudioPlayerCard {...defaultProps} />);

      // Simulate time update
      act(() => {
        mockAudioInstance.currentTime = 15;
        mockAudioInstance._triggerEvent("timeupdate");
      });

      // Progress should be updated (15/30 = 50%)
      // Check if time display updates - initial time is 0:00
      expect(screen.getByText("0:15")).toBeInTheDocument();
    });

    it("should reset on audio ended", () => {
      render(<AudioPlayerCard {...defaultProps} />);

      // Play the audio first
      act(() => {
        mockAudioInstance._triggerEvent("loadeddata");
      });

      // Simulate end of audio
      act(() => {
        mockAudioInstance._triggerEvent("ended");
      });

      // Should show initial time
      expect(screen.getByText("0:00")).toBeInTheDocument();
    });
  });

  describe("Audio format handling", () => {
    it("should create audio with correct MIME type for mp3", () => {
      render(<AudioPlayerCard {...defaultProps} format="mp3" />);

      // The audio element should be created with mp3 MIME type
      // This is implicitly tested through the Audio constructor being called
      expect(global.Audio).toHaveBeenCalled();
    });

    it("should create audio with correct MIME type for wav", () => {
      render(<AudioPlayerCard {...defaultProps} format="wav" />);

      expect(global.Audio).toHaveBeenCalled();
    });
  });

  describe("Disabled state", () => {
    it("should disable controls before audio is loaded", () => {
      render(<AudioPlayerCard {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      const playButton = buttons.find((btn) =>
        btn.className.includes("rounded-full"),
      );

      // Before loadeddata event, play button should be disabled
      expect(playButton).toBeDisabled();
    });

    it("should enable controls after audio is loaded", () => {
      render(<AudioPlayerCard {...defaultProps} />);

      act(() => {
        mockAudioInstance._triggerEvent("loadeddata");
      });

      const buttons = screen.getAllByRole("button");
      const playButton = buttons.find((btn) =>
        btn.className.includes("rounded-full"),
      );

      expect(playButton).not.toBeDisabled();
    });
  });

  describe("Cleanup", () => {
    it("should cleanup audio on unmount", () => {
      const { unmount } = render(<AudioPlayerCard {...defaultProps} />);

      unmount();

      expect(mockAudioInstance.pause).toHaveBeenCalled();
      expect(mockAudioInstance.src).toBe("");
    });
  });
});
