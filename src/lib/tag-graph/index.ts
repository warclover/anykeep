/**
 * 标签图谱服务模块
 *
 * 管理标签之间的关系（同义词、相关、父子），
 * 支持从分类行为中学习标签关系、同义词扩展等。
 */
export { tagGraphService } from "./tag-graph.service";
export type {
  TagRelationshipType,
  TagRelationshipSource,
  TagRelationship,
  RelatedTag,
  TagGraphData,
} from "./tag-graph.service";
