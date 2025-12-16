"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useFolders } from "@/hooks/use-folders";
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
import {
  PlatformFilter,
  extractPlatformStats,
  getBookmarkIdsByPlatforms,
} from "./platform-filter";
import type { Platform } from "@/types/supabase";
import {
  parseBookmarkHtml,
  filterSelectedBookmarks,
  isValidBookmarkFile,
  IMPORT_DIALOG_STEPS,
  IMPORT_STEP_NAMES,
  DEFAULT_IMPORT_OPTIONS,
  DEFAULT_IMPORT_PROGRESS,
  BROWSER_SOURCE_TO_PLATFORM,
  BATCH_SIZE,
  BATCH_DELAY_MS,
  MAX_FOLDER_DEPTH,
  extractRequiredFolderPaths,
  buildFolderMapping,
  updateMappingWithCreatedFolders,
  getFolderIdForBookmark,
  getFoldersExceedingDepth,
} from "@/lib/browser-bookmark";
import { clientLogger } from "@/lib/client-logger";
import type {
  ParsedBookmarkFile,
  ParsedBookmarkNode,
  BrowserSource,
  BrowserBookmarkImportOptions,
  ImportProgress as ImportProgressType,
  ImportResult as ImportResultType,
  ImportDialogStep,
  FolderMappingResult,
} from "@/lib/browser-bookmark";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface StepIndicatorProps {
  currentStep: ImportDialogStep;
}

function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [
    IMPORT_DIALOG_STEPS.UPLOAD,
    IMPORT_DIALOG_STEPS.PREVIEW,
    IMPORT_DIALOG_STEPS.OPTIONS,
    IMPORT_DIALOG_STEPS.IMPORT,
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              step === currentStep
                ? "bg-primary text-primary-foreground"
                : step < currentStep
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {step}
          </div>
          <span
            className={`ml-2 text-sm hidden sm:inline ${
              step === currentStep ? "font-medium" : "text-muted-foreground"
            }`}
          >
            {IMPORT_STEP_NAMES[step]}
          </span>
          {index < steps.length - 1 && (
            <div className="w-8 h-px bg-muted mx-2" />
          )}
        </div>
      ))}
    </div>
  );
}

export function BrowserBookmarkImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportDialogProps) {
  // 步骤状态
  const [step, setStep] = useState<ImportDialogStep>(
    IMPORT_DIALOG_STEPS.UPLOAD,
  );

  // 文件状态
  const [_file, setFile] = useState<File | null>(null);
  const [parsedFile, setParsedFile] = useState<ParsedBookmarkFile | null>(null);

  // 选择状态
  const [selectedSource, setSelectedSource] =
    useState<BrowserSource>("unknown");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 配置状态
  const [options, setOptions] = useState<BrowserBookmarkImportOptions>(
    DEFAULT_IMPORT_OPTIONS,
  );

  // V4.2.24: 使用统一的文件夹缓存 Hook（仅在配置步骤时获取）
  const { folders: rawFolders } = useFolders({
    enabled: open && step === IMPORT_DIALOG_STEPS.OPTIONS,
  });

  // 扁平化文件夹列表
  const folders = useMemo(() => {
    if (!rawFolders) return [];
    const flatFolders: Array<{
      id: number;
      name: string;
      parent_id: number | null;
    }> = [];

    function flattenTree(
      nodes: Array<{
        id: number;
        name: string;
        parent_id: number | null;
        children?: Array<unknown>;
      }>,
    ) {
      for (const node of nodes) {
        flatFolders.push({
          id: node.id,
          name: node.name,
          parent_id: node.parent_id,
        });
        if (node.children && Array.isArray(node.children)) {
          flattenTree(
            node.children as Array<{
              id: number;
              name: string;
              parent_id: number | null;
              children?: Array<unknown>;
            }>,
          );
        }
      }
    }

    flattenTree(
      rawFolders as Array<{
        id: number;
        name: string;
        parent_id: number | null;
        children?: Array<unknown>;
      }>,
    );
    return flatFolders;
  }, [rawFolders]);

  // 导入状态
  const [progress, setProgress] = useState<ImportProgressType>(
    DEFAULT_IMPORT_PROGRESS,
  );
  const [result, setResult] = useState<ImportResultType | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const cancelRef = useRef(false); // 取消标志

  // 深度警告状态
  const [foldersExceedingDepth, setFoldersExceedingDepth] = useState<
    Array<{ path: string[]; depth: number }>
  >([]);
  const [depthWarningConfirmed, setDepthWarningConfirmed] = useState(false);

  // 平台筛选状态
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(
    new Set(),
  );
  const [platformFilterEnabled, setPlatformFilterEnabled] = useState(false);

  // 重置状态
  const resetState = useCallback(() => {
    setStep(IMPORT_DIALOG_STEPS.UPLOAD);
    setFile(null);
    setParsedFile(null);
    setSelectedSource("unknown");
    setSelectedIds(new Set());
    setOptions(DEFAULT_IMPORT_OPTIONS);
    setProgress(DEFAULT_IMPORT_PROGRESS);
    setResult(null);
    setIsImporting(false);
    setFoldersExceedingDepth([]);
    setDepthWarningConfirmed(false);
    setSelectedPlatforms(new Set());
    setPlatformFilterEnabled(false);
  }, []);

  // 关闭对话框时重置状态
  useEffect(() => {
    if (!open) {
      // 延迟重置，等待动画完成
      const timer = setTimeout(resetState, 300);
      return () => clearTimeout(timer);
    }
  }, [open, resetState]);

  // 加载文件夹列表
  // V4.2.24: 文件夹数据现在由 useFolders Hook 提供，无需手动 fetch

  // 处理文件选择
  const handleFileSelect = useCallback(
    (selectedFile: File, content: string) => {
      // 验证文件格式
      if (!isValidBookmarkFile(content)) {
        toast.error("无效的书签文件格式");
        return;
      }

      try {
        const parsed = parseBookmarkHtml(selectedFile.name, content);
        setFile(selectedFile);
        setParsedFile(parsed);
        setSelectedSource(parsed.source);

        // 默认全选所有书签
        const allIds = new Set<string>();
        function collectIds(nodes: typeof parsed.roots) {
          for (const node of nodes) {
            allIds.add(node.id);
            if (node.children) {
              collectIds(node.children);
            }
          }
        }
        collectIds(parsed.roots);
        setSelectedIds(allIds);

        // 检测超过深度限制的文件夹
        const exceeding = getFoldersExceedingDepth(
          parsed.roots,
          MAX_FOLDER_DEPTH,
        );
        setFoldersExceedingDepth(exceeding);
        setDepthWarningConfirmed(exceeding.length === 0); // 无警告则自动确认

        // 初始化平台筛选（默认全选所有检测到的平台）
        const platformStats = extractPlatformStats(parsed.roots);
        const allPlatforms = new Set(platformStats.map((s) => s.platform));
        setSelectedPlatforms(allPlatforms);
        setPlatformFilterEnabled(platformStats.length > 1); // 多于一个平台时启用

        // 进入预览步骤
        setStep(IMPORT_DIALOG_STEPS.PREVIEW);

        toast.success(`成功解析 ${parsed.totalBookmarks} 个书签`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "解析文件失败");
      }
    },
    [],
  );

  // 处理平台筛选变化
  const handlePlatformFilterChange = useCallback(
    (platforms: Set<Platform>) => {
      setSelectedPlatforms(platforms);

      // 如果有解析的文件，更新选中的书签
      if (parsedFile) {
        // 获取所有选中平台的书签 ID
        const platformBookmarkIds = getBookmarkIdsByPlatforms(
          parsedFile.roots,
          platforms,
        );

        // 还需要包含文件夹，以便它们可以正确展示
        const newSelectedIds = new Set<string>();

        function collectIdsRecursive(
          nodes: ParsedBookmarkNode[],
          _parentIncluded: boolean,
        ): boolean {
          let hasSelectedChild = false;

          for (const node of nodes) {
            if (node.type === "bookmark") {
              // 书签：检查是否在平台筛选中
              if (platformBookmarkIds.has(node.id)) {
                newSelectedIds.add(node.id);
                hasSelectedChild = true;
              }
            } else if (node.type === "folder" && node.children) {
              // 文件夹：递归检查子节点
              const childHasSelected = collectIdsRecursive(
                node.children,
                false,
              );
              if (childHasSelected) {
                newSelectedIds.add(node.id);
                hasSelectedChild = true;
              }
            }
          }

          return hasSelectedChild;
        }

        collectIdsRecursive(parsedFile.roots, false);
        setSelectedIds(newSelectedIds);
      }
    },
    [parsedFile],
  );

  // 处理导入（支持分批）
  const handleImport = useCallback(async () => {
    if (!parsedFile) return;

    cancelRef.current = false;
    setIsImporting(true);

    // 开始计时
    const startTime = Date.now();

    // 扩展统计跟踪
    let foldersCreatedCount = 0;

    // 生成导入批次 ID
    const importBatchId = crypto.randomUUID();

    try {
      // 获取选中的书签（只导入有 URL 的书签，排除文件夹）
      const bookmarksToImport = filterSelectedBookmarks(
        parsedFile.roots,
        selectedIds,
      ).filter((bookmark) => bookmark.url && bookmark.url.trim() !== "");
      const platform = BROWSER_SOURCE_TO_PLATFORM[selectedSource];

      if (bookmarksToImport.length === 0) {
        throw new Error("没有可导入的书签（选中项都是文件夹或无效链接）");
      }

      // AI 分类模式：获取或创建待整理文件夹
      let aiInboxFolderId: number | null = null;
      if (options.enableAiClassify) {
        try {
          const inboxResponse = await fetch("/api/folders/inbox", {
            method: "POST",
          });
          if (inboxResponse.ok) {
            const inboxData = await inboxResponse.json();
            aiInboxFolderId = inboxData.data?.id || inboxData.id;
          }
        } catch (error) {
          clientLogger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            "Failed to get inbox folder for AI classify",
          );
          // 继续使用默认目标文件夹
        }
      }

      // 文件夹映射结果（当启用自动创建文件夹时使用）
      let folderMapping: FolderMappingResult | null = null;

      // 如果启用了自动创建文件夹（且未启用 AI 分类）
      if (options.autoCreateFolders && !options.enableAiClassify) {
        // 1. 提取需要的文件夹路径
        const requiredPaths = extractRequiredFolderPaths(bookmarksToImport);

        // 2. 构建文件夹映射
        folderMapping = buildFolderMapping(
          requiredPaths,
          folders,
          options.targetFolderId,
        );

        // 3. 如果有需要创建的文件夹，调用批量创建 API
        if (folderMapping.foldersToCreate.length > 0) {
          const createResponse = await fetch("/api/folders/batch-create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              folders: folderMapping.foldersToCreate,
              baseParentId: options.targetFolderId,
            }),
          });

          if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(errorData.error || "创建文件夹失败");
          }

          const createResult = await createResponse.json();
          // 更新映射（将临时 ID 替换为真实 ID）
          // API 返回 { data: { folders: [...] } }
          const createdFolders =
            createResult.data?.folders || createResult.folders || [];
          folderMapping = updateMappingWithCreatedFolders(
            folderMapping,
            createdFolders,
          );
          // 记录创建的文件夹数量
          foldersCreatedCount = createdFolders.length;
        }
      }

      // 准备导入数据
      const allImportData = bookmarksToImport.map((bookmark) => {
        // 确定目标文件夹 ID
        let folderId = options.targetFolderId;

        // AI 分类模式：所有书签都放入待整理文件夹
        if (options.enableAiClassify && aiInboxFolderId !== null) {
          folderId = aiInboxFolderId;
        } else if (options.autoCreateFolders && folderMapping) {
          // 使用文件夹映射获取目标文件夹
          folderId = getFolderIdForBookmark(bookmark, folderMapping);
        }

        // 构建导入数据
        const importData: {
          url: string;
          title: string;
          description?: string;
          platform: typeof platform;
          folderId: number | null;
          originalAddDate?: string;
          importSource: string;
          importBatchId: string;
        } = {
          url: bookmark.url!,
          title: bookmark.title,
          description: bookmark.description,
          platform,
          folderId,
          importSource: `browser_${selectedSource}`, // e.g., browser_chrome
          importBatchId,
        };

        // 如果启用保留原始时间且书签有 addDate
        if (options.preserveAddDate && bookmark.addDate) {
          // 将 Unix 时间戳（秒）转换为 ISO 字符串
          importData.originalAddDate = new Date(
            bookmark.addDate * 1000,
          ).toISOString();
        }

        return importData;
      });

      // 统计有原始时间的书签数量
      const withOriginalDateCount = allImportData.filter(
        (d) => d.originalAddDate,
      ).length;

      // 计算批次
      const totalBatches = Math.ceil(allImportData.length / BATCH_SIZE);

      // 初始化进度
      setProgress({
        ...DEFAULT_IMPORT_PROGRESS,
        totalBookmarks: allImportData.length,
        totalBatches,
        currentBatch: 1,
        status: "importing",
      });

      // 汇总结果
      let totalSuccess = 0;
      let totalFailed = 0;
      let totalSkipped = 0;
      const allErrors: Array<{ url: string; title: string; reason: string }> =
        [];

      // 分批导入
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        // 检查是否取消
        if (cancelRef.current) {
          setProgress((prev) => ({
            ...prev,
            status: "idle",
            errorMessage: "导入已取消",
          }));
          return;
        }

        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, allImportData.length);
        const batchData = allImportData.slice(start, end);

        // 更新当前批次进度
        setProgress((prev) => ({
          ...prev,
          currentBatch: batchIndex + 1,
          currentItem: batchData[0]?.title,
          batchProgress: { total: batchData.length, processed: 0 },
        }));

        try {
          // 调用批量导入 API
          const response = await fetch("/api/bookmarks/batch-import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookmarks: batchData }),
          });

          const responseData = await response.json();

          if (!response.ok) {
            throw new Error(
              responseData.error?.message || responseData.error || "导入失败",
            );
          }

          // API 响应格式: { success: true, data: { success, failed, skipped, errors, message } }
          const batchResult = responseData.data || responseData;

          // 累加结果
          totalSuccess += batchResult.success || 0;
          totalFailed += batchResult.failed || 0;
          totalSkipped += batchResult.skipped || 0;
          if (batchResult.errors) {
            allErrors.push(...batchResult.errors);
          }

          // 更新进度
          setProgress((prev) => ({
            ...prev,
            totalSuccess,
            totalFailed,
            totalSkipped,
            batchProgress: {
              total: batchData.length,
              processed: batchData.length,
            },
          }));
        } catch (batchError) {
          // 单批失败，记录错误但继续处理
          totalFailed += batchData.length;
          allErrors.push({
            url: `批次 ${batchIndex + 1}`,
            title: `批次 ${batchIndex + 1} (${batchData.length} 条)`,
            reason:
              batchError instanceof Error ? batchError.message : "批次导入失败",
          });
        }

        // 批次间延迟（避免请求过快）
        if (batchIndex < totalBatches - 1 && !cancelRef.current) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      // 计算耗时
      const durationMs = Date.now() - startTime;

      // 设置最终结果
      const importResult: ImportResultType = {
        success: totalSuccess,
        failed: totalFailed,
        skipped: totalSkipped,
        errors: allErrors,
        platformBreakdown: { [platform]: totalSuccess },
        extendedStats: {
          durationMs,
          foldersCreated: foldersCreatedCount,
          withOriginalDate: withOriginalDateCount,
          browserSource: selectedSource,
          totalSelected: bookmarksToImport.length,
          aiClassifyEnabled: options.enableAiClassify,
        },
      };

      setResult(importResult);
      setProgress((prev) => ({
        ...prev,
        status: "completed",
        totalSuccess,
        totalFailed,
        totalSkipped,
      }));

      if (totalSuccess > 0) {
        toast.success(`成功导入 ${totalSuccess} 个书签`);
        onSuccess?.();
      } else if (totalSkipped > 0) {
        toast.info(`${totalSkipped} 个书签已存在，已跳过`);
      }
    } catch (error) {
      setProgress((prev) => ({
        ...prev,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "导入失败",
      }));
      toast.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setIsImporting(false);
    }
  }, [parsedFile, selectedIds, selectedSource, options, folders, onSuccess]);

  // 取消导入
  const handleCancelImport = useCallback(() => {
    cancelRef.current = true;
    setIsImporting(false);
    setProgress((prev) => ({
      ...prev,
      status: "idle",
      errorMessage: "导入已取消",
    }));
  }, []);

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
