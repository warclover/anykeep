/**
 * B站 URL 解析器测试
 *
 * @version 1.0.0
 */

import {
  parseBilibiliUrl,
  resolveShortLink,
  isValidBvid,
  formatSrtTime,
  formatMinuteTime,
  extractBilibiliUrl,
} from "../api/url-parser";

describe("parseBilibiliUrl", () => {
  it("should parse standard bilibili video URL", () => {
    const result = parseBilibiliUrl(
      "https://www.bilibili.com/video/BV1xx411c7XW",
    );
    expect(result).toEqual({
      bvid: "BV1xx411c7XW",
      page: 1,
      isShortLink: false,
    });
  });

  it("should parse URL with page parameter", () => {
    const result = parseBilibiliUrl(
      "https://www.bilibili.com/video/BV1xx411c7XW?p=3",
    );
    expect(result).toEqual({
      bvid: "BV1xx411c7XW",
      page: 3,
      isShortLink: false,
    });
  });

  it("should parse URL without www", () => {
    const result = parseBilibiliUrl("https://bilibili.com/video/BV1xx411c7XW");
    expect(result).toEqual({
      bvid: "BV1xx411c7XW",
      page: 1,
      isShortLink: false,
    });
  });

  it("should detect short link", () => {
    const result = parseBilibiliUrl("https://b23.tv/abc123");
    expect(result).toEqual({
      bvid: "",
      page: 1,
      isShortLink: true,
    });
  });

  it("should return null for non-bilibili URL", () => {
    const result = parseBilibiliUrl("https://youtube.com/watch?v=abc123");
    expect(result).toBeNull();
  });

  it("should return null for invalid URL", () => {
    const result = parseBilibiliUrl("not a url");
    expect(result).toBeNull();
  });

  it("should return null for bilibili URL without video path", () => {
    const result = parseBilibiliUrl("https://www.bilibili.com/");
    expect(result).toBeNull();
  });

  it("should handle URL with extra query parameters", () => {
    const result = parseBilibiliUrl(
      "https://www.bilibili.com/video/BV1xx411c7XW?p=2&t=120",
    );
    expect(result).toEqual({
      bvid: "BV1xx411c7XW",
      page: 2,
      isShortLink: false,
    });
  });
});

describe("isValidBvid", () => {
  it("should return true for valid BV ID", () => {
    expect(isValidBvid("BV1xx411c7XW")).toBe(true);
  });

  it("should return false for too short BV ID", () => {
    expect(isValidBvid("BV1xx411")).toBe(false);
  });

  it("should return false for too long BV ID", () => {
    expect(isValidBvid("BV1xx411c7XWabc")).toBe(false);
  });

  it("should return false for lowercase bv prefix", () => {
    expect(isValidBvid("bv1xx411c7XW")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isValidBvid("")).toBe(false);
  });

  it("should return false for AV number", () => {
    expect(isValidBvid("av12345678")).toBe(false);
  });
});

describe("formatSrtTime", () => {
  it("should format 0 seconds", () => {
    expect(formatSrtTime(0)).toBe("00:00:00,000");
  });

  it("should format seconds only", () => {
    expect(formatSrtTime(45)).toBe("00:00:45,000");
  });

  it("should format minutes and seconds", () => {
    expect(formatSrtTime(125)).toBe("00:02:05,000");
  });

  it("should format hours, minutes, and seconds", () => {
    expect(formatSrtTime(3725)).toBe("01:02:05,000");
  });

  it("should format milliseconds", () => {
    expect(formatSrtTime(65.5)).toBe("00:01:05,500");
  });

  it("should handle decimal milliseconds", () => {
    expect(formatSrtTime(10.123)).toBe("00:00:10,123");
  });
});

describe("formatMinuteTime", () => {
  it("should format 0 seconds", () => {
    expect(formatMinuteTime(0)).toBe("0:00");
  });

  it("should format seconds only", () => {
    expect(formatMinuteTime(45)).toBe("0:45");
  });

  it("should format minutes and seconds", () => {
    expect(formatMinuteTime(125)).toBe("2:05");
  });

  it("should format with padded seconds", () => {
    expect(formatMinuteTime(61)).toBe("1:01");
  });

  it("should format hours when needed", () => {
    expect(formatMinuteTime(3725)).toBe("1:02:05");
  });

  it("should format multiple hours", () => {
    expect(formatMinuteTime(7325)).toBe("2:02:05");
  });
});

describe("extractBilibiliUrl", () => {
  it("should extract bilibili URL from text", () => {
    const text =
      "Check out this video https://www.bilibili.com/video/BV1xx411c7XW it's great!";
    expect(extractBilibiliUrl(text)).toBe(
      "https://www.bilibili.com/video/BV1xx411c7XW",
    );
  });

  it("should extract short link from text", () => {
    const text = "看这个 https://b23.tv/abc123 太搞笑了";
    expect(extractBilibiliUrl(text)).toBe("https://b23.tv/abc123");
  });

  it("should return null when no bilibili URL", () => {
    const text = "Check out https://youtube.com/watch?v=abc";
    expect(extractBilibiliUrl(text)).toBeNull();
  });

  it("should handle URL with Chinese characters after", () => {
    const text = "https://www.bilibili.com/video/BV1xx411c7XW这个视频";
    const result = extractBilibiliUrl(text);
    expect(result).toBe("https://www.bilibili.com/video/BV1xx411c7XW");
  });

  it("should clean trailing punctuation", () => {
    const text = "看看这个(https://www.bilibili.com/video/BV1xx411c7XW)";
    const result = extractBilibiliUrl(text);
    expect(result).toBe("https://www.bilibili.com/video/BV1xx411c7XW");
  });
});

// Note: resolveShortLink requires network access and is tested separately
describe("resolveShortLink", () => {
  it("should be a function", () => {
    expect(typeof resolveShortLink).toBe("function");
  });

  // Integration test - skipped in unit tests
  it.skip("should resolve b23.tv short link", async () => {
    const result = await resolveShortLink("https://b23.tv/abc123");
    expect(result).toContain("bilibili.com");
  });
});
