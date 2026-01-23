/**
 * Obsidian 配置表单组件
 *
 * @description 用于配置 Obsidian 本地同步的表单
 */

"use client";

import { useState, useCallback } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  FolderOpen,
  FileText,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Monitor,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import type { ObsidianTargetConfig } from "@/lib/distribution/types";

/**
 * 表单验证 Schema
 */
const obsidianConfigSchema = z.object({
  vaultPath: z.string().min(1, "Vault 路径不能为空"),
  folderName: z
    .string()
    .min(1, "保存目录不能为空")
    .max(50, "目录名最长 50 个字符")
    .regex(/^[^<>:"/\\|?*]+$/, "目录名包含非法字符"),
  filenamePattern: z.string().min(1, "文件名模式不能为空"),
  useYamlFrontmatter: z.boolean(),
  triggerMode: z.enum(["manual", "scheduled", "realtime"]),
  scheduleIntervalMinutes: z.number().min(5).max(1440).optional(),
});

type ObsidianConfigFormValues = z.infer<typeof obsidianConfigSchema>;

/**
 * 文件名模式选项
 */
const FILENAME_PATTERNS = [
  {
    value: "{{title}}-{{date}}",
    label: "标题-日期",
    example: "文章标题-2026-01-01.md",
  },
  {
    value: "{{date}}-{{title}}",
    label: "日期-标题",
    example: "2026-01-01-文章标题.md",
  },
  { value: "{{title}}", label: "仅标题", example: "文章标题.md" },
  {
    value: "{{date}}/{{title}}",
    label: "按日期分目录",
    example: "2026-01-01/文章标题.md",
  },
  {
    value: "{{platform}}/{{title}}",
    label: "按平台分目录",
    example: "wechat/文章标题.md",
  },
];

/**
 * 同步间隔选项
 */
const INTERVAL_OPTIONS = [
  { value: 5, label: "每 5 分钟" },
  { value: 15, label: "每 15 分钟" },
  { value: 30, label: "每 30 分钟" },
  { value: 60, label: "每小时" },
  { value: 360, label: "每 6 小时" },
  { value: 720, label: "每 12 小时" },
  { value: 1440, label: "每天" },
];

export interface ObsidianConfigFormProps {
  /** 初始配置 */
  initialConfig?: Partial<ObsidianTargetConfig> & {
    triggerMode?: "manual" | "scheduled" | "realtime";
    scheduleIntervalMinutes?: number;
  };
  /** 是否为编辑模式 */
  isEdit?: boolean;
  /** 提交回调 */
  onSubmit: (config: ObsidianConfigFormValues) => Promise<void>;
  /** 取消回调 */
  onCancel?: () => void;
  /** 是否为桌面端 */
  isDesktop?: boolean;
}

/**
 * 检测是否为桌面端（Electron/Capacitor）
 */
function useIsDesktop(): boolean {
  // 使用惰性初始化，仅在客户端检测一次
  const [isDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    const isElectron = "electron" in window;
    const isCapacitorNative =
      "Capacitor" in window &&
      (
        window as unknown as { Capacitor: { isNativePlatform: () => boolean } }
      ).Capacitor.isNativePlatform();
    return isElectron || isCapacitorNative;
  });

  return isDesktop;
}

/**
 * Obsidian 配置表单
 */
export function ObsidianConfigForm({
  initialConfig,
  isEdit = false,
  onSubmit,
  onCancel,
  isDesktop: isDesktopProp,
}: ObsidianConfigFormProps) {
  const detectedIsDesktop = useIsDesktop();
  const isDesktop = isDesktopProp ?? detectedIsDesktop;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const form = useForm<ObsidianConfigFormValues>({
    resolver: zodResolver(obsidianConfigSchema),
    defaultValues: {
      vaultPath: initialConfig?.vaultPath ?? "",
      folderName: initialConfig?.folderName ?? "AnyKeep",
      filenamePattern: initialConfig?.filenamePattern ?? "{{title}}-{{date}}",
      useYamlFrontmatter: initialConfig?.useYamlFrontmatter ?? true,
      triggerMode: initialConfig?.triggerMode ?? "manual",
      scheduleIntervalMinutes: initialConfig?.scheduleIntervalMinutes ?? 60,
    },
  });

  const triggerMode = form.watch("triggerMode");
  const vaultPath = form.watch("vaultPath");
  const folderName = form.watch("folderName");
  const filenamePattern = form.watch("filenamePattern");

  /**
   * 生成预览路径
   */
  const getPreviewPath = useCallback(() => {
    if (!vaultPath || !folderName) return "";

    let filename = filenamePattern
      .replace("{{title}}", "文章标题")
      .replace("{{date}}", "2026-01-01")
      .replace("{{platform}}", "wechat");

    if (!filename.endsWith(".md")) {
      filename += ".md";
    }

    return `${vaultPath}/${folderName}/${filename}`;
  }, [vaultPath, folderName, filenamePattern]);

  /**
   * 选择 Vault 文件夹
   */
  const handleSelectFolder = async () => {
    if (!isDesktop) {
      toast.error("文件夹选择仅支持桌面客户端");
      return;
    }

    try {
      // 调用 Electron/Capacitor 文件选择器 API
      // 这里使用占位实现，实际需要根据平台 API 实现
      const selectedPath = await selectFolderDialog();
      if (selectedPath) {
        form.setValue("vaultPath", selectedPath, { shouldValidate: true });
        setTestResult(null);
      }
    } catch {
      toast.error("选择文件夹失败");
    }
  };

  /**
   * 测试连接
   */
  const handleTestConnection = async () => {
    const values = form.getValues();

    if (!values.vaultPath) {
      toast.error("请先设置 Vault 路径");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/distribution/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "obsidian",
          targetConfig: {
            vaultPath: values.vaultPath,
            folderName: values.folderName,
            filenamePattern: values.filenamePattern,
            useYamlFrontmatter: values.useYamlFrontmatter,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTestResult({
          success: true,
          message: "连接测试成功！可以正常写入文件。",
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || "连接测试失败",
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "连接测试失败",
      });
    } finally {
      setIsTesting(false);
    }
  };

  /**
   * 表单提交
   */
  const handleSubmit = async (values: ObsidianConfigFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      toast.success(isEdit ? "配置已更新" : "Obsidian 同步已添加");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Web 端提示
  if (!isDesktop) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Obsidian 本地同步
          </CardTitle>
          <CardDescription>将收藏内容同步到本地 Obsidian Vault</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>仅支持桌面客户端</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">
                Obsidian 本地同步需要访问本地文件系统，仅在桌面客户端中可用。
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="/download" target="_blank" rel="noopener noreferrer">
                  下载桌面客户端
                </a>
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {isEdit ? "编辑 Obsidian 配置" : "添加 Obsidian 同步"}
        </CardTitle>
        <CardDescription>
          配置 Obsidian Vault 路径和同步规则，自动将收藏内容同步为 Markdown 文件
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Vault 路径 */}
            <FormField
              control={form.control}
              name="vaultPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vault 路径</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        {...field}
                        placeholder="/Users/xxx/Documents/Obsidian"
                        readOnly
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSelectFolder}
                      >
                        <FolderOpen className="h-4 w-4 mr-2" />
                        选择
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    选择你的 Obsidian Vault 根目录
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 保存目录 */}
            <FormField
              control={form.control}
              name="folderName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>保存目录</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="AnyKeep" />
                  </FormControl>
                  <FormDescription>
                    在 Vault 中创建的子目录名称，用于存放同步的文件
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 文件名模式 */}
            <FormField
              control={form.control}
              name="filenamePattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>文件名模式</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择文件名模式" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FILENAME_PATTERNS.map((pattern) => (
                        <SelectItem key={pattern.value} value={pattern.value}>
                          <div className="flex flex-col">
                            <span>{pattern.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {pattern.example}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* YAML Frontmatter */}
            <FormField
              control={form.control}
              name="useYamlFrontmatter"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      YAML Frontmatter
                    </FormLabel>
                    <FormDescription>
                      在文件开头添加元数据（标题、链接、标签等）
                    </FormDescription>
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

            {/* 同步方式 */}
            <FormField
              control={form.control}
              name="triggerMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>同步方式</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择同步方式" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="manual">手动同步</SelectItem>
                      <SelectItem value="scheduled">定时同步</SelectItem>
                      <SelectItem value="realtime">实时同步</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {triggerMode === "manual" && "需要手动点击同步按钮触发"}
                    {triggerMode === "scheduled" && "按设定的时间间隔自动同步"}
                    {triggerMode === "realtime" && "每次收藏新内容后立即同步"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 同步间隔（仅定时同步显示） */}
            {triggerMode === "scheduled" && (
              <FormField
                control={form.control}
                name="scheduleIntervalMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>同步间隔</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(parseInt(v, 10))}
                      defaultValue={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择同步间隔" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INTERVAL_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            {/* 预览 */}
            {vaultPath && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Info className="h-4 w-4" />
                  文件预览
                </div>
                <code className="block text-xs text-muted-foreground break-all">
                  {getPreviewPath()}
                </code>
              </div>
            )}

            {/* 测试结果 */}
            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={!vaultPath || isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                测试连接
              </Button>

              <div className="flex gap-2">
                {onCancel && (
                  <Button type="button" variant="ghost" onClick={onCancel}>
                    取消
                  </Button>
                )}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {isEdit ? "保存更改" : "添加目标"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/**
 * 文件夹选择对话框（平台相关实现）
 * 支持 Electron 和 Capacitor 两种环境
 */
async function selectFolderDialog(): Promise<string | null> {
  // Electron 实现
  if (typeof window !== "undefined" && "electron" in window) {
    const electron = (
      window as unknown as {
        electron: { selectFolder: () => Promise<string | null> };
      }
    ).electron;
    return electron.selectFolder();
  }

  // Capacitor 实现（通过 Filesystem 插件）
  if (typeof window !== "undefined" && "Capacitor" in window) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      // Capacitor 不支持直接选择文件夹，使用默认文档目录
      const result = await Filesystem.getUri({
        path: "Obsidian",
        directory: Directory.Documents,
      });
      return result.uri;
    } catch {
      // Capacitor 插件不可用，回退到手动输入
    }
  }

  // 回退：显示手动输入提示
  const path = window.prompt("请输入 Obsidian Vault 路径:");
  return path || null;
}
