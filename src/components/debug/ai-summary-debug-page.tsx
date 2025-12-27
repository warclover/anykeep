/**
 * AI 摘要调试页面
 *
 * 提供可视化的 AI 摘要参数配置和实时测试功能
 * 仅在开发环境可用
 */

"use client";

import { useState, useCallback } from "react";
import {
  Settings2,
  Sliders,
  TestTube2,
  Upload,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebugConfig } from "@/hooks/core";
import {
  exportConfigAsJson,
  importConfigFromJson,
  type AIDebugConfig,
} from "@/lib/classification/config/debug-config-store";
import {
  CONTENT_TYPE_LABELS,
  type ContentType,
} from "@/lib/classification/content-type-detector";

// ==================== 类型定义 ====================

interface TestResult {
  id: string;
  url: string;
  timestamp: Date;
  contentType: ContentType;
  confidence: number;
  summary: string;
  tags: string[];
  latency: number;
  error?: string;
}

// ==================== 子组件 ====================

/**
 * 模型参数编辑器
 */
function ModelParamsEditor({
  config,
  onUpdate,
}: {
  config: AIDebugConfig;
  onUpdate: (updates: Partial<AIDebugConfig>) => void;
}) {
  return (
    <div className="space-y-6">
      {/* API 超时 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>API 超时时间</Label>
          <span className="text-sm text-muted-foreground">
            {config.model.timeout / 1000}s
          </span>
        </div>
        <Slider
          value={[config.model.timeout]}
          min={5000}
          max={30000}
          step={1000}
          onValueChange={(values: number[]) =>
            onUpdate({ model: { ...config.model, timeout: values[0] } })
          }
        />
        <p className="text-xs text-muted-foreground">
          DeepSeek API 请求超时时间（5-30秒）
        </p>
      </div>

      {/* Max Tokens */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>最大生成 Token</Label>
          <span className="text-sm text-muted-foreground">
            {config.model.maxTokens}
          </span>
        </div>
        <Slider
          value={[config.model.maxTokens]}
          min={500}
          max={4000}
          step={100}
          onValueChange={(values: number[]) =>
            onUpdate({ model: { ...config.model, maxTokens: values[0] } })
          }
        />
        <p className="text-xs text-muted-foreground">
          AI 生成内容的最大长度（500-4000）
        </p>
      </div>

      {/* Default Temperature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>默认 Temperature</Label>
          <span className="text-sm text-muted-foreground">
            {config.model.defaultTemperature.toFixed(1)}
          </span>
        </div>
        <Slider
          value={[config.model.defaultTemperature * 10]}
          min={0}
          max={10}
          step={1}
          onValueChange={(values: number[]) =>
            onUpdate({
              model: { ...config.model, defaultTemperature: values[0] / 10 },
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          0.0=精确严谨，1.0=创意发散（当类型专用配置未设置时使用）
        </p>
      </div>
    </div>
  );
}

/**
 * 输出格式编辑器
 */
function OutputFormatEditor({
  config,
  onUpdate,
}: {
  config: AIDebugConfig;
  onUpdate: (updates: Partial<AIDebugConfig>) => void;
}) {
  return (
    <div className="space-y-6">
      {/* JSON 格式开关 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>JSON 结构化输出 (V2)</Label>
          <p className="text-xs text-muted-foreground">
            启用后生成 tldr、key_points、sentiment 等结构化字段
          </p>
        </div>
        <Switch
          checked={config.output.useJsonFormat}
          onCheckedChange={(checked) =>
            onUpdate({ output: { ...config.output, useJsonFormat: checked } })
          }
        />
      </div>

      {/* 摘要长度范围 */}
      <div className="space-y-4">
        <Label>默认摘要长度范围（字符）</Label>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">最小长度</Label>
            <Input
              type="number"
              value={config.output.summaryMinLength}
              onChange={(e) =>
                onUpdate({
                  output: {
                    ...config.output,
                    summaryMinLength: parseInt(e.target.value) || 50,
                  },
                })
              }
              min={50}
              max={500}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">最大长度</Label>
            <Input
              type="number"
              value={config.output.summaryMaxLength}
              onChange={(e) =>
                onUpdate({
                  output: {
                    ...config.output,
                    summaryMaxLength: parseInt(e.target.value) || 500,
                  },
                })
              }
              min={100}
              max={2000}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 内容类型检测权重编辑器
 */
function DetectionWeightsEditor({
  config,
  onUpdate,
}: {
  config: AIDebugConfig;
  onUpdate: (updates: Partial<AIDebugConfig>) => void;
}) {
  const total =
    config.detection.urlWeight +
    config.detection.keywordWeight +
    config.detection.contentWeight;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label>检测权重配置</Label>
        <Badge variant={total === 100 ? "default" : "destructive"}>
          总计: {total}%
        </Badge>
      </div>

      {/* URL 权重 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">URL 规则权重</Label>
          <span className="text-sm text-muted-foreground">
            {config.detection.urlWeight}%
          </span>
        </div>
        <Slider
          value={[config.detection.urlWeight]}
          min={0}
          max={100}
          step={5}
          onValueChange={(values: number[]) =>
            onUpdate({
              detection: { ...config.detection, urlWeight: values[0] },
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          基于 URL 域名和路径匹配（如 bilibili.com → video）
        </p>
      </div>

      {/* 关键词权重 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">关键词权重</Label>
          <span className="text-sm text-muted-foreground">
            {config.detection.keywordWeight}%
          </span>
        </div>
        <Slider
          value={[config.detection.keywordWeight]}
          min={0}
          max={100}
          step={5}
          onValueChange={(values: number[]) =>
            onUpdate({
              detection: { ...config.detection, keywordWeight: values[0] },
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          基于标题和描述中的关键词（如「教程」「入门」→ tutorial）
        </p>
      </div>

      {/* 内容特征权重 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">内容特征权重</Label>
          <span className="text-sm text-muted-foreground">
            {config.detection.contentWeight}%
          </span>
        </div>
        <Slider
          value={[config.detection.contentWeight]}
          min={0}
          max={100}
          step={5}
          onValueChange={(values: number[]) =>
            onUpdate({
              detection: { ...config.detection, contentWeight: values[0] },
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          基于内容结构特征（如代码块、步骤列表）
        </p>
      </div>

      {total !== 100 && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-4" />
          <span>建议权重总和为 100%</span>
        </div>
      )}
    </div>
  );
}

/**
 * 内容类型参数编辑器
 */
function ContentTypeParamsEditor({
  config,
  onUpdate,
}: {
  config: AIDebugConfig;
  onUpdate: (updates: Partial<AIDebugConfig>) => void;
}) {
  const [selectedType, setSelectedType] = useState<ContentType>("article");
  const currentParams = config.contentTypeOverrides[selectedType] || {
    temperature: config.model.defaultTemperature,
    summaryMinLength: config.output.summaryMinLength,
    summaryMaxLength: config.output.summaryMaxLength,
  };

  const updateTypeParams = (
    params: Partial<(typeof config.contentTypeOverrides)[ContentType]>,
  ) => {
    onUpdate({
      contentTypeOverrides: {
        ...config.contentTypeOverrides,
        [selectedType]: {
          ...currentParams,
          ...params,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* 类型选择 */}
      <div className="space-y-2">
        <Label>选择内容类型</Label>
        <Select
          value={selectedType}
          onValueChange={(v) => setSelectedType(v as ContentType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {CONTENT_TYPE_LABELS[type]} ({type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Temperature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Temperature</Label>
          <span className="text-sm text-muted-foreground">
            {currentParams.temperature?.toFixed(1) || "N/A"}
          </span>
        </div>
        <Slider
          value={[(currentParams.temperature || 0.7) * 10]}
          min={0}
          max={10}
          step={1}
          onValueChange={(values: number[]) =>
            updateTypeParams({ temperature: values[0] / 10 })
          }
        />
      </div>

      {/* 摘要长度 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">最小摘要长度</Label>
          <Input
            type="number"
            value={currentParams.summaryMinLength || 100}
            onChange={(e) =>
              updateTypeParams({
                summaryMinLength: parseInt(e.target.value) || 100,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">最大摘要长度</Label>
          <Input
            type="number"
            value={currentParams.summaryMaxLength || 700}
            onChange={(e) =>
              updateTypeParams({
                summaryMaxLength: parseInt(e.target.value) || 700,
              })
            }
          />
        </div>
      </div>

      {/* 类型说明 */}
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <p className="font-medium mb-1">{CONTENT_TYPE_LABELS[selectedType]}</p>
        <p className="text-muted-foreground">
          {selectedType === "article" &&
            "通用文章类型，适用于新闻、博客、观点等内容"}
          {selectedType === "tutorial" &&
            "教程/指南类型，强调步骤清晰和准确性，使用较低 temperature"}
          {selectedType === "video" &&
            "视频内容类型，生成简短摘要，忽略非核心部分"}
          {selectedType === "tool" &&
            "工具/产品介绍，客观中立，保留定价等关键信息"}
        </p>
      </div>
    </div>
  );
}

/**
 * 特性开关编辑器
 */
function FeatureTogglesEditor({
  config,
  onUpdate,
}: {
  config: AIDebugConfig;
  onUpdate: (updates: Partial<AIDebugConfig>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Jina Reader */}
      <div className="flex items-center justify-between p-3 rounded-lg border">
        <div className="space-y-0.5">
          <Label>Jina Reader 内容提取</Label>
          <p className="text-xs text-muted-foreground">
            使用 Jina Reader API 提取网页正文内容（Phase 2）
          </p>
        </div>
        <Switch
          checked={config.features.jinaReader}
          onCheckedChange={(checked) =>
            onUpdate({ features: { ...config.features, jinaReader: checked } })
          }
        />
      </div>

      {/* 模型路由 */}
      <div className="flex items-center justify-between p-3 rounded-lg border">
        <div className="space-y-0.5">
          <Label>智能模型路由</Label>
          <p className="text-xs text-muted-foreground">
            根据内容长度自动切换模型（Phase 3）
          </p>
        </div>
        <Switch
          checked={config.features.modelRouting}
          onCheckedChange={(checked) =>
            onUpdate({
              features: { ...config.features, modelRouting: checked },
            })
          }
        />
      </div>

      {/* 调试日志 */}
      <div className="flex items-center justify-between p-3 rounded-lg border">
        <div className="space-y-0.5">
          <Label>详细调试日志</Label>
          <p className="text-xs text-muted-foreground">
            在控制台输出详细的处理日志
          </p>
        </div>
        <Switch
          checked={config.features.debugLogging}
          onCheckedChange={(checked) =>
            onUpdate({
              features: { ...config.features, debugLogging: checked },
            })
          }
        />
      </div>
    </div>
  );
}

/**
 * 测试面板
 */
function TestPanel({ config }: { config: AIDebugConfig }) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const runTest = useCallback(async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    const startTime = Date.now();

    try {
      const response = await fetch("/api/internal/debug/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          useDebugConfig: config.enabled,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      const result: TestResult = {
        id: Date.now().toString(),
        url: url.trim(),
        timestamp: new Date(),
        contentType: data.contentType,
        confidence: data.confidence,
        summary: data.summary,
        tags: data.tags,
        latency: Date.now() - startTime,
      };

      setResults((prev) => [result, ...prev].slice(0, 10));
    } catch (error) {
      const result: TestResult = {
        id: Date.now().toString(),
        url: url.trim(),
        timestamp: new Date(),
        contentType: "article",
        confidence: 0,
        summary: "",
        tags: [],
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      setResults((prev) => [result, ...prev].slice(0, 10));
    } finally {
      setIsLoading(false);
    }
  }, [url, config.enabled]);

  return (
    <div className="space-y-4">
      {/* 输入区域 */}
      <div className="flex gap-2">
        <Input
          placeholder="输入 URL 测试 AI 摘要效果..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runTest()}
        />
        <Button onClick={runTest} disabled={isLoading || !url.trim()}>
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <TestTube2 className="size-4" />
          )}
          <span className="ml-2">测试</span>
        </Button>
      </div>

      {/* 配置状态提示 */}
      {!config.enabled && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
          <AlertTriangle className="size-4" />
          <span>调试配置未启用，测试将使用默认配置</span>
        </div>
      )}

      {/* 结果列表 */}
      <div className="space-y-3">
        {results.map((result) => (
          <Card key={result.id}>
            <CardContent className="pt-4">
              {result.error ? (
                <div className="text-red-500 text-sm">
                  <p className="font-medium">错误</p>
                  <p>{result.error}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {CONTENT_TYPE_LABELS[result.contentType]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        置信度: {result.confidence}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{result.latency}ms</span>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="text-sm">
                    <p className="text-muted-foreground line-clamp-3">
                      {result.summary}
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {result.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <TestTube2 className="size-8 mx-auto mb-2 opacity-50" />
            <p>输入 URL 并点击测试查看 AI 摘要效果</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 配置操作面板
 */
function ConfigActions({ onReset }: { onReset: () => void }) {
  const [copied, setCopied] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [showImport, setShowImport] = useState(false);

  const handleExport = () => {
    const json = exportConfigAsJson();
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    if (importConfigFromJson(importJson)) {
      setImportJson("");
      setShowImport(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {/* 导出 */}
        <Button variant="outline" size="sm" onClick={handleExport}>
          {copied ? (
            <Check className="size-4 mr-2" />
          ) : (
            <Copy className="size-4 mr-2" />
          )}
          {copied ? "已复制" : "导出配置"}
        </Button>

        {/* 导入 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowImport(!showImport)}
        >
          <Upload className="size-4 mr-2" />
          导入配置
        </Button>

        {/* 重置 */}
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="size-4 mr-2" />
          重置默认
        </Button>
      </div>

      {showImport && (
        <div className="space-y-2">
          <Textarea
            placeholder="粘贴 JSON 配置..."
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            rows={4}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleImport} disabled={!importJson}>
              确认导入
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowImport(false)}
            >
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 主组件 ====================

export function AISummaryDebugPage() {
  const { config, updateConfig, resetConfig, isEnabled } = useDebugConfig();

  if (!isEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="size-12 mx-auto mb-4 text-amber-500" />
            <h2 className="text-lg font-semibold mb-2">仅限开发环境</h2>
            <p className="text-muted-foreground">
              AI 摘要调试系统仅在开发环境中可用
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="size-6 text-primary" />
            AI 摘要调试系统
          </h1>
          <p className="text-muted-foreground mt-1">
            实时调整 AI 摘要参数，即时查看效果
          </p>
        </div>

        {/* 主开关 */}
        <div className="flex items-center gap-3">
          <Label htmlFor="debug-toggle" className="text-sm">
            {config.enabled ? "已启用" : "已禁用"}
          </Label>
          <Switch
            id="debug-toggle"
            checked={config.enabled}
            onCheckedChange={(checked) => updateConfig({ enabled: checked })}
          />
        </div>
      </div>

      {/* 状态卡片 */}
      {config.enabled && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Check className="size-4" />
              <span className="text-sm font-medium">
                调试配置已启用，新的摘要请求将使用当前配置
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 主内容 */}
      <Tabs defaultValue="model" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="model" className="gap-2">
            <Settings2 className="size-4" />
            <span className="hidden sm:inline">模型参数</span>
          </TabsTrigger>
          <TabsTrigger value="output" className="gap-2">
            <Sliders className="size-4" />
            <span className="hidden sm:inline">输出格式</span>
          </TabsTrigger>
          <TabsTrigger value="detection" className="gap-2">
            <Settings2 className="size-4" />
            <span className="hidden sm:inline">内容检测</span>
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-2">
            <Sliders className="size-4" />
            <span className="hidden sm:inline">类型参数</span>
          </TabsTrigger>
          <TabsTrigger value="test" className="gap-2">
            <TestTube2 className="size-4" />
            <span className="hidden sm:inline">测试面板</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="model">
          <Card>
            <CardHeader>
              <CardTitle>模型参数</CardTitle>
              <CardDescription>
                调整 DeepSeek API 调用参数，影响生成质量和响应速度
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModelParamsEditor config={config} onUpdate={updateConfig} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="output">
          <Card>
            <CardHeader>
              <CardTitle>输出格式</CardTitle>
              <CardDescription>控制摘要输出格式和长度限制</CardDescription>
            </CardHeader>
            <CardContent>
              <OutputFormatEditor config={config} onUpdate={updateConfig} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detection">
          <Card>
            <CardHeader>
              <CardTitle>内容类型检测</CardTitle>
              <CardDescription>调整内容类型检测算法的权重分配</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <DetectionWeightsEditor config={config} onUpdate={updateConfig} />
              <hr />
              <FeatureTogglesEditor config={config} onUpdate={updateConfig} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types">
          <Card>
            <CardHeader>
              <CardTitle>类型专用参数</CardTitle>
              <CardDescription>
                为不同内容类型设置专用的 AI 参数
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContentTypeParamsEditor
                config={config}
                onUpdate={updateConfig}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>实时测试</CardTitle>
              <CardDescription>
                输入 URL 测试当前配置下的 AI 摘要效果
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TestPanel config={config} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 配置操作 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">配置管理</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigActions onReset={resetConfig} />
        </CardContent>
      </Card>
    </div>
  );
}
