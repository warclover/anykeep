"use client";

/**
 * 智能分类调试工具 - 主页面组件
 *
 * V3 vs V4 vs V4.1 分类对比分析
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FlaskConical, Play, RotateCcw, AlertTriangle } from "lucide-react";

import { BookmarkInput } from "./BookmarkInput";
import { ScenarioSelector } from "./ScenarioSelector";
import { ConfigPanel } from "./ConfigPanel";
import { ResultsCompare } from "./ResultsCompare";
import { useClassificationCompare } from "../hooks";
import type { DebugBookmarkInput } from "../types";

export function DebuggerPage() {
  // 书签输入状态
  const [bookmark, setBookmark] = useState<DebugBookmarkInput>({
    url: "",
    title: "",
    description: "",
  });

  // 使用对比 Hook
  const {
    isLoading,
    selectedScenario,
    selectedPreset,
    lastResult,
    error,
    executeCompare,
    setScenario,
    setPreset,
    clearResult: _clearResult,
    reset,
  } = useClassificationCompare();

  // 验证输入
  const isInputValid =
    bookmark.url.trim() !== "" && bookmark.title.trim() !== "";

  // 执行对比
  const handleExecute = async () => {
    if (!isInputValid) return;
    await executeCompare(bookmark);
  };

  // 重置
  const handleReset = () => {
    setBookmark({ url: "", title: "", description: "" });
    reset();
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6" />
            智能分类调试工具
          </h1>
          <p className="text-muted-foreground">
            V3 vs V4 vs V4.1 分类对比分析 - 开发者工具
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-600 border-green-600">
            DEV
          </Badge>
          <Button variant="outline" size="sm" onClick={handleReset}>
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

      {/* 输入区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 书签输入 */}
        <div className="lg:col-span-2">
          <BookmarkInput
            value={bookmark}
            onChange={setBookmark}
            disabled={isLoading}
          />
        </div>

        {/* 场景和配置 */}
        <div className="space-y-4">
          <ScenarioSelector
            value={selectedScenario}
            onChange={setScenario}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* 配置面板 */}
      <ConfigPanel
        value={selectedPreset}
        onChange={setPreset}
        disabled={isLoading}
      />

      {/* 执行按钮 */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleExecute}
          disabled={!isInputValid || isLoading}
          className="min-w-[200px]"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              执行中...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              执行对比分析
            </>
          )}
        </Button>
      </div>

      {/* 结果区域 */}
      <div className="pt-4">
        <h2 className="text-lg font-semibold mb-4">对比结果</h2>
        <ResultsCompare result={lastResult} />
      </div>

      {/* 使用说明 */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>功能说明：</strong>
              此工具用于对比 V3 和 V4
              智能分类算法的结果差异，帮助开发者调试和优化分类效果。
            </p>
            <p>
              <strong>数据隔离：</strong>
              所有测试操作均在 dry-run 模式下执行，不会影响生产数据。
            </p>
            <p>
              <strong>测试场景：</strong>
              冷启动 - 模拟无历史数据用户；学习期 - 少量历史数据；成熟用户 -
              丰富历史数据； 真实只读 - 使用当前用户真实数据（只读）。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
