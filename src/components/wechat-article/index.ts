/**
 * 微信文章组件模块
 *
 * @module wechat-article
 * @description 微信公众号文章展示组件集
 *
 * @example
 * ```tsx
 * import { WechatArticleViewer } from '@/components/wechat-article';
 *
 * <WechatArticleViewer
 *   snapshotId={123}
 *   bookmarkId={456}
 *   originalUrl="https://mp.weixin.qq.com/..."
 *   autoFetch={false}
 * />
 * ```
 */

// 主组件
export { WechatArticleViewer } from "./wechat-article-viewer";
export type { WechatArticleViewerProps } from "./wechat-article-viewer";

// 区块组件（集成用）
export { WechatArticleSection } from "./wechat-article-section";
export type { WechatArticleSectionProps } from "./wechat-article-section";

// 子组件
export { WechatArticleImages } from "./wechat-article-images";
export type { WechatArticleImagesProps } from "./wechat-article-images";

export { WechatArticleStatus } from "./wechat-article-status";
export type { WechatArticleStatusProps } from "./wechat-article-status";

// Hooks
export { useWechatArticle } from "./hooks/use-wechat-article";
export { useWechatArticleCrawl } from "./hooks/use-wechat-article-crawl";
export type { UseWechatArticleCrawlOptions } from "./hooks/use-wechat-article-crawl";

// 默认导出
export { WechatArticleViewer as default } from "./wechat-article-viewer";
