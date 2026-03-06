/**
 * AI 学习洞察页面 - 页面头部与空状态
 */

import { BrainCog } from "lucide-react";
import { TEXT } from "./constants";

export function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <BrainCog className="size-6 text-violet-500" />
        {TEXT.title}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">{TEXT.subtitle}</p>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center gap-3 text-muted-foreground">
      <BrainCog className="size-16 opacity-20" />
      <p className="text-lg font-medium">{TEXT.noData}</p>
      <p className="text-sm max-w-md text-center">{TEXT.noDataHint}</p>
    </div>
  );
}
