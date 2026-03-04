"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { GitCompare, Layers, History } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type {
  SynthesisDepthMode,
  SynthesisOutputStyle,
  SynthesisStatus,
} from "@/lib/synthesis";
import { useSynthesisListQuery } from "@/hooks/synthesis/use-synthesis-list-query";
import { useBookmarkLoader } from "./hooks/use-bookmark-loader";
import { useBookmarkSelection } from "./hooks/use-bookmark-selection";
import { useReportActions } from "./hooks/use-report-actions";
import { BookmarkSelectionPanel } from "./bookmark-selection-panel";
import { HistoryTab } from "./history-tab";
import { DeleteReportDialog } from "./delete-report-dialog";
import { SORT_OPTIONS, type AnalysisTab } from "./types";

export function ContentAnalysisListClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialTab =
    (searchParams?.get("tab") as AnalysisTab | null) || "compare";

  const [activeTab, setActiveTab] = useState<AnalysisTab>(initialTab);
  const [depthMode, setDepthMode] = useState<SynthesisDepthMode>("standard");
  const [outputStyle, setOutputStyle] =
    useState<SynthesisOutputStyle>("narrative");

  // History tab filters
  const [search, setSearch] = useState("");
  const [depthFilter, setDepthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("createdAt-desc");

  const sortOption =
    SORT_OPTIONS.find((o) => o.value === sortValue) || SORT_OPTIONS[0];

  const minCount = activeTab === "compare" ? 2 : 3;
  const maxCount = activeTab === "compare" ? 2 : Infinity;

  const loader = useBookmarkLoader(activeTab);
  const selection = useBookmarkSelection(maxCount);

  const { data, isLoading, error, refetch } = useSynthesisListQuery({
    search: search || undefined,
    depthMode:
      depthFilter !== "all" ? (depthFilter as SynthesisDepthMode) : undefined,
    status:
      statusFilter !== "all" ? (statusFilter as SynthesisStatus) : undefined,
    sort: sortOption.sort,
    order: sortOption.order,
    enabled: activeTab === "history",
  });

  const canStartAnalysis =
    selection.selectedCount >= minCount && selection.selectedCount <= maxCount;

  const actions = useReportActions({
    activeTab,
    depthMode,
    outputStyle,
    selectedIds: selection.selectedIds,
    canStartAnalysis,
    refetch,
  });

  const handleTabChange = useCallback(
    (tab: string) => {
      const newTab = tab as AnalysisTab;
      setActiveTab(newTab);
      selection.clearSelection();

      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("tab", newTab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });

      if (newTab === "compare") {
        setOutputStyle("comparison");
      } else if (newTab === "synthesis") {
        setOutputStyle("narrative");
      }

      if (
        (newTab === "compare" || newTab === "synthesis") &&
        loader.bookmarks.length === 0
      ) {
        loader.loadBookmarks(1);
      }
    },
    [pathname, searchParams, router, loader, selection],
  );

  const buttonText = useMemo(() => {
    if (actions.isCreating) return "创建中...";
    if (selection.selectedCount === 0) {
      return activeTab === "compare"
        ? "请选择 2 篇内容"
        : "请选择 3 篇以上内容";
    }
    if (activeTab === "compare") {
      if (selection.selectedCount < 2)
        return `还需选择 ${2 - selection.selectedCount} 篇`;
      return "开始对比";
    }
    if (selection.selectedCount < 3)
      return `还需选择 ${3 - selection.selectedCount} 篇`;
    return "开始综述";
  }, [actions.isCreating, selection.selectedCount, activeTab]);

  const tabHint =
    activeTab === "compare"
      ? "选择 2 篇内容，AI 将对比它们的异同点"
      : "选择 3 篇以上内容，AI 将综合萃取知识精华";

  const selectionPanelProps = {
    bookmarks: loader.bookmarks,
    isLoadingBookmarks: loader.isLoadingBookmarks,
    bookmarkSearch: loader.bookmarkSearch,
    onSearchChange: loader.setBookmarkSearch,
    selectedIds: selection.selectedIds,
    selectedCount: selection.selectedCount,
    onToggleSelection: selection.toggleSelection,
    hasMore: loader.hasMore,
    isLoadingMore: loader.isLoadingMore,
    onLoadMore: loader.handleLoadMore,
    canStartAnalysis,
    isCreating: actions.isCreating,
    buttonText,
    onStartAnalysis: actions.handleStartAnalysis,
  } as const;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="container max-w-4xl pt-6 pb-2">
        <h1 className="text-2xl font-bold">内容分析</h1>
      </div>

      <div className="container max-w-4xl pb-4">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger
              value="compare"
              className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
            >
              <GitCompare className="h-4 w-4" />
              对比分析
            </TabsTrigger>
            <TabsTrigger
              value="synthesis"
              className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
            >
              <Layers className="h-4 w-4" />
              主题综述
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
            >
              <History className="h-4 w-4" />
              历史记录
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compare" className="mt-0">
            <BookmarkSelectionPanel
              mode="compare"
              hint={tabHint}
              {...selectionPanelProps}
            />
          </TabsContent>

          <TabsContent value="synthesis" className="mt-0">
            <BookmarkSelectionPanel
              mode="synthesis"
              hint={tabHint}
              {...selectionPanelProps}
              depthMode={depthMode}
              outputStyle={outputStyle}
              onDepthModeChange={setDepthMode}
              onOutputStyleChange={setOutputStyle}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <HistoryTab
              reports={data?.data || []}
              isLoading={isLoading}
              error={error}
              pagination={data?.pagination}
              search={search}
              onSearchChange={setSearch}
              sortValue={sortValue}
              onSortChange={setSortValue}
              depthFilter={depthFilter}
              onDepthFilterChange={setDepthFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onDelete={actions.handleDelete}
              onRetry={actions.handleRetry}
              onRefetch={refetch}
            />
          </TabsContent>
        </Tabs>
      </div>

      <DeleteReportDialog
        target={actions.deleteTarget}
        isDeleting={actions.isDeleting}
        onConfirm={actions.confirmDelete}
        onCancel={actions.cancelDelete}
      />
    </div>
  );
}
