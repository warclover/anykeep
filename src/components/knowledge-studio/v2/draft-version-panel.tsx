/**
 * Draft Version Panel - 草稿版本历史面板组件
 * @module knowledge-studio/v2
 *
 * Phase 4: 草稿迭代与反馈驱动优化
 * P2-1: 版本对比 Diff 功能
 */

"use client";

import { useState, useCallback } from "react";
import {
  History,
  CheckCircle2,
  Circle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Scissors,
  RefreshCw,
  Sparkles,
  ArrowLeftRight,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  type DraftVersion,
  formatDraftVersionTimestamp,
  getDraftSourceLabel,
  FEEDBACK_TYPES,
} from "@/lib/knowledge-studio/iteration";
import { ContentDiffViewer } from "./content-diff-viewer";

// ============================================================
// Types
// ============================================================

interface DraftVersionPanelProps {
  /** 版本列表 */
  versions: DraftVersion[];
  /** 当前版本索引 */
  currentIndex: number;
  /** 恢复版本回调 */
  onRestore: (versionId: string) => void;
  /** 是否正在恢复 */
  isRestoring?: boolean;
  /** 是否可折叠 */
  collapsible?: boolean;
  /** 默认展开状态 */
  defaultOpen?: boolean;
  /** P2-1: 当前版本内容（用于 Diff 对比） */
  currentContent?: string;
}

/** P2-1: 对比对话框状态 */
interface DiffDialogState {
  open: boolean;
  compareVersion: DraftVersion | null;
}

// ============================================================
// Version Item
// ============================================================

interface VersionItemProps {
  version: DraftVersion;
  isCurrent: boolean;
  onRestore: () => void;
  isRestoring: boolean;
  /** P2-1: 对比回调 */
  onCompare?: () => void;
  /** P2-1: 是否显示对比按钮 */
  showCompareButton?: boolean;
}

function VersionItem({
  version,
  isCurrent,
  onRestore,
  isRestoring,
  onCompare,
  showCompareButton = false,
}: VersionItemProps) {
  // Get source icon
  const getSourceIcon = () => {
    switch (version.source) {
      case "initial":
        return <Sparkles className="h-3.5 w-3.5" />;
      case "condense":
        return <Scissors className="h-3.5 w-3.5" />;
      case "iteration":
        return <RefreshCw className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  // Get feedback badge
  const getFeedbackBadge = () => {
    if (!version.feedback) return null;
    const feedbackInfo = FEEDBACK_TYPES[version.feedback.type];
    return (
      <Badge variant="outline" className="text-xs">
        {feedbackInfo.icon} {feedbackInfo.label}
      </Badge>
    );
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        isCurrent
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/30",
      )}
    >
      {/* Status indicator */}
      <div className="mt-0.5">
        {isCurrent ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">v{version.version}</span>
          <span className="text-sm text-muted-foreground">
            {getDraftSourceLabel(version)}
          </span>
          {isCurrent && (
            <Badge variant="secondary" className="text-xs">
              当前
            </Badge>
          )}
          {getFeedbackBadge()}
        </div>

        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            {getSourceIcon()}
            {version.wordCount.toLocaleString()} 字
          </span>
          <span>{formatDraftVersionTimestamp(version.timestamp)}</span>
        </div>

        {/* Feedback comment preview */}
        {version.feedback?.comment && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">
            &quot;{version.feedback.comment}&quot;
          </p>
        )}
      </div>

      {/* P2-1: Compare button + Restore button */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Compare with current button */}
        {showCompareButton && !isCurrent && onCompare && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCompare}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>与当前版本对比</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Restore button */}
        {!isCurrent && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRestore}
                  disabled={isRestoring}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>恢复到此版本</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Draft Version Panel
// ============================================================

export function DraftVersionPanel({
  versions,
  currentIndex,
  onRestore,
  isRestoring = false,
  collapsible = true,
  defaultOpen = false,
  currentContent,
}: DraftVersionPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  // P2-1: Diff 对话框状态
  const [diffDialog, setDiffDialog] = useState<DiffDialogState>({
    open: false,
    compareVersion: null,
  });

  const handleRestore = useCallback(
    (versionId: string) => {
      onRestore(versionId);
    },
    [onRestore],
  );

  // P2-1: 打开对比对话框
  const handleCompare = useCallback((version: DraftVersion) => {
    setDiffDialog({ open: true, compareVersion: version });
  }, []);

  // P2-1: 关闭对比对话框
  const handleCloseDiffDialog = useCallback(() => {
    setDiffDialog({ open: false, compareVersion: null });
  }, []);

  // No versions
  if (versions.length === 0) {
    return null;
  }

  // P2-1: 是否显示对比按钮（需要有当前内容且版本数 > 1）
  const showCompareButton = !!currentContent && versions.length > 1;

  const content = (
    <div className="space-y-2">
      {versions.map((version, index) => (
        <VersionItem
          key={version.id}
          version={version}
          isCurrent={index === currentIndex}
          onRestore={() => handleRestore(version.id)}
          isRestoring={isRestoring}
          showCompareButton={showCompareButton}
          onCompare={() => handleCompare(version)}
        />
      ))}
    </div>
  );

  // P2-1: Diff 对话框组件
  const diffDialogComponent = diffDialog.compareVersion && currentContent && (
    <Dialog open={diffDialog.open} onOpenChange={handleCloseDiffDialog}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            版本对比
          </DialogTitle>
          <DialogDescription>
            对比 v{diffDialog.compareVersion.version} 与当前版本的差异
          </DialogDescription>
        </DialogHeader>
        <ContentDiffViewer
          before={diffDialog.compareVersion.content}
          after={currentContent}
          defaultExpanded={true}
          maxHeight="400px"
        />
      </DialogContent>
    </Dialog>
  );

  if (!collapsible) {
    return (
      <>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">版本历史</h3>
            <Badge variant="secondary" className="text-xs">
              {versions.length}
            </Badge>
          </div>
          {content}
        </div>
        {diffDialogComponent}
      </>
    );
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-3 py-2 h-auto"
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">版本历史</span>
              <Badge variant="secondary" className="text-xs">
                {versions.length}
              </Badge>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">{content}</CollapsibleContent>
      </Collapsible>
      {diffDialogComponent}
    </>
  );
}

export default DraftVersionPanel;
