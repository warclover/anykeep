/**
 * 智能分类 v5.0 - 规则编辑对话框
 */

"use client";

import { memo, useCallback, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import type { UserClassificationRule } from "@/lib/classification/v5/chat-to-rule/types";

interface RuleEditDialogProps {
  rule: UserClassificationRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (ruleId: number, updates: RuleUpdateData) => Promise<void>;
}

export interface RuleUpdateData {
  pattern: string;
  description: string;
  confidence: number;
}

/**
 * 规则编辑对话框
 */
export const RuleEditDialog = memo(function RuleEditDialog({
  rule,
  open,
  onOpenChange,
  onSave,
}: RuleEditDialogProps) {
  const [pattern, setPattern] = useState("");
  const [description, setDescription] = useState("");
  const [confidence, setConfidence] = useState(0.8);
  const [isSaving, setIsSaving] = useState(false);

  // 当规则变化时，更新表单
  useEffect(() => {
    if (rule) {
      setPattern(rule.pattern);
      setDescription(rule.description || "");
      setConfidence(rule.confidence);
    }
  }, [rule]);

  const handleSave = useCallback(async () => {
    if (!rule) return;

    setIsSaving(true);
    try {
      await onSave(rule.id, {
        pattern,
        description,
        confidence,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("保存规则失败:", error);
    } finally {
      setIsSaving(false);
    }
  }, [rule, pattern, description, confidence, onSave, onOpenChange]);

  if (!rule) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>编辑规则</DialogTitle>
          <DialogDescription>
            修改规则的匹配模式、描述和置信度
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 规则模式 */}
          <div className="space-y-2">
            <Label htmlFor="pattern">匹配模式</Label>
            <Input
              id="pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="输入匹配模式"
            />
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入规则描述"
              rows={3}
            />
          </div>

          {/* 置信度 */}
          <div className="space-y-2">
            <Label htmlFor="confidence">
              置信度: {Math.round(confidence * 100)}%
            </Label>
            <Slider
              id="confidence"
              value={[confidence]}
              onValueChange={(values) => setConfidence(values[0])}
              min={0}
              max={1}
              step={0.05}
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
