"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface DepthWarningProps {
  /** 超过深度限制的文件夹列表 */
  foldersExceeding: Array<{ path: string[]; depth: number }>;
  /** 最大允许深度 */
  maxDepth: number;
  /** 是否已确认 */
  confirmed: boolean;
  /** 确认回调 */
  onConfirm: () => void;
}

export function DepthWarning({
  foldersExceeding,
  maxDepth,
  confirmed,
  onConfirm,
}: DepthWarningProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (foldersExceeding.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              文件夹层级过深
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              检测到 {foldersExceeding.length} 个文件夹超过了最大层级限制（
              {maxDepth}{" "}
              层）。超过限制的文件夹内的书签将被导入到最近的有效父文件夹中。
            </p>

            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto text-amber-600 dark:text-amber-400 hover:bg-transparent hover:text-amber-700"
                >
                  {showDetails ? (
                    <ChevronDown className="mr-1 h-4 w-4" />
                  ) : (
                    <ChevronRight className="mr-1 h-4 w-4" />
                  )}
                  查看详情 ({foldersExceeding.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 max-h-28 overflow-auto rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/50 p-2 text-xs">
                  {foldersExceeding.slice(0, 10).map((folder, index) => (
                    <div
                      key={index}
                      className="py-1 border-b border-amber-100 dark:border-amber-900 last:border-0"
                    >
                      <span className="font-mono text-amber-800 dark:text-amber-200">
                        {folder.path.join(" / ")}
                      </span>
                      <span className="ml-2 text-amber-500">
                        (深度: {folder.depth})
                      </span>
                    </div>
                  ))}
                  {foldersExceeding.length > 10 && (
                    <div className="py-1 text-amber-500">
                      ... 还有 {foldersExceeding.length - 10} 个
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {!confirmed && (
              <Button
                variant="outline"
                size="sm"
                onClick={onConfirm}
                className="mt-2 border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
              >
                我了解，继续导入
              </Button>
            )}

            {confirmed && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                ✓ 已确认，将继续导入
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
