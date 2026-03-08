/**
 * AI 助手测试页面客户端组件
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AIAssistantButton,
  AIAssistantPanel,
  FloatingAIAssistantButton,
} from "@/components/ai";

// TODO(@backlog): 从认证上下文获取真实用户 ID
const TEST_USER_ID = "test-user-123";

export function AIAssistantTestClient() {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="space-y-8">
      {/* 功能卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* 面板测试 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5" />
              对话面板
            </CardTitle>
            <CardDescription>打开 AI 助手对话面板进行交互</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setPanelOpen(true)} className="w-full">
              <Sparkles className="size-4 mr-2" />
              打开 AI 助手
            </Button>
          </CardContent>
        </Card>

        {/* 按钮测试 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5" />
              内联按钮
            </CardTitle>
            <CardDescription>不同尺寸和样式的 AI 助手按钮</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <AIAssistantButton
              userId={TEST_USER_ID}
              size="sm"
              variant="outline"
            />
            <AIAssistantButton
              userId={TEST_USER_ID}
              size="default"
              variant="default"
            />
            <AIAssistantButton
              userId={TEST_USER_ID}
              size="lg"
              variant="ghost"
            />
          </CardContent>
        </Card>

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5" />
              使用说明
            </CardTitle>
            <CardDescription>AI 助手支持的功能</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>• 搜索书签内容</li>
              <li>• 智能分类书签</li>
              <li>• 生成内容摘要</li>
              <li>• 回答知识问题</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* 示例对话 */}
      <Card>
        <CardHeader>
          <CardTitle>示例对话</CardTitle>
          <CardDescription>你可以尝试以下对话来测试 AI 助手</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="p-3 rounded-lg bg-muted text-sm">
              &ldquo;搜索关于 React 的文章&rdquo;
            </div>
            <div className="p-3 rounded-lg bg-muted text-sm">
              &ldquo;帮我整理最近收藏的内容&rdquo;
            </div>
            <div className="p-3 rounded-lg bg-muted text-sm">
              &ldquo;生成这篇文章的摘要&rdquo;
            </div>
            <div className="p-3 rounded-lg bg-muted text-sm">
              &ldquo;我有哪些关于 AI 的收藏？&rdquo;
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI 助手面板 */}
      <AIAssistantPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        userId={TEST_USER_ID}
      />

      {/* 悬浮按钮 */}
      <FloatingAIAssistantButton userId={TEST_USER_ID} />
    </div>
  );
}
