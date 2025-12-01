/**
 * 浏览器书签空状态组件
 * 当没有浏览器书签时显示，引导用户导入
 */

"use client";

import { Globe, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrowserBookmarkEmptyStateProps {
  onImport?: () => void;
}

/**
 * 浏览器书签空状态
 */
export function BrowserBookmarkEmptyState({
  onImport,
}: BrowserBookmarkEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* 图标 */}
      <div className="w-24 h-24 mb-6 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
        <Globe className="w-12 h-12 text-blue-500 dark:text-blue-400" />
      </div>

      {/* 标题 */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        还没有浏览器书签
      </h3>

      {/* 描述 */}
      <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
        从 Chrome、Edge、Firefox 或 Safari 导入书签，
        统一管理所有浏览器的收藏内容
      </p>

      {/* 导入按钮 */}
      <Button
        onClick={onImport}
        size="lg"
        className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        <Upload className="w-4 h-4 mr-2" />
        导入浏览器书签
      </Button>

      {/* 提示信息 */}
      <p className="text-xs text-gray-500 dark:text-gray-500 mt-4 max-w-sm">
        支持导入书签的层级文件夹结构，自动识别网站图标
      </p>
    </div>
  );
}
