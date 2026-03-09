/**
 * 文件夹标签智能生成器
 *
 * 功能：
 * 1. 智能拆词：处理中英文混合、特殊符号分隔
 * 2. 同义词扩展：为专业术语添加同义词
 * 3. 标签去重与清洗
 *
 * @module classification/utils/folder-tag-generator
 * @version 1.0.0
 * @since 2025-01-15
 */

import { logger } from "@/lib/logger";

// ============================================================================
// 同义词词典
// ============================================================================

/**
 * 领域同义词词典
 * 键：标准术语（小写），值：同义词数组
 */
const SYNONYM_DICTIONARY: Record<string, string[]> = {
  // 技术开发
  lims: ["实验室信息管理系统", "实验室管理", "实验室系统"],
  前端: ["frontend", "前端开发", "web前端"],
  前端开发: ["frontend", "前端", "web前端"],
  开发: ["dev", "development"],
  后端: ["backend", "后端开发", "服务端"],
  全栈: ["fullstack", "全栈开发"],

  // 设计相关
  ui: ["用户界面", "界面设计"],
  ux: ["用户体验", "体验设计"],
  产品设计: ["产品", "设计"],

  // 项目管理
  敏捷: ["agile", "scrum"],
  看板: ["kanban"],

  // 数据相关
  数据分析: ["数据", "分析"],
  机器学习: ["ml", "ai", "人工智能"],
  ai: ["机器学习", "人工智能"],

  // 行业术语
  可持续发展: ["可持续", "sustainability"],
  实验室: ["laboratory", "lab", "实验"],

  // 通用术语
  学习: ["学习资料", "教程"],
  笔记: ["notes", "记录"],
  资料: ["资源", "materials"],
};

// ============================================================================
// 拆词规则
// ============================================================================

/**
 * 分隔符正则表达式
 * 匹配：空格、+、-、_、/、|、·、.、,、;、:、中文顿号等
 */
const SEPARATOR_REGEX = /[\s+\-_/|·.,;:、]+/g;

/**
 * 驼峰命名拆分正则
 * 例如：camelCase → camel Case
 */
const CAMEL_CASE_REGEX = /([a-z])([A-Z])/g;

/**
 * 常见停用词（不作为独立标签）
 */
const STOP_WORDS = new Set([
  "的",
  "和",
  "与",
  "or",
  "and",
  "the",
  "a",
  "an",
  "in",
  "on",
  "at",
  "for",
  "to",
  "of",
  "by",
  "with",
]);

// ============================================================================
// 核心功能
// ============================================================================

/**
 * 智能拆词
 *
 * @example
 * tokenizeFolderName("lims+实验室")
 * // => ["lims", "实验室"]
 *
 * tokenizeFolderName("前端开发-React")
 * // => ["前端", "开发", "react"]
 *
 * tokenizeFolderName("camelCaseTest")
 * // => ["camel", "case", "test"]
 */
function tokenizeFolderName(folderName: string): string[] {
  if (!folderName || folderName.trim().length === 0) {
    return [];
  }

  // 1. 预处理：拆分驼峰命名
  const processed = folderName.replace(CAMEL_CASE_REGEX, "$1 $2");

  // 2. 按分隔符拆分
  const tokens = processed
    .split(SEPARATOR_REGEX)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => {
      // 过滤条件：
      // - 非空
      // - 长度 >= 2（避免单字符噪音）
      // - 不是停用词
      return token.length >= 2 && !STOP_WORDS.has(token);
    });

  // 3. 去重（保持顺序）
  return Array.from(new Set(tokens));
}

/**
 * 同义词扩展
 *
 * @example
 * expandSynonyms(["lims"])
 * // => ["lims", "实验室信息管理系统", "Laboratory Information Management System", ...]
 */
function expandSynonyms(tokens: string[]): string[] {
  const expanded = new Set<string>();

  // 添加原始 token
  tokens.forEach((token) => expanded.add(token));

  // 查找同义词
  tokens.forEach((token) => {
    const synonyms = SYNONYM_DICTIONARY[token.toLowerCase()];
    if (synonyms) {
      synonyms.forEach((syn) => expanded.add(syn));
    }
  });

  return Array.from(expanded);
}

/**
 * 标签清洗与限制
 *
 * 规则：
 * 1. 去除过长标签（> 20 字符）
 * 2. 限制总数量（最多 15 个）
 * 3. 优先保留原始 token
 */
function cleanAndLimitTags(
  tokens: string[],
  expanded: string[],
  maxTags = 15,
): string[] {
  // 1. 过滤过长标签
  const filtered = expanded.filter((tag) => tag.length <= 20);

  // 2. 确保原始 token 在前面
  const originalSet = new Set(tokens);
  const prioritized = [
    ...filtered.filter((tag) => originalSet.has(tag)),
    ...filtered.filter((tag) => !originalSet.has(tag)),
  ];

  // 3. 限制数量
  return prioritized.slice(0, maxTags);
}

/**
 * 生成文件夹标签（主入口）
 *
 * @param folderName - 文件夹名称
 * @param options - 配置选项
 * @returns 标签数组
 *
 * @example
 * generateFolderTags("lims+实验室")
 * // => ["lims", "实验室", "实验室信息管理系统", "Laboratory Information Management System", ...]
 *
 * generateFolderTags("前端开发-React")
 * // => ["前端", "开发", "react", "frontend", "前端开发", "web前端", ...]
 */
export function generateFolderTags(
  folderName: string,
  options: {
    enableSynonyms?: boolean;
    maxTags?: number;
  } = {},
): string[] {
  const { enableSynonyms = true, maxTags = 15 } = options;

  try {
    // 1. 智能拆词
    const tokens = tokenizeFolderName(folderName);

    if (tokens.length === 0) {
      // 回退：使用原始文件夹名
      return [folderName];
    }

    // 2. 同义词扩展
    const expanded = enableSynonyms ? expandSynonyms(tokens) : tokens;

    // 3. 清洗与限制
    const tags = cleanAndLimitTags(tokens, expanded, maxTags);

    logger.info(
      {
        folderName,
        tokens: tokens.length,
        expanded: expanded.length,
        final: tags.length,
      },
      "FolderTagGenerator: Tags generated",
    );

    return tags;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        folderName,
      },
      "FolderTagGenerator: Failed to generate tags",
    );

    // 错误回退：返回原始名称
    return [folderName];
  }
}

// ============================================================================
// 辅助功能
// ============================================================================

/**
 * 添加自定义同义词
 * 用于用户自定义扩展词典
 */
export function addCustomSynonyms(term: string, synonyms: string[]): void {
  const key = term.toLowerCase();
  if (SYNONYM_DICTIONARY[key]) {
    SYNONYM_DICTIONARY[key].push(...synonyms);
  } else {
    SYNONYM_DICTIONARY[key] = synonyms;
  }

  logger.info(
    { term, synonymCount: synonyms.length },
    "FolderTagGenerator: Custom synonyms added",
  );
}

/**
 * 批量生成文件夹标签（用于批量更新）
 */
export function batchGenerateFolderTags(
  folders: Array<{ id: number; name: string }>,
  options?: { enableSynonyms?: boolean; maxTags?: number },
): Array<{ folderId: number; tags: string[] }> {
  return folders.map((folder) => ({
    folderId: folder.id,
    tags: generateFolderTags(folder.name, options),
  }));
}
