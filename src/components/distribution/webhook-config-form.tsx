/**
 * Webhook 配置表单组件
 *
 * @description 用于配置 Webhook 推送目标的表单
 */

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  Loader2,
  Webhook,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { WebhookTargetConfig } from "@/lib/distribution/types";
import { clientLogger } from "@/lib/client-logger";
import { API_DISTRIBUTION } from "@/lib/constants/api-paths";

/**
 * 表单验证 Schema
 */
const webhookConfigSchema = z.object({
  url: z.string().url("请输入有效的 URL"),
  method: z.enum(["POST", "PUT"]),
  secretKey: z.string().optional(),
  retryCount: z.number().min(0).max(5),
  headers: z.array(
    z.object({
      key: z.string().min(1, "Header 名称不能为空"),
      value: z.string(),
    }),
  ),
  triggerMode: z.enum(["manual", "scheduled", "realtime"]),
  scheduleIntervalMinutes: z.number().min(5).max(1440).optional(),
});

type WebhookConfigFormValues = z.infer<typeof webhookConfigSchema>;

export interface WebhookConfigFormProps {
  /** 初始配置 */
  initialConfig?: WebhookTargetConfig;
  /** 保存回调 */
  onSave?: (config: WebhookTargetConfig) => Promise<void>;
  /** 取消回调 */
  onCancel?: () => void;
  /** 是否显示为卡片形式 */
  showCard?: boolean;
}

export function WebhookConfigForm({
  initialConfig,
  onSave,
  onCancel,
  showCard = true,
}: WebhookConfigFormProps) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);

  // 将 headers 对象转换为数组
  const initialHeaders = initialConfig?.headers
    ? Object.entries(initialConfig.headers).map(([key, value]) => ({
        key,
        value,
      }))
    : [];

  const form = useForm<WebhookConfigFormValues>({
    resolver: zodResolver(webhookConfigSchema),
    defaultValues: {
      url: initialConfig?.url || "",
      method: initialConfig?.method || "POST",
      secretKey: initialConfig?.secretKey || "",
      retryCount: initialConfig?.retryCount ?? 3,
      headers: initialHeaders.length > 0 ? initialHeaders : [],
      triggerMode: "manual",
      scheduleIntervalMinutes: 60,
    },
  });

  const triggerMode = form.watch("triggerMode");
  const headers = form.watch("headers");

  // 添加 Header
  const addHeader = () => {
    const currentHeaders = form.getValues("headers");
    form.setValue("headers", [...currentHeaders, { key: "", value: "" }]);
  };

  // 移除 Header
  const removeHeader = (index: number) => {
    const currentHeaders = form.getValues("headers");
    form.setValue(
      "headers",
      currentHeaders.filter((_, i) => i !== index),
    );
  };

  // 测试 Webhook 连接
  const handleTestConnection = async () => {
    const url = form.getValues("url");
    if (!url) {
      toast.error("请先输入 Webhook URL");
      return;
    }

    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      toast.error("请输入有效的 URL");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // 发送测试请求到我们的 API
      const response = await fetch(API_DISTRIBUTION.webhookTest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          method: form.getValues("method"),
          headers: form.getValues("headers").reduce(
            (acc, h) => {
              if (h.key) acc[h.key] = h.value;
              return acc;
            },
            {} as Record<string, string>,
          ),
          secretKey: form.getValues("secretKey"),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `连接成功，响应状态: ${data.statusCode || 200}`,
        });
      } else {
        const data = await response.json();
        setTestResult({
          success: false,
          message: data.error || "连接失败",
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: "连接测试失败，请检查 URL 是否正确",
      });
    } finally {
      setTesting(false);
    }
  };

  // 保存配置
  const handleSubmit = async (values: WebhookConfigFormValues) => {
    if (!onSave) return;

    setSaving(true);
    try {
      // 将 headers 数组转换为对象
      const headersObj = values.headers.reduce(
        (acc, h) => {
          if (h.key) acc[h.key] = h.value;
          return acc;
        },
        {} as Record<string, string>,
      );

      const config: WebhookTargetConfig = {
        url: values.url,
        method: values.method,
        headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
        secretKey: values.secretKey || undefined,
        retryCount: values.retryCount,
      };

      await onSave(config);
      toast.success("配置已保存");
    } catch (error) {
      clientLogger.error({ error }, "Failed to save config:");
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Webhook URL */}
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Webhook URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://example.com/webhook"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    setTestResult(null);
                  }}
                />
              </FormControl>
              <FormDescription>
                书签同步时将发送 HTTP 请求到此地址
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 请求方法 */}
        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>请求方法</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择请求方法" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 密钥签名 */}
        <FormField
          control={form.control}
          name="secretKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>签名密钥（可选）</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showSecretKey ? "text" : "password"}
                    placeholder="用于生成 HMAC-SHA256 签名"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                  >
                    {showSecretKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                设置后请求将包含 X-AnyKeep-Signature Header
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 重试次数 */}
        <FormField
          control={form.control}
          name="retryCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>失败重试次数</FormLabel>
              <Select
                onValueChange={(v) => field.onChange(Number(v))}
                defaultValue={String(field.value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择重试次数" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="0">不重试</SelectItem>
                  <SelectItem value="1">1 次</SelectItem>
                  <SelectItem value="2">2 次</SelectItem>
                  <SelectItem value="3">3 次</SelectItem>
                  <SelectItem value="5">5 次</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>请求失败后的自动重试次数</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        {/* 自定义 Headers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <FormLabel className="text-base">自定义 Headers</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addHeader}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              添加
            </Button>
          </div>

          {headers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              暂无自定义 Headers，点击添加按钮创建
            </p>
          ) : (
            <div className="space-y-2">
              {headers.map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Header 名称"
                    value={form.watch(`headers.${index}.key`)}
                    onChange={(e) =>
                      form.setValue(`headers.${index}.key`, e.target.value)
                    }
                    className="flex-1"
                  />
                  <Input
                    placeholder="Header 值"
                    value={form.watch(`headers.${index}.value`)}
                    onChange={(e) =>
                      form.setValue(`headers.${index}.value`, e.target.value)
                    }
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHeader(index)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 连接测试 */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || !form.getValues("url")}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Webhook className="h-4 w-4 mr-2" />
            )}
            测试连接
          </Button>
          {testResult && (
            <Badge
              variant={testResult.success ? "secondary" : "destructive"}
              className={testResult.success ? "text-green-600" : "text-red-600"}
            >
              {testResult.success ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <X className="h-3 w-3 mr-1" />
              )}
              {testResult.message}
            </Badge>
          )}
        </div>

        <Separator />

        {/* 同步触发模式 */}
        <FormField
          control={form.control}
          name="triggerMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>同步模式</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择同步模式" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="manual">手动同步</SelectItem>
                  <SelectItem value="scheduled">定时同步</SelectItem>
                  <SelectItem value="realtime">实时同步</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                {triggerMode === "manual" && "手动点击同步按钮时执行"}
                {triggerMode === "scheduled" && "按设定的时间间隔自动推送"}
                {triggerMode === "realtime" && "新增收藏时立即推送"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 定时间隔 */}
        {triggerMode === "scheduled" && (
          <FormField
            control={form.control}
            name="scheduleIntervalMinutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>推送间隔</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(Number(v))}
                  defaultValue={String(field.value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="选择推送间隔" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="5">每 5 分钟</SelectItem>
                    <SelectItem value="15">每 15 分钟</SelectItem>
                    <SelectItem value="30">每 30 分钟</SelectItem>
                    <SelectItem value="60">每小时</SelectItem>
                    <SelectItem value="360">每 6 小时</SelectItem>
                    <SelectItem value="1440">每天</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button type="submit" disabled={saving || !form.getValues("url")}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存配置
          </Button>
        </div>
      </form>
    </Form>
  );

  if (!showCard) {
    return formContent;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          Webhook 推送配置
        </CardTitle>
        <CardDescription>
          配置 Webhook 端点，书签变更时自动推送到你的服务
        </CardDescription>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
