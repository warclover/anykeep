/**
 * 服务端仓储模块导出
 * @description 服务端数据访问层，用于 Server Components 和 API Routes
 */

export {
  BookmarkServerRepository,
  createBookmarkServerRepository,
  isBrowserPlatform,
  BROWSER_PLATFORMS,
} from "./bookmark-server.repository";

export type {
  BookmarkScope,
  BookmarkQueryOptions,
  BookmarkCountOptions,
} from "./bookmark-server.repository";
