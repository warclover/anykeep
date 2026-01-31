/**
 * 健康检测页面
 */

import { Suspense } from "react";
import { HealthPageClient } from "@/components/health/health-page-client";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "健康检测 - AnyKeep",
  description: "检测失效链接、重复内容和过期内容，全面诊断收藏夹健康状况",
};

function LoadingFallback() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">正在加载...</p>
      </div>
    </div>
  );
}

export default function HealthPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HealthPageClient />
    </Suspense>
  );
}
