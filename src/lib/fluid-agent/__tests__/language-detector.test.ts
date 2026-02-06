import { languageDetector } from "../prediction/language-detector";

describe("LanguageDetector", () => {
  beforeEach(() => {
    languageDetector.clearCache();
  });

  it("should return unknown for short text", () => {
    const result = languageDetector.detect("hi");
    expect(result.code).toBe("unknown");
    expect(result.confidence).toBe(0);
  });

  it("should detect English text", () => {
    const result = languageDetector.detect(
      "This is a sample English text for testing the language detector.",
    );
    expect(result.code).toBe("en");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("should detect Chinese text", () => {
    const result = languageDetector.detect(
      "这是一段用于测试语言检测器的中文示例文本。",
    );
    expect(result.code).toBe("zh");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("should check if all texts are in a specific language", () => {
    const englishTexts = [
      "This is the first English sentence.",
      "This is another English sentence for testing.",
      "And this is the third English sentence.",
    ];

    expect(languageDetector.isAllLanguage(englishTexts, "en")).toBe(true);
    expect(languageDetector.isAllLanguage(englishTexts, "zh")).toBe(false);
  });

  it("should detect mixed language texts", () => {
    const mixedTexts = [
      "This is an English sentence.",
      "这是一段用于测试的中文句子。",
    ];

    expect(languageDetector.isMixedLanguage(mixedTexts)).toBe(true);
  });

  it("should return false for single text in isMixedLanguage", () => {
    expect(languageDetector.isMixedLanguage(["Single text"])).toBe(false);
  });

  it("should get dominant language", () => {
    const texts = [
      "First English sentence.",
      "Second English sentence.",
      "一段中文句子。",
    ];

    expect(languageDetector.getDominantLanguage(texts)).toBe("en");
  });

  it("should cache detection results", () => {
    const text =
      "This is a sample text for cache testing in the language detector.";

    // First call
    const result1 = languageDetector.detect(text);

    // Second call should use cache
    const result2 = languageDetector.detect(text);

    expect(result1).toEqual(result2);
  });

  it("should return empty array check correctly", () => {
    expect(languageDetector.isAllLanguage([], "en")).toBe(false);
  });
});
