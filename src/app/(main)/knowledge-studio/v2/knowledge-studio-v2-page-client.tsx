/**
 * Knowledge Studio v2 - 主页面客户端组件
 * @module knowledge-studio/v2
 *
 * 性能优化 V1.1.0:
 * - 使用 useBlueprints hook（TanStack Query 缓存，二次访问秒开）
 * - 减少初始书签加载数量（50 → 20）
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, BookOpen, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BlueprintSelectorV2,
  MaterialRecommendations,
} from "@/components/knowledge-studio/v2";
import { MaterialSelector } from "@/components/knowledge-studio/material-selector";
import { useBookmarks } from "@/hooks/queries/use-bookmarks";
import { useBlueprints } from "@/hooks/queries/use-blueprints";
import {
  MATERIAL_LIMITS,
  MATERIAL_SELECTOR_TEXT,
} from "@/lib/knowledge-studio/v2/constants";

// ============================================================
// Types
// ============================================================

type Step = "blueprint" | "materials";

// ============================================================
// Hooks
// ============================================================

/**
 * Debounce hook - 延迟更新值
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================
// Component
// ============================================================

export function KnowledgeStudioV2PageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // V1.1.0: 使用 TanStack Query 缓存的 useBlueprints hook
  const { blueprints, userTier, isLoading, error } = useBlueprints();

  // 检查 URL 错误参数
  const errorType = searchParams?.get("error") ?? null;

  // 平台筛选状态
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);

  // 素材搜索状态（后端搜索）
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(materialSearchQuery, 300);

  // V1.1.0: 减少初始加载数量（50 → 20），搜索时加载 50 条
  const {
    data: bookmarksData,
    isLoading: isLoadingBookmarks,
    isFetching: isFetchingBookmarks,
  } = useBookmarks({
    limit: debouncedSearchQuery ? 50 : 20,
    platform: platformFilter || undefined,
    search: debouncedSearchQuery || undefined,
  });

  // 判断是否正在搜索（输入与 debounced 不同，或正在请求）
  const isSearching =
    materialSearchQuery !== debouncedSearchQuery || isFetchingBookmarks;
  const bookmarks = useMemo(
    () => bookmarksData?.items || [],
    [bookmarksData?.items],
  );

  // 转换书签为素材格式
  const materials = useMemo(
    () =>
      bookmarks.map((b) => ({
        id: String(b.id),
        title: b.title || "无标题",
        url: b.url,
        platform: b.platform || undefined,
        summary: b.aiSummary || undefined,
        createdAt: new Date(b.createdAt),
      })),
    [bookmarks],
  );

  const [step, setStep] = useState<Step>("blueprint");
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<
    string | undefined
  >(() => {
    // 读取历史页面传递的预选蓝图（初始化时读取）
    if (typeof window !== "undefined") {
      const preselectBlueprint = sessionStorage.getItem(
        "ks-v2-preselect-blueprint",
      );
      if (preselectBlueprint) {
        // 一次性使用后清除
        sessionStorage.removeItem("ks-v2-preselect-blueprint");
        return preselectBlueprint;
      }
    }
    return undefined;
  });
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);

  // 获取选中的蓝图信息
  const selectedBlueprint = blueprints.find(
    (bp) => bp.blueprintId === selectedBlueprintId,
  );

  // 清除 URL 错误参数
  useEffect(() => {
    if (errorType) {
      // 3秒后清除 URL 参数
      const timer = setTimeout(() => {
        router.replace("/knowledge-studio/v2", { scroll: false });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorType, router]);

  /**
   * 处理蓝图选择
   */
  const handleBlueprintSelect = useCallback((blueprintId: string) => {
    setSelectedBlueprintId(blueprintId);
  }, []);

  /**
   * 处理素材选择变更
   */
  const handleMaterialsChange = useCallback((selectedIds: string[]) => {
    setSelectedMaterialIds(selectedIds);
  }, []);

  /**
   * 处理从推荐中添加素材
   */
  const handleAddMaterial = useCallback(
    (materialId: string) => {
      if (
        !selectedMaterialIds.includes(materialId) &&
        selectedMaterialIds.length < MATERIAL_LIMITS.HARD_MAX
      ) {
        setSelectedMaterialIds((prev) => [...prev, materialId]);
      }
    },
    [selectedMaterialIds],
  );

  /**
   * 进入下一步
   */
  const handleNextStep = useCallback(() => {
    if (step === "blueprint" && selectedBlueprintId) {
      setStep("materials");
    } else if (
      step === "materials" &&
      selectedMaterialIds.length > 0 &&
      selectedBlueprintId
    ) {
      // 从选中的 ID 提取完整素材信息
      const selectedBookmarks = bookmarks.filter((b) =>
        selectedMaterialIds.includes(String(b.id)),
      );
      const materialsToStore = selectedBookmarks.map((b) => ({
        bookmarkId: String(b.id),
        title: b.title || "无标题",
        content: b.aiSummary || b.description || "",
        url: b.url,
        platform: b.platform || undefined,
      }));

      // 将素材信息存储到 sessionStorage
      sessionStorage.setItem(
        "ks-v2-materials",
        JSON.stringify(materialsToStore),
      );
      // 跳转到蓝图工作流页面
      router.push(`/knowledge-studio/v2/${selectedBlueprintId}`);
    }
  }, [step, selectedBlueprintId, selectedMaterialIds, bookmarks, router]);

  /**
   * 返回上一步
   */
  const handlePrevStep = useCallback(() => {
    if (step === "materials") {
      setStep("blueprint");
    }
  }, [step]);

  /**
   * 处理升级
   */
  const handleUpgrade = useCallback(() => {
    router.push("/pricing");
  }, [router]);

  // 错误状态
  if (error) {
    return (
      <div className="container max-w-6xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 space-y-4">
      {/* 错误提示 */}
      {errorType === "invalid-materials" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>素材数据异常</AlertTitle>
          <AlertDescription>
            会话数据已过期或损坏，请重新选择素材后继续
          </AlertDescription>
        </Alert>
      )}

      {/* 页面标题 - 紧凑版 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">知识工坊</h1>
          <Badge variant="secondary" className="text-xs">
            Beta
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          选择增强蓝图和素材，生成专业内容
        </p>
      </div>

      {/* 主内容区 - P0-6: 步骤切换动画 */}
      <AnimatePresence mode="wait">
        {step === "blueprint" && (
          <motion.div
            key="blueprint"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* 蓝图选择区域 - 紧凑���局，无 Card 包裹 */}
            <BlueprintSelectorV2
              blueprints={blueprints}
              value={selectedBlueprintId}
              onChange={handleBlueprintSelect}
              userTier={userTier}
              onUpgradeClick={handleUpgrade}
              isLoading={isLoading}
            />
          </motion.div>
        )}

        {step === "materials" && (
          <motion.div
            key="materials"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-6"
          >
            {/* 左侧推荐栏 */}
            <div className="lg:col-span-2 order-2 lg:order-1">
              <MaterialRecommendations
                selectedMaterialIds={selectedMaterialIds}
                onAddMaterial={handleAddMaterial}
                maxSelection={MATERIAL_LIMITS.HARD_MAX}
              />
            </div>

            {/* 右侧素材选择 */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        选择素材
                      </CardTitle>
                      <CardDescription>
                        {MATERIAL_SELECTOR_TEXT.LABEL}
                      </CardDescription>
                    </div>
                    {selectedBlueprint && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-2xl">
                          {selectedBlueprint.icon}
                        </span>
                        <span className="font-medium">
                          {selectedBlueprint.displayName}
                        </span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* P0-1: 平台筛选器 */}
                  <div className="flex items-center gap-2 mb-4">
                    <Select
                      value={platformFilter ?? "all"}
                      onValueChange={(v) =>
                        setPlatformFilter(v === "all" ? null : v)
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="全部平台" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部平台</SelectItem>
                        <SelectItem value="wechat">微信公众号</SelectItem>
                        <SelectItem value="bilibili">B站</SelectItem>
                        <SelectItem value="zhihu">知乎</SelectItem>
                        <SelectItem value="xiaohongshu">小红书</SelectItem>
                        <SelectItem value="browser">浏览器书签</SelectItem>
                      </SelectContent>
                    </Select>
                    {platformFilter && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPlatformFilter(null)}
                      >
                        清除筛选
                      </Button>
                    )}
                  </div>

                  {/* 初始加载状态（非搜索时） */}
                  {isLoadingBookmarks && !materialSearchQuery ? (
                    <div className="py-12 text-center text-muted-foreground">
                      加载中...
                    </div>
                  ) : /* 仅在非搜索、非请求中时显示空状态 */
                  materials.length === 0 &&
                    !materialSearchQuery &&
                    !isFetchingBookmarks ? (
                    <div className="py-12 text-center">
                      <p className="text-muted-foreground mb-4">
                        暂无收藏内容，请先添加一些收藏
                      </p>
                      <Button asChild variant="outline">
                        <a href="/home">去添加收藏</a>
                      </Button>
                    </div>
                  ) : (
                    <MaterialSelector
                      materials={materials}
                      selected={selectedMaterialIds}
                      onChange={handleMaterialsChange}
                      maxSelection={MATERIAL_LIMITS.HARD_MAX}
                      searchQuery={materialSearchQuery}
                      onSearchChange={setMaterialSearchQuery}
                      isSearching={isSearching}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 操作按钮 - P0-6: 按钮微动效 */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevStep}
          disabled={step === "blueprint"}
          className="transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          上一步
        </Button>

        <Button
          onClick={handleNextStep}
          disabled={
            (step === "blueprint" && !selectedBlueprintId) ||
            (step === "materials" && selectedMaterialIds.length < 2)
          }
          className="transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          {step === "materials" ? (
            <>
              开始生成
              <Sparkles className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              下一步
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
