/**
 * RPC 函数定义
 *
 * 注册项目中使用的 RPC 函数及其版本信息
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { rpcRegistry, defineRPCFunction } from "./rpc-registry";

/**
 * 批量标签操作函数定义
 */
const batchTagsFunctions = [
  defineRPCFunction("batch_add_tags", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-20",
    changelog: "初始版本：批量为书签添加标签",
  }),
  defineRPCFunction("batch_remove_tags", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-20",
    changelog: "初始版本：批量从书签移除标签",
  }),
];

/**
 * 语义搜索函数定义
 */
const searchFunctions = [
  defineRPCFunction("search_bookmarks_semantic", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-11-26",
    changelog: "初始版本：基于向量的语义搜索",
  }),
  defineRPCFunction("search_similar_folders", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-05",
    changelog: "初始版本：搜索相似文件夹",
  }),
  defineRPCFunction("search_folders_unified", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-09",
    changelog: "初始版本：统一文件夹搜索（支持多种匹配策略）",
  }),
  defineRPCFunction("find_related_bookmarks", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-09",
    changelog: "初始版本：查找相关书签",
  }),
  defineRPCFunction("search_bookmarks_by_embedding", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-09",
    changelog: "初始版本：基于向量搜索书签",
  }),
];

/**
 * 分类相关函数定义
 */
const classificationFunctions = [
  defineRPCFunction("compute_folder_profile", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-05",
    changelog: "初始版本：计算文件夹 Profile",
  }),
  defineRPCFunction("compute_user_folder_profiles", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-05",
    changelog: "初始版本：批量计算用户所有文件夹 Profile",
  }),
  defineRPCFunction("get_user_classification_stage", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-05",
    changelog: "初始版本：获取用户分类阶段",
  }),
  defineRPCFunction("get_pending_suggestions_count", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-11-25",
    changelog: "初始版本：获取待处理建议数量",
  }),
  defineRPCFunction("accept_classification_suggestions", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-11-25",
    changelog: "初始版本：接受分类建议",
  }),
  defineRPCFunction("reject_classification_suggestions", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-11-25",
    changelog: "初始版本：拒绝分类建议",
  }),
];

/**
 * 用户 Profile 函数定义
 */
const profileFunctions = [
  defineRPCFunction("get_or_create_interest_profile", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-05",
    changelog: "初始版本：获取或创建用户兴趣 Profile",
  }),
  defineRPCFunction("update_user_interest_stage", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-05",
    changelog: "初始版本：更新用户兴趣阶段",
  }),
  defineRPCFunction("analyze_imported_bookmarks", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-05",
    changelog: "初始版本：分析导入的书签",
  }),
  defineRPCFunction("learn_from_user_behavior", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-05",
    changelog: "初始版本：从用户行为中学习",
  }),
];

/**
 * 存储配额函数定义
 */
const storageFunctions = [
  defineRPCFunction("increment_storage_used", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-11-21",
    changelog: "初始版本：增加存储使用量",
  }),
  defineRPCFunction("decrement_storage_used", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-11-21",
    changelog: "初始版本：减少存储使用量",
  }),
];

/**
 * 系统文件夹函数定义
 */
const systemFolderFunctions = [
  defineRPCFunction("get_or_create_inbox_folder", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-11-25",
    changelog: "初始版本：获取或创建收件箱文件夹",
  }),
  defineRPCFunction("get_system_folder_name", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-11-27",
    changelog: "初始版本：获取系统文件夹名称（支持 i18n）",
  }),
];

/**
 * 热门标签函数定义
 */
const tagFunctions = [
  defineRPCFunction("get_user_hot_tags", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-03",
    changelog: "初始版本：获取用户热门标签",
  }),
];

/**
 * 知识图谱函数定义
 */
const knowledgeFunctions = [
  defineRPCFunction("get_knowledge_graph", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-14",
    changelog: "初始版本：获取知识图谱",
  }),
  defineRPCFunction("get_graph_stats", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-14",
    changelog: "初始版本：获取图谱统计",
  }),
];

/**
 * 消息函数定义
 */
const messageFunctions = [
  defineRPCFunction("mark_messages_read", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-08",
    changelog: "初始版本：批量标记消息已读",
  }),
];

/**
 * 信任模式函数定义
 */
const trustModeFunctions = [
  defineRPCFunction("get_trust_mode", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-11",
    changelog: "初始版本：获取用户信任模式",
  }),
  defineRPCFunction("update_trust_score", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-15",
    changelog: "初始版本：原子更新信任分数",
  }),
];

/**
 * 作业队列函数定义
 */
const jobQueueFunctions = [
  defineRPCFunction("claim_next_job", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-09",
    changelog: "初始版本：原子领取下一个作业",
  }),
];

/**
 * 快照函数定义
 */
const snapshotFunctions = [
  defineRPCFunction("claim_snapshot_quota", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-16",
    changelog: "初始版本：原子领取快照配额",
  }),
  defineRPCFunction("create_snapshot_atomic", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-16",
    changelog: "初始版本：原子创建快照",
  }),
];

/**
 * 文件夹事务函数定义
 */
const folderTransactionFunctions = [
  defineRPCFunction("execute_folder_transaction", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-15",
    changelog: "初始版本：执行文件夹事务",
  }),
  defineRPCFunction("get_folder_path", {
    version: "v1",
    semanticVersion: { major: 1, minor: 0, patch: 0 },
    status: "stable",
    releasedAt: "2025-12-17",
    changelog: "初始版本：获取文件夹路径",
  }),
];

/**
 * 初始化 RPC 函数注册表
 */
export function initializeRPCRegistry(): void {
  // 批量标签
  batchTagsFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });

  // 搜索
  searchFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });

  // 分类
  classificationFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });

  // Profile
  profileFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });

  // 存储
  storageFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });

  // 系统文件夹
  systemFolderFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });

  // 标签
  tagFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });

  // 知识图谱
  knowledgeFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });

  // 消息
  messageFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });

  // 信任模式
  trustModeFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });

  // 作业队列
  jobQueueFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });

  // 快照
  snapshotFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });

  // 文件夹事务
  folderTransactionFunctions.forEach((def) => {
    rpcRegistry.register(def.name, def);
  });
}

// 自动初始化
initializeRPCRegistry();
