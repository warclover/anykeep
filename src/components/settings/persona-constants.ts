/**
 * 用户画像设置 - 常量、类型、辅助函数
 *
 * 从 persona-settings-card.tsx 提取
 */

import {
  GraduationCap,
  Briefcase,
  Palette,
  TrendingUp,
  Code2,
  PenTool,
  BookOpen,
} from "lucide-react";
import type { PersonaType, PersonaGroup } from "@/lib/ai-agent/personas/types";
import { PERSONA_METADATA } from "@/lib/ai-agent/personas/types";

// ============================================================================
// UI 文本常量
// ============================================================================

export const UI_TEXT = {
  title: "AI 个性化",
  version: "Phase 4",
  description: "让 AI 更懂你的使用习惯和偏好",
  inferredSection: "AI 识别的你",
  basedOn: "基于你的 {count} 条收藏",
  primaryPersona: "主画像",
  confidence: "置信度",
  secondaryTraits: "次要特征",
  modeSection: "画像模式",
  useInference: "使用 AI 推断",
  useInferenceDesc: "AI 根据你的收藏行为自动识别最适合的画像",
  manualSelect: "手动选择",
  manualSelectDesc: "自己选择画像类型，覆盖 AI 推断结果",
  selectGroup: "选择分组",
  selectType: "选择画像",
  preferencesSection: "响应偏好",
  responseStyle: "响应风格",
  emojiStyle: "Emoji 风格",
  proactiveReminders: "主动提醒",
  academicCitations: "学术引用",
  saveButton: "保存设置",
  saving: "保存中...",
  saved: "已保存",
  resetButton: "重置",
  restoreDefaults: "恢复默认设置",
  insufficientData: "收藏数据不足（少于 10 条），无法推断画像",
  featureDisabled: "画像功能未启用",
} as const;

// ============================================================================
// 分组配置
// ============================================================================

export const PERSONA_GROUPS = [
  {
    id: "academic" as PersonaGroup,
    icon: GraduationCap,
    name: "学术研究",
    description: "学生、教师、科研人员",
  },
  {
    id: "content" as PersonaGroup,
    icon: PenTool,
    name: "内容创作",
    description: "博主、讲师、策展人",
  },
  {
    id: "tech" as PersonaGroup,
    icon: Code2,
    name: "技术实践",
    description: "开发者、架构师、研究员",
  },
  {
    id: "professional" as PersonaGroup,
    icon: Briefcase,
    name: "专业服务",
    description: "咨询、分析、法律、医学",
  },
  {
    id: "design" as PersonaGroup,
    icon: Palette,
    name: "产品设计",
    description: "产品经理、UX、策划",
  },
  {
    id: "growth" as PersonaGroup,
    icon: TrendingUp,
    name: "自我提升",
    description: "学习、考证、转型",
  },
];

// ============================================================================
// 辅助函数
// ============================================================================

export function getPersonaIcon(group: PersonaGroup) {
  const groupConfig = PERSONA_GROUPS.find((g) => g.id === group);
  return groupConfig?.icon || BookOpen;
}

export function getPersonasByGroup(group: PersonaGroup): PersonaType[] {
  return (
    Object.entries(PERSONA_METADATA) as [
      PersonaType,
      (typeof PERSONA_METADATA)[PersonaType],
    ][]
  )
    .filter(([, meta]) => meta.group === group && meta.enabled)
    .map(([type]) => type);
}
