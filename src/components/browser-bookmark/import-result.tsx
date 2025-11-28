"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  SkipForward,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  ImportResult as ImportResultType,
  BrowserSource,
} from "@/lib/browser-bookmark";
import { getPlatformName, getPlatformIcon } from "@/lib/constants/platforms";
import type { Platform } from "@/types/supabase";

interface ImportResultProps {
  result: ImportResultType;
  source: BrowserSource;
  onViewBookmarks?: () => void;
  onClose?: () => void;
}

export function ImportResult({
  result,
  source: _source,
  onViewBookmarks,
  onClose,
}: ImportResultProps) {
  void _source; // suppress unused variable warning
  const [showErrors, setShowErrors] = useState(false);
  const { success, failed, skipped, errors, platformBreakdown } = result;
  const hasErrors = errors.length > 0;

  return (
    <div className="space-y-6">
      {/* 成功图标和消息 */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold">导入完成</h3>
        <p className="mt-1 text-muted-foreground">成功导入 {success} 条书签</p>
      </div>

      {/* 平台分布 */}
      {Object.keys(platformBreakdown).length > 0 && (
        <div className="flex flex-wrap justify-center gap-4">
          {Object.entries(platformBreakdown).map(([platform, count]) => (
            <div
              key={platform}
              className="flex items-center gap-2 rounded-full bg-muted px-4 py-2"
            >
              <span>{getPlatformIcon(platform as Platform)}</span>
              <span className="font-medium">
                {getPlatformName(platform as Platform)}
              </span>
              <Badge variant="secondary">{count}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* 详细统计 */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="font-medium flex items-center gap-2">📊 详细统计</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              成功导入
            </span>
            <span className="font-medium">{success} 条</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <SkipForward className="h-4 w-4 text-amber-500" />
              跳过 (重复)
            </span>
            <span className="font-medium">{skipped} 条</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              导入失败
            </span>
            <span className="font-medium">{failed} 条</span>
          </div>
        </div>

        {/* 失败详情 */}
        {hasErrors && (
          <Collapsible open={showErrors} onOpenChange={setShowErrors}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
              >
                {showErrors ? (
                  <ChevronDown className="mr-2 h-4 w-4" />
                ) : (
                  <ChevronRight className="mr-2 h-4 w-4" />
                )}
                查看失败详情 ({errors.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 max-h-40 overflow-auto rounded border bg-muted/50 p-2 text-xs">
                {errors.map((error, index) => (
                  <div key={index} className="py-1 border-b last:border-0">
                    <div className="font-medium truncate">{error.title}</div>
                    <div className="text-muted-foreground truncate">
                      {error.url}
                    </div>
                    <div className="text-destructive">{error.reason}</div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* 下一步建议 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50 p-4 space-y-2">
        <h4 className="font-medium flex items-center gap-2 text-blue-700 dark:text-blue-300">
          💡 下一步建议
        </h4>
        <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
          <li>• 使用平台筛选查看导入的书签</li>
          <li>• 运行 AI 智能分类，自动整理书签</li>
          <li>• 检查「待整理」文件夹中的新书签</li>
        </ul>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3">
        {onViewBookmarks && (
          <Button variant="outline" onClick={onViewBookmarks}>
            查看书签
          </Button>
        )}
        {onClose && <Button onClick={onClose}>关闭</Button>}
      </div>
    </div>
  );
}
