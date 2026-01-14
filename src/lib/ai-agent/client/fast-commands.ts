/**
 * 客户端快捷命令系统
 *
 * 职责：
 * - 解析用户输入的快捷命令（以 / 开头）
 * - 绕过 AI 意图理解，直接返回预定义意图
 * - 支持中英文命令和简写
 *
 * 设计原则：
 * - 延迟 0ms（纯客户端执行）
 * - 覆盖高频操作（搜索、删除、导出、整理、帮助）
 * - 支持命令参数提取
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import type { IntentType } from "@/lib/ai-skills/router/types";

// ============================================
// 类型定义
// ============================================

/**
 * 快捷命令配置
 */
export interface FastCommandConfig {
  /** 意图类型 */
  intent: IntentType;
  /** 意图子类型 */
  subType: string;
  /** 是否需要确认（高风险操作） */
  requireConfirm?: boolean;
  /** 命令描述（用于帮助信息） */
  description?: string;
  /** 别名列表 */
  aliases?: string[];
}

/**
 * 解析后的快捷命令结果
 */
export interface FastCommandResult {
  /** 意图类型 */
  intent: IntentType;
  /** 意图子类型 */
  subType: string;
  /** 命令参数（命令后的文本） */
  args: string;
  /** 是否需要确认 */
  requireConfirm: boolean;
  /** 原始命令 */
  command: string;
  /** 置信度（快捷命令始终为 1.0） */
  confidence: 1.0;
  /** 来源标识 */
  source: "fast_command";
}

// ============================================
// 快捷命令映射表
// ============================================

/**
 * 快捷命令配置映射
 *
 * 命名规范：
 * - 英文命令小写，支持简写
 * - 中文命令对应常见操作词
 * - 高风险操作必须标记 requireConfirm
 */
export const FAST_COMMANDS: Record<string, FastCommandConfig> = {
  // ============================================
  // 搜索命令
  // ============================================
  "/search": {
    intent: "query",
    subType: "search",
    description: "搜索书签",
    aliases: ["/s", "/找", "/搜", "/搜索"],
  },
  "/s": {
    intent: "query",
    subType: "search",
    description: "搜索书签（简写）",
  },
  "/找": {
    intent: "query",
    subType: "search",
    description: "搜索书签",
  },
  "/搜": {
    intent: "query",
    subType: "search",
    description: "搜索书签",
  },
  "/搜索": {
    intent: "query",
    subType: "search",
    description: "搜索书签",
  },

  // ============================================
  // 列表/统计命令
  // ============================================
  "/list": {
    intent: "query",
    subType: "list",
    description: "列出书签",
    aliases: ["/ls", "/列表", "/显示"],
  },
  "/ls": {
    intent: "query",
    subType: "list",
    description: "列出书签（简写）",
  },
  "/列表": {
    intent: "query",
    subType: "list",
    description: "列出书签",
  },
  "/显示": {
    intent: "query",
    subType: "list",
    description: "显示书签列表",
  },
  "/count": {
    intent: "query",
    subType: "count",
    description: "统计书签数量",
    aliases: ["/统计", "/数量"],
  },
  "/统计": {
    intent: "query",
    subType: "count",
    description: "统计书签数量",
  },
  "/数量": {
    intent: "query",
    subType: "count",
    description: "统计书签数量",
  },

  // ============================================
  // 删除命令（高风险）
  // ============================================
  "/delete": {
    intent: "action",
    subType: "delete",
    requireConfirm: true,
    description: "删除书签（需确认）",
    aliases: ["/del", "/rm", "/删除", "/删"],
  },
  "/del": {
    intent: "action",
    subType: "delete",
    requireConfirm: true,
    description: "删除书签（简写）",
  },
  "/rm": {
    intent: "action",
    subType: "delete",
    requireConfirm: true,
    description: "删除书签（简写）",
  },
  "/删除": {
    intent: "action",
    subType: "delete",
    requireConfirm: true,
    description: "删除书签",
  },
  "/删": {
    intent: "action",
    subType: "delete",
    requireConfirm: true,
    description: "删除书签",
  },

  // ============================================
  // 导出命令
  // ============================================
  "/export": {
    intent: "create",
    subType: "export",
    description: "导出书签",
    aliases: ["/导出", "/备份"],
  },
  "/导出": {
    intent: "create",
    subType: "export",
    description: "导出书签",
  },
  "/备份": {
    intent: "create",
    subType: "share",
    description: "备份书签",
  },

  // ============================================
  // 整理命令
  // ============================================
  "/organize": {
    intent: "organize",
    subType: "cleanup",
    description: "整理书签",
    aliases: ["/整理", "/清理"],
  },
  "/整理": {
    intent: "organize",
    subType: "cleanup",
    description: "整理书签",
  },
  "/清理": {
    intent: "organize",
    subType: "cleanup",
    description: "清理书签",
  },
  "/dedupe": {
    intent: "organize",
    subType: "dedupe",
    description: "去除重复书签",
    aliases: ["/去重"],
  },
  "/去重": {
    intent: "organize",
    subType: "dedupe",
    description: "去除重复书签",
  },
  "/classify": {
    intent: "organize",
    subType: "classify",
    description: "自动分类书签",
    aliases: ["/分类"],
  },
  "/分类": {
    intent: "organize",
    subType: "classify",
    description: "自动分类书签",
  },

  // ============================================
  // 标签命令
  // ============================================
  "/tag": {
    intent: "action",
    subType: "tag",
    description: "添加标签",
    aliases: ["/标签", "/打标签"],
  },
  "/标签": {
    intent: "action",
    subType: "tag",
    description: "添加标签",
  },
  "/打标签": {
    intent: "action",
    subType: "tag",
    description: "添加标签",
  },

  // ============================================
  // 移动命令
  // ============================================
  "/move": {
    intent: "action",
    subType: "move",
    description: "移动书签到文件夹",
    aliases: ["/mv", "/移动"],
  },
  "/mv": {
    intent: "action",
    subType: "move",
    description: "移动书签（简写）",
  },
  "/移动": {
    intent: "action",
    subType: "move",
    description: "移动书签到文件夹",
  },

  // ============================================
  // 帮助命令
  // ============================================
  "/help": {
    intent: "chitchat",
    subType: "help",
    description: "显示帮助信息",
    aliases: ["/h", "/帮助", "/?"],
  },
  "/h": {
    intent: "chitchat",
    subType: "help",
    description: "显示帮助信息（简写）",
  },
  "/帮助": {
    intent: "chitchat",
    subType: "help",
    description: "显示帮助信息",
  },
  "/?": {
    intent: "chitchat",
    subType: "help",
    description: "显示帮助信息",
  },

  // ============================================
  // 摘要/TTS 命令
  // ============================================
  "/summary": {
    intent: "create",
    subType: "digest",
    description: "生成摘要",
    aliases: ["/摘要", "/总结"],
  },
  "/摘要": {
    intent: "create",
    subType: "digest",
    description: "生成摘要",
  },
  "/总结": {
    intent: "create",
    subType: "digest",
    description: "生成总结",
  },
  "/tts": {
    intent: "create",
    subType: "tts",
    description: "语音朗读",
    aliases: ["/朗读", "/读"],
  },
  "/朗读": {
    intent: "create",
    subType: "tts",
    description: "语音朗读",
  },
  "/读": {
    intent: "create",
    subType: "tts",
    description: "语音朗读",
  },
} as const;

// ============================================
// 解析函数
// ============================================

/**
 * 解析快捷命令
 *
 * @param input - 用户输入
 * @returns 解析结果，或 null 表示不是快捷命令
 *
 * @example
 * ```typescript
 * parseFastCommand('/search React')
 * // { intent: 'query', subType: 'search', args: 'React', ... }
 *
 * parseFastCommand('普通消息')
 * // null
 * ```
 */
export function parseFastCommand(input: string): FastCommandResult | null {
  const trimmed = input.trim();

  // 必须以 / 开头
  if (!trimmed.startsWith("/")) {
    return null;
  }

  // 提取命令和参数
  const firstSpaceIndex = trimmed.indexOf(" ");
  const command =
    firstSpaceIndex > 0 ? trimmed.slice(0, firstSpaceIndex) : trimmed;
  const args = firstSpaceIndex > 0 ? trimmed.slice(firstSpaceIndex + 1).trim() : "";

  // 查找命令配置（大小写不敏感）
  const normalizedCommand = command.toLowerCase();
  const config = FAST_COMMANDS[normalizedCommand];

  if (!config) {
    return null;
  }

  return {
    intent: config.intent,
    subType: config.subType,
    args,
    requireConfirm: config.requireConfirm ?? false,
    command: normalizedCommand,
    confidence: 1.0,
    source: "fast_command",
  };
}

/**
 * 检查输入是否是快捷命令
 *
 * @param input - 用户输入
 * @returns 是否是有效的快捷命令
 */
export function isFastCommand(input: string): boolean {
  return parseFastCommand(input) !== null;
}

/**
 * 获取所有可用的快捷命令列表
 *
 * @returns 命令列表，用于帮助信息
 */
export function getAllFastCommands(): Array<{
  command: string;
  description: string;
  aliases: string[];
  requireConfirm: boolean;
}> {
  const seen = new Set<string>();
  const result: Array<{
    command: string;
    description: string;
    aliases: string[];
    requireConfirm: boolean;
  }> = [];

  for (const [cmd, config] of Object.entries(FAST_COMMANDS)) {
    // 跳过别名，只处理主命令
    if (config.aliases && !seen.has(cmd)) {
      seen.add(cmd);
      config.aliases.forEach((alias) => seen.add(alias));

      result.push({
        command: cmd,
        description: config.description ?? "",
        aliases: config.aliases ?? [],
        requireConfirm: config.requireConfirm ?? false,
      });
    }
  }

  return result;
}

/**
 * 生成帮助文本
 *
 * @returns 格式化的帮助信息
 */
export function generateHelpText(): string {
  const commands = getAllFastCommands();

  const lines = [
    "## 快捷命令",
    "",
    "使用 `/命令 参数` 格式快速执行操作：",
    "",
  ];

  for (const cmd of commands) {
    const aliases =
      cmd.aliases.length > 0 ? ` (别名: ${cmd.aliases.join(", ")})` : "";
    const warning = cmd.requireConfirm ? " ⚠️" : "";
    lines.push(`- \`${cmd.command}\`${aliases}: ${cmd.description}${warning}`);
  }

  lines.push("");
  lines.push("⚠️ 标记表示需要确认的高风险操作");

  return lines.join("\n");
}
