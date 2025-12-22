/**
 * AI 助手测试页面
 *
 * 用于测试和演示 AI 助手功能
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { Suspense } from "react";
import { AIAssistantTestClient } from "./ai-test-client";

export const metadata = {
  title: "AI 助手测试 - AnyKeep",
  description: "测试 AI 知识助手功能",
};

export default function AITestPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">AI 助手测试</h1>
        <p className="text-muted-foreground">
          测试 AI 知识助手的对话和工具调用功能
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <AIAssistantTestClient />
      </Suspense>
    </div>
  );
}
