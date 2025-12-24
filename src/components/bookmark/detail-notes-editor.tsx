/**
 * Detail Notes Editor Component
 *
 * 书签详情页的用户备注编辑区，支持内联编辑和保存。
 *
 * @version 1.0.0
 * @since 2025-12-24 (Phase 2.3.7)
 */

"use client";

import { Edit, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ============================================
// 类型定义
// ============================================

export interface DetailNotesEditorProps {
  /** 当前备注内容 */
  notes: string | null;
  /** 是否处于编辑模式 */
  isEditing: boolean;
  /** 编辑中的备注内容 */
  editedNotes: string;
  /** 是否正在保存 */
  isSaving: boolean;
  /** 更新编辑中的备注 */
  onEditedNotesChange: (value: string) => void;
  /** 开始编辑 */
  onEdit: () => void;
  /** 取消编辑 */
  onCancel: () => void;
  /** 保存备注 */
  onSave: () => void;
}

// ============================================
// 组件实现
// ============================================

export function DetailNotesEditor({
  notes,
  isEditing,
  editedNotes,
  isSaving,
  onEditedNotesChange,
  onEdit,
  onCancel,
  onSave,
}: DetailNotesEditorProps) {
  // 如果没有备注且不在编辑模式，不渲染
  if (!notes && !isEditing) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          我的备注
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
          <Textarea
            value={editedNotes}
            onChange={(e) => onEditedNotesChange(e.target.value)}
            placeholder="输入备注..."
            rows={4}
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
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
          {notes}
        </p>
      )}
    </div>
  );
}
