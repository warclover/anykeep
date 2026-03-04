"use client";

import {
  Loader2,
  Sparkles,
  RefreshCw,
  Check,
  AlertCircle,
  Link,
  FileText,
  FolderOpen,
  Tags,
  MessageSquare,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SideSheetPrimaryZone,
  SideSheetSecondaryZone,
  SideSheetExpandableZone,
} from "@/components/ui/side-sheet";
import { extractUrlFromShareText } from "@/lib/utils/url-extractor";
import { UsageTagSelector } from "./usage-tag-selector";
import type { FetchStatus } from "./hooks/use-metadata-fetch";
import type { CustomUsageTag } from "@/types/supabase";

const TEXT = {
  URL_LABEL: "粘贴链接",
  URL_PLACEHOLDER: "粘贴链接或分享文本...",
  URL_HELPER: "输入链接后自动获取网页信息",
  FETCHING: "正在获取网页信息...",
  FETCH_SUCCESS: "已自动填充网页信息",
  FETCH_ERROR: "获取失败，请手动填写",
  REFETCH: "重新获取",
  RETRY: "重试",
  AUTO_FILLED: "已自动填充",
  TITLE_LABEL: "标题",
  TITLE_PLACEHOLDER: "可选，保存后自动获取",
  FOLDER_LABEL: "保存到",
  FOLDER_PLACEHOLDER: "选择文件夹（可选）",
  USAGE_TAGS_LABEL: "用途标签",
  USAGE_TAGS_HELPER: "方便日后筛选",
  DESCRIPTION_LABEL: "描述",
  DESCRIPTION_PLACEHOLDER: "简单描述这篇内容...",
  CUSTOM_TAGS_LABEL: "自定义标签",
  CUSTOM_TAGS_PLACEHOLDER: "输入标签后按回车添加",
  CUSTOM_TAGS_HELPER: "可选，保存后自动生成 AI 标签",
  NOTES_LABEL: "个人笔记",
  NOTES_PLACEHOLDER: "记录想法...",
  VISION_LABEL: "深度视觉分析",
  VISION_HELPER: "提取图片文字、分析图表逻辑",
  MORE_OPTIONS: "更多选项",
  MORE_OPTIONS_DESC: "描述、标签、笔记、视觉分析",
} as const;

function AutoFilledBadge({
  field,
  autoFilledFields,
}: {
  field: string;
  autoFilledFields: Set<string>;
}) {
  if (!autoFilledFields.has(field)) return null;
  return (
    <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400 font-normal flex items-center gap-1">
      <Sparkles className="size-3" />
      {TEXT.AUTO_FILLED}
    </span>
  );
}

function UrlStatus({
  fetchStatus,
  fetchError,
  handleRefetch,
}: {
  fetchStatus: FetchStatus;
  fetchError: string;
  handleRefetch: () => void;
}) {
  switch (fetchStatus) {
    case "loading":
      return (
        <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
          <Loader2 className="size-3 animate-spin" />
          <span>{TEXT.FETCHING}</span>
        </div>
      );
    case "success":
      return (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="size-3" />
          <span>{TEXT.FETCH_SUCCESS}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-xs"
            onClick={handleRefetch}
          >
            <RefreshCw className="size-3 mr-1" />
            {TEXT.REFETCH}
          </Button>
        </div>
      );
    case "error":
      return (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="size-3" />
          <span>{fetchError || TEXT.FETCH_ERROR}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-xs"
            onClick={handleRefetch}
          >
            <RefreshCw className="size-3 mr-1" />
            {TEXT.RETRY}
          </Button>
        </div>
      );
    default:
      return null;
  }
}

// ============================================================================
// DrawerUrlZone
// ============================================================================

interface DrawerUrlZoneProps {
  url: string;
  setUrl: (url: string) => void;
  fetchStatus: FetchStatus;
  fetchError: string;
  handleRefetch: () => void;
  errors: Record<string, string>;
  urlInputRef: React.Ref<HTMLInputElement>;
  onFocus: () => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}

export function DrawerUrlZone({
  url,
  setUrl,
  fetchStatus,
  fetchError,
  handleRefetch,
  errors,
  urlInputRef,
  onFocus,
  onPaste,
}: DrawerUrlZoneProps) {
  return (
    <SideSheetPrimaryZone index={0}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 size-10 rounded-xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
          <Link className="size-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Label
              htmlFor="url"
              className="text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              {TEXT.URL_LABEL}
            </Label>
            <span className="text-red-500 text-xs">*</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            {TEXT.URL_HELPER}
          </p>
          <UrlStatus
            fetchStatus={fetchStatus}
            fetchError={fetchError}
            handleRefetch={handleRefetch}
          />
        </div>
      </div>

      <div className="relative group mt-3">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm" />
        <Input
          ref={urlInputRef}
          id="url"
          type="text"
          placeholder={TEXT.URL_PLACEHOLDER}
          value={url}
          onChange={(e) => setUrl(extractUrlFromShareText(e.target.value))}
          onFocus={onFocus}
          onPaste={onPaste}
          required
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`relative bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-transparent focus:ring-2 focus:ring-violet-500/50 transition-all ${errors.url ? "border-red-500" : ""} ${fetchStatus === "loading" ? "pr-10" : ""}`}
        />
        {fetchStatus === "loading" && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="size-4 animate-spin text-violet-500" />
          </div>
        )}
      </div>
      {errors.url && <p className="text-xs text-red-500 mt-1">{errors.url}</p>}
    </SideSheetPrimaryZone>
  );
}

// ============================================================================
// DrawerInfoZone
// ============================================================================

interface DrawerInfoZoneProps {
  title: string;
  setTitle: (v: string) => void;
  folderId: string;
  setFolderId: (v: string) => void;
  folders: Array<{ id: number; name: string }>;
  selectedUsageTags: string[];
  setSelectedUsageTags: (v: string[]) => void;
  customUsageTags: CustomUsageTag[];
  setCustomUsageTags: (v: CustomUsageTag[]) => void;
  isSubmitting: boolean;
  autoFilledFields: Set<string>;
  markFieldAsModified: (field: string) => void;
  errors: Record<string, string>;
}

export function DrawerInfoZone({
  title,
  setTitle,
  folderId,
  setFolderId,
  folders,
  selectedUsageTags,
  setSelectedUsageTags,
  customUsageTags,
  setCustomUsageTags,
  isSubmitting,
  autoFilledFields,
  markFieldAsModified,
  errors,
}: DrawerInfoZoneProps) {
  return (
    <SideSheetSecondaryZone index={1}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-slate-500" />
          <Label
            htmlFor="title"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {TEXT.TITLE_LABEL}
          </Label>
          <AutoFilledBadge field="title" autoFilledFields={autoFilledFields} />
        </div>
        <Input
          id="title"
          placeholder={TEXT.TITLE_PLACEHOLDER}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markFieldAsModified("title");
          }}
          className={`bg-white dark:bg-slate-900 ${errors.title ? "border-red-500" : ""}`}
        />
        {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
      </div>

      {folders.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <FolderOpen className="size-4 text-slate-500" />
            <Label
              htmlFor="folder"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {TEXT.FOLDER_LABEL}
            </Label>
          </div>
          <Select value={folderId} onValueChange={setFolderId}>
            <SelectTrigger className="bg-white dark:bg-slate-900">
              <SelectValue placeholder={TEXT.FOLDER_PLACEHOLDER} />
            </SelectTrigger>
            <SelectContent>
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id.toString()}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Tags className="size-4 text-slate-500" />
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {TEXT.USAGE_TAGS_LABEL}
          </Label>
          <span className="text-xs text-slate-500">
            {TEXT.USAGE_TAGS_HELPER}
          </span>
        </div>
        <UsageTagSelector
          selectedTags={selectedUsageTags}
          onSelectedTagsChange={setSelectedUsageTags}
          customUsageTags={customUsageTags}
          onCustomTagsChange={setCustomUsageTags}
          disabled={isSubmitting}
        />
      </div>
    </SideSheetSecondaryZone>
  );
}

// ============================================================================
// DrawerExpandedZone
// ============================================================================

interface DrawerExpandedZoneProps {
  description: string;
  setDescription: (v: string) => void;
  tags: string;
  setTags: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  userAddedTags: string[];
  addUserTag: (tag: string) => void;
  removeUserTag: (tag: string) => void;
  enableVisionAnalysis: boolean;
  setEnableVisionAnalysis: (v: boolean) => void;
  isSubmitting: boolean;
  autoFilledFields: Set<string>;
  markFieldAsModified: (field: string) => void;
  errors: Record<string, string>;
}

export function DrawerExpandedZone({
  description,
  setDescription,
  tags,
  setTags,
  notes,
  setNotes,
  userAddedTags,
  addUserTag,
  removeUserTag,
  enableVisionAnalysis,
  setEnableVisionAnalysis,
  isSubmitting,
  autoFilledFields,
  markFieldAsModified,
  errors,
}: DrawerExpandedZoneProps) {
  return (
    <SideSheetExpandableZone
      index={2}
      title={TEXT.MORE_OPTIONS}
      description={TEXT.MORE_OPTIONS_DESC}
      defaultExpanded={false}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="description"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {TEXT.DESCRIPTION_LABEL}
          </Label>
          <AutoFilledBadge
            field="description"
            autoFilledFields={autoFilledFields}
          />
        </div>
        <Textarea
          id="description"
          placeholder={TEXT.DESCRIPTION_PLACEHOLDER}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            markFieldAsModified("description");
          }}
          rows={2}
          className={`bg-white dark:bg-slate-900 ${errors.description ? "border-red-500" : ""}`}
        />
        {errors.description && (
          <p className="text-xs text-red-500">{errors.description}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="tags"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {TEXT.CUSTOM_TAGS_LABEL}
          </Label>
          <span className="text-xs text-slate-500">
            {TEXT.CUSTOM_TAGS_HELPER}
          </span>
        </div>
        {userAddedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {userAddedTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeUserTag(tag)}
                className="px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1"
              >
                {tag}
                <X className="size-3 opacity-60 hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
        <Input
          id="tags"
          placeholder={TEXT.CUSTOM_TAGS_PLACEHOLDER}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const input = e.currentTarget;
              if (input.value.trim()) {
                addUserTag(input.value.trim());
                setTags("");
              }
            }
          }}
          className={`bg-white dark:bg-slate-900 ${errors.userTags ? "border-red-500" : ""}`}
        />
        {errors.userTags && (
          <p className="text-xs text-red-500">{errors.userTags}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-slate-500" />
          <Label
            htmlFor="notes"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {TEXT.NOTES_LABEL}
          </Label>
        </div>
        <Textarea
          id="notes"
          placeholder={TEXT.NOTES_PLACEHOLDER}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={`bg-white dark:bg-slate-900 ${errors.notes ? "border-red-500" : ""}`}
        />
        {errors.notes && <p className="text-xs text-red-500">{errors.notes}</p>}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
            <Eye className="size-4 text-purple-500" />
          </div>
          <div>
            <Label
              htmlFor="vision-analysis"
              className="text-sm font-medium cursor-pointer text-slate-700 dark:text-slate-300"
            >
              {TEXT.VISION_LABEL}
            </Label>
            <p className="text-xs text-slate-500">{TEXT.VISION_HELPER}</p>
          </div>
        </div>
        <Switch
          id="vision-analysis"
          checked={enableVisionAnalysis}
          onCheckedChange={setEnableVisionAnalysis}
          disabled={isSubmitting}
        />
      </div>
    </SideSheetExpandableZone>
  );
}
