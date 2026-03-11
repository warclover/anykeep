/**
 * Classification V2 Matchers
 * 分类匹配器统一导出
 *
 * @description 从 classification-v1 迁移的匹配器模块
 * - TagMatcher: 基于标签的快速路径匹配
 * - TitleMatcher: 基于标题的快速路径匹配
 */

export { tagMatcher, TagMatcher } from "./tag-matcher";
export type { TagMatchResult } from "./tag-matcher";

export { titleMatcher, TitleMatcher } from "./title-matcher";
export type { TitleMatchResult, TitleVectorMatchConfig } from "./title-matcher";
