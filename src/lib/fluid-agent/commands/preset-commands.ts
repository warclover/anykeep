import type { PresetCommand } from "../types";

export const presetCommands: PresetCommand[] = [
  {
    id: "translate",
    keywords: ["翻译", "翻成中文", "translate", "zh"],
    name: "翻译",
    description: "将选中内容翻译为中文",
    icon: "🌐",
    action: "translate_batch",
    tools: ["translate"],
    requiresSelection: true,
  },
  {
    id: "summarize",
    keywords: ["摘要", "总结", "summary", "summarize"],
    name: "生成摘要",
    description: "为选中内容生成AI摘要",
    icon: "📝",
    action: "generate_summary",
    tools: ["summarize"],
    requiresSelection: true,
  },
  {
    id: "deduplicate",
    keywords: ["去重", "删除重复", "dedupe", "deduplicate"],
    name: "去重清理",
    description: "检测并删除重复的书签",
    icon: "🧹",
    action: "deduplicate",
    tools: ["deduplicate"],
    requiresSelection: true,
  },
  {
    id: "archive",
    keywords: ["归档", "整理", "archive", "organize"],
    name: "智能归档",
    description: "自动将书签归类到合适的文件夹",
    icon: "📁",
    action: "smart_archive",
    tools: ["archive", "folder_recommend"],
    requiresSelection: true,
  },
  {
    id: "tag",
    keywords: ["标签", "打标", "tag", "label"],
    name: "智能标签",
    description: "自动为书签添加合适的标签",
    icon: "🏷️",
    action: "smart_tagging",
    tools: ["tag_suggest"],
    requiresSelection: true,
  },
  {
    id: "extract_pdf",
    keywords: ["提取PDF", "PDF文本", "extract pdf", "pdf text"],
    name: "提取PDF文本",
    description: "从PDF文件中提取文本内容",
    icon: "📄",
    action: "extract_pdf_text",
    tools: ["pdf_extract"],
    requiresSelection: true,
  },
  {
    id: "extract_subtitles",
    keywords: ["提取字幕", "视频字幕", "subtitles", "captions"],
    name: "提取字幕",
    description: "从视频中提取字幕内容",
    icon: "🎬",
    action: "extract_subtitles",
    tools: ["subtitle_extract"],
    requiresSelection: true,
  },
  {
    id: "weekly_report",
    keywords: ["周报", "本周总结", "weekly", "week report"],
    name: "生成周报",
    description: "生成本周收藏内容的总结报告",
    icon: "📊",
    action: "generate_weekly_report",
    tools: ["report_generate"],
    requiresSelection: false,
  },
  {
    id: "search",
    keywords: ["搜索", "查找", "search", "find"],
    name: "语义搜索",
    description: "使用AI语义搜索收藏内容",
    icon: "🔍",
    action: "semantic_search",
    tools: ["search"],
    requiresSelection: false,
  },
  {
    id: "export",
    keywords: ["导出", "下载", "export", "download"],
    name: "导出数据",
    description: "导出选中的书签数据",
    icon: "📤",
    action: "export_data",
    tools: ["export"],
    requiresSelection: true,
  },
];

/**
 * 根据ID获取预设命令
 */
export function getCommandById(id: string): PresetCommand | undefined {
  return presetCommands.find((cmd) => cmd.id === id);
}

/**
 * 获取所有需要选择的命令
 */
export function getSelectionRequiredCommands(): PresetCommand[] {
  return presetCommands.filter((cmd) => cmd.requiresSelection);
}

/**
 * 获取所有不需要选择的命令
 */
export function getGlobalCommands(): PresetCommand[] {
  return presetCommands.filter((cmd) => !cmd.requiresSelection);
}
