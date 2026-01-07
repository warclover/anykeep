/**
 * Export Result Dialog - 导出结果对话框
 * 支持将生成内容导出为 Markdown/纯文本/HTML 格式
 * @module knowledge-studio/v2
 */

"use client";

import { useState, useCallback } from "react";
import { Download, FileText, Code2, FileType } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

// ============================================================
// Constants
// ============================================================

/** 导出格式类型 */
type ExportFormat = "markdown" | "text" | "html";

/** 格式配置 */
const FORMAT_CONFIG: Record<
  ExportFormat,
  {
    label: string;
    extension: string;
    mimeType: string;
    icon: typeof FileText;
    description: string;
  }
> = {
  markdown: {
    label: "Markdown",
    extension: "md",
    mimeType: "text/markdown",
    icon: FileText,
    description: "保留格式标记，可用于文档编辑器",
  },
  text: {
    label: "纯文本",
    extension: "txt",
    mimeType: "text/plain",
    icon: FileType,
    description: "移除所有格式，适合复制粘贴",
  },
  html: {
    label: "HTML",
    extension: "html",
    mimeType: "text/html",
    icon: Code2,
    description: "可直接在浏览器中查看",
  },
};

// ============================================================
// Types
// ============================================================

interface ExportResultDialogProps {
  /** 是否打开对话框 */
  open: boolean;
  /** 打开状态变更回调 */
  onOpenChange: (open: boolean) => void;
  /** 要导出的内容 */
  content: string;
  /** 蓝图名称，用于生成文件名 */
  blueprintName: string;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 生成时间戳文件名
 * 格式：{蓝图名称}_{YYYYMMDD}_{HHmmss}
 */
function generateFilename(blueprintName: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  // 移除可能导致文件名问题的特殊字符
  const safeName = blueprintName.replace(/[<>:"/\\|?*]/g, "_");
  return `${safeName}_${date}_${time}`;
}

/**
 * 移除 Markdown 格式标记
 */
function stripMarkdown(content: string): string {
  return (
    content
      // 移除标题标记
      .replace(/^#{1,6}\s+/gm, "")
      // 移除粗体
      .replace(/\*\*(.+?)\*\*/g, "$1")
      // 移除斜体
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      // 移除代码块标记
      .replace(/```[\s\S]*?```/g, (match) => {
        return match.replace(/```\w*\n?/g, "").replace(/```/g, "");
      })
      // 移除行内代码
      .replace(/`(.+?)`/g, "$1")
      // 移除链接，保留文字
      .replace(/\[(.+?)\]\(.+?\)/g, "$1")
      // 移除列表标记
      .replace(/^[\s]*[-*+]\s+/gm, "")
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // 移除引用标记
      .replace(/^>\s+/gm, "")
      // 移除水平线
      .replace(/^[-*_]{3,}$/gm, "")
      // 清理多余空行
      .replace(/\n{3,}/g, "\n\n")
  );
}

/**
 * 将 Markdown 转换为简单 HTML
 */
function convertToHtml(content: string, blueprintName: string): string {
  // 基础 Markdown 到 HTML 转换
  const html = content
    // 标题
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // 斜体
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // 行内代码
    .replace(/`(.+?)`/g, "<code>$1</code>")
    // 链接
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // 列表项
    .replace(/^[\s]*[-*+]\s+(.+)$/gm, "<li>$1</li>")
    // 段落
    .replace(/^(?!<[hlu]|<li)(.+)$/gm, "<p>$1</p>")
    // 换行
    .replace(/\n/g, "\n");

  // 包装完整 HTML 结构
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${blueprintName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3 { color: #1a1a1a; margin-top: 1.5em; }
    h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    p { margin: 1em 0; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    li { margin: 0.5em 0; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

// ============================================================
// Component
// ============================================================

export function ExportResultDialog({
  open,
  onOpenChange,
  content,
  blueprintName,
}: ExportResultDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [isExporting, setIsExporting] = useState(false);

  /**
   * 处理导出操作
   */
  const handleExport = useCallback(async () => {
    if (!content) {
      toast.error("没有可导出的内容");
      return;
    }

    setIsExporting(true);

    try {
      const filename = generateFilename(blueprintName);
      const config = FORMAT_CONFIG[format];

      let exportContent: string;

      switch (format) {
        case "markdown":
          exportContent = content;
          break;
        case "text":
          exportContent = stripMarkdown(content);
          break;
        case "html":
          exportContent = convertToHtml(content, blueprintName);
          break;
        default:
          exportContent = content;
      }

      // 创建 Blob 并触发下载
      const blob = new Blob([exportContent], { type: config.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${config.extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 显示成功提示
      toast.success("导出成功！", {
        description: `已保存为 ${filename}.${config.extension}`,
      });

      // 关闭对话框
      onOpenChange(false);
    } catch (error) {
      toast.error("导出失败", {
        description: error instanceof Error ? error.message : "请重试",
      });
    } finally {
      setIsExporting(false);
    }
  }, [content, blueprintName, format, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            导出内容
          </DialogTitle>
          <DialogDescription>
            选择导出格式，将生成的内容保存到本地
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={format}
            onValueChange={(v) => setFormat(v as ExportFormat)}
            className="space-y-3"
          >
            {Object.entries(FORMAT_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div
                  key={key}
                  className="flex items-start space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setFormat(key as ExportFormat)}
                >
                  <RadioGroupItem value={key} id={key} className="mt-1" />
                  <div className="flex-1">
                    <Label
                      htmlFor={key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Icon className="h-4 w-4" />
                      {config.label}
                      <span className="text-muted-foreground text-xs">
                        (.{config.extension})
                      </span>
                    </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {config.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleExport} disabled={isExporting || !content}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "导出中..." : "导出"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
