/**
 * Knowledge Studio v2 - 主页面客户端组件
 * @module knowledge-studio/v2
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Sparkles, AlertCircle } from "lucide-react";
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
  BlueprintSelectorV2,
  ScenarioQuickEntry,
  BlueprintRecommendations,
  MaterialRecommendations,
  type BlueprintListItem,
} from "@/components/knowledge-studio/v2";
import { MaterialSelector } from "@/components/knowledge-studio/material-selector";
import { useBookmarks } from "@/hooks/queries/use-bookmarks";
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
 * 获取蓝图列表
 */
function useBlueprintList() {
  const [blueprints, setBlueprints] = useState<BlueprintListItem[]>([]);
  const [userTier, setUserTier] = useState<"free" | "pro" | "enterprise">(
    "free",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBlueprints() {
      try {
        const response = await fetch("/api/knowledge-studio/v2/blueprints");
        if (!response.ok) {
          throw new Error("Failed to fetch blueprints");
        }
        const data = await response.json();
        setBlueprints(data.blueprints);
        setUserTier(data.userTier);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    fetchBlueprints();
  }, []);

  return { blueprints, userTier, isLoading, error };
}

// ============================================================
// Component
// ============================================================

export function KnowledgeStudioV2PageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { blueprints, userTier, isLoading, error } = useBlueprintList();

  // 检查 URL 错误参数
  const errorType = searchParams?.get("error") ?? null;

  // 获取书签数据
  const { data: bookmarksData, isLoading: isLoadingBookmarks } = useBookmarks({
    limit: 100,
  });
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
    <div className="container max-w-6xl py-8 space-y-8">
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

      {/* 页面标题 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">知识工坊</h1>
          <Badge variant="secondary" className="text-xs">
            Beta
          </Badge>
        </div>
        <p className="text-muted-foreground">
          选择增强蓝图和素材，生成专业内容
        </p>
      </div>

      {/* 步骤指示器 */}
      <div className="flex items-center gap-4">
        <div
          className={`flex items-center gap-2 ${
            step === "blueprint" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
              step === "blueprint"
                ? "border-primary bg-primary text-primary-foreground"
                : selectedBlueprintId
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted-foreground"
            }`}
          >
            1
          </div>
          <span className="font-medium">选择蓝图</span>
        </div>

        <div className="flex-1 h-0.5 bg-border" />

        <div
          className={`flex items-center gap-2 ${
            step === "materials" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
              step === "materials"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground"
            }`}
          >
            2
          </div>
          <span className="font-medium">选择素材</span>
        </div>

        <div className="flex-1 h-0.5 bg-border" />

        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-muted-foreground">
            3
          </div>
          <span className="font-medium">生成内容</span>
        </div>
      </div>

      {/* 主内容区 */}
      {step === "blueprint" && (
        <div className="space-y-6">
          {/* Phase 2: 场景快速入口 */}
          <ScenarioQuickEntry onSelect={handleBlueprintSelect} />

          {/* 蓝图选择区域（左侧推荐 + 右侧网格） */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* 左侧推荐栏 */}
            <div className="lg:col-span-2 order-2 lg:order-1">
              <BlueprintRecommendations
                onSelect={handleBlueprintSelect}
                selectedBlueprintId={selectedBlueprintId}
              />
            </div>

            {/* 右侧蓝图网格 */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    选择蓝图
                  </CardTitle>
                  <CardDescription>
                    选择一个增强蓝图来定义生成内容的类型和格式
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BlueprintSelectorV2
                    blueprints={blueprints}
                    value={selectedBlueprintId}
                    onChange={handleBlueprintSelect}
                    userTier={userTier}
                    onUpgradeClick={handleUpgrade}
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {step === "materials" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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
                      <span className="text-2xl">{selectedBlueprint.icon}</span>
                      <span className="font-medium">
                        {selectedBlueprint.displayName}
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingBookmarks ? (
                  <div className="py-12 text-center text-muted-foreground">
                    加载中...
                  </div>
                ) : materials.length === 0 ? (
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
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevStep}
          disabled={step === "blueprint"}
        >
          上一步
        </Button>

        <Button
          onClick={handleNextStep}
          disabled={
            (step === "blueprint" && !selectedBlueprintId) ||
            (step === "materials" && selectedMaterialIds.length < 2)
          }
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
