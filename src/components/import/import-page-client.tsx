/**
 * 数据导入页面 - 客户端组件
 *
 * 整合三种导入方式：
 * 1. 浏览器书签导入（Chrome/Edge/Firefox/Safari）
 * 2. 批量导入（URL 列表或 JSON）
 * 3. 文件导入（Markdown/HTML/JSON）
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

"use client";

import { useState } from "react";
import { Globe, Upload, FileText, History, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ImportCard } from "./import-card";
import { ImportHistoryList } from "@/components/browser-bookmark/import-history-list";
import { BrowserBookmarkImportDialog } from "@/components/browser-bookmark/import-dialog";
import { BatchImportDialog } from "@/components/bookmark/batch-import-dialog";

// ============================================
// 常量定义
// ============================================

const IMPORT_OPTIONS = [
  {
    id: "browser",
    title: "浏览器书签",
    description: "导入 Chrome、Edge、Firefox、Safari 等浏览器的书签文件",
    icon: Globe,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    features: [
      "支持 Netscape Bookmark HTML 格式",
      "保留文件夹层级结构",
      "自动检测重复书签",
    ],
    comingSoon: false,
  },
  {
    id: "batch",
    title: "批量导入",
    description: "通过 URL 列表或 JSON 文件批量导入书签",
    icon: Upload,
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800",
    features: ["支持 JSON 格式", "批量 URL 文本", "自动抓取元数据"],
    comingSoon: false,
  },
  {
    id: "file",
    title: "文件导入",
    description: "导入 Markdown、HTML 或其他格式的内容文件",
    icon: FileText,
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-800",
    features: ["Markdown 笔记", "HTML 网页存档", "CSV 表格数据"],
    comingSoon: true,
  },
] as const;

// ============================================
// 主组件
// ============================================

interface ImportPageClientProps {
  /** 嵌入模式：隐藏页面标题和返回按钮 */
  embedded?: boolean;
}

export function ImportPageClient({ embedded = false }: ImportPageClientProps) {
  // 对话框状态
  const [showBrowserImport, setShowBrowserImport] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);

  // 历史刷新 key
  const [historyKey, setHistoryKey] = useState(0);

  // 处理导入选项点击
  const handleImportClick = (optionId: string) => {
    switch (optionId) {
      case "browser":
        setShowBrowserImport(true);
        break;
      case "batch":
        setShowBatchImport(true);
        break;
      case "file":
        // 文件导入 - 待开发
        break;
    }
  };

  // 导入成功后刷新历史
  const handleImportSuccess = () => {
    setHistoryKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div
          className={embedded ? "" : "container mx-auto py-6 px-4 max-w-6xl"}
        >
          {/* 页面标题 - 嵌入模式下隐藏 */}
          {!embedded && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Link href="/home">
                  <Button variant="ghost" size="sm" className="gap-1">
                    <ArrowLeft className="h-4 w-4" />
                    返回首页
                  </Button>
                </Link>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                数据导入
              </h1>
              <p className="text-muted-foreground mt-1">
                将外部数据导入到 AnyKeep，支持多种格式和来源
              </p>
            </div>
          )}

          {/* 导入选项卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {IMPORT_OPTIONS.map((option) => (
              <ImportCard
                key={option.id}
                title={option.title}
                description={option.description}
                icon={option.icon}
                color={option.color}
                bgColor={option.bgColor}
                borderColor={option.borderColor}
                features={option.features}
                comingSoon={option.comingSoon}
                onClick={() => handleImportClick(option.id)}
              />
            ))}
          </div>

          {/* 导入历史 */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">导入历史</h2>
            </div>
            <ImportHistoryList
              key={historyKey}
              maxItems={10}
              showHeader={false}
              onDelete={handleImportSuccess}
              className="border rounded-lg"
            />
          </div>

          {/* 浏览器书签导入对话框 */}
          <BrowserBookmarkImportDialog
            open={showBrowserImport}
            onOpenChange={setShowBrowserImport}
            onSuccess={handleImportSuccess}
          />

          {/* 批量导入对话框 */}
          <BatchImportDialog
            open={showBatchImport}
            onOpenChange={setShowBatchImport}
          />
        </div>
      </div>
    </div>
  );
}
