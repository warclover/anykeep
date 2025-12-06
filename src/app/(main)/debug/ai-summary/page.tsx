/**
 * AI 摘要调试页面
 *
 * 路由: /debug/ai-summary
 * 仅在开发环境可用
 */

import { AISummaryDebugPage } from "@/components/debug/ai-summary-debug-page";

export const metadata = {
  title: "AI 摘要调试 - AnyKeep",
  description: "AI 摘要参数配置和实时测试",
};

export default function DebugAISummaryPage() {
  return <AISummaryDebugPage />;
}
