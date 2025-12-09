/**
 * V4.0 文件夹命名优化 Prompt
 *
 * 目标："信达雅"的文件夹命名
 * - 信：准确反映文件夹内容
 * - 达：简洁易懂，符合用户习惯
 * - 雅：风格统一，美观大方
 *
 * 核心功能：
 * 1. Few-Shot 学习用户命名风格
 * 2. 语义去重检测
 * 3. 中文/英文双语支持
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 命名上下文
 */
export interface NamingContext {
  /** 原始建议名称 */
  proposedName: string;

  /** 书签标题 */
  bookmarkTitle: string;

  /** 书签标签 */
  bookmarkTags: string[];

  /** 书签摘要 */
  bookmarkSummary?: string;

  /** 用户现有文件夹样本（Few-Shot） */
  existingFolders: Array<{
    name: string;
    bookmarkCount: number;
  }>;

  /** 通用分类匹配结果 */
  categoryMatch?: {
    name: string;
    suggestedName: string;
  };
}

/**
 * 语义去重检测上下文
 */
export interface DeduplicationContext {
  /** 新建议的名称 */
  newName: string;

  /** 现有文件夹名称列表 */
  existingNames: string[];
}

/**
 * 命名优化响应
 */
export interface NamingResponse {
  /** 优化后的名称 */
  optimizedName: string;

  /** 命名理由 */
  reason: string;

  /** 是否保持原名 */
  keptOriginal: boolean;

  /** 命名风格分析 */
  styleAnalysis?: {
    detectedStyle: string;
    appliedRules: string[];
  };
}

/**
 * 去重检测响应
 */
export interface DeduplicationResponse {
  /** 是否为语义重复 */
  isDuplicate: boolean;

  /** 重复的文件夹名称 */
  duplicateOf?: string;

  /** 相似度描述 */
  similarityReason?: string;

  /** 建议：使用现有 / 创建新的 / 合并 */
  suggestion: "use_existing" | "create_new" | "merge";
}

// ============================================================================
// Prompt 模板
// ============================================================================

/**
 * 命名优化系统提示词
 */
export const NAMING_SYSTEM_PROMPT = `你是一位专业的文件夹命名专家，擅长：
- 分析用户的命名风格和习惯
- 生成简洁、准确、美观的文件夹名称
- 保持命名风格的一致性
- 支持中英文双语命名

命名原则：
1. 简洁：2-6 个字/词为宜，最长不超过 10 个字
2. 准确：反映文件夹主要内容
3. 一致：与用户现有风格保持统一
4. 区分：与现有文件夹有明确区分
5. 禁忌：严禁使用"内容分类与标签管理"、"待整理"、"未命名"等泛指名称`;

/**
 * 构建命名优化 Prompt（Few-Shot）
 */
export function buildNamingPrompt(context: NamingContext): string {
  const styleSection = buildStyleSection(context.existingFolders);
  const contentSection = buildContentSection(context);

  return `${styleSection}

${contentSection}

## 任务
请为新内容生成一个符合用户风格的文件夹名称。

### 分析步骤
1. **风格识别**：用户偏好什么命名风格？（如：简短中文、英文缩写、领域+类型）
2. **内容理解**：新书签的核心主题是什么？
3. **名称生成**：生成 2-3 个候选名称（必须避开禁忌词）
4. **最优选择**：选择最符合风格且最准确的名称

### 禁忌词检测
在生成名称前，请自我检查：生成的名称是否包含"内容分类"、"标签管理"、"助手"等词？如果是，请立即更换为具体的主题名称（如"前端开发"、"效率工具"等）。

### 输出格式
\`\`\`json
{
  "styleAnalysis": {
    "detectedStyle": "用户命名风格描述",
    "patterns": ["模式1", "模式2"],
    "preferredLength": "简短/中等/详细"
  },
  "candidates": [
    { "name": "候选名1", "reason": "理由" },
    { "name": "候选名2", "reason": "理由" }
  ],
  "final": {
    "optimizedName": "最终推荐名称",
    "reason": "选择理由",
    "keptOriginal": false
  }
}
\`\`\`

只返回 JSON，不要其他内容。`;
}

/**
 * 构建风格学习部分（Few-Shot 样本）
 */
function buildStyleSection(
  existingFolders: NamingContext["existingFolders"],
): string {
  if (existingFolders.length === 0) {
    return `## 用户文件夹样本
（用户暂无文件夹，请使用通用命名风格）`;
  }

  // 按书签数量排序，取最常用的文件夹作为样本
  const samples = [...existingFolders]
    .sort((a, b) => b.bookmarkCount - a.bookmarkCount)
    .slice(0, 10);

  let section = `## 用户文件夹样本（学习命名风格）\n\n`;
  section += `以下是用户现有的文件夹名称，请分析命名风格：\n\n`;

  for (const folder of samples) {
    section += `- 「${folder.name}」(${folder.bookmarkCount} 个书签)\n`;
  }

  return section;
}

/**
 * 构建内容部分
 */
function buildContentSection(context: NamingContext): string {
  let section = `## 新书签信息\n\n`;
  section += `**标题**：${context.bookmarkTitle}\n`;
  section += `**标签**：${context.bookmarkTags.join("、") || "（无标签）"}\n`;

  if (context.bookmarkSummary) {
    section += `**摘要**：${context.bookmarkSummary}\n`;
  }

  section += `\n**AI 建议名称**：${context.proposedName}\n`;

  if (context.categoryMatch) {
    section += `**通用分类匹配**：${context.categoryMatch.name} → 「${context.categoryMatch.suggestedName}」\n`;
  }

  return section;
}

/**
 * 构建语义去重检测 Prompt
 */
export function buildDeduplicationPrompt(
  context: DeduplicationContext,
): string {
  return `## 语义去重检测

请判断新文件夹名称是否与现有文件夹语义重复。

### 新名称
「${context.newName}」

### 现有文件夹
${context.existingNames.map((n) => `- 「${n}」`).join("\n")}

### 判断标准
1. **完全重复**：名称几乎相同（如"前端"vs"前端开发"）
2. **语义重复**：含义相同但表述不同（如"JS"vs"JavaScript"）
3. **包含关系**：一个是另一个的子集（如"React"vs"React 学习"）
4. **互补关系**：可以合并使用（如"Vue2"vs"Vue3"→合并为"Vue"）

### 输出格式
\`\`\`json
{
  "isDuplicate": true/false,
  "duplicateOf": "重复的文件夹名（如有）",
  "similarityType": "exact/semantic/subset/complement/none",
  "similarityReason": "判断理由",
  "suggestion": "use_existing/create_new/merge",
  "mergeRecommendation": "合并后的名称建议（如适用）"
}
\`\`\`

只返回 JSON，不要其他内容。`;
}

// ============================================================================
// 响应解析
// ============================================================================

/**
 * 解析命名优化响应
 */
export function parseNamingResponse(content: string): NamingResponse | null {
  try {
    // 提取 JSON 部分
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;

    // 尝试找到 JSON 对象
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      return null;
    }

    const parsed = JSON.parse(objectMatch[0]);

    // 验证必要字段
    if (!parsed.final?.optimizedName) {
      return null;
    }

    return {
      optimizedName: parsed.final.optimizedName,
      reason: parsed.final.reason || "",
      keptOriginal: parsed.final.keptOriginal ?? false,
      styleAnalysis: parsed.styleAnalysis
        ? {
            detectedStyle: parsed.styleAnalysis.detectedStyle || "",
            appliedRules: parsed.styleAnalysis.patterns || [],
          }
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 解析去重检测响应
 */
export function parseDeduplicationResponse(
  content: string,
): DeduplicationResponse | null {
  try {
    // 提取 JSON 部分
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;

    // 尝试找到 JSON 对象
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      return null;
    }

    const parsed = JSON.parse(objectMatch[0]);

    return {
      isDuplicate: parsed.isDuplicate ?? false,
      duplicateOf: parsed.duplicateOf,
      similarityReason: parsed.similarityReason,
      suggestion: parsed.suggestion || "create_new",
    };
  } catch {
    return null;
  }
}

// ============================================================================
// 规则引擎（轻量级本地检测）
// ============================================================================

/**
 * 常见语义同义词映射
 * 用于本地快速去重，无需调用 AI
 */
export const SEMANTIC_SYNONYMS: Record<string, string[]> = {
  // 编程语言
  javascript: ["js", "javascript", "ecmascript", "es6", "es2015"],
  typescript: ["ts", "typescript"],
  python: ["py", "python", "python3"],
  java: ["java", "jvm"],
  golang: ["go", "golang"],
  rust: ["rust", "rs"],

  // 前端框架
  react: ["react", "reactjs", "react.js"],
  vue: ["vue", "vuejs", "vue.js", "vue2", "vue3"],
  angular: ["angular", "ng", "angularjs"],
  nextjs: ["next", "nextjs", "next.js"],
  nuxt: ["nuxt", "nuxtjs", "nuxt.js"],

  // 后端框架
  nodejs: ["node", "nodejs", "node.js"],
  express: ["express", "expressjs"],
  fastapi: ["fastapi", "fast-api"],
  django: ["django"],
  spring: ["spring", "springboot", "spring-boot"],

  // 通用技术领域
  frontend: ["前端", "前端开发", "web前端", "front-end", "frontend"],
  backend: ["后端", "后端开发", "服务端", "back-end", "backend"],
  fullstack: ["全栈", "全栈开发", "full-stack", "fullstack"],
  devops: ["devops", "运维", "dev-ops"],
  database: ["数据库", "db", "database"],
  ai: ["人工智能", "ai", "机器学习", "ml", "深度学习", "dl"],
};

/**
 * 本地语义同义词检测
 * @returns 如果找到同义词，返回标准化名称；否则返回 null
 */
export function findSemanticSynonym(name: string): string | null {
  const normalized = name.toLowerCase().replace(/[\s\-_.]/g, "");

  for (const [standard, synonyms] of Object.entries(SEMANTIC_SYNONYMS)) {
    if (synonyms.some((s) => s.replace(/[\s\-_.]/g, "") === normalized)) {
      return standard;
    }
  }

  return null;
}

/**
 * 本地快速去重检测
 * @returns 重复的文件夹名称，或 null
 */
export function quickDeduplicationCheck(
  newName: string,
  existingNames: string[],
): string | null {
  const newNormalized = newName.toLowerCase().replace(/[\s\-_.]/g, "");
  const newSynonym = findSemanticSynonym(newName);

  for (const existing of existingNames) {
    const existingNormalized = existing.toLowerCase().replace(/[\s\-_.]/g, "");
    const existingSynonym = findSemanticSynonym(existing);

    // 完全匹配（忽略空格和大小写）
    if (newNormalized === existingNormalized) {
      return existing;
    }

    // 同义词匹配
    if (newSynonym && existingSynonym && newSynonym === existingSynonym) {
      return existing;
    }

    // 包含关系检测
    if (
      newNormalized.includes(existingNormalized) ||
      existingNormalized.includes(newNormalized)
    ) {
      // 长度差异不大时才认为是重复
      if (Math.abs(newNormalized.length - existingNormalized.length) <= 4) {
        return existing;
      }
    }
  }

  return null;
}
