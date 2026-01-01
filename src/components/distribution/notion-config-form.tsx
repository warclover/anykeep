/**
 * Notion 配置表单组件
 *
 * @description 用于配置 Notion 同步目标的表单
 */

"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  X,
  Loader2,
  Database,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { DatabaseSelector } from "./database-selector";
import type { NotionTargetConfig } from "@/lib/distribution/types";

/**
 * 表单验证 Schema
 */
const notionConfigSchema = z.object({
  databaseId: z.string().min(1, "请选择目标 Database"),
  propertyMapping: z.record(z.string(), z.string()).optional(),
  triggerMode: z.enum(["manual", "scheduled", "realtime"]),
  scheduleIntervalMinutes: z.number().min(5).max(1440).optional(),
});

type NotionConfigFormValues = z.infer<typeof notionConfigSchema>;

/**
 * 书签字段 -> Notion 属性映射配置
 */
const BOOKMARK_FIELDS = [
  { key: "title", label: "标题", required: true },
  { key: "url", label: "链接", required: true },
  { key: "platform", label: "来源平台", required: false },
  { key: "description", label: "描述", required: false },
  { key: "aiSummary", label: "AI 摘要", required: false },
  { key: "tags", label: "标签", required: false },
  { key: "createdAt", label: "收藏时间", required: false },
];

/**
 * Notion 属性类型
 */
interface NotionProperty {
  id: string;
  name: string;
  type: string;
}

/**
 * 获取属性类型的中文名
 */
function getPropertyTypeLabel(type: string): string {
  const typeMap: Record<string, string> = {
    title: "标题",
    rich_text: "文本",
    url: "链接",
    select: "单选",
    multi_select: "多选",
    date: "日期",
    number: "数字",
    checkbox: "复选框",
    email: "邮箱",
    phone_number: "电话",
    created_time: "创建时间",
    last_edited_time: "编辑时间",
    created_by: "创建者",
    last_edited_by: "编辑者",
    files: "文件",
    relation: "关联",
    rollup: "汇总",
    formula: "公式",
    status: "状态",
  };
  return typeMap[type] || type;
}

/**
 * 获取字段兼容的属性类型
 */
function getCompatibleTypes(fieldKey: string): string[] {
  const compatibilityMap: Record<string, string[]> = {
    title: ["title"],
    url: ["url", "rich_text"],
    platform: ["select", "rich_text"],
    description: ["rich_text"],
    aiSummary: ["rich_text"],
    tags: ["multi_select"],
    createdAt: ["date", "created_time"],
  };
  return compatibilityMap[fieldKey] || ["rich_text"];
}

export interface NotionConfigFormProps {
  /** 初始配置 */
  initialConfig?: NotionTargetConfig;
  /** 保存回调 */
  onSave?: (config: NotionTargetConfig) => Promise<void>;
  /** 取消回调 */
  onCancel?: () => void;
  /** 是否显示为卡片形式 */
  showCard?: boolean;
}

export function NotionConfigForm({
  initialConfig,
  onSave,
  onCancel,
  showCard = true,
}: NotionConfigFormProps) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [properties, setProperties] = useState<NotionProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<{
    id: string;
    title: string;
    icon: string | null;
  } | null>(null);

  const form = useForm<NotionConfigFormValues>({
    resolver: zodResolver(notionConfigSchema),
    defaultValues: {
      databaseId: initialConfig?.databaseId || "",
      propertyMapping: initialConfig?.propertyMapping || {},
      triggerMode: "manual",
      scheduleIntervalMinutes: 60,
    },
  });

  const databaseId = form.watch("databaseId");
  const triggerMode = form.watch("triggerMode");

  // 获取 Database 属性
  const fetchProperties = useCallback(async (dbId: string) => {
    if (!dbId) {
      setProperties([]);
      return;
    }

    setLoadingProperties(true);
    try {
      const response = await fetch(
        `/api/distribution/notion/databases/${dbId}/properties`,
      );

      if (!response.ok) {
        throw new Error("获取属性失败");
      }

      const data = await response.json();
      setProperties(data.properties || []);
      setSelectedDatabase(data.database);

      // 自动映射常用属性
      autoMapProperties(data.properties);
    } catch (error) {
      console.error("Failed to fetch properties:", error);
      toast.error("获取 Database 属性失败");
    } finally {
      setLoadingProperties(false);
    }
  }, []);

  // 自动映射属性
  const autoMapProperties = (props: NotionProperty[]) => {
    const mapping: Record<string, string> = {};

    // 查找并映射标题字段
    const titleProp = props.find((p) => p.type === "title");
    if (titleProp) {
      mapping.title = titleProp.name;
    }

    // 查找并映射 URL 字段
    const urlProp = props.find(
      (p) => p.type === "url" || p.name.toLowerCase().includes("url"),
    );
    if (urlProp) {
      mapping.url = urlProp.name;
    }

    // 查找并映射标签字段
    const tagsProp = props.find(
      (p) =>
        p.type === "multi_select" &&
        (p.name.toLowerCase().includes("tag") ||
          p.name.toLowerCase().includes("标签")),
    );
    if (tagsProp) {
      mapping.tags = tagsProp.name;
    }

    form.setValue("propertyMapping", mapping);
  };

  useEffect(() => {
    if (databaseId) {
      fetchProperties(databaseId);
    }
  }, [databaseId, fetchProperties]);

  // 测试连接
  const handleTestConnection = async () => {
    if (!databaseId) {
      toast.error("请先选择 Database");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(
        `/api/distribution/notion/databases/${databaseId}/properties`,
      );

      if (response.ok) {
        setTestResult({
          success: true,
          message: `成功连接到 Database，共 ${properties.length} 个属性`,
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
        message: "连接测试失败，请检查网络",
      });
    } finally {
      setTesting(false);
    }
  };

  // 保存配置
  const handleSubmit = async (values: NotionConfigFormValues) => {
    if (!onSave) return;

    setSaving(true);
    try {
      const config: NotionTargetConfig = {
        databaseId: values.databaseId,
        propertyMapping: values.propertyMapping || {},
        workspaceName: selectedDatabase?.title,
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

  // 获取兼容的属性选项
  const getPropertyOptions = (fieldKey: string) => {
    const compatibleTypes = getCompatibleTypes(fieldKey);
    return properties.filter((p) => compatibleTypes.includes(p.type));
  };

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Database 选择 */}
        <FormField
          control={form.control}
          name="databaseId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>目标 Database</FormLabel>
              <FormControl>
                <DatabaseSelector
                  value={field.value}
                  onChange={(db) => {
                    field.onChange(db?.id || "");
                    setTestResult(null);
                  }}
                />
              </FormControl>
              <FormDescription>
                选择要同步书签的 Notion Database
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 连接测试 */}
        {databaseId && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              测试连接
            </Button>
            {testResult && (
              <Badge
                variant={testResult.success ? "secondary" : "destructive"}
                className={
                  testResult.success ? "text-green-600" : "text-red-600"
                }
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
        )}

        {/* 属性映射 */}
        {databaseId && (
          <>
            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">属性映射</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchProperties(databaseId)}
                  disabled={loadingProperties}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 mr-1 ${loadingProperties ? "animate-spin" : ""}`}
                  />
                  刷新
                </Button>
              </div>

              {loadingProperties ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : properties.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  未找到属性，请检查 Database 设置
                </p>
              ) : (
                <div className="space-y-3">
                  {BOOKMARK_FIELDS.map((field) => {
                    const options = getPropertyOptions(field.key);
                    const watchedValue = form.watch(
                      `propertyMapping.${field.key}`,
                    );
                    const currentValue =
                      (typeof watchedValue === "string" ? watchedValue : "") ||
                      "";

                    return (
                      <div
                        key={field.key}
                        className="flex items-center gap-3 text-sm"
                      >
                        <div className="w-24 flex items-center gap-1">
                          <span>{field.label}</span>
                          {field.required && (
                            <span className="text-destructive">*</span>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <Select
                          value={currentValue}
                          onValueChange={(value) => {
                            const mapping =
                              form.getValues("propertyMapping") || {};
                            form.setValue("propertyMapping", {
                              ...mapping,
                              [field.key]: value,
                            });
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="选择属性" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">不映射</SelectItem>
                            {options.map((prop) => (
                              <SelectItem key={prop.id} value={prop.name}>
                                <span className="flex items-center gap-2">
                                  <span>{prop.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({getPropertyTypeLabel(prop.type)})
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

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
                {triggerMode === "scheduled" && "按设定的时间间隔自动同步"}
                {triggerMode === "realtime" && "新增收藏时立即同步"}
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
                <FormLabel>同步间隔</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(Number(v))}
                  defaultValue={String(field.value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="选择同步间隔" />
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
          <Button type="submit" disabled={saving || !databaseId}>
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
          <Database className="h-5 w-5" />
          Notion 同步配置
        </CardTitle>
        <CardDescription>
          配置如何将书签同步到你的 Notion Database
        </CardDescription>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
