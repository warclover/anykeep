import { franc } from "franc-min";

export type LanguageCode = "en" | "zh" | "ja" | "ko" | "unknown";

export interface LanguageDetectionResult {
  code: LanguageCode;
  confidence: number;
}

// franc 代码到简化代码的映射
const LANG_MAPPING: Record<string, LanguageCode> = {
  eng: "en",
  cmn: "zh",
  jpn: "ja",
  kor: "ko",
};

class LanguageDetector {
  private cache: Map<string, LanguageDetectionResult> = new Map();
  private readonly MIN_TEXT_LENGTH = 10;
  private readonly CACHE_SIZE = 1000;

  /**
   * 检测单个文本的语言
   */
  detect(text: string): LanguageDetectionResult {
    if (!text || text.length < this.MIN_TEXT_LENGTH) {
      return { code: "unknown", confidence: 0 };
    }

    // 检查缓存
    const cached = this.cache.get(text);
    if (cached) {
      return cached;
    }

    // 执行检测
    const langCode = franc(text);
    const result: LanguageDetectionResult = {
      code: LANG_MAPPING[langCode] || "unknown",
      confidence: langCode === "und" ? 0 : 0.8,
    };

    // 更新缓存
    this.updateCache(text, result);

    return result;
  }

  /**
   * 批量检测并判断是否全部为某语言
   */
  isAllLanguage(texts: string[], targetLang: LanguageCode): boolean {
    if (texts.length === 0) return false;
    return texts.every((text) => this.detect(text).code === targetLang);
  }

  /**
   * 检测是否为混合语言
   */
  isMixedLanguage(texts: string[]): boolean {
    if (texts.length < 2) return false;

    const langs = new Set(
      texts.map((t) => this.detect(t).code).filter((c) => c !== "unknown"),
    );

    return langs.size > 1;
  }

  /**
   * 获取文本数组中的主要语言
   */
  getDominantLanguage(texts: string[]): LanguageCode {
    const counts: Record<LanguageCode, number> = {
      en: 0,
      zh: 0,
      ja: 0,
      ko: 0,
      unknown: 0,
    };

    texts.forEach((text) => {
      const { code } = this.detect(text);
      counts[code]++;
    });

    let dominant: LanguageCode = "unknown";
    let maxCount = 0;

    for (const [lang, count] of Object.entries(counts)) {
      if (count > maxCount && lang !== "unknown") {
        maxCount = count;
        dominant = lang as LanguageCode;
      }
    }

    return dominant;
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  private updateCache(text: string, result: LanguageDetectionResult): void {
    // LRU 简化实现：超出大小时清空一半
    if (this.cache.size >= this.CACHE_SIZE) {
      const keys = Array.from(this.cache.keys());
      keys.slice(0, this.CACHE_SIZE / 2).forEach((k) => this.cache.delete(k));
    }
    this.cache.set(text, result);
  }
}

export const languageDetector = new LanguageDetector();
