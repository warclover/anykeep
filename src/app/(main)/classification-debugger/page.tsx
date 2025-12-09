"use client";

import { useState } from "react";
import {
  BrainCircuit,
  Play,
  Settings2,
  RefreshCw,
  Zap,
  Target,
  Database,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// 调试结果类型
interface ClassificationDebugResult {
  classification: {
    action: string;
    folderId: number | null;
    folderName: string;
    confidence: number;
    reason: string;
    scores: {
      vectorScore: number;
      historyScore: number;
      aiScore: number;
    };
  };
  // 支持 meta 或 metrics 字段名
  meta?: {
    tierCounts?: {
      tier1?: number;
      tier2?: number;
      tier3?: number;
    };
    aiSavingsRate?: number;
  };
  metrics?: {
    tierCounts?: {
      tier1?: number;
      tier2?: number;
      tier3?: number;
    };
    aiSavingsRate?: number;
  };
  // 其他可能的字段
  [key: string]: unknown;
}

// 默认配置
const DEFAULT_CONFIG = {
  highConfidenceThreshold: 80,
  mediumConfidenceThreshold: 60,
  autoCreateConfidenceThreshold: 75,
  tieredOptimizationEnabled: true,
  metricsEnabled: true,
  enableKnnDirect: true,
  enableFolderFingerprint: true,
  enableTagMatcher: true,
  enableUniversalCategories: true,
};

export default function ClassificationDebuggerPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [input, setInput] = useState({
    url: "",
    title: "",
    summary: "",
    tags: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassificationDebugResult | null>(null);

  const handleRun = async () => {
    if (!input.title && !input.url) {
      toast.error("请输入标题或 URL");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/classification/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          tags: input.tags
            ? input.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
          config: {
            highConfidenceThreshold: config.highConfidenceThreshold,
            mediumConfidenceThreshold: config.mediumConfidenceThreshold,
            autoCreateConfidenceThreshold: config.autoCreateConfidenceThreshold,
            tieredOptimizationEnabled: config.tieredOptimizationEnabled,
            metricsEnabled: config.metricsEnabled,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "请求失败");
      }

      setResult(data.data);
      toast.success("分类测试完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "测试失败");
    } finally {
      setLoading(false);
    }
  };

  const fillExample = () => {
    setInput({
      url: "https://github.com/features/actions",
      title: "GitHub Actions - Automate your workflow from idea to production",
      summary:
        "GitHub Actions makes it easy to automate all your software workflows, now with world-class CI/CD. Build, test, and deploy your code right from GitHub.",
      tags: "devops, ci/cd, automation",
    });
  };

  return (
    <div className="container mx-auto p-4 lg:p-8 max-w-7xl space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <BrainCircuit className="size-8 text-purple-600" />
            智能分类调试台
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            V3.0 算法参数调优与准确性测试工具
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fillExample}>
            填充示例数据
          </Button>
          <Button
            onClick={handleRun}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <RefreshCw className="mr-2 size-4 animate-spin" />
            ) : (
              <Play className="mr-2 size-4" />
            )}
            开始测试
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧：配置与输入 */}
        <div className="lg:col-span-4 space-y-6">
          {/* 算法参数配置 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="size-4" />
                算法参数配置
              </CardTitle>
              <CardDescription>实时调整分类阈值与策略开关</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tiered-opt" className="flex flex-col gap-1">
                    <span>分层优化策略</span>
                    <span className="text-xs font-normal text-gray-500">
                      启用后优先使用快速匹配，减少 AI 调用
                    </span>
                  </Label>
                  <Switch
                    id="tiered-opt"
                    checked={config.tieredOptimizationEnabled}
                    onCheckedChange={(c) =>
                      setConfig((prev) => ({
                        ...prev,
                        tieredOptimizationEnabled: c,
                      }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>高置信度阈值 (Tier 1)</Label>
                    <span className="text-sm font-medium text-purple-600">
                      {config.highConfidenceThreshold}%
                    </span>
                  </div>
                  <Slider
                    value={[config.highConfidenceThreshold]}
                    onValueChange={(v) =>
                      setConfig((prev) => ({
                        ...prev,
                        highConfidenceThreshold: v[0],
                      }))
                    }
                    max={100}
                    step={1}
                    className="py-2"
                  />
                  <p className="text-xs text-gray-500">
                    超过此分数直接分类，跳过 AI 确认 (节省成本)
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>中置信度阈值 (Tier 2)</Label>
                    <span className="text-sm font-medium text-blue-600">
                      {config.mediumConfidenceThreshold}%
                    </span>
                  </div>
                  <Slider
                    value={[config.mediumConfidenceThreshold]}
                    onValueChange={(v) =>
                      setConfig((prev) => ({
                        ...prev,
                        mediumConfidenceThreshold: v[0],
                      }))
                    }
                    max={100}
                    step={1}
                    className="py-2"
                  />
                  <p className="text-xs text-gray-500">
                    超过此分数启用 AI 确认，否则进入自动创建评估
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 测试数据输入 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="size-4" />
                测试数据
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL (可选)</Label>
                <Input
                  placeholder="https://..."
                  value={input.url}
                  onChange={(e) =>
                    setInput((prev) => ({ ...prev, url: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  标题 <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="输入书签标题..."
                  value={input.title}
                  onChange={(e) =>
                    setInput((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>摘要/描述</Label>
                <Textarea
                  placeholder="输入内容摘要..."
                  rows={4}
                  value={input.summary}
                  onChange={(e) =>
                    setInput((prev) => ({ ...prev, summary: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>标签 (逗号分隔)</Label>
                <Input
                  placeholder="tech, news, design..."
                  value={input.tags}
                  onChange={(e) =>
                    setInput((prev) => ({ ...prev, tags: e.target.value }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：结果展示 */}
        <div className="lg:col-span-8 space-y-6">
          {result ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* 最终结果卡片 */}
              <Card className="border-l-4 border-l-purple-500 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="size-5 text-purple-600" />
                      分类决策结果
                    </span>
                    <Badge
                      variant={
                        result.classification.action === "classify"
                          ? "default"
                          : result.classification.action === "suggest_create"
                            ? "secondary"
                            : "outline"
                      }
                      className="text-base px-3 py-1"
                    >
                      {result.classification.action === "classify"
                        ? "自动归类"
                        : result.classification.action === "suggest_create"
                          ? "建议创建"
                          : result.classification.action === "suggest_new"
                            ? "推荐新文件夹"
                            : "待整理"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    基于 V3.0 分层策略的最终判定
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">
                        目标文件夹
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        {result.classification.folderName}
                        {result.classification.folderId && (
                          <span className="text-xs font-normal text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                            ID: {result.classification.folderId}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">决策理由</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded-md border">
                        {result.classification.reason}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-2 flex justify-between">
                        <span>最终置信度</span>
                        <span className="font-bold">
                          {result.classification.confidence.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-1000 ease-out",
                            result.classification.confidence >= 80
                              ? "bg-green-500"
                              : result.classification.confidence >= 60
                                ? "bg-blue-500"
                                : "bg-yellow-500",
                          )}
                          style={{
                            width: `${result.classification.confidence}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-900 rounded border">
                        <div className="text-xs text-gray-500">向量匹配</div>
                        <div className="font-semibold">
                          {result.classification.scores.vectorScore.toFixed(0)}
                        </div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-900 rounded border">
                        <div className="text-xs text-gray-500">历史匹配</div>
                        <div className="font-semibold">
                          {result.classification.scores.historyScore.toFixed(0)}
                        </div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-900 rounded border">
                        <div className="text-xs text-gray-500">AI 评分</div>
                        <div className="font-semibold">
                          {result.classification.scores.aiScore.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 性能与成本分析 */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="size-4 text-yellow-500" />
                      性能分析
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-gray-500">Tier 1 (快速匹配)</span>
                        <span>
                          {result.metrics?.tierCounts?.tier1 || 0} hits
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-gray-500">Tier 2 (AI 确认)</span>
                        <span>
                          {result.metrics?.tierCounts?.tier2 || 0} hits
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-gray-500">Tier 3 (自动创建)</span>
                        <span>
                          {result.metrics?.tierCounts?.tier3 || 0} hits
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Share2 className="size-4 text-green-500" />
                      成本节省
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-2">
                      <div className="text-3xl font-bold text-green-600">
                        {result.metrics?.aiSavingsRate || 0}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        AI 调用节省率
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 详细 JSON 数据 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">原始响应数据</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-950 text-gray-50 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 min-h-[400px] border-2 border-dashed rounded-lg bg-gray-50/50 dark:bg-gray-900/20">
              <BrainCircuit className="size-16 mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                准备就绪
              </h3>
              <p className="max-w-sm mt-2">
                输入测试数据并点击【开始测试】以运行智能分类算法。结果将显示在此处。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
