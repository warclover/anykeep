"use client";

import { useCallback } from "react";
import { Loader2, Plus } from "lucide-react";
import { useDebouncedAbortableFetch } from "@/hooks/core";
import { useClipboardPaste } from "@/components/quick-add/hooks/useClipboardPaste";
import { Button } from "@/components/ui/button";
import { SideSheet } from "@/components/ui/side-sheet";
import { extractUrlFromShareText } from "@/lib/utils/url-extractor";
import { FolderQuickSelect } from "@/components/classification/folder-quick-select";
import { useCreateBookmarkForm } from "./hooks/use-create-bookmark-form";
import { useMetadataFetch, isValidUrl } from "./hooks/use-metadata-fetch";
import {
  useBookmarkSubmit,
  type BookmarkCreatedData,
} from "./hooks/use-bookmark-submit";
import { useUrlClipboard } from "./hooks/use-url-clipboard";
import {
  DrawerUrlZone,
  DrawerInfoZone,
  DrawerExpandedZone,
} from "./drawer-form-zones";

interface CreateBookmarkDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders?: Array<{ id: number; name: string }>;
  onSuccess?: (bookmark: BookmarkCreatedData) => void;
}

const TEXT = {
  SHEET_TITLE: "新建收藏",
  SHEET_DESCRIPTION: "输入链接保存网页内容，支持自动获取标题和摘要",
  SUBMIT_BUTTON: "创建",
  SUBMITTING: "创建中",
} as const;

export function CreateBookmarkDrawer({
  open,
  onOpenChange,
  folders = [],
  onSuccess,
}: CreateBookmarkDrawerProps) {
  const form = useCreateBookmarkForm();
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

  const { readClipboard, extractUrlFromText } = useClipboardPaste({
    onUrlExtracted: (extractedUrl) =>
      form.setUrl(extractUrlFromShareText(extractedUrl)),
  });

  const clipboard = useUrlClipboard({
    open,
    url: form.url,
    readClipboard,
    extractUrlFromText,
    setUrl: form.setUrl,
  });

  const { resetForm } = form;
  const { resetFetchState } = metadata;
  const resetAll = useCallback(() => {
    resetForm();
    resetFetchState();
  }, [resetForm, resetFetchState]);

  const submit = useBookmarkSubmit({
    form,
    resetAll,
    abortAll,
    onSuccess,
    onOpenChange,
  });
  const showExpandedSections = !!(form.url && isValidUrl(form.url));

  return (
    <>
      <SideSheet
        open={open}
        onOpenChange={onOpenChange}
        size="md"
        title={TEXT.SHEET_TITLE}
        description={TEXT.SHEET_DESCRIPTION}
        headerAction={
          <Button
            type="submit"
            form="create-bookmark-form"
            disabled={submit.isSubmitting || !form.url}
            size="sm"
            className="h-8 px-4 bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/25 disabled:opacity-50"
          >
            {submit.isSubmitting ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                {TEXT.SUBMITTING}
              </>
            ) : (
              <>
                <Plus className="size-3.5 mr-1.5" />
                {TEXT.SUBMIT_BUTTON}
              </>
            )}
          </Button>
        }
      >
        <form
          id="create-bookmark-form"
          onSubmit={submit.handleSubmit}
          className="contents"
        >
          <DrawerUrlZone
            url={form.url}
            setUrl={form.setUrl}
            fetchStatus={metadata.fetchStatus}
            fetchError={metadata.fetchError}
            handleRefetch={metadata.handleRefetch}
            errors={form.errors}
            urlInputRef={clipboard.urlInputRef}
            onFocus={clipboard.handleUrlInputFocus}
            onPaste={clipboard.handleUrlPaste}
          />
          {showExpandedSections && (
            <DrawerInfoZone
              title={form.title}
              setTitle={form.setTitle}
              folderId={form.folderId}
              setFolderId={form.setFolderId}
              folders={folders}
              selectedUsageTags={form.selectedUsageTags}
              setSelectedUsageTags={form.setSelectedUsageTags}
              customUsageTags={form.customUsageTags}
              setCustomUsageTags={form.setCustomUsageTags}
              isSubmitting={submit.isSubmitting}
              autoFilledFields={metadata.autoFilledFields}
              markFieldAsModified={metadata.markFieldAsModified}
              errors={form.errors}
            />
          )}
          {showExpandedSections && (
            <DrawerExpandedZone
              description={form.description}
              setDescription={form.setDescription}
              tags={form.tags}
              setTags={form.setTags}
              notes={form.notes}
              setNotes={form.setNotes}
              userAddedTags={form.userAddedTags}
              addUserTag={form.addUserTag}
              removeUserTag={form.removeUserTag}
              enableVisionAnalysis={form.enableVisionAnalysis}
              setEnableVisionAnalysis={form.setEnableVisionAnalysis}
              isSubmitting={submit.isSubmitting}
              autoFilledFields={metadata.autoFilledFields}
              markFieldAsModified={metadata.markFieldAsModified}
              errors={form.errors}
            />
          )}
        </form>
      </SideSheet>
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
