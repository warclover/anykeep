/**
 * 多用户画像类型系统
 *
 * 支持 6 大分组、25+ 画像类型
 * Phase 2 启用：pm, consultant, teacher, analyst, cert_seeker, ux_researcher + 原有 9 类
 *
 * @version 3.1.1
 * @since 2025-12-28
 */

// =============================================================================
// 画像分组
// =============================================================================

/**
 * 画像分组（6大分组 + 通用）
 */
export type PersonaGroup =
  | "academic" // 学术研究型
  | "content" // 内容创作型
  | "tech" // 技术实践型
  | "professional" // 专业服务型 [v3.1新增]
  | "design" // 产品设计型 [v3.1新增]
  | "growth" // 自我提升型 [v3.1新增]
  | "general"; // 通用

// =============================================================================
// 画像类型
// =============================================================================

/**
 * 画像类型（25+ 类型）
 *
 * Phase 2 实现：pm, consultant, teacher, analyst, cert_seeker, ux_researcher + 原有 9 类
 */
export type PersonaType =
  // 学术研究型 (5类)
  | "student" // 本科生
  | "master" // 研究生
  | "phd" // 博士生
  | "teacher" // 大学教师 [Phase 1]
  | "researcher" // 科研人员 [Phase 3]
  // 内容创作型 (5类)
  | "tech_blogger" // 科技博主
  | "knowledge_blogger" // 知识博主
  | "dev_blogger" // 技术博主
  | "online_teacher" // 在线讲师 [Phase 3]
  | "curator" // 策展人 [Phase 3]
  // 技术实践型 (5类)
  | "indie_dev" // 独立开发者
  | "ai_enthusiast" // AI发烧友
  | "creator" // 内容创作者
  | "security_researcher" // 安全研究员 [Phase 3]
  | "architect" // 技术架构师 [Phase 3]
  // 专业服务型 (5类) [v3.1新增分组]
  | "consultant" // 咨询顾问 [Phase 1]
  | "analyst" // 行业分析师 [Phase 2]
  | "lawyer" // 律师/法务 [Phase 3]
  | "medical" // 医学从业者 [Phase 3]
  | "journalist" // 记者 [Phase 3]
  // 产品设计型 (4类) [v3.1新增分组]
  | "pm" // 产品经理 [Phase 1]
  | "ux_researcher" // UX研究员 [Phase 2]
  | "game_planner" // 游戏策划 [Phase 3]
  | "trainer" // 企业培训师 [Phase 3]
  // 自我提升型 (4类) [v3.1新增分组]
  | "lifelong_learner" // 终身学习者 [Phase 3]
  | "cert_seeker" // 考证备考者 [Phase 2]
  | "career_changer" // 职业转型者 [Phase 3]
  | "language_learner" // 语言学习者 [Phase 3]
  // 通用
  | "general"; // 通用（默认）

// =============================================================================
// 画像分组映射
// =============================================================================

/**
 * 画像类型 → 分组映射
 */
export const PERSONA_GROUP_MAP: Record<PersonaType, PersonaGroup> = {
  // 学术研究型
  student: "academic",
  master: "academic",
  phd: "academic",
  teacher: "academic",
  researcher: "academic",
  // 内容创作型
  tech_blogger: "content",
  knowledge_blogger: "content",
  dev_blogger: "content",
  online_teacher: "content",
  curator: "content",
  // 技术实践型
  indie_dev: "tech",
  ai_enthusiast: "tech",
  creator: "tech",
  security_researcher: "tech",
  architect: "tech",
  // 专业服务型
  consultant: "professional",
  analyst: "professional",
  lawyer: "professional",
  medical: "professional",
  journalist: "professional",
  // 产品设计型
  pm: "design",
  ux_researcher: "design",
  game_planner: "design",
  trainer: "design",
  // 自我提升型
  lifelong_learner: "growth",
  cert_seeker: "growth",
  career_changer: "growth",
  language_learner: "growth",
  // 通用
  general: "general",
};

// =============================================================================
// Phase 2 启用列表
// =============================================================================

/**
 * Phase 2 启用的画像类型
 */
export const PHASE2_ENABLED_PERSONAS: PersonaType[] = [
  // 原有 v3.0 的 9 类
  "student",
  "master",
  "phd",
  "tech_blogger",
  "knowledge_blogger",
  "dev_blogger",
  "indie_dev",
  "ai_enthusiast",
  "creator",
  // Phase 1 新增 3 类
  "pm",
  "consultant",
  "teacher",
  // Phase 2 新增 3 类
  "analyst",
  "cert_seeker",
  "ux_researcher",
  // 通用
  "general",
];

/**
 * Phase 3 启用的画像类型（全部 25 类）
 */
export const PHASE3_ENABLED_PERSONAS: PersonaType[] = [
  // 学术研究型 (5类)
  "student",
  "master",
  "phd",
  "teacher",
  "researcher",
  // 内容创作型 (5类)
  "tech_blogger",
  "knowledge_blogger",
  "dev_blogger",
  "online_teacher",
  "curator",
  // 技术实践型 (5类)
  "indie_dev",
  "ai_enthusiast",
  "creator",
  "security_researcher",
  "architect",
  // 专业服务型 (5类)
  "consultant",
  "analyst",
  "lawyer",
  "medical",
  "journalist",
  // 产品设计型 (4类)
  "pm",
  "ux_researcher",
  "game_planner",
  "trainer",
  // 自我提升型 (4类)
  "lifelong_learner",
  "cert_seeker",
  "career_changer",
  "language_learner",
  // 通用
  "general",
];

/**
 * Phase 1 启用的画像类型（向后兼容）
 * @deprecated 使用 PHASE2_ENABLED_PERSONAS
 */
export const PHASE1_ENABLED_PERSONAS: PersonaType[] = [
  "student",
  "master",
  "phd",
  "tech_blogger",
  "knowledge_blogger",
  "dev_blogger",
  "indie_dev",
  "ai_enthusiast",
  "creator",
  "pm",
  "consultant",
  "teacher",
  "general",
];

/**
 * 检查画像类型是否在当前阶段启用
 * Phase 3: 全部 25 类画像已启用
 */
export function isPersonaEnabled(persona: PersonaType): boolean {
  return PHASE3_ENABLED_PERSONAS.includes(persona);
}

/**
 * 检查画像类型是否在 Phase 1 启用
 * @deprecated 使用 isPersonaEnabled
 */
export function isPhase1Enabled(persona: PersonaType): boolean {
  return PHASE1_ENABLED_PERSONAS.includes(persona);
}

// =============================================================================
// 画像元数据
// =============================================================================

/**
 * 画像元数据
 */
export interface PersonaMetadata {
  /** 画像类型 */
  type: PersonaType;
  /** 画像分组 */
  group: PersonaGroup;
  /** 显示名称（中文） */
  displayName: string;
  /** 描述 */
  description: string;
  /** 是否在当前 Phase 启用 */
  enabled: boolean;
}

/**
 * 所有画像的元数据
 */
export const PERSONA_METADATA: Record<PersonaType, PersonaMetadata> = {
  // 学术研究型
  student: {
    type: "student",
    group: "academic",
    displayName: "本科生",
    description: "大学本科在读学生",
    enabled: true,
  },
  master: {
    type: "master",
    group: "academic",
    displayName: "研究生",
    description: "硕士研究生",
    enabled: true,
  },
  phd: {
    type: "phd",
    group: "academic",
    displayName: "博士生",
    description: "博士研究生",
    enabled: true,
  },
  teacher: {
    type: "teacher",
    group: "academic",
    displayName: "大学教师",
    description: "高校教师、讲师",
    enabled: true, // Phase 1 新增
  },
  researcher: {
    type: "researcher",
    group: "academic",
    displayName: "科研人员",
    description: "科研机构研究员",
    enabled: true, // Phase 3 启用
  },
  // 内容创作型
  tech_blogger: {
    type: "tech_blogger",
    group: "content",
    displayName: "科技博主",
    description: "科技领域内容创作者",
    enabled: true,
  },
  knowledge_blogger: {
    type: "knowledge_blogger",
    group: "content",
    displayName: "知识博主",
    description: "知识分享类内容创作者",
    enabled: true,
  },
  dev_blogger: {
    type: "dev_blogger",
    group: "content",
    displayName: "技术博主",
    description: "编程开发类内容创作者",
    enabled: true,
  },
  online_teacher: {
    type: "online_teacher",
    group: "content",
    displayName: "在线讲师",
    description: "在线教育内容创作者",
    enabled: true, // Phase 3 启用
  },
  curator: {
    type: "curator",
    group: "content",
    displayName: "策展人",
    description: "内容策展、资讯整合者",
    enabled: true, // Phase 3 启用
  },
  // 技术实践型
  indie_dev: {
    type: "indie_dev",
    group: "tech",
    displayName: "独立开发者",
    description: "独立软件/应用开发者",
    enabled: true,
  },
  ai_enthusiast: {
    type: "ai_enthusiast",
    group: "tech",
    displayName: "AI发烧友",
    description: "人工智能爱好者、实践者",
    enabled: true,
  },
  creator: {
    type: "creator",
    group: "tech",
    displayName: "内容创作者",
    description: "多平台内容创作者",
    enabled: true,
  },
  security_researcher: {
    type: "security_researcher",
    group: "tech",
    displayName: "安全研究员",
    description: "网络安全研究者",
    enabled: true, // Phase 3 启用
  },
  architect: {
    type: "architect",
    group: "tech",
    displayName: "技术架构师",
    description: "系统架构设计者",
    enabled: true, // Phase 3 启用
  },
  // 专业服务型
  consultant: {
    type: "consultant",
    group: "professional",
    displayName: "咨询顾问",
    description: "管理/战略咨询顾问",
    enabled: true, // Phase 1 新增
  },
  analyst: {
    type: "analyst",
    group: "professional",
    displayName: "行业分析师",
    description: "行业研究、投资分析师",
    enabled: true, // Phase 2 启用
  },
  lawyer: {
    type: "lawyer",
    group: "professional",
    displayName: "律师/法务",
    description: "法律从业者",
    enabled: true, // Phase 3 启用
  },
  medical: {
    type: "medical",
    group: "professional",
    displayName: "医学从业者",
    description: "医疗健康领域从业者",
    enabled: true, // Phase 3 启用
  },
  journalist: {
    type: "journalist",
    group: "professional",
    displayName: "记者",
    description: "新闻媒体从业者",
    enabled: true, // Phase 3 启用
  },
  // 产品设计型
  pm: {
    type: "pm",
    group: "design",
    displayName: "产品经理",
    description: "互联网产品经理",
    enabled: true, // Phase 1 新增
  },
  ux_researcher: {
    type: "ux_researcher",
    group: "design",
    displayName: "UX研究员",
    description: "用户体验研究员",
    enabled: true, // Phase 2 启用
  },
  game_planner: {
    type: "game_planner",
    group: "design",
    displayName: "游戏策划",
    description: "游戏设计策划师",
    enabled: true, // Phase 3 启用
  },
  trainer: {
    type: "trainer",
    group: "design",
    displayName: "企业培训师",
    description: "企业内训师",
    enabled: true, // Phase 3 启用
  },
  // 自我提升型
  lifelong_learner: {
    type: "lifelong_learner",
    group: "growth",
    displayName: "终身学习者",
    description: "持续学习进步者",
    enabled: true, // Phase 3 启用
  },
  cert_seeker: {
    type: "cert_seeker",
    group: "growth",
    displayName: "考证备考者",
    description: "职业资格考试备考者",
    enabled: true, // Phase 2 启用
  },
  career_changer: {
    type: "career_changer",
    group: "growth",
    displayName: "职业转型者",
    description: "职业转型中的人群",
    enabled: true, // Phase 3 启用
  },
  language_learner: {
    type: "language_learner",
    group: "growth",
    displayName: "语言学习者",
    description: "外语学习者",
    enabled: true, // Phase 3 启用
  },
  // 通用
  general: {
    type: "general",
    group: "general",
    displayName: "通用",
    description: "默认画像，适用于所有用户",
    enabled: true,
  },
};

/**
 * 获取画像元数据
 */
export function getPersonaMetadata(type: PersonaType): PersonaMetadata {
  return PERSONA_METADATA[type];
}

/**
 * 获取分组下的所有画像
 */
export function getPersonasByGroup(group: PersonaGroup): PersonaType[] {
  return Object.entries(PERSONA_GROUP_MAP)
    .filter(([, g]) => g === group)
    .map(([persona]) => persona as PersonaType);
}

/**
 * 获取所有启用的画像
 */
export function getEnabledPersonas(): PersonaType[] {
  return Object.entries(PERSONA_METADATA)
    .filter(([, meta]) => meta.enabled)
    .map(([type]) => type as PersonaType);
}

// =============================================================================
// 画像配置接口 (Phase 2)
// =============================================================================

/**
 * 行为信号定义
 *
 * 用于推断用户画像的收藏行为特征
 */
export interface BehaviorSignals {
  /** 标签匹配模式（正则表达式） */
  tagPatterns: RegExp[];
  /** 偏好平台列表 */
  platformPreferences: string[];
  /** 内容类型列表 */
  contentTypes: string[];
  /** 文件夹命名模式（正则表达式） */
  folderPatterns: RegExp[];
  /** 域名模式（可选） */
  domainPatterns?: RegExp[];
}

/**
 * 画像偏好默认值
 */
export interface PersonaPreferences {
  /** 响应风格 */
  responseStyle: "concise" | "detailed" | "auto";
  /** 是否主动提醒 */
  proactiveReminders: boolean;
  /** 是否使用学术引用 */
  academicCitations: boolean;
  /** 是否显示代码块 */
  codeBlocks: boolean;
  /** Emoji 风格 */
  emojiStyle: "none" | "minimal" | "rich";
  /** 语言偏好 */
  language: "zh-CN" | "en-US" | "auto";
}

/**
 * 画像配置
 *
 * 定义画像的完整配置，包括行为信号、意图权重、Prompt 等
 */
export interface PersonaConfig {
  /** 画像 ID */
  id: PersonaType;
  /** 所属分组 */
  group: PersonaGroup;
  /** 显示名称 */
  name: string;
  /** 图标 */
  icon: string;
  /** 描述 */
  description: string;

  /** 行为信号（用于推断） */
  behaviorSignals: BehaviorSignals;

  /** 意图权重映射（意图ID → 权重倍数） */
  intentBoosts: Record<string, number>;

  /** System Prompt 模板键名 */
  promptKey: string;

  /** 偏好默认值 */
  defaultPreferences: PersonaPreferences;
}

/**
 * 默认画像偏好
 */
export const DEFAULT_PERSONA_PREFERENCES: PersonaPreferences = {
  responseStyle: "auto",
  proactiveReminders: true,
  academicCitations: false,
  codeBlocks: false,
  emojiStyle: "minimal",
  language: "auto",
};
