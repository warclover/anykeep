"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MainLayout] Page error:", error);
  }, [error]);

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-6">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">页面加载出错</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "发生了意外错误，请重试"}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">
            错误 ID: {error.digest}
          </p>
        )}
        <Button onClick={reset} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          重试
        </Button>
      </div>
    </div>
  );
}
