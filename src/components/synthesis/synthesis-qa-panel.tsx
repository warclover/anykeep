/**
 * 综述实时问答面板
 *
 * 基于综述内容进行实时问答，深入理解综述观点
 *
 * @version 1.0.0
 * @since 2026-01-01 [S3]
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  MessageCircle,
  Send,
  Loader2,
  User,
  Bot,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// ============================================================================
// 类型定义
// ============================================================================

interface QAMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface SynthesisQAPanelProps {
  reportId: string;
  reportTitle: string;
  overview?: string;
  className?: string;
}

// ============================================================================
// 预设问题
// ============================================================================

const PRESET_QUESTIONS = [
  "这篇综述的核心观点是什么？",
  "各来源之间最大的分歧在哪里？",
  "有哪些知识盲区需要我补充？",
  "能用通俗的语言解释一下吗？",
];

// ============================================================================
// 组件实现
// ============================================================================

/**
 * 综述实时问答面板
 */
export function SynthesisQAPanel({
  reportId,
  reportTitle,
  overview,
  className,
}: SynthesisQAPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 发送问题
  const handleSubmit = useCallback(
    async (question: string) => {
      if (!question.trim() || isLoading) return;

      const userMessage: QAMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: question.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const response = await fetch("/api/synthesis/qa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId,
            question: question.trim(),
            context: {
              title: reportTitle,
              overview,
            },
          }),
        });

        if (!response.ok) {
          throw new Error("请求失败");
        }

        const data = await response.json();

        const assistantMessage: QAMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.answer || "抱歉，我无法回答这个问题。",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error("QA error:", error);
        const errorMessage: QAMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "抱歉，回答时出现了问题，请稍后重试。",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [reportId, reportTitle, overview, isLoading],
  );

  // 处理表单提交
  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleSubmit(input);
    },
    [input, handleSubmit],
  );

  // 处理预设问题点击
  const handlePresetClick = useCallback(
    (question: string) => {
      handleSubmit(question);
    },
    [handleSubmit],
  );

  // 清空对话
  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn("border-2 border-indigo-200", className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="flex items-center gap-2 text-lg">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
              <MessageCircle className="h-5 w-5 text-indigo-500" />
              实时提问
              <Badge
                variant="secondary"
                className="ml-2 bg-indigo-100 text-indigo-700"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                AI
              </Badge>
            </CardTitle>
            <CardDescription>
              有疑问？直接提问，AI 基于综述内容为你解答
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* 对话历史 */}
            {messages.length > 0 ? (
              <ScrollArea className="h-[300px] pr-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        message.role === "user" && "flex-row-reverse",
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-indigo-100 text-indigo-600",
                        )}
                      >
                        {message.role === "user" ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>
                      <div
                        className={cn(
                          "flex-1 rounded-lg p-3",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted",
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                        </p>
                        <p
                          className={cn(
                            "text-xs mt-1",
                            message.role === "user"
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 shrink-0">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="flex-1 rounded-lg p-3 bg-muted">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">
                            正在思考...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              /* 预设问题 */
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  试试这些问题，或输入你的疑问：
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_QUESTIONS.map((question, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-colors py-1.5 px-3"
                      onClick={() => handlePresetClick(question)}
                    >
                      {question}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 输入区域 */}
            <form onSubmit={handleFormSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入你的问题..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={!input.trim() || isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </form>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
