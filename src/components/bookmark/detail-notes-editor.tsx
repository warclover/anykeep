/**
 * Detail Notes Editor Component
 *
 * 书签详情页的用户备注编辑区，支持内联编辑和保存。
 *
 * @version 1.1.0
 * @since 2025-12-24 (Phase 2.3.7)
 *
 * v1.1.0: 空状态显示"添加备注"按钮、提取硬编码文本到常量
 */

"use client";

import { Edit, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NOTES } from "@/lib/constants/notes-messages";

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
  // 空状态：显示"添加备注"按钮
  if (!notes && !isEditing) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3 mr-1" />
          {NOTES.EDITOR.ADD}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {NOTES.EDITOR.TITLE}
        </h3>
        {!isEditing && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit className="size-3 mr-1" />
            {NOTES.EDITOR.EDIT}
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={editedNotes}
            onChange={(e) => onEditedNotesChange(e.target.value)}
            placeholder={NOTES.EDITOR.PLACEHOLDER}
            rows={4}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave} disabled={isSaving}>
              <Check className="size-3 mr-1" />
              {isSaving ? NOTES.EDITOR.SAVING : NOTES.EDITOR.SAVE}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              <X className="size-3 mr-1" />
              {NOTES.EDITOR.CANCEL}
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
