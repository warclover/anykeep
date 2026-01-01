/**
 * RSS Feed 配置表单组件
 *
 * @description 用于配置 RSS Feed 订阅目标的表单
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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Rss,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type { RssTargetConfig } from "@/lib/distribution/types";

/**
 * 表单验证 Schema
 */
const rssConfigSchema = z.object({
  feedFormat: z.enum(["rss2", "atom"]),
  itemCount: z.number().min(10).max(100),
  includeContent: z.boolean(),
  feedToken: z.string().min(16, "Token 长度不足"),
});

type RssConfigFormValues = z.infer<typeof rssConfigSchema>;

/**
 * 生成新的 Feed Token
 */
function generateFeedToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 获取 Feed URL
 */
function getFeedUrl(feedToken: string): string {
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "https://anykeep.app";
  return `${baseUrl}/api/distribution/rss/${feedToken}`;
}

export interface RssConfigFormProps {
  /** 初始配置 */
  initialConfig?: RssTargetConfig;
  /** 保存回调 */
  onSave?: (config: RssTargetConfig) => Promise<void>;
  /** 取消回调 */
  onCancel?: () => void;
  /** 是否显示为卡片形式 */
  showCard?: boolean;
}

export function RssConfigForm({
  initialConfig,
  onSave,
  onCancel,
  showCard = true,
}: RssConfigFormProps) {
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const form = useForm<RssConfigFormValues>({
    resolver: zodResolver(rssConfigSchema),
    defaultValues: {
      feedFormat: initialConfig?.feedFormat || "rss2",
      itemCount: initialConfig?.itemCount || 50,
      includeContent: initialConfig?.includeContent ?? true,
      feedToken: initialConfig?.feedToken || generateFeedToken(),
    },
  });

  const feedToken = form.watch("feedToken");
  const feedFormat = form.watch("feedFormat");
  const feedUrl = getFeedUrl(feedToken);

  // 复制 Feed URL
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      toast.success("Feed URL 已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  // 重新生成 Token
  const handleRegenerateToken = () => {
    const newToken = generateFeedToken();
    form.setValue("feedToken", newToken);
    toast.info("已生成新的 Feed Token");
  };

  // 在阅读器中打开
  const handleOpenInReader = () => {
    // 使用 Feedly 作为示例阅读器
    const feedlyUrl = `https://feedly.com/i/subscription/feed/${encodeURIComponent(feedUrl)}`;
    window.open(feedlyUrl, "_blank");
  };

  // 保存配置
  const handleSubmit = async (values: RssConfigFormValues) => {
    if (!onSave) return;

    setSaving(true);
    try {
      const config: RssTargetConfig = {
        feedFormat: values.feedFormat,
        itemCount: values.itemCount,
        includeContent: values.includeContent,
        feedToken: values.feedToken,
      };

      await onSave(config);
      toast.success("配置已保存");
    } catch (error) {
      console.error("Failed to save config:", error);
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Feed URL 展示 */}
        <div className="space-y-3">
          <FormLabel className="text-base">你的 Feed URL</FormLabel>
          <div className="flex items-center gap-2">
            <Input
              value={feedUrl}
              readOnly
              className="font-mono text-sm bg-muted"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopyUrl}
              title="复制 URL"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleOpenInReader}
              title="在 Feedly 中订阅"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            将此 URL 添加到你喜欢的 RSS 阅读器（如
            Feedly、Inoreader、NetNewsWire）
          </p>
        </div>

        <Separator />

        {/* Feed 格式 */}
        <FormField
          control={form.control}
          name="feedFormat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Feed 格式</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择格式" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="rss2">RSS 2.0（推荐）</SelectItem>
                  <SelectItem value="atom">Atom 1.0</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                {feedFormat === "rss2"
                  ? "兼容性最好，支持绝大多数阅读器"
                  : "更现代的格式，支持更多元数据"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 条目数量 */}
        <FormField
          control={form.control}
          name="itemCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Feed 条目数</FormLabel>
              <Select
                onValueChange={(v) => field.onChange(Number(v))}
                defaultValue={String(field.value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择条目数" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="10">10 条</SelectItem>
                  <SelectItem value="25">25 条</SelectItem>
                  <SelectItem value="50">50 条（推荐）</SelectItem>
                  <SelectItem value="100">100 条</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>Feed 中显示的最新书签数量</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 包含内容 */}
        <FormField
          control={form.control}
          name="includeContent"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">包含摘要内容</FormLabel>
                <FormDescription>在 Feed 中包含 AI 摘要或描述</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Separator />

        {/* Token 管理 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FormLabel className="text-base">Feed Token</FormLabel>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRegenerateToken}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              重新生成
            </Button>
          </div>
          <Input
            value={feedToken}
            readOnly
            className="font-mono text-xs bg-muted"
          />
          <Alert variant="default" className="bg-amber-50 border-amber-200">
            <AlertDescription className="text-amber-800 text-sm">
              ⚠️ Token 是你 Feed
              的唯一访问凭证。重新生成后，旧的订阅链接将失效。
            </AlertDescription>
          </Alert>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button type="submit" disabled={saving}>
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
          <Rss className="h-5 w-5" />
          RSS Feed 配置
        </CardTitle>
        <CardDescription>
          生成私有 RSS Feed，在任何阅读器中订阅你的收藏
        </CardDescription>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
