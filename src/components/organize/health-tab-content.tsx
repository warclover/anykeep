"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QuickActionGrid } from "./quick-action-grid";
import { OrganizeProgress } from "./organize-progress";
import { OrganizeComparison } from "./organize-comparison";
import { HealthDiagnosisPanel } from "./health-diagnosis-panel";
import { IssueDetailDrawer } from "./issue-detail-drawer";
import type { OrganizePageState, QuickActionType } from "@/lib/organize/types";
import type { OrganizeSnapshot } from "@/lib/organize/types";
import type { ProgressState } from "./hooks/use-organize-flow";
import type { UseLibrarianAnalysisReturn } from "@/hooks/domain/folder/use-librarian-analysis";
import type { IssueType, ActionType } from "./issue-summary-list";

interface HealthTabContentProps {
  state: OrganizePageState;
  progress: ProgressState;
  organizeError: string | null;
  snapshotError: string | null;
  isExecuting: boolean;
  hasComparison: boolean;
  beforeSnapshot: OrganizeSnapshot | null;
  afterSnapshot: OrganizeSnapshot | null;
  librarianAnalysis: UseLibrarianAnalysisReturn;
  onOrganizeAction: (actionType: QuickActionType) => void;
  onCancel: () => void;
  onReset: () => void;
  mergeFolders: (
    sourceFolderId: number,
    targetFolderId: number,
  ) => Promise<boolean>;
  deleteFolder: (folderId: number) => Promise<boolean>;
  renameFolder: (folderId: number, newName: string) => Promise<boolean>;
  createFolder: (name: string, parentId?: number) => Promise<boolean>;
}

export function HealthTabContent({
  state,
  progress,
  organizeError,
  snapshotError,
  isExecuting,
  hasComparison,
  beforeSnapshot,
  afterSnapshot,
  librarianAnalysis,
  onOrganizeAction,
  onCancel,
  onReset,
  mergeFolders,
  deleteFolder,
  renameFolder,
  createFolder,
}: HealthTabContentProps) {
  const [showIssueDrawer, setShowIssueDrawer] = useState(false);
  const { analysis } = librarianAnalysis;

  const handleIssueAction = useCallback(
    async (_type: IssueType, itemId: number, action: ActionType) => {
      if (!analysis) return;

      switch (action) {
        case "merge": {
          const group = analysis.duplicateFolders[itemId];
          if (group && group.folders.length >= 2) {
            const suggestedTarget = group.folders.find((f) =>
              group.suggestedMerge?.includes(f.name),
            );
            const target = suggestedTarget || group.folders[0];
            const source = group.folders.find((f) => f.id !== target.id);
            if (source) {
              await mergeFolders(source.id, target.id);
            }
          }
          break;
        }
        case "delete": {
          await deleteFolder(itemId);
          break;
        }
        case "rename": {
          const namingItem = analysis.poorlyNamedFolders.find(
            (item) => item.folder.id === itemId,
          );
          if (namingItem) {
            await renameFolder(itemId, namingItem.suggestedName);
          }
          break;
        }
        case "create": {
          const missingItem = analysis.missingCategories[itemId];
          if (missingItem) {
            await createFolder(missingItem.category);
          }
          break;
        }
        case "split": {
          toast.info("拆分功能开发中，敬请期待");
          break;
        }
      }
    },
    [analysis, mergeFolders, deleteFolder, renameFolder, createFolder],
  );

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {state === "idle" && (
            <QuickActionGrid
              onAction={onOrganizeAction}
              disabled={isExecuting}
            />
          )}

          {isExecuting && (
            <OrganizeProgress
              status={state as "analyzing" | "executing"}
              message={progress.message}
              progress={progress.percent}
              currentStep={progress.step}
              onCancel={onCancel}
            />
          )}

          {state === "complete" &&
            hasComparison &&
            beforeSnapshot &&
            afterSnapshot && (
              <OrganizeComparison
                before={beforeSnapshot}
                after={afterSnapshot}
                onReset={onReset}
              />
            )}

          {state === "complete" && !hasComparison && (
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">整理完成！</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    {snapshotError || organizeError || "整理操作已完成"}
                  </p>
                </div>
                <Button onClick={onReset}>继续整理</Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <HealthDiagnosisPanel
            librarianState={{
              analysis: librarianAnalysis.analysis,
              isLoading: librarianAnalysis.isLoading,
              isAnalyzing: librarianAnalysis.isAnalyzing,
              error: librarianAnalysis.error,
              runAnalysis: librarianAnalysis.runAnalysis,
              refresh: librarianAnalysis.refresh,
            }}
            onViewAllIssues={() => setShowIssueDrawer(true)}
            onIssueAction={handleIssueAction}
            disabled={isExecuting}
          />
        </div>
      </div>

      {analysis && (
        <IssueDetailDrawer
          open={showIssueDrawer}
          onOpenChange={setShowIssueDrawer}
          duplicateFolders={analysis.duplicateFolders}
          emptyFolders={analysis.emptyFolders}
          oversizedFolders={analysis.oversizedFolders}
          poorlyNamedFolders={analysis.poorlyNamedFolders}
          missingCategories={analysis.missingCategories}
          onMerge={(groupIndex) => {
            const group = analysis.duplicateFolders[groupIndex];
            if (group && group.folders.length >= 2) {
              // 与 handleIssueAction 保持一致：优先使用 AI 推荐的合并目标
              const suggestedTarget = group.folders.find((f) =>
                group.suggestedMerge?.includes(f.name),
              );
              const target = suggestedTarget || group.folders[0];
              const source = group.folders.find((f) => f.id !== target.id);
              if (source) {
                mergeFolders(source.id, target.id);
              }
            }
          }}
          onDelete={(folderId) => deleteFolder(folderId)}
          onSplit={() => toast.info("拆分功能开发中，敬请期待")}
          onRename={(folderId, newName) => renameFolder(folderId, newName)}
          onCreate={(categoryIndex) => {
            const item = analysis.missingCategories[categoryIndex];
            if (item) {
              createFolder(item.category);
            }
          }}
        />
      )}
    </>
  );
}
