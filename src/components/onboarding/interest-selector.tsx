"use client";

/**
 * 兴趣选择组件
 * 用于注册引导流程中的兴趣领域选择
 */

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PRESET_INTEREST_DOMAINS,
  getSuggestedFolders,
  type PresetInterestId,
} from "@/lib/classification";

interface InterestSelectorProps {
  /** 已选择的兴趣 ID 列表 */
  selectedInterests: PresetInterestId[];
  /** 选择变更回调 */
  onSelectionChange: (interests: PresetInterestId[]) => void;
  /** 确认回调 */
  onConfirm?: () => void;
  /** 跳过回调 */
  onSkip?: () => void;
  /** 是否显示预览 */
  showPreview?: boolean;
  /** 最大可选数量 */
  maxSelection?: number;
  /** 是否正在加载 */
  isLoading?: boolean;
}

// 按类别分组的兴趣领域
const INTEREST_CATEGORIES = [
  {
    key: "tech",
    name: "技术",
    ids: ["tech_frontend", "tech_backend", "tech_ai", "tech_mobile"],
  },
  { key: "design", name: "设计", ids: ["design_ui", "design_graphic"] },
  { key: "business", name: "产品/运营", ids: ["product", "marketing"] },
  {
    key: "lifestyle",
    name: "生活/学习",
    ids: ["reading", "investment", "lifestyle", "learning"],
  },
] as const;

export function InterestSelector({
  selectedInterests,
  onSelectionChange,
  onConfirm,
  onSkip,
  showPreview = true,
  maxSelection = 12,
  isLoading = false,
}: InterestSelectorProps) {
  // 切换兴趣选择
  const toggleInterest = (interestId: PresetInterestId) => {
    if (selectedInterests.includes(interestId)) {
      onSelectionChange(selectedInterests.filter((id) => id !== interestId));
    } else if (selectedInterests.length < maxSelection) {
      onSelectionChange([...selectedInterests, interestId]);
    }
  };

  // 获取预览文件夹
  const previewFolders = useMemo(() => {
    return getSuggestedFolders(selectedInterests).slice(0, 7);
  }, [selectedInterests]);

  return (
    <div className="space-y-6">
      {/* 分类选择区域 */}
      <div className="space-y-4">
        {INTEREST_CATEGORIES.map((category) => (
          <div key={category.key} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {category.name}
            </h3>
            <div className="flex flex-wrap gap-2">
              {category.ids.map((id) => {
                const interestId = id as PresetInterestId;
                const domain = PRESET_INTEREST_DOMAINS[interestId];
                const isSelected = selectedInterests.includes(interestId);

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleInterest(interestId)}
                    disabled={
                      !isSelected && selectedInterests.length >= maxSelection
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      "border-2 hover:shadow-sm",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted bg-background text-foreground hover:border-muted-foreground/50",
                      !isSelected &&
                        selectedInterests.length >= maxSelection &&
                        "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <span>{domain.icon}</span>
                    <span>{domain.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 已选数量提示 */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>已选择 {selectedInterests.length} 个领域</span>
        {selectedInterests.length >= maxSelection && (
          <span className="text-orange-500">已达最大数量</span>
        )}
      </div>

      {/* 预览将创建的文件夹 */}
      {showPreview && previewFolders.length > 0 && (
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <CardDescription>
              根据你的选择，我们将创建以下文件夹：
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {previewFolders.map((folder) => (
                <Badge key={folder} variant="secondary">
                  {folder}
                </Badge>
              ))}
              {previewFolders.length <
                getSuggestedFolders(selectedInterests).length && (
                <Badge variant="outline">
                  +
                  {getSuggestedFolders(selectedInterests).length -
                    previewFolders.length}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center justify-between pt-4">
        {onSkip && (
          <Button variant="ghost" onClick={onSkip} disabled={isLoading}>
            跳过，稍后设置
          </Button>
        )}
        {onConfirm && (
          <Button
            onClick={onConfirm}
            disabled={isLoading || selectedInterests.length === 0}
            className="ml-auto"
          >
            {isLoading ? "创建中..." : "确认并开始使用"}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * 兴趣选择对话框
 * 完整的兴趣选择流程，包含标题和说明
 */
interface InterestSelectorDialogContentProps {
  selectedInterests: PresetInterestId[];
  onSelectionChange: (interests: PresetInterestId[]) => void;
  onConfirm: () => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export function InterestSelectorDialogContent({
  selectedInterests,
  onSelectionChange,
  onConfirm,
  onSkip,
  isLoading,
}: InterestSelectorDialogContentProps) {
  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl">👋 欢迎来到 AnyKeep！</CardTitle>
        <CardDescription className="text-base">
          为了帮你更好地整理收藏，请选择你感兴趣的领域（可多选）
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InterestSelector
          selectedInterests={selectedInterests}
          onSelectionChange={onSelectionChange}
          onConfirm={onConfirm}
          onSkip={onSkip}
          isLoading={isLoading}
        />
      </CardContent>
    </Card>
  );
}

export default InterestSelector;
