"use client";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileUploader } from "./file-uploader";
import { SourceSelector } from "./source-selector";
import { BookmarkTree } from "./bookmark-tree";
import { ImportOptions } from "./import-options";
import { ImportProgress } from "./import-progress";
import { ImportResult } from "./import-result";
import { DepthWarning } from "./depth-warning";
import { PlatformFilter } from "./platform-filter";
import { IMPORT_DIALOG_STEPS, MAX_FOLDER_DEPTH } from "@/lib/browser-bookmark";
import { StepIndicator } from "./step-indicator";
import { useImportWizard } from "./use-import-wizard";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BrowserBookmarkImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportDialogProps) {
  const {
    step,
    setStep,
    parsedFile,
    selectedSource,
    setSelectedSource,
    selectedIds,
    setSelectedIds,
    options,
    setOptions,
    folders,
    progress,
    result,
    isImporting,
    foldersExceedingDepth,
    depthWarningConfirmed,
    setDepthWarningConfirmed,
    selectedPlatforms,
    platformFilterEnabled,
    handleFileSelect,
    handlePlatformFilterChange,
    handleImport,
    handleCancelImport,
    setFile,
    setParsedFile,
  } = useImportWizard({ open, onSuccess });

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (step) {
      case IMPORT_DIALOG_STEPS.UPLOAD:
        return (
          <div className="space-y-4">
            <FileUploader
              onFileSelect={handleFileSelect}
              onError={(message) => toast.error(message)}
            />
            <p className="text-xs text-center text-muted-foreground">
              <a
                href="https://support.google.com/chrome/answer/96816"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                如何从 Chrome 导出书签？
              </a>
            </p>
          </div>
        );

      case IMPORT_DIALOG_STEPS.PREVIEW:
        return parsedFile ? (
          <div className="space-y-4">
            {/* 深度警告 */}
            {foldersExceedingDepth.length > 0 && (
              <DepthWarning
                foldersExceeding={foldersExceedingDepth}
                maxDepth={MAX_FOLDER_DEPTH}
                confirmed={depthWarningConfirmed}
                onConfirm={() => setDepthWarningConfirmed(true)}
              />
            )}

            <div className="flex items-center justify-between">
              <SourceSelector
                detectedSource={parsedFile.source}
                selectedSource={selectedSource}
                onSourceChange={setSelectedSource}
              />
              <div className="text-sm text-muted-foreground">
                {parsedFile.totalBookmarks} 个书签 · {parsedFile.totalFolders}{" "}
                个文件夹
              </div>
            </div>

            {/* 平台筛选器 */}
            {platformFilterEnabled && (
              <PlatformFilter
                nodes={parsedFile.roots}
                selectedPlatforms={selectedPlatforms}
                onPlatformChange={handlePlatformFilterChange}
                compact
              />
            )}

            <BookmarkTree
              nodes={parsedFile.roots}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              maxHeight={
                foldersExceedingDepth.length > 0
                  ? platformFilterEnabled
                    ? "200px"
                    : "280px"
                  : platformFilterEnabled
                    ? "280px"
                    : "350px"
              }
            />
          </div>
        ) : null;

      case IMPORT_DIALOG_STEPS.OPTIONS:
        return (
          <ImportOptions
            options={options}
            onOptionsChange={setOptions}
            folders={folders}
          />
        );

      case IMPORT_DIALOG_STEPS.IMPORT:
        return result ? (
          <ImportResult
            result={result}
            source={selectedSource}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <ImportProgress progress={progress} onCancel={handleCancelImport} />
        );

      default:
        return null;
    }
  };

  // 渲染底部按钮
  const renderFooter = () => {
    if (step === IMPORT_DIALOG_STEPS.IMPORT && (result || isImporting)) {
      return null;
    }

    const canGoNext = () => {
      switch (step) {
        case IMPORT_DIALOG_STEPS.UPLOAD:
          return false; // 上传步骤通过文件选择自动进入下一步
        case IMPORT_DIALOG_STEPS.PREVIEW:
          // 需要选中书签且确认深度警告（如果有的话）
          return selectedIds.size > 0 && depthWarningConfirmed;
        case IMPORT_DIALOG_STEPS.OPTIONS:
          return true;
        default:
          return false;
      }
    };

    const handleNext = () => {
      if (step === IMPORT_DIALOG_STEPS.PREVIEW) {
        setStep(IMPORT_DIALOG_STEPS.OPTIONS);
      } else if (step === IMPORT_DIALOG_STEPS.OPTIONS) {
        setStep(IMPORT_DIALOG_STEPS.IMPORT);
        handleImport();
      }
    };

    const handleBack = () => {
      if (step === IMPORT_DIALOG_STEPS.PREVIEW) {
        setStep(IMPORT_DIALOG_STEPS.UPLOAD);
        setFile(null);
        setParsedFile(null);
      } else if (step === IMPORT_DIALOG_STEPS.OPTIONS) {
        setStep(IMPORT_DIALOG_STEPS.PREVIEW);
      }
    };

    return (
      <DialogFooter>
        {step > IMPORT_DIALOG_STEPS.UPLOAD && (
          <Button variant="outline" onClick={handleBack}>
            上一步
          </Button>
        )}
        {step !== IMPORT_DIALOG_STEPS.UPLOAD && (
          <Button onClick={handleNext} disabled={!canGoNext()}>
            {step === IMPORT_DIALOG_STEPS.OPTIONS ? "开始导入" : "下一步"}
          </Button>
        )}
      </DialogFooter>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>导入浏览器书签</DialogTitle>
          <DialogDescription>
            从 Chrome、Edge 等浏览器导入书签到 AnyKeep
          </DialogDescription>
        </DialogHeader>

        <StepIndicator currentStep={step} />

        <div className="flex-1 overflow-auto py-4">{renderStepContent()}</div>

        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}
