/**
 * 大纲版本历史组件 (Story 2.5)
 * @module knowledge-studio/outline-version-history
 *
 * 显示大纲版本历史列表，支持恢复到历史版本。
 */

"use client";

import { useState, useCallback } from "react";
import {
  History,
  RotateCcw,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OutlineVersion } from "@/lib/knowledge-studio/blueprint/outline-version-manager";
import { formatVersionTimestamp } from "@/lib/knowledge-studio/blueprint/outline-version-manager";

// ============================================================
// Types
// ============================================================

export interface OutlineVersionHistoryProps {
  /** 版本列表 */
  versions: OutlineVersion[];
  /** 当前版本 ID */
  currentVersionId?: string;
  /** 恢复版本回调 */
  onRestoreVersion: (versionId: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 类名 */
  className?: string;
}

// ============================================================
// Component
// ============================================================

export function OutlineVersionHistory({
  versions,
  currentVersionId,
  onRestoreVersion,
  disabled = false,
  className,
}: OutlineVersionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<OutlineVersion | null>(
    null,
  );

  const handleRestoreClick = useCallback((version: OutlineVersion) => {
    setRestoreTarget(version);
  }, []);

  const handleConfirmRestore = useCallback(() => {
    if (restoreTarget) {
      onRestoreVersion(restoreTarget.id);
      setRestoreTarget(null);
    }
  }, [restoreTarget, onRestoreVersion]);

  const handleCancelRestore = useCallback(() => {
    setRestoreTarget(null);
  }, []);

  if (versions.length === 0) {
    return null;
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            disabled={disabled}
          >
            <History className="size-4" />
            <span>版本历史</span>
            <Badge variant="secondary" className="ml-1">
              {versions.length}
            </Badge>
            {isOpen ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2">
          <div className="rounded-lg border bg-muted/30 p-2">
            <div className="space-y-1">
              {versions.map((version) => (
                <VersionItem
                  key={version.id}
                  version={version}
                  isCurrent={version.id === currentVersionId}
                  onRestore={() => handleRestoreClick(version)}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* 恢复确认对话框 */}
      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={() => setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>恢复版本</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreTarget && (
                <>
                  确定要恢复到版本 {restoreTarget.version}（
                  {formatVersionTimestamp(restoreTarget.timestamp)}）吗？
                  <br />
                  <span className="text-amber-600 dark:text-amber-400">
                    当前的修改将会丢失。
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelRestore}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore}>
              恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================
// VersionItem
// ============================================================

interface VersionItemProps {
  version: OutlineVersion;
  isCurrent: boolean;
  onRestore: () => void;
  disabled: boolean;
}

function VersionItem({
  version,
  isCurrent,
  onRestore,
  disabled,
}: VersionItemProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2 text-sm",
        isCurrent
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted transition-colors",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium">版本 {version.version}</span>
            {isCurrent && (
              <Badge variant="outline" className="text-xs">
                当前
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span>{formatVersionTimestamp(version.timestamp)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* 版本信息 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-xs text-muted-foreground">
                {version.outline.nodes.length} 章节 ·{" "}
                {version.outline.totalEstimatedWords}字
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>标题：{version.outline.title}</p>
              {version.description && <p>描述：{version.description}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 恢复按钮 */}
        {!isCurrent && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={onRestore}
                  disabled={disabled}
                  aria-label="恢复版本"
                >
                  <RotateCcw className="size-3.5" />
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
