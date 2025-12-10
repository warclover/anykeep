"use client";

/**
 * AI 操作历史卡片组件 (V4.2)
 * 显示 AI 文件夹操作历史，支持撤销
 */

import { useState } from "react";
import { History, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { OperationHistoryList } from "@/components/folder-evolution";
import { useOperationHistory } from "@/hooks/use-operation-history";

interface AIOperationHistoryCardProps {
  defaultExpanded?: boolean;
}

export function AIOperationHistoryCard({
  defaultExpanded = false,
}: AIOperationHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const {
    operations,
    isLoading,
    error,
    undoableCount,
    undoOperation,
    refresh,
    isUndoing: _isUndoing,
  } = useOperationHistory({
    limit: 10,
    autoRefresh: true,
    refreshInterval: 60000, // 1 分钟刷新一次
  });

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <History className="size-5 text-indigo-600 dark:text-indigo-400" />
                <CardTitle>AI 操作历史</CardTitle>
                {undoableCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {undoableCount} 项可撤销
                  </Badge>
                )}
              </div>
              <ChevronRight
                className={`size-5 text-muted-foreground transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
            </div>
          </CollapsibleTrigger>
          <CardDescription>
            查看 AI 对文件夹的操作记录，2 天内可撤销
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* 快速预览列表 */}
            <OperationHistoryList
              operations={operations}
              isLoading={isLoading}
              error={error}
              onUndo={async (id: string) => {
                await undoOperation(id);
              }}
              onRefresh={refresh}
              undoableCount={undoableCount}
            />

            {/* 查看更多链接 */}
            {operations.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Link href="/settings/ai-history">
                  <Button variant="outline" className="w-full">
                    <span>查看全部操作历史</span>
                    <ExternalLink className="size-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
