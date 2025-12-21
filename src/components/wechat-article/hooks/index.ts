/**
 * 微信文章 Hooks 索引
 *
 * @module wechat-article/hooks
 */

// 数据获取
export { useWechatArticle } from "./use-wechat-article";
export { useWechatArticleCrawl } from "./use-wechat-article-crawl";

// Phase 4 升级：阅读器增强
export {
  useReaderSettings,
  type ReaderTheme,
  type ReaderSettings,
  type UseReaderSettingsReturn,
} from "./use-reader-settings";

export {
  useReadingProgress,
  type UseReadingProgressOptions,
  type UseReadingProgressReturn,
} from "./use-reading-progress";

export {
  useToc,
  type TocItem,
  type UseTocOptions,
  type UseTocReturn,
} from "./use-toc";
