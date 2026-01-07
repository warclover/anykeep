/**
 * Knowledge Studio v2 - Constants
 * @module knowledge-studio/v2
 */

// ============================================================
// Material Limits
// ============================================================

/** 素材选择器默认加载数量 (P0-1: 从100改为50，避免选择困难) */
export const MATERIAL_SELECTOR_LIMIT = 50;

/** 最少需要的素材数量 */
export const MIN_MATERIALS_REQUIRED = 2;

/** 最多允许的素材数量（限制为5篇以确保生成稳定性） */
export const MAX_MATERIALS_ALLOWED = 5;

/** 素材数量限制配置（Phase 1.1 优化） */
export const MATERIAL_LIMITS = {
  /** 最少素材数 */
  MIN: 2,
  /** 推荐上限（超过显示提示） */
  RECOMMENDED_MAX: 3,
  /** 硬上限 */
  HARD_MAX: 5,
  /** 警告阈值（超过显示黄色警告） */
  WARNING_THRESHOLD: 4,
} as const;

/** 素材选择器 UI 文案 */
export const MATERIAL_SELECTOR_TEXT = {
  LABEL: "精选 2-3 篇核心素材（最多 5 篇）",
  HINT: "素材越精准，生成质量越高",
  WARNING_TOO_MANY: "素材过多可能导致内容发散，建议精选 2-3 篇核心素材",
} as const;

// ============================================================
// Output Length Configuration（Phase 1.2 优化 + P3 字数选择）
// ============================================================

/** 输出长度模式配置 */
export const LENGTH_MODE_CONFIG = {
  short: {
    label: "简洁",
    description: "适合小红书、快速阅读",
    minWords: 800,
    maxWords: 1500,
    recommendedWords: 1200,
    maxOutputTokens: 2500,
    visible: true,
  },
  medium: {
    label: "标准（推荐）",
    description: "适合公众号标准文章",
    minWords: 1500,
    maxWords: 2500,
    recommendedWords: 1800,
    maxOutputTokens: 4000,
    visible: true,
  },
  long: {
    label: "详细",
    description: "适合深度分析长文",
    minWords: 2500,
    maxWords: 4000,
    recommendedWords: 3000,
    maxOutputTokens: 6000,
    visible: true,
  },
  extended: {
    label: "超长",
    description: "适合专业报告（最多6000字）",
    minWords: 4000,
    maxWords: 6000,
    recommendedWords: 5000,
    maxOutputTokens: 8192,
    visible: false, // 高级选项
  },
} as const;

export type LengthMode = keyof typeof LENGTH_MODE_CONFIG;

// ============================================================
// Platform Style Configuration（Phase 3.1）
// ============================================================

/** 平台风格配置 */
export const PLATFORM_STYLE_CONFIG = {
  wechat: {
    id: "wechat",
    label: "公众号风格",
    description: "标题吸睛、分段清晰、适当留白",
    icon: "💬",
    minWords: 1500,
    maxWords: 3000,
    features: ["吸引眼球的标题", "清晰的段落分隔", "适当留白增强可读性"],
    // P2-5: 风格预览示例
    preview: `**你真的了解时间管理吗？**

很多人觉得自己很忙，但效率却很低。

其实问题的关键不在于时间不够，而在于我们没有找到适合自己的节奏。

以下三个方法，帮你重新掌控时间：

**1. 番茄工作法**

每次专注25分钟，休息5分钟。简单却有效。

**2. 二八法则**

把80%的精力放在最重要的20%的事情上。

**3. 建立固定仪式感**

每天固定时间做固定的事，让大脑形成自动化。`,
  },
  xiaohongshu: {
    id: "xiaohongshu",
    label: "小红书风格",
    description: "短段落、emoji 点缀、口语化",
    icon: "📕",
    minWords: 600,
    maxWords: 1500,
    features: ["短段落易阅读", "emoji 点缀活泼", "口语化表达亲切"],
    // P2-5: 风格预览示例
    preview: `姐妹们！！这个时间管理方法真的绝了 ⏰✨

之前我也是每天忙到飞起
但感觉啥也没干成 😭

直到我学会了这三招 👇

🍅 番茄钟法
25分钟专注+5分钟休息
亲测超有效！

📊 二八法则
把精力花在最重要的事上
别再瞎忙了姐妹

🌅 固定仪式感
每天同一时间做同样的事
慢慢就养成习惯啦～`,
  },
  general: {
    id: "general",
    label: "通用风格",
    description: "正式书面语、结构完整",
    icon: "📝",
    minWords: 2000,
    maxWords: 5000,
    features: ["正式书面语", "结构完整", "适合多场景"],
    // P2-5: 风格预览示例
    preview: `## 时间管理的艺术：三种实用方法论

### 引言

在现代快节奏的工作生活中，时间管理能力已成为影响个人效率和生活质量的关键因素。

### 一、番茄工作法

番茄工作法由 Francesco Cirillo 于1980年代提出。该方法将工作时间划分为25分钟的专注时段，每个时段后休息5分钟。

### 二、帕累托法则（二八定律）

帕累托法则指出，约80%的结果来自20%的努力。将此原则应用于时间管理，意味着我们应当识别并优先处理那些能产生最大价值的任务。

### 三、仪式化工作习惯

建立固定的工作仪式能够降低决策疲劳，使高效工作行为逐渐成为自动化习惯。`,
  },
} as const;

export type PlatformStyle = keyof typeof PLATFORM_STYLE_CONFIG;

/** 平台风格选择器 UI 文案 */
export const PLATFORM_STYLE_TEXT = {
  LABEL: "选择输出风格",
  HINT: "不同风格适合不同平台，影响语言和排版",
} as const;

// ============================================================
// SSE Configuration
// ============================================================

/** SSE chunk 发送间隔（毫秒），用于背压控制 */
export const SSE_CHUNK_DELAY_MS = 30;

/** SSE 请求超时时间（毫秒）(P2 #6) */
export const SSE_REQUEST_TIMEOUT_MS = 300_000; // 5 minutes (长内容生成需要更多时间)

/** SSE 解析错误阈值，超过此数量视为流损坏 (P2 #4) */
export const SSE_PARSE_ERROR_THRESHOLD = 10;

// ============================================================
// Error Codes
// ============================================================

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_REQUEST: "INVALID_REQUEST",
  BLUEPRINT_NOT_FOUND: "BLUEPRINT_NOT_FOUND",
  ACCESS_DENIED: "ACCESS_DENIED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  OUTLINE_GENERATION_FAILED: "OUTLINE_GENERATION_FAILED",
  GENERATION_FAILED: "GENERATION_FAILED",
  STREAM_ERROR: "STREAM_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

// ============================================================
// UI Configuration
// ============================================================

/** 大纲编辑器默认最大高度 */
export const OUTLINE_EDITOR_MAX_HEIGHT = "400px";

/** 结构化输出查看器默认最大高度 */
export const STRUCTURED_OUTPUT_MAX_HEIGHT = "600px";
