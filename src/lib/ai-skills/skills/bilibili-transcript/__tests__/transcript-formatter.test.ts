/**
 * B站字幕格式化器测试
 *
 * @version 1.0.0
 */

import { formatTranscript } from "../formatters/transcript-formatter";
import type { SubtitleSegment } from "../types";

describe("formatTranscript", () => {
  const sampleSegments: SubtitleSegment[] = [
    { from: 0, to: 2.5, content: "大家好" },
    { from: 2.5, to: 5.0, content: "欢迎收看本期视频" },
    { from: 5.0, to: 8.0, content: "今天我们来聊一聊" },
    { from: 12.0, to: 15.0, content: "这是一个很有趣的话题" },
    { from: 15.0, to: 18.0, content: "让我们开始吧" },
  ];

  describe("text format", () => {
    it("should format segments as plain text", () => {
      const result = formatTranscript(sampleSegments, "text", "测试视频");
      expect(result.content).toContain("大家好");
      expect(result.content).toContain("欢迎收看本期视频");
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it("should group segments by natural paragraphs in content", () => {
      const result = formatTranscript(sampleSegments, "text", "测试视频");
      // Segments with gap > 3 seconds should be in separate paragraphs in content
      // Between segment 3 (ends at 8.0) and segment 4 (starts at 12.0) there's a 4 second gap
      expect(result.content).toContain("\n\n");
    });

    it("should have fullText as space-joined content", () => {
      const result = formatTranscript(sampleSegments, "text", "测试视频");
      expect(result.fullText).toBe(
        "大家好 欢迎收看本期视频 今天我们来聊一聊 这是一个很有趣的话题 让我们开始吧",
      );
    });

    it("should return empty content for empty segments", () => {
      const result = formatTranscript([], "text", "测试视频");
      expect(result.content).toBe("");
      expect(result.fullText).toBe("");
      expect(result.wordCount).toBe(0);
    });
  });

  describe("srt format", () => {
    it("should format segments as SRT", () => {
      const result = formatTranscript(sampleSegments, "srt", "测试视频");
      // SRT format should have numbered entries
      expect(result.content).toContain("1\n");
      expect(result.content).toContain("-->");
      expect(result.content).toContain("00:00:00,000");
    });

    it("should have correct SRT structure", () => {
      const result = formatTranscript(sampleSegments, "srt", "测试视频");
      const lines = result.content.split("\n");
      // First line should be "1"
      expect(lines[0]).toBe("1");
      // Second line should be timestamp
      expect(lines[1]).toMatch(
        /\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/,
      );
      // Third line should be content
      expect(lines[2]).toBe("大家好");
    });
  });

  describe("json format", () => {
    it("should format segments as JSON", () => {
      const result = formatTranscript(sampleSegments, "json", "测试视频");
      const parsed = JSON.parse(result.content);
      expect(parsed.segments).toHaveLength(5);
      expect(parsed.segments[0]).toEqual({
        from: 0,
        to: 2.5,
        content: "大家好",
      });
    });

    it("should include metadata in JSON", () => {
      const result = formatTranscript(sampleSegments, "json", "测试视频");
      const parsed = JSON.parse(result.content);
      expect(parsed.metadata.segmentCount).toBe(5);
      expect(typeof parsed.metadata.totalDuration).toBe("number");
      expect(parsed.metadata.generatedAt).toBeDefined();
    });
  });

  describe("markdown format", () => {
    it("should format segments as Markdown", () => {
      const result = formatTranscript(sampleSegments, "markdown", "测试视频");
      expect(result.content).toContain("# 测试视频");
      expect(result.content).toContain("## 视频字幕");
    });

    it("should include timestamps in Markdown", () => {
      const result = formatTranscript(sampleSegments, "markdown", "测试视频");
      // Should have time section headers like ### [0:00 - 0:18]
      expect(result.content).toMatch(/###\s*\[\d+:\d+\s*-\s*\d+:\d+\]/);
    });

    it("should group content into sections", () => {
      const result = formatTranscript(sampleSegments, "markdown", "测试视频");
      // Should have at least one section header
      const sectionCount = (result.content.match(/###/g) || []).length;
      expect(sectionCount).toBeGreaterThan(0);
    });
  });

  describe("word count", () => {
    it("should count Chinese characters", () => {
      const result = formatTranscript(sampleSegments, "text", "测试视频");
      // Count the Chinese characters in our sample (including spaces)
      // "大家好 欢迎收看本期视频 今天我们来聊一聊 这是一个很有趣的话题 让我们开始吧"
      // 3 + 8 + 7 + 10 + 5 + 4 spaces = 37 characters
      expect(result.wordCount).toBeGreaterThan(30);
    });

    it("should return 0 for empty segments", () => {
      const result = formatTranscript([], "text", "测试视频");
      expect(result.wordCount).toBe(0);
    });
  });

  describe("fullText", () => {
    it("should contain all segment content", () => {
      const result = formatTranscript(sampleSegments, "text", "测试视频");
      expect(result.fullText).toContain("大家好");
      expect(result.fullText).toContain("欢迎收看本期视频");
      expect(result.fullText).toContain("今天我们来聊一聊");
      expect(result.fullText).toContain("这是一个很有趣的话题");
      expect(result.fullText).toContain("让我们开始吧");
    });
  });
});
