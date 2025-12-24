/**
 * Detail Tags Editor Component
 *
 * 书签详情页的用户标签编辑区，支持内联编辑和保存。
 *
 * @version 1.0.0
 * @since 2025-12-24 (Phase 2.3.7)
 */

"use client";

import { Edit, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// ============================================
// 类型定义
// ============================================

export interface DetailTagsEditorProps {
  /** 普通标签列表（不含用途标签） */
  regularTags: string[];
  /** 是否处于编辑模式 */
  isEditing: boolean;
  /** 编辑中的标签字符串 */
  editedTags: string;
  /** 是否正在保存 */
  isSaving: boolean;
  /** 更新编辑中的标签 */
  onEditedTagsChange: (value: string) => void;
  /** 开始编辑 */
  onEdit: () => void;
  /** 取消编辑 */
  onCancel: () => void;
  /** 保存标签 */
  onSave: () => void;
}

// ============================================
// 组件实现
// ============================================

export function DetailTagsEditor({
  regularTags,
  isEditing,
  editedTags,
  isSaving,
  onEditedTagsChange,
  onEdit,
  onCancel,
  onSave,
}: DetailTagsEditorProps) {
  // 如果没有标签且不在编辑模式，不渲染
  if (regularTags.length === 0 && !isEditing) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          我的标签
        </h3>
        {!isEditing && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit className="size-3 mr-1" />
            编辑
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <Input
            value={editedTags}
            onChange={(e) => onEditedTagsChange(e.target.value)}
            placeholder="输入标签，用逗号或空格分隔"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave} disabled={isSaving}>
              <Check className="size-3 mr-1" />
              {isSaving ? "保存中..." : "保存"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              <X className="size-3 mr-1" />
              取消
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {regularTags.map((tag) => (
            <Badge key={tag} variant="default">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
