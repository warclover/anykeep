/**
 * 智能分类 v5.0 - 规则卡片组件
 */

"use client";

import { memo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Target } from "lucide-react";
import type { UserClassificationRule } from "@/lib/classification/v5/chat-to-rule/types";

interface RuleCardProps {
  rule: UserClassificationRule;
  onToggleActive: (ruleId: number, isActive: boolean) => void;
  onEdit: (rule: UserClassificationRule) => void;
  onDelete: (ruleId: number) => void;
}

/**
 * 规则类型显示名称
 */
const RULE_TYPE_LABELS: Record<string, string> = {
  title: "标题规则",
  url: "URL 规则",
  content: "内容规则",
};

/**
 * 模式类型显示名称
 */
const PATTERN_TYPE_LABELS: Record<string, string> = {
  keyword: "关键词",
  domain: "域名",
  regex: "正则表达式",
};

/**
 * 规则卡片组件
 */
export const RuleCard = memo(function RuleCard({
  rule,
  onToggleActive,
  onEdit,
  onDelete,
}: RuleCardProps) {
  const handleToggleActive = useCallback(() => {
    onToggleActive(rule.id, !rule.isActive);
  }, [rule.id, rule.isActive, onToggleActive]);

  const handleEdit = useCallback(() => {
    onEdit(rule);
  }, [rule, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete(rule.id);
  }, [rule.id, onDelete]);

  return (
    <Card className={!rule.isActive ? "opacity-60" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              {rule.targetFolderName}
            </CardTitle>
            <CardDescription className="mt-1">
              {rule.description || "无描述"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={rule.isActive}
              onCheckedChange={handleToggleActive}
              aria-label="启用/禁用规则"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* 规则类型和模式类型 */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {RULE_TYPE_LABELS[rule.ruleType] || rule.ruleType}
            </Badge>
            <Badge variant="outline">
              {PATTERN_TYPE_LABELS[rule.patternType] || rule.patternType}
            </Badge>
            <Badge variant="default" className="ml-auto">
              置信度: {Math.round(rule.confidence * 100)}%
            </Badge>
          </div>

          {/* 规则模式 */}
          <div className="rounded-md bg-muted p-3">
            <code className="text-sm break-all">{rule.pattern}</code>
          </div>

          {/* 统计信息 */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>匹配次数: {rule.matchCount}</span>
            <span>创建于: {new Date(rule.createdAt).toLocaleDateString()}</span>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="flex-1"
            >
              <Pencil className="h-4 w-4 mr-1" />
              编辑
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="flex-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
