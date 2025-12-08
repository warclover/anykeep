"use client";

/**
 * V3 vs V4 智能分类对比调试工具
 *
 * 路由入口页面 - 仅导入 feature 模块
 *
 * 环境变量：
 * - NEXT_PUBLIC_ENABLE_CLASSIFICATION_DEBUGGER: 前端功能开关
 */

import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import {
  isDebuggerEnabled,
  DebuggerPage,
} from "@/features/classification-debugger";

export default function ClassificationDebuggerPageRoute() {
  // 环境变量检查
  if (!isDebuggerEnabled()) {
    return (
      <div className="container max-w-4xl py-12">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              <div>
                <h2 className="font-semibold">功能未启用</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  请在环境变量中设置{" "}
                  <code className="bg-muted px-1 rounded">
                    NEXT_PUBLIC_ENABLE_CLASSIFICATION_DEBUGGER=true
                  </code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <DebuggerPage />;
}
