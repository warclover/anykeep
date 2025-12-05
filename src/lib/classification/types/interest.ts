/**
 * Interest-related type definitions
 */

/**
 * Preset interest domain ID
 */
export type PresetInterestId =
  | "tech_frontend"
  | "tech_backend"
  | "tech_ai"
  | "tech_mobile"
  | "design_ui"
  | "design_graphic"
  | "product"
  | "marketing"
  | "reading"
  | "investment"
  | "lifestyle"
  | "learning";

/**
 * Interest category
 */
export type InterestCategory = "tech" | "design" | "business" | "lifestyle";

/**
 * Preset interest domain definition
 */
export interface PresetInterestDomain {
  name: string;
  icon: string;
  category: InterestCategory;
  keywords: string[];
  suggestedFolders: string[];
}

/**
 * Custom interest from database
 */
export interface CustomInterest {
  id: string;
  userId: string;
  name: string;
  icon: string;
  keywords: string[];
  suggestedFolders: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Custom interest input for creation
 */
export interface CustomInterestInput {
  name: string;
  icon: string;
  keywords: string[];
  suggestedFolders: string[];
}

/**
 * User interest configuration
 */
export interface UserInterestConfig {
  presetInterests: PresetInterestId[];
  customInterestIds: string[];
}

/**
 * Full user interest config with details
 */
export interface UserInterestConfigFull {
  presetInterests: PresetInterestId[];
  customInterests: CustomInterest[];
}

/**
 * Extended user profile (optional)
 */
export interface ExtendedUserProfile {
  occupation?: {
    type:
      | "developer"
      | "designer"
      | "product_manager"
      | "marketer"
      | "student"
      | "other";
    industry?: string;
    yearsOfExperience?: number;
  };
  usageScenarios?: Array<
    "learning" | "work_reference" | "inspiration" | "entertainment" | "research"
  >;
  contentPreferences?: {
    preferredPlatforms: string[];
    preferredFormats: string[];
    averageReadingTime?: number;
  };
  classificationStyle?: {
    granularity: "coarse" | "medium" | "fine";
    namingPattern: "topic" | "purpose" | "mixed";
    averageFolderSize: number;
  };
}

/**
 * User profile settings
 */
export interface UserProfileSettings {
  theme?: string;
  auto_tag?: boolean;
  interest_config?: UserInterestConfig;
  classification_stage?: string;
  onboarding_completed_at?: string;
  last_inbox_organize_at?: string;
  extended_profile?: ExtendedUserProfile;
}

// ============================================
// Interest Profile V2 - 渐进式学习系统
// ============================================

/**
 * 兴趣来源类型
 * - manual: 用户手动输入
 * - imported: 从导入书签分析
 * - learned: 从日常使用行为学习
 */
export type InterestSource = "manual" | "imported" | "learned";

/**
 * 用户阶段
 * - cold_start: 冷启动（0-20 书签，系统了解不足）
 * - learning: 学习期（21-100 书签，持续优化）
 * - mature: 成熟期（100+ 书签，稳定分类）
 */
export type UserStage = "cold_start" | "learning" | "mature";

/**
 * 手动输入来源详情
 */
export interface ManualSourceDetail {
  /** 用户原始输入文本 */
  rawText: string;
  /** 解析时间 */
  parsedAt: Date;
}

/**
 * 导入分析来源详情
 */
export interface ImportedSourceDetail {
  /** 分析的书签数量 */
  bookmarkCount: number;
  /** 分析时间 */
  analyzedAt: Date;
  /** 导入来源（如 chrome, edge, firefox） */
  importSource?: string;
}

/**
 * 行为学习来源详情
 */
export interface LearnedSourceDetail {
  /** 学习的书签数量 */
  bookmarkCount: number;
  /** 最后更新时间 */
  lastUpdatedAt: Date;
}

/**
 * 兴趣来源集合
 */
export interface InterestSources {
  manual?: ManualSourceDetail;
  imported?: ImportedSourceDetail;
  learned?: LearnedSourceDetail;
}

/**
 * 单个兴趣关键词
 */
export interface InterestKeyword {
  /** 关键词 */
  keyword: string;
  /** 权重（0-1） */
  weight: number;
  /** 来源 */
  source: InterestSource;
  /** 相关书签数量（可选） */
  bookmarkCount?: number;
}

/**
 * 用户兴趣画像 V2
 * 核心设计原则：
 * 1. 零障碍 - 用户什么都不填也能工作
 * 2. 渐进式 - 随使用越来越精准
 * 3. 多来源 - 手动/导入/学习三种方式互补
 */
export interface UserInterestProfile {
  /** 用户 ID */
  userId: string;

  /** 兴趣来源详情 */
  sources: InterestSources;

  /** 兴趣关键词列表（按权重降序） */
  interests: InterestKeyword[];

  /** 用户阶段 */
  stage: UserStage;

  /** 整体置信度（0-100） */
  confidence: number;

  /** 创建时间 */
  createdAt: Date;

  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 兴趣画像创建输入
 */
export interface InterestProfileInput {
  /** 手动输入的兴趣描述（可选） */
  manualDescription?: string;
}

/**
 * 兴趣画像更新输入
 */
export interface InterestProfileUpdateInput {
  /** 新的手动输入描述 */
  manualDescription?: string;
  /** 是否重新分析导入书签 */
  reanalyzeImported?: boolean;
  /** 是否重新学习行为 */
  relearnBehavior?: boolean;
}

/**
 * 书签分析结果（用于导入分析）
 */
export interface BookmarkAnalysisResult {
  /** 提取的关键词 */
  keywords: Array<{
    keyword: string;
    count: number;
    weight: number;
  }>;
  /** 分析的书签总数 */
  totalBookmarks: number;
  /** 有效分析的书签数（有标签或摘要） */
  validBookmarks: number;
  /** 建议的文件夹 */
  suggestedFolders: string[];
}
