/**
 * AI 助手聊天 Tab
 *
 * 提供与 AI Agent 的对话界面
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Send,
  Loader2,
  AlertCircle,
  Sparkles,
  Bookmark,
  FileText,
  Link,
  MessageCircle,
  Trash2,
  Check,
  Clock,
  XCircle,
} from "lucide-react";
import { useChatStore } from "../../stores/chat-store";
import { useAgentChat } from "../../hooks/use-agent-chat";

/**
 * 快捷操作按钮
 */
interface QuickAction {
  id:
    | "save_page"
    | "save_selection"
    | "summarize"
    | "extract_links"
    | "ask_about_page";
  label: string;
  icon: React.ReactNode;
}

const quickActions: QuickAction[] = [
  {
    id: "save_page",
    label: "保存页面",
    icon: <Bookmark className="w-3.5 h-3.5" />,
  },
  {
    id: "summarize",
    label: "总结页面",
    icon: <FileText className="w-3.5 h-3.5" />,
  },
  {
    id: "extract_links",
    label: "提取链接",
    icon: <Link className="w-3.5 h-3.5" />,
  },
  {
    id: "ask_about_page",
    label: "问问这页",
    icon: <MessageCircle className="w-3.5 h-3.5" />,
  },
];

/**
 * 操作状态图标
 */
function ActionStatusIcon({
  status,
}: {
  status: "pending" | "completed" | "error";
}) {
  switch (status) {
    case "pending":
      return <Clock className="w-3 h-3 text-yellow-500 animate-pulse" />;
    case "completed":
      return <Check className="w-3 h-3 text-green-500" />;
    case "error":
      return <XCircle className="w-3 h-3 text-red-500" />;
  }
}

/**
 * 聊天消息组件
 */
function ChatMessage({
  message,
}: {
  message: {
    role: "user" | "assistant";
    content: string;
    actions?: Array<{
      name: string;
      status: "pending" | "completed" | "error";
    }>;
  };
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${
          isUser
            ? "bg-primary-500 text-white rounded-br-md"
            : "bg-gray-100 text-gray-800 rounded-bl-md"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>

        {/* 操作状态 */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200/50 space-y-1">
            {message.actions.map((action, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 text-xs opacity-80"
              >
                <ActionStatusIcon status={action.status} />
                <span>{action.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 聊天 Tab 主组件
 */
export function ChatTab() {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isLoading, isTyping, error } = useChatStore();
  const { sendMessage, sendQuickAction, clearChat } = useAgentChat();

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // 处理发送
  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue);
    setInputValue("");
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 自动调整输入框高度
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // 重置高度以计算新高度
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  };

  return (
    <div className="flex flex-col h-full">
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          // 空状态 - 显示快捷操作
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-primary-500" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">AI 助手</h3>
            <p className="text-sm text-gray-500 mb-4">
              帮你保存、整理和分析网页内容
            </p>

            {/* 快捷操作 */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => sendQuickAction(action.id)}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 transition-colors disabled:opacity-50"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // 消息列表
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* 输入中提示 */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2">
                  <div className="flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-3 mb-2 flex items-center gap-2 p-2 bg-red-50 text-red-600 rounded-lg text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 底部工具栏 */}
      {messages.length > 0 && (
        <div className="flex justify-end px-3 pb-1">
          <button
            onClick={clearChat}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            <Trash2 className="w-3 h-3" />
            清除对话
          </button>
        </div>
      )}

      {/* 输入区域 */}
      <div className="px-3 pb-3">
        <div className="flex items-end gap-2 bg-gray-50 rounded-xl p-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm placeholder-gray-400 focus:outline-none py-1.5 px-1 max-h-24"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={`p-2 rounded-lg transition-colors ${
              inputValue.trim() && !isLoading
                ? "bg-primary-500 text-white hover:bg-primary-600"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
