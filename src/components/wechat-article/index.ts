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

// 样式选项升级：样式选择器组件
export { StyleSelector, StyleSelectorCompact } from "./style-selector";
export type { StyleSelectorProps } from "./style-selector";

// Hooks
export { useWechatArticle } from "./hooks/use-wechat-article";
export { useWechatArticleCrawl } from "./hooks/use-wechat-article-crawl";
export type { UseWechatArticleCrawlOptions } from "./hooks/use-wechat-article-crawl";

// 样式选项升级：用户偏好 Hook
export { useStylePreferences } from "./hooks/use-style-preferences";
export type { UseStylePreferencesReturn } from "./hooks/use-style-preferences";

// 默认导出
export { WechatArticleViewer as default } from "./wechat-article-viewer";
