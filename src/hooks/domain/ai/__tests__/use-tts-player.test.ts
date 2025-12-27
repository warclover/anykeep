/**
 * useTTSPlayer Hook 测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { renderHook, act } from "@testing-library/react";
import { useTTSPlayer } from "../use-tts-player";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Audio
class MockAudioElement {
  src: string = "";
  currentTime: number = 0;
  duration: number = 30;
  playbackRate: number = 1;
  muted: boolean = false;
  paused: boolean = true;

  onloadedmetadata: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  play = jest.fn().mockImplementation(() => {
    this.paused = false;
    return Promise.resolve();
  });

  pause = jest.fn().mockImplementation(() => {
    this.paused = true;
  });
}

let mockAudioInstance: MockAudioElement;

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

// Mock URL methods
const mockCreateObjectURL = jest.fn(() => "blob:test-url");
const mockRevokeObjectURL = jest.fn();

beforeEach(() => {
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
});

// Mock atob
global.atob = jest.fn((str) => str);

describe("useTTSPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Initial state", () => {
    it("should return initial idle state", () => {
      const { result } = renderHook(() => useTTSPlayer());

      expect(result.current.state).toEqual({
        state: "idle",
        progress: 0,
        currentTime: 0,
        duration: 0,
        speed: 1.0,
        error: null,
        bookmarkTitle: null,
        currentBookmarkId: null,
      });
    });

    it("should provide all control methods", () => {
      const { result } = renderHook(() => useTTSPlayer());

      expect(result.current.controls).toHaveProperty("play");
      expect(result.current.controls).toHaveProperty("pause");
      expect(result.current.controls).toHaveProperty("resume");
      expect(result.current.controls).toHaveProperty("stop");
      expect(result.current.controls).toHaveProperty("setSpeed");
      expect(result.current.controls).toHaveProperty("seek");
      expect(result.current.controls).toHaveProperty("isPlayingBookmark");
    });
  });

  describe("play()", () => {
    const mockApiResponse = {
      success: true,
      data: {
        audioBase64: "dGVzdCBhdWRpbw==",
        format: "mp3",
        durationSec: 30,
        charCount: 100,
        bookmarkTitle: "Test Bookmark",
      },
    };

    it("should fetch TTS audio and start playing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({
          bookmarkId: 123,
          contentType: "summary",
        });
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookmarkId: 123,
          contentType: "summary",
          speed: undefined,
          voiceGender: undefined,
          voice: undefined,
        }),
        signal: expect.any(AbortSignal),
      });

      expect(result.current.state.currentBookmarkId).toBe(123);
    });

    it("should update state to loading during fetch", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce({
        ok: true,
        json: () => promise,
      });

      const { result } = renderHook(() => useTTSPlayer());

      act(() => {
        result.current.controls.play({ bookmarkId: 123 });
      });

      // Should be loading while waiting for API
      expect(result.current.state.state).toBe("loading");

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          success: true,
          data: {
            audioBase64: "dGVzdA==",
            format: "mp3",
            durationSec: 10,
            bookmarkTitle: "Test",
          },
        });
      });
    });

    it("should handle API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            error: { message: "Server error" },
          }),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      expect(result.current.state.state).toBe("error");
      expect(result.current.state.error).toBe("Server error");
    });

    it("should handle network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      expect(result.current.state.state).toBe("error");
      expect(result.current.state.error).toBe("Network error");
    });

    it("should pass custom options to API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              audioBase64: "dGVzdA==",
              format: "mp3",
              durationSec: 10,
              bookmarkTitle: "Test",
            },
          }),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({
          bookmarkId: 123,
          contentType: "tldr",
          speed: 1.5,
          voiceGender: "male",
          voice: "custom-voice",
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tts",
        expect.objectContaining({
          body: JSON.stringify({
            bookmarkId: 123,
            contentType: "tldr",
            speed: 1.5,
            voiceGender: "male",
            voice: "custom-voice",
          }),
        }),
      );
    });

    it("should ignore abort errors", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      // State should remain loading or idle, not error
      expect(result.current.state.state).not.toBe("error");
    });
  });

  describe("pause()", () => {
    it("should pause playing audio", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              audioBase64: "dGVzdA==",
              format: "mp3",
              durationSec: 10,
              bookmarkTitle: "Test",
            },
          }),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      // Manually set state to playing for test
      act(() => {
        result.current.controls.pause();
      });

      // The pause function should call audio.pause()
      expect(mockAudioInstance.pause).toHaveBeenCalled();
    });

    it("should not pause if not playing", () => {
      const { result } = renderHook(() => useTTSPlayer());

      act(() => {
        result.current.controls.pause();
      });

      // Should not throw, just do nothing
      expect(result.current.state.state).toBe("idle");
    });
  });

  describe("resume()", () => {
    it("should resume paused audio", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              audioBase64: "dGVzdA==",
              format: "mp3",
              durationSec: 10,
              bookmarkTitle: "Test",
            },
          }),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      act(() => {
        result.current.controls.pause();
      });

      act(() => {
        result.current.controls.resume();
      });

      expect(mockAudioInstance.play).toHaveBeenCalled();
    });
  });

  describe("stop()", () => {
    it("should stop and reset state", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              audioBase64: "dGVzdA==",
              format: "mp3",
              durationSec: 10,
              bookmarkTitle: "Test",
            },
          }),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      act(() => {
        result.current.controls.stop();
      });

      expect(result.current.state).toEqual({
        state: "idle",
        progress: 0,
        currentTime: 0,
        duration: 0,
        speed: 1.0,
        error: null,
        bookmarkTitle: null,
        currentBookmarkId: null,
      });
    });
  });

  describe("setSpeed()", () => {
    it("should update playback speed", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              audioBase64: "dGVzdA==",
              format: "mp3",
              durationSec: 10,
              bookmarkTitle: "Test",
            },
          }),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      act(() => {
        result.current.controls.setSpeed(1.5);
      });

      expect(result.current.state.speed).toBe(1.5);
      expect(mockAudioInstance.playbackRate).toBe(1.5);
    });

    it("should clamp speed to valid range", () => {
      const { result } = renderHook(() => useTTSPlayer());

      act(() => {
        result.current.controls.setSpeed(3.0);
      });
      expect(result.current.state.speed).toBe(2.0);

      act(() => {
        result.current.controls.setSpeed(0.1);
      });
      expect(result.current.state.speed).toBe(0.5);
    });
  });

  describe("seek()", () => {
    it("should seek to specified time", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              audioBase64: "dGVzdA==",
              format: "mp3",
              durationSec: 30,
              bookmarkTitle: "Test",
            },
          }),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      act(() => {
        result.current.controls.seek(15);
      });

      expect(mockAudioInstance.currentTime).toBe(15);
      expect(result.current.state.currentTime).toBe(15);
    });
  });

  describe("isPlayingBookmark()", () => {
    it("should return true when playing specified bookmark", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              audioBase64: "dGVzdA==",
              format: "mp3",
              durationSec: 10,
              bookmarkTitle: "Test",
            },
          }),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      expect(result.current.controls.isPlayingBookmark(123)).toBe(true);
      expect(result.current.controls.isPlayingBookmark(456)).toBe(false);
    });

    it("should return false when idle", () => {
      const { result } = renderHook(() => useTTSPlayer());

      expect(result.current.controls.isPlayingBookmark(123)).toBe(false);
    });
  });

  describe("Cleanup on unmount", () => {
    it("should cleanup resources on unmount", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              audioBase64: "dGVzdA==",
              format: "mp3",
              durationSec: 10,
              bookmarkTitle: "Test",
            },
          }),
      });

      const { result, unmount } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      unmount();

      expect(mockAudioInstance.pause).toHaveBeenCalled();
    });
  });

  describe("Audio events", () => {
    it("should update duration on loadedmetadata", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              audioBase64: "dGVzdA==",
              format: "mp3",
              durationSec: 45,
              bookmarkTitle: "Test Bookmark Title",
            },
          }),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      // Trigger loadedmetadata event
      act(() => {
        mockAudioInstance.duration = 45;
        mockAudioInstance.onloadedmetadata?.();
      });

      expect(result.current.state.duration).toBe(45);
      expect(result.current.state.bookmarkTitle).toBe("Test Bookmark Title");
    });

    it("should update progress on timeupdate", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              audioBase64: "dGVzdA==",
              format: "mp3",
              durationSec: 30,
              bookmarkTitle: "Test",
            },
          }),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      // Trigger timeupdate event
      act(() => {
        mockAudioInstance.currentTime = 15;
        mockAudioInstance.duration = 30;
        mockAudioInstance.ontimeupdate?.();
      });

      expect(result.current.state.currentTime).toBe(15);
      expect(result.current.state.progress).toBe(0.5);
    });

    it("should reset to idle on ended", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              audioBase64: "dGVzdA==",
              format: "mp3",
              durationSec: 30,
              bookmarkTitle: "Test",
            },
          }),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      // Trigger ended event
      act(() => {
        mockAudioInstance.onended?.();
      });

      expect(result.current.state.state).toBe("idle");
      expect(result.current.state.progress).toBe(1);
    });

    it("should set error state on audio error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              audioBase64: "dGVzdA==",
              format: "mp3",
              durationSec: 30,
              bookmarkTitle: "Test",
            },
          }),
      });

      const { result } = renderHook(() => useTTSPlayer());

      await act(async () => {
        await result.current.controls.play({ bookmarkId: 123 });
      });

      // Trigger error event
      act(() => {
        mockAudioInstance.onerror?.();
      });

      expect(result.current.state.state).toBe("error");
      expect(result.current.state.error).toBe("音频播放失败");
    });
  });
});
