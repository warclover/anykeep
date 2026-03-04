"use client";

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useDebouncedAbortableFetch } from "@/hooks/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderQuickSelect } from "@/components/classification/folder-quick-select";
import { useCreateBookmarkForm } from "./hooks/use-create-bookmark-form";
import { useMetadataFetch, isValidUrl } from "./hooks/use-metadata-fetch";
import { useExpandableSections } from "./hooks/use-expandable-sections";
import {
  useBookmarkSubmit,
  type BookmarkCreatedData,
} from "./hooks/use-bookmark-submit";
import { UrlInputSection } from "./url-input-section";
import { ContentInfoSection } from "./content-info-section";
import { ClassificationSection } from "./classification-section";
import { NotesSection } from "./notes-section";
import { VisionAnalysisToggle } from "./vision-analysis-toggle";

interface CreateBookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders?: Array<{ id: number; name: string }>;
  onSuccess?: (bookmark: BookmarkCreatedData) => void;
}

const SLOGAN_FONT = {
  fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
} as const;

export function CreateBookmarkDialog({
  open,
  onOpenChange,
  folders = [],
  onSuccess,
}: CreateBookmarkDialogProps) {
  const form = useCreateBookmarkForm();
  const sections = useExpandableSections();
  const { debouncedFetch, abortAll } = useDebouncedAbortableFetch(500);
  const metadata = useMetadataFetch({
    url: form.url,
    setTitle: form.setTitle,
    setDescription: form.setDescription,
    setCoverUrl: form.setCoverUrl,
    setSourceName: form.setSourceName,
    setAuthor: form.setAuthor,
    setPublishTime: form.setPublishTime,
    setWordCount: form.setWordCount,
    setImageCount: form.setImageCount,
    debouncedFetch,
    abortAll,
  });
  const resetAll = useCallback(() => {
    form.resetForm();
    metadata.resetFetchState();
    sections.resetExpanded();
  }, [form.resetForm, metadata.resetFetchState, sections.resetExpanded]);
  const submit = useBookmarkSubmit({
    form,
    resetAll,
    abortAll,
    onSuccess,
    onOpenChange,
  });
  const showExpanded = !!(form.url && isValidUrl(form.url));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加收藏</DialogTitle>
            <DialogDescription className="sr-only">
              输入链接保存网页内容，支持自动获取标题和摘要
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit.handleSubmit} className="space-y-3">
            <UrlInputSection
              url={form.url}
              setUrl={form.setUrl}
              fetchStatus={metadata.fetchStatus}
              fetchError={metadata.fetchError}
              handleRefetch={metadata.handleRefetch}
              errors={form.errors}
            />
            <ContentInfoSection
              title={form.title}
              setTitle={form.setTitle}
              description={form.description}
              setDescription={form.setDescription}
              isDescriptionExpanded={sections.isDescriptionExpanded}
              setIsDescriptionExpanded={sections.setIsDescriptionExpanded}
              autoFilledFields={metadata.autoFilledFields}
              markFieldAsModified={metadata.markFieldAsModified}
              errors={form.errors}
              showExpandedSections={showExpanded}
            />
            <ClassificationSection
              folderId={form.folderId}
              setFolderId={form.setFolderId}
              folders={folders}
              selectedUsageTags={form.selectedUsageTags}
              setSelectedUsageTags={form.setSelectedUsageTags}
              customUsageTags={form.customUsageTags}
              setCustomUsageTags={form.setCustomUsageTags}
              userAddedTags={form.userAddedTags}
              tags={form.tags}
              setTags={form.setTags}
              addUserTag={form.addUserTag}
              removeUserTag={form.removeUserTag}
              isClassificationExpanded={sections.isClassificationExpanded}
              setIsClassificationExpanded={sections.setIsClassificationExpanded}
              isCustomTagsExpanded={sections.isCustomTagsExpanded}
              setIsCustomTagsExpanded={sections.setIsCustomTagsExpanded}
              isSubmitting={submit.isSubmitting}
              errors={form.errors}
              showExpandedSections={showExpanded}
            />
            <NotesSection
              notes={form.notes}
              setNotes={form.setNotes}
              isNotesExpanded={sections.isNotesExpanded}
              setIsNotesExpanded={sections.setIsNotesExpanded}
              errors={form.errors}
              showExpandedSections={showExpanded}
            />
            <VisionAnalysisToggle
              enableVisionAnalysis={form.enableVisionAnalysis}
              setEnableVisionAnalysis={form.setEnableVisionAnalysis}
              isSubmitting={submit.isSubmitting}
              showExpandedSections={showExpanded}
            />
            <DialogFooter className="flex-row justify-between items-end sm:justify-between">
              <div
                className={`transition-all duration-500 ease-out ${showExpanded ? "opacity-0 -translate-x-4 pointer-events-none" : "opacity-100 translate-x-0"}`}
              >
                <div className="flex items-baseline gap-3 select-none">
                  <span
                    className="text-4xl font-bold bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400 bg-clip-text text-transparent tracking-wide"
                    style={SLOGAN_FONT}
                  >
                    Just
                  </span>
                  <span
                    className="text-5xl font-bold bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400 bg-clip-text text-transparent tracking-tight"
                    style={SLOGAN_FONT}
                  >
                    Keep!
                  </span>
                </div>
                <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400 rounded-full mt-0.5" />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={submit.isSubmitting}
                >
                  取消
                </Button>
                <Button type="submit" disabled={submit.isSubmitting}>
                  {submit.isSubmitting ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    "创建收藏"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <FolderQuickSelect
        open={submit.folderSelectOpen}
        onOpenChange={submit.setFolderSelectOpen}
        bookmarkId={submit.pendingBookmarkId || 0}
        onSelect={submit.handleFolderSelected}
        title="选择其他文件夹"
      />
    </>
  );
}
