/**
 * v3对比v4 - 主页面组件
 */

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GitCompareArrows,
  Play,
  RotateCcw,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import { TestInputCard } from "./TestInputCard";
import { ConfigCard } from "./ConfigCard";
import { CompareTable } from "./CompareTable";
import { DiffAnalysis } from "./DiffAnalysis";
import { useVersionCompare } from "../hooks/useVersionCompare";

export function VersionComparePage() {
  const {
    isLoading,
    bookmark,
    scenario,
    versions,
    result,
    error,
    setBookmark,
    setScenario,
    toggleVersion,
    executeCompare,
    reset,
  } = useVersionCompare();

  // 验证输入
  const isInputValid =
    bookmark.url.trim() !== "" && bookmark.title.trim() !== "";
  const selectedCount = Object.values(versions).filter(Boolean).length;
  const canExecute = isInputValid && selectedCount >= 2 && !isLoading;

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitCompareArrows className="w-6 h-6" />
            智能分类版本对比
          </h1>
          <p className="text-muted-foreground text-sm">
            V3 vs V4.1 vs V4.2 分类效果对比分析
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-purple-600 border-purple-600"
          >
            DEV
          </Badge>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-1" />
            重置
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 输入和配置 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TestInputCard
            value={bookmark}
            onChange={setBookmark}
            disabled={isLoading}
          />
        </div>
        <div>
          <ConfigCard
            scenario={scenario}
            versions={versions}
            onScenarioChange={setScenario}
            onVersionToggle={toggleVersion}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* 执行按钮 */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={executeCompare}
          disabled={!canExecute}
          className="min-w-[180px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              对比中...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              开始对比
            </>
          )}
        </Button>
      </div>

      {/* 结果展示 */}
      {result?.success && (
        <div className="space-y-4">
          <CompareTable results={result.results} />
          <DiffAnalysis diffs={result.diffs} />
        </div>
      )}

      {/* 使用说明 */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>功能说明：</strong>
              对比 V3、V4.1、V4.2 三个版本的智能分类效果，帮助评估版本升级效果。
            </p>
            <p>
              <strong>版本特点：</strong>
              V3 基础版 | V4.1 简化版（统一向量搜索）| V4.2
              增强版（完整类型系统+原子操作）
            </p>
            <p>
              <strong>数据隔离：</strong>
              所有测试在 dry-run
              模式下执行，不会影响生产数据。结果不持久化，刷新即失效。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
