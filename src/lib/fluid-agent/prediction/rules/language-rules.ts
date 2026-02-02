import type { PredictionRule } from "../../types";
import { languageDetector } from "../language-detector";

export const languageRules: PredictionRule[] = [
  {
    id: "lang_all_english",
    name: "翻译为中文",
    icon: "🌐",
    priority: 95,
    category: "language",
    enabled: true,
    condition: (selection) => {
      const titles = selection.map((b) => b.title);
      return languageDetector.isAllLanguage(titles, "en");
    },
    action: "translate_batch",
    params: (selection) => ({
      targetLang: "zh",
      bookmarkIds: selection.map((b) => b.id),
    }),
  },
  {
    id: "lang_all_chinese",
    name: "生成摘要",
    icon: "📝",
    priority: 80,
    category: "language",
    enabled: true,
    condition: (selection) => {
      const titles = selection.map((b) => b.title);
      return languageDetector.isAllLanguage(titles, "zh");
    },
    action: "generate_summary",
    params: (selection) => ({
      bookmarkIds: selection.map((b) => b.id),
    }),
  },
  {
    id: "lang_mixed",
    name: "统一翻译",
    icon: "🌐",
    priority: 85,
    category: "language",
    enabled: true,
    condition: (selection) => {
      const titles = selection.map((b) => b.title);
      return languageDetector.isMixedLanguage(titles);
    },
    action: "translate_batch",
    params: (selection) => ({
      targetLang: "zh",
      bookmarkIds: selection.map((b) => b.id),
    }),
  },
];
