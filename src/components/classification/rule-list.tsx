/**
 * 智能分类 v5.0 - 规则列表组件
 */

"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { RuleCard } from "./rule-card";
import { RuleEditDialog, type RuleUpdateData } from "./rule-edit-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";
import type { UserClassificationRule } from "@/lib/classification-v2/services/chat-to-rule.types";
import { API_CLASSIFICATION_V2 } from "@/lib/constants/api-paths";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RuleListProps {
  activeOnly?: boolean;
}

/**
 * 规则列表组件
 */
export const RuleList = memo(function RuleList({
  activeOnly = false,
}: RuleListProps) {
  const [rules, setRules] = useState<UserClassificationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<UserClassificationRule | null>(
    null,
  );
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const { toast } = useToast();

  // 加载规则列表
  const loadRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_CLASSIFICATION_V2.rules}?activeOnly=${activeOnly}`,
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "加载规则失败");
      }

      setRules(result.data.rules);
    } catch (error) {
      toast({
        title: "加载失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeOnly, toast]);

  // 初始加载
  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // 切换规则启用状态
  const handleToggleActive = useCallback(
    async (ruleId: number, isActive: boolean) => {
      try {
        const response = await fetch(
          `${API_CLASSIFICATION_V2.ruleDetail(ruleId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive }),
          },
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "更新规则失败");
        }

        // 更新本地状态
        setRules((prev) =>
          prev.map((rule) =>
            rule.id === ruleId ? { ...rule, isActive } : rule,
          ),
        );

        toast({
          title: "更新成功",
          description: `规则已${isActive ? "启用" : "禁用"}`,
        });
      } catch (error) {
        toast({
          title: "更新失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  // 保存规则编辑
  const handleSaveEdit = useCallback(
    async (ruleId: number, updates: RuleUpdateData) => {
      try {
        const response = await fetch(
          `${API_CLASSIFICATION_V2.ruleDetail(ruleId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          },
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "保存规则失败");
        }

        // 更新本地状态
        setRules((prev) =>
          prev.map((rule) =>
            rule.id === ruleId ? { ...rule, ...updates } : rule,
          ),
        );

        toast({
          title: "保存成功",
          description: "规则已更新",
        });
      } catch (error) {
        toast({
          title: "保存失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        });
        throw error;
      }
    },
    [toast],
  );

  // 删除规则
  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingRuleId) return;

    try {
      const response = await fetch(
        `${API_CLASSIFICATION_V2.ruleDetail(deletingRuleId)}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "删除规则失败");
      }

      // 更新本地状态
      setRules((prev) => prev.filter((rule) => rule.id !== deletingRuleId));

      toast({
        title: "删除成功",
        description: "规则已删除",
      });
    } catch (error) {
      toast({
        title: "删除失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setDeletingRuleId(null);
    }
  }, [deletingRuleId, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          {activeOnly ? "暂无启用的规则" : "暂无规则"}
        </p>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          创建规则
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rules.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onToggleActive={handleToggleActive}
            onEdit={setEditingRule}
            onDelete={setDeletingRuleId}
          />
        ))}
      </div>

      {/* 编辑对话框 */}
      <RuleEditDialog
        rule={editingRule}
        open={!!editingRule}
        onOpenChange={(open) => !open && setEditingRule(null)}
        onSave={handleSaveEdit}
      />

      {/* 删除确认对话框 */}
      <AlertDialog
        open={!!deletingRuleId}
        onOpenChange={(open) => !open && setDeletingRuleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条规则吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
