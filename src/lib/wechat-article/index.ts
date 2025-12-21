/**
 * 微信文章模块
 *
 * @module wechat-article
 * @description 微信公众号文章完整内容存储与展示
 *
 * 功能特性：
 * - 完整正文抓取与存储
 * - 图片持久化（Supabase Storage）
 * - Markdown 格式转换
 * - 重新获取支持
 * - 内容版本管理
 *
 * @example
 * ```typescript
 * import { wechatArticleService, type WechatArticleContent } from '@/lib/wechat-article';
 *
 * // 抓取完整内容
 * const content = await wechatArticleService.crawlFullContent(snapshotId);
 *
 * // 获取已保存的内容
 * const article = await wechatArticleService.getArticleContent(snapshotId);
 *
 * // 重新获取
 * const result = await wechatArticleService.refetch(snapshotId, { redownloadImages: true });
 * ```
 */

// 类型导出
export type {
  // 图片相关
  ImagePersistStatus,
  WechatArticleImage,
  ImagesStats,
  // 媒体相关（Phase 3 升级）
  MediaType,
  MediaDownloadStatus,
  MediaElement,
  MediaStats,
  // 配置
  WechatArticleCrawlConfig,
  // 内容
  WechatArticleContent,
  WechatArticleRow,
  // 进度
  CrawlStage,
  WechatArticleCrawlProgress,
  // 重新获取
  RefetchOptions,
  RefetchResult,
  // API
  GetArticleContentResponse,
  CrawlArticleResponse,
  RefetchArticleResponse,
  // Hooks
  UseWechatArticleReturn,
  UseWechatArticleCrawlOptions,
  UseWechatArticleCrawlReturn,
} from "./wechat-article.types";

// 配置导出
export {
  DEFAULT_CRAWL_CONFIG,
  EXCLUDE_IMAGE_PATTERNS,
  ALLOWED_IMAGE_HOSTS,
  generateImageStoragePath,
  IMAGE_FETCH_HEADERS,
  MIME_TO_EXT,
  getExtFromMime,
  ALLOWED_HTML_TAGS,
  ALLOWED_HTML_ATTRS,
  // Phase 1 升级：样式白名单
  ALLOWED_STYLE_PROPERTIES,
  DANGEROUS_STYLE_VALUES,
  // Phase 2 升级：代理配置
  IMAGE_PROXY_SERVICES,
  IMAGE_REFERER_LIST,
  getProxyUrl,
  // 本站图片代理（解决防盗链）
  IMAGE_PROXY_PATH,
  PROXY_REQUIRED_HOSTS,
  getLocalProxyUrl,
  requiresProxy,
  getImageDisplayUrl,
  ERROR_CODES,
  type ErrorCode,
} from "./wechat-article.config";

// 服务导出 (延迟加载以避免循环依赖)
export {
  WechatArticleService,
  wechatArticleService,
} from "./wechat-article.service";

// 处理器导出
export { processWechatContent } from "./processors/content.processor";
export { extractImages, persistImages, optimizeWechatImageUrl } from "./processors/image.processor";
export {
  processMediaElements,
  processVideoElements,
  processAudioElements,
  persistMedia,
} from "./processors/media.processor";

// Phase 4 升级：自动抓取
export {
  autoFetchWechatArticle,
  isWechatArticleUrl,
} from "./auto-crawl";
