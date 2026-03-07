/**
 * 内容平台解析器模块
 *
 * 为不同内容平台提供定制化的 HTML 正文提取能力
 *
 * @example
 * ```typescript
 * import { getParserRegistry } from "@/lib/summary/parsers";
 *
 * const registry = getParserRegistry();
 * const parser = registry.findParser("https://mp.weixin.qq.com/s/xxx");
 * const result = parser.parse(html, url);
 * ```
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

// 接口
export type { IPlatformParser, ParsedContent } from "./parser.interface";

// 注册表
export { getParserRegistry } from "./parser.registry";

// 各平台解析器
export { WechatParser } from "./wechat.parser";
export { BilibiliParser } from "./bilibili.parser";
export { XiaohongshuParser } from "./xiaohongshu.parser";
export { ZhihuParser } from "./zhihu.parser";
export { GenericParser } from "./generic.parser";
