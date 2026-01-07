/**
 * Outline Template Service - 大纲模板服务
 * @module knowledge-studio/v2
 *
 * P2-3: 大纲模板保存与复用
 * 使用 localStorage 存储用户保存的大纲模板
 */

import type { BlueprintOutline } from "@/lib/knowledge-studio/blueprint/types";

// ============================================================
// Types
// ============================================================

export interface OutlineTemplate {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 创建时间 */
  createdAt: number;
  /** 关联的蓝图 ID */
  blueprintId: string;
  /** 大纲数据 */
  outline: BlueprintOutline;
  /** 用户备注 */
  description?: string;
}

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = "ks_outline_templates";
const MAX_TEMPLATES = 20;

// ============================================================
// Helpers
// ============================================================

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 从 localStorage 获取模板列表
 */
function getTemplatesFromStorage(): OutlineTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * 保存模板列表到 localStorage
 */
function saveTemplatesToStorage(templates: OutlineTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Storage quota exceeded or other error - fail silently
  }
}

// ============================================================
// Service Functions
// ============================================================

/**
 * 获取所有模板
 */
export function getAllOutlineTemplates(): OutlineTemplate[] {
  return getTemplatesFromStorage();
}

/**
 * 获取指定蓝图的模板
 */
export function getOutlineTemplatesByBlueprint(
  blueprintId: string,
): OutlineTemplate[] {
  const templates = getTemplatesFromStorage();
  return templates.filter((t) => t.blueprintId === blueprintId);
}

/**
 * 获取单个模板
 */
export function getOutlineTemplateById(
  id: string,
): OutlineTemplate | undefined {
  const templates = getTemplatesFromStorage();
  return templates.find((t) => t.id === id);
}

/**
 * 保存新模板
 */
export function saveOutlineTemplate(
  name: string,
  blueprintId: string,
  outline: BlueprintOutline,
  description?: string,
): OutlineTemplate {
  const templates = getTemplatesFromStorage();

  // 限制模板数量
  if (templates.length >= MAX_TEMPLATES) {
    // 删除最旧的模板
    templates.sort((a, b) => a.createdAt - b.createdAt);
    templates.shift();
  }

  const newTemplate: OutlineTemplate = {
    id: generateId(),
    name,
    createdAt: Date.now(),
    blueprintId,
    outline,
    description,
  };

  templates.push(newTemplate);
  saveTemplatesToStorage(templates);

  return newTemplate;
}

/**
 * 更新模板
 */
export function updateOutlineTemplate(
  id: string,
  updates: Partial<Pick<OutlineTemplate, "name" | "description" | "outline">>,
): OutlineTemplate | undefined {
  const templates = getTemplatesFromStorage();
  const index = templates.findIndex((t) => t.id === id);

  if (index === -1) return undefined;

  templates[index] = {
    ...templates[index],
    ...updates,
  };

  saveTemplatesToStorage(templates);
  return templates[index];
}

/**
 * 删除模板
 */
export function deleteOutlineTemplate(id: string): boolean {
  const templates = getTemplatesFromStorage();
  const index = templates.findIndex((t) => t.id === id);

  if (index === -1) return false;

  templates.splice(index, 1);
  saveTemplatesToStorage(templates);
  return true;
}

/**
 * 检查模板名称是否已存在
 */
export function isTemplateNameExists(
  name: string,
  blueprintId: string,
  excludeId?: string,
): boolean {
  const templates = getTemplatesFromStorage();
  return templates.some(
    (t) =>
      t.blueprintId === blueprintId &&
      t.name.toLowerCase() === name.toLowerCase() &&
      t.id !== excludeId,
  );
}
