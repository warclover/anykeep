/**
 * AI Provider 设置卡片
 *
 * 显示 AI Provider 健康状态和电路断路器信息
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Cpu,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  CircleDot,
  Clock,
  Zap,
  RotateCcw,
} from "lucide-react";
import { clientLogger } from "@/lib/client-logger";
import { API_AI } from "@/lib/constants/api-paths";

/** Provider 状态类型 */
type ProviderStatus = "healthy" | "degraded" | "unhealthy";

/** 电路状态类型 */
type CircuitState = "closed" | "open" | "half-open" | "unknown";

/** Provider 信息 */
interface ProviderInfo {
  name: string;
  status: ProviderStatus;
  isAvailable: boolean;
  latencyMs?: number;
  lastCheckedAt?: string;
  errorMessage?: string;
  consecutiveFailures: number;
  circuitState: CircuitState;
  cooldownRemainingMs?: number | null;
  halfOpenProgress?: string | null;
}

/** 电路断路器配置 */
interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
  halfOpenRequests: number;
  recoveryThreshold: number;
}

/** API 响应 */
interface ProvidersResponse {
  success: boolean;
  data?: {
    providers: ProviderInfo[];
    circuitBreakerConfig: CircuitBreakerConfig;
    summary: {
      totalProviders: number;
      healthyCount: number;
      degradedCount: number;
      unhealthyCount: number;
    };
  };
  error?: string;
}

/** Provider 显示名称映射 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  deepseek: "DeepSeek",
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  local: "本地模型",
};

/** Provider 颜色映射 */
const PROVIDER_COLORS: Record<string, string> = {
  deepseek: "bg-blue-500",
  openai: "bg-emerald-500",
  anthropic: "bg-orange-500",
  local: "bg-gray-500",
};

/** 状态图标组件 */
function StatusIcon({ status }: { status: ProviderStatus }) {
  switch (status) {
    case "healthy":
      return <CheckCircle className="size-4 text-green-500" />;
    case "degraded":
      return <AlertTriangle className="size-4 text-yellow-500" />;
    case "unhealthy":
      return <XCircle className="size-4 text-red-500" />;
    default:
      return <CircleDot className="size-4 text-gray-400" />;
  }
}

/** 状态徽章组件 */
function StatusBadge({ status }: { status: ProviderStatus }) {
  const variants: Record<ProviderStatus, string> = {
    healthy:
      "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-600 dark:text-green-300",
    degraded:
      "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 text-yellow-600 dark:text-yellow-300",
    unhealthy:
      "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-600 dark:text-red-300",
  };

  const labels: Record<ProviderStatus, string> = {
    healthy: "健康",
    degraded: "降级",
    unhealthy: "不可用",
  };

  return (
    <Badge variant="outline" className={variants[status]}>
      {labels[status]}
    </Badge>
  );
}

/** 电路状态徽章组件 */
function CircuitStateBadge({ state }: { state: CircuitState }) {
  const variants: Record<CircuitState, string> = {
    closed:
      "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-600 dark:text-green-300",
    open: "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-600 dark:text-red-300",
    "half-open":
      "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 text-yellow-600 dark:text-yellow-300",
    unknown:
      "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300",
  };

  const labels: Record<CircuitState, string> = {
    closed: "正常",
    open: "断开",
    "half-open": "半开",
    unknown: "未知",
  };

  return (
    <Badge variant="outline" className={`text-xs ${variants[state]}`}>
      {labels[state]}
    </Badge>
  );
}

/** Provider 卡片项组件 */
function ProviderItem({
  provider,
  onReset,
  resetting,
}: {
  provider: ProviderInfo;
  onReset: (name: string) => void;
  resetting: boolean;
}) {
  const displayName = PROVIDER_DISPLAY_NAMES[provider.name] || provider.name;
  const colorClass = PROVIDER_COLORS[provider.name] || "bg-gray-500";

  return (
    <div className="p-4 border rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center`}
          >
            <Cpu className="size-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">
                {displayName}
              </span>
              <StatusBadge status={provider.status} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                电路状态:
              </span>
              <CircuitStateBadge state={provider.circuitState} />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {provider.latencyMs !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Zap className="size-3" />
                    {provider.latencyMs}ms
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>最近响应延迟</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {provider.lastCheckedAt && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatLastChecked(provider.lastCheckedAt)}
            </span>
          )}
        </div>
      </div>

      {/* 详细信息 */}
      <div className="mt-3 space-y-2">
        {/* 故障信息 */}
        {provider.consecutiveFailures > 0 && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
            <AlertTriangle className="size-3" />
            连续失败: {provider.consecutiveFailures} 次
          </div>
        )}

        {/* 错误消息 */}
        {provider.errorMessage && (
          <div className="text-xs text-red-600 dark:text-red-400 truncate">
            错误: {provider.errorMessage}
          </div>
        )}

        {/* 冷却时间 */}
        {provider.circuitState === "open" &&
          provider.cooldownRemainingMs !== null &&
          provider.cooldownRemainingMs !== undefined && (
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock className="size-3" />
              冷却剩余: {Math.ceil(provider.cooldownRemainingMs / 1000)}秒
            </div>
          )}

        {/* 半开进度 */}
        {provider.circuitState === "half-open" && provider.halfOpenProgress && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
            <RefreshCw className="size-3" />
            恢复进度: {provider.halfOpenProgress}
          </div>
        )}

        {/* 重置按钮 */}
        {provider.circuitState !== "closed" && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => onReset(provider.name)}
            disabled={resetting}
          >
            <RotateCcw className="size-3 mr-1" />
            重置电路
          </Button>
        )}
      </div>
    </div>
  );
}

/** 格式化最后检查时间 */
function formatLastChecked(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return `${diffSeconds}秒前`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}分钟前`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}小时前`;
  return date.toLocaleDateString("zh-CN");
}

/**
 * AI Provider 设置卡片组件
 */
export function AIProviderSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [config, setConfig] = useState<CircuitBreakerConfig | null>(null);
  const [summary, setSummary] = useState<{
    totalProviders: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
  } | null>(null);

  /** 获取 Provider 状态 */
  const fetchProviderStatus = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(API_AI.providers);
      const result: ProvidersResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "获取状态失败");
      }

      setProviders(result.data.providers);
      setConfig(result.data.circuitBreakerConfig);
      setSummary(result.data.summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : "获取状态失败";
      setError(message);
      clientLogger.error({ error: message }, "Failed to fetch provider status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /** 重置电路断路器 */
  const handleReset = async (providerName: string) => {
    setResetting(true);
    try {
      const response = await fetch(API_AI.providers, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", providerName }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "重置失败");
      }

      // 刷新状态
      await fetchProviderStatus(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "重置失败";
      clientLogger.error(
        { error: message, provider: providerName },
        "Failed to reset circuit breaker",
      );
    } finally {
      setResetting(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchProviderStatus();
  }, [fetchProviderStatus]);

  // 定时刷新（每30秒）
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProviderStatus(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchProviderStatus]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="size-5 text-indigo-600 dark:text-indigo-400" />
              AI Provider 状态
            </CardTitle>
            <CardDescription>
              监控 AI 服务提供商的健康状态和故障转移机制
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchProviderStatus(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={`size-4 mr-1 ${refreshing ? "animate-spin" : ""}`}
            />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="size-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">加载中...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <XCircle className="size-8 mx-auto text-red-400 mb-2" />
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => fetchProviderStatus()}
            >
              重试
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 摘要信息 */}
            {summary && (
              <div className="flex items-center gap-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    总计:
                  </span>{" "}
                  <span className="font-medium">{summary.totalProviders}</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1 text-sm">
                  <StatusIcon status="healthy" />
                  <span className="text-green-600 dark:text-green-400">
                    {summary.healthyCount}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <StatusIcon status="degraded" />
                  <span className="text-yellow-600 dark:text-yellow-400">
                    {summary.degradedCount}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <StatusIcon status="unhealthy" />
                  <span className="text-red-600 dark:text-red-400">
                    {summary.unhealthyCount}
                  </span>
                </div>
              </div>
            )}

            {/* Provider 列表 */}
            {providers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Cpu className="size-8 mx-auto mb-2 opacity-50" />
                <p>未配置任何 AI Provider</p>
                <p className="text-xs mt-1">
                  请在环境变量中配置 DEEPSEEK_API_KEY、OPENAI_API_KEY 或
                  ANTHROPIC_API_KEY
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {providers.map((provider) => (
                  <ProviderItem
                    key={provider.name}
                    provider={provider}
                    onReset={handleReset}
                    resetting={resetting}
                  />
                ))}
              </div>
            )}

            {/* 电路断路器配置 */}
            {config && (
              <>
                <Separator />
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <p className="font-medium mb-1">电路断路器配置:</p>
                  <ul className="space-y-0.5 ml-2">
                    <li>• 失败阈值: {config.failureThreshold} 次连续失败</li>
                    <li>• 冷却时间: {config.cooldownMs / 1000} 秒</li>
                    <li>• 半开测试: {config.halfOpenRequests} 个请求</li>
                    <li>• 恢复阈值: {config.recoveryThreshold} 次成功</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
