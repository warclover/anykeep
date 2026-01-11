"use client";

/**
 * AI 助手调试页面
 *
 * 功能：
 * - 动态开关 Feature Flags 观察响应速度
 * - 一键切换最快模式/默认模式
 * - 实时查看当前配置状态
 * - 配置导入/导出
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Zap,
  RotateCcw,
  Download,
  Upload,
  Settings2,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Pickaxe,
} from "lucide-react";
import { RuleCandidateReview } from "@/components/dev/rule-candidate-review";
import {
  getAIDebugConfig,
  updateFeatureFlag,
  resetAIDebugConfig,
  applyFastestMode,
  setDebugEnabled,
  exportConfigAsJson,
  importConfigFromJson,
  AI_DEBUG_CONFIG_CHANGED,
} from "@/lib/ai-debug";
import {
  FEATURE_FLAG_META,
  type AIDebugConfig,
  type AIDebugFeatureFlags,
  type FeatureFlagMeta,
} from "@/lib/ai-debug/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================
// 组件：Feature Flag 开关项
// ============================================

interface FeatureFlagItemProps {
  meta: FeatureFlagMeta;
  value: boolean | null;
  enabled: boolean;
  onChange: (value: boolean | null) => void;
}

function FeatureFlagItem({
  meta,
  value,
  enabled,
  onChange,
}: FeatureFlagItemProps) {
  // 计算当前有效值
  const effectiveValue = value === null ? meta.envDefault : value;
  const isOverridden = value !== null;

  // 三态切换：null -> true -> false -> null
  const handleToggle = () => {
    if (!enabled) return;

    if (value === null) {
      // 如果环境变量默认是 true，切换到 false
      // 如果环境变量默认是 false，切换到 true
      onChange(!meta.envDefault);
    } else if (value === !meta.envDefault) {
      // 已经是相反值，切换到同值
      onChange(meta.envDefault);
    } else {
      // 恢复为 null（使用默认值）
      onChange(null);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between py-3 px-4 rounded-lg border",
        enabled && isOverridden
          ? value
            ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
            : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
          : "border-transparent hover:bg-muted/50",
        !enabled && "opacity-60",
      )}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{meta.label}</span>
          {isOverridden && (
            <Badge
              variant={value ? "default" : "destructive"}
              className="text-xs"
            >
              {value ? "强制启用" : "强制禁用"}
            </Badge>
          )}
          {!isOverridden && (
            <Badge variant="outline" className="text-xs">
              默认: {meta.envDefault ? "开" : "关"}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {meta.description}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {/* 性能影响指示器 */}
        <div
          className="flex items-center gap-1"
          title={`性能影响: ${meta.performanceImpact}/5`}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-3 rounded-sm",
                i < meta.performanceImpact
                  ? meta.performanceImpact >= 4
                    ? "bg-red-500"
                    : meta.performanceImpact >= 2
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  : "bg-muted",
              )}
            />
          ))}
        </div>
        <Switch
          checked={effectiveValue}
          onCheckedChange={handleToggle}
          disabled={!enabled}
        />
      </div>
    </div>
  );
}

// ============================================
// 组件：分类卡片
// ============================================

interface CategoryCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  flags: FeatureFlagMeta[];
  config: AIDebugConfig;
  onFlagChange: (key: keyof AIDebugFeatureFlags, value: boolean | null) => void;
}

function CategoryCard({
  title,
  description,
  icon,
  flags,
  config,
  onFlagChange,
}: CategoryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {flags.map((meta) => (
          <FeatureFlagItem
            key={meta.key}
            meta={meta}
            value={config.featureFlags[meta.key]}
            enabled={config.enabled}
            onChange={(value) => onFlagChange(meta.key, value)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================
// 主页面组件
// ============================================

export default function AIDebugPage() {
  // 使用函数初始化 state，避免在 effect 中调用 setState
  const [config, setConfigState] = useState<AIDebugConfig | null>(() => {
    if (typeof window !== "undefined") {
      return getAIDebugConfig();
    }
    return null;
  });
  const [exportJson, setExportJson] = useState("");
  const [importJson, setImportJson] = useState("");

  // 监听配置变更（仅订阅/取消订阅）
  useEffect(() => {
    const handleChange = () => {
      setConfigState(getAIDebugConfig());
    };
    window.addEventListener(AI_DEBUG_CONFIG_CHANGED, handleChange);
    return () =>
      window.removeEventListener(AI_DEBUG_CONFIG_CHANGED, handleChange);
  }, []);

  // 处理 Flag 变更
  const handleFlagChange = useCallback(
    (key: keyof AIDebugFeatureFlags, value: boolean | null) => {
      updateFeatureFlag(key, value);
    },
    [],
  );

  // 启用/禁用调试
  const handleEnableChange = useCallback((enabled: boolean) => {
    setDebugEnabled(enabled);
  }, []);

  // 应用最快模式
  const handleApplyFastest = useCallback(() => {
    applyFastestMode();
    toast.success("已应用最快模式", {
      description: "所有可能影响速度的功能已禁用",
    });
  }, []);

  // 重置配置
  const handleReset = useCallback(() => {
    resetAIDebugConfig();
    toast.success("已重置配置", {
      description: "所有设置已恢复默认值",
    });
  }, []);

  // 导出配置
  const handleExport = useCallback(() => {
    const json = exportConfigAsJson();
    setExportJson(json);
    toast.success("配置已导出", {
      description: "您可以复制下方的 JSON 内容",
    });
  }, []);

  // 复制配置
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败");
    }
  }, [exportJson]);

  // 导入配置
  const handleImport = useCallback(() => {
    if (!importJson.trim()) {
      toast.error("请输入配置 JSON");
      return;
    }

    const success = importConfigFromJson(importJson);
    if (success) {
      setImportJson("");
      toast.success("配置已导入", {
        description: "新配置已生效",
      });
    } else {
      toast.error("导入失败", {
        description: "JSON 格式无效",
      });
    }
  }, [importJson]);

  if (!config) {
    return (
      <div className="container py-6">
        <div className="animate-pulse">加载中...</div>
      </div>
    );
  }

  // 按分类分组 flags
  const coreFlags = FEATURE_FLAG_META.filter((f) => f.category === "core");
  const optionalFlags = FEATURE_FLAG_META.filter(
    (f) => f.category === "optional",
  );
  const debugFlags = FEATURE_FLAG_META.filter((f) => f.category === "debug");

  // 计算统计
  const activeOverrides = Object.entries(config.featureFlags).filter(
    ([, v]) => v !== null,
  ).length;
  const disabledCount = Object.entries(config.featureFlags).filter(
    ([, v]) => v === false,
  ).length;

  return (
    <div className="container py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI 助手调试</h1>
          <p className="text-muted-foreground">
            动态调整 Feature Flags 以观察 AI 助手的响应速度变化
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="debug-enabled" className="text-sm">
            启用调试覆盖
          </Label>
          <Switch
            id="debug-enabled"
            checked={config.enabled}
            onCheckedChange={handleEnableChange}
          />
        </div>
      </div>

      {/* 状态概览 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                {config.enabled ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-sm">
                  {config.enabled ? "调试模式已启用" : "使用环境变量默认值"}
                </span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {activeOverrides} 个覆盖 · {disabledCount} 个禁用
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                重置
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleApplyFastest}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              >
                <Zap className="h-4 w-4 mr-1" />
                一键最快模式
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 主要内容 */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance" className="gap-2">
            <Zap className="h-4 w-4" />
            性能优化
          </TabsTrigger>
          <TabsTrigger value="rule-mining" className="gap-2">
            <Pickaxe className="h-4 w-4" />
            规则挖掘
          </TabsTrigger>
          <TabsTrigger value="debug" className="gap-2">
            <Activity className="h-4 w-4" />
            调试信息
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Settings2 className="h-4 w-4" />
            导入/导出
          </TabsTrigger>
        </TabsList>

        {/* 性能优化标签页 */}
        <TabsContent value="performance" className="space-y-4">
          <CategoryCard
            title="核心优化"
            description="这些选项对响应速度影响最大，禁用可显著提升速度"
            icon={<Zap className="h-5 w-5 text-orange-500" />}
            flags={coreFlags}
            config={config}
            onFlagChange={handleFlagChange}
          />

          <CategoryCard
            title="可选优化"
            description="这些选项影响较小，可根据需求选择性禁用"
            icon={<Settings2 className="h-5 w-5 text-blue-500" />}
            flags={optionalFlags}
            config={config}
            onFlagChange={handleFlagChange}
          />
        </TabsContent>

        {/* 规则挖掘标签页 */}
        <TabsContent value="rule-mining" className="space-y-4">
          <RuleCandidateReview />
        </TabsContent>

        {/* 调试信息标签页 */}
        <TabsContent value="debug" className="space-y-4">
          <CategoryCard
            title="调试信息"
            description="启用这些选项可以获取更多调试信息"
            icon={<Activity className="h-5 w-5 text-purple-500" />}
            flags={debugFlags}
            config={config}
            onFlagChange={handleFlagChange}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">当前配置状态</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-64">
                {JSON.stringify(config, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 导入/导出标签页 */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">导出配置</CardTitle>
              <CardDescription>
                将当前配置导出为 JSON 格式，可用于备份或分享
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                生成导出内容
              </Button>
              {exportJson && (
                <>
                  <Textarea
                    value={exportJson}
                    readOnly
                    className="font-mono text-xs h-40"
                  />
                  <Button variant="secondary" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-2" />
                    复制到剪贴板
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">导入配置</CardTitle>
              <CardDescription>
                从 JSON 格式导入配置，将覆盖当前设置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="粘贴 JSON 配置内容..."
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                className="font-mono text-xs h-40"
              />
              <Button variant="outline" onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />
                导入配置
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 使用提示 */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">使用说明</p>
              <ul className="list-disc list-inside space-y-1">
                <li>启用「调试覆盖」后，您的设置将覆盖环境变量默认值</li>
                <li>设置会通过 Cookie 传递给 API，刷新页面后保持</li>
                <li>点击开关可在 启用/禁用/默认 三种状态间切换</li>
                <li>「一键最快模式」将禁用所有可能影响速度的功能</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
