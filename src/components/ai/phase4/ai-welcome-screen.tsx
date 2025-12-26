"use client";

/**
 * AI 欢迎界面组件
 *
 * 在无消息时显示的欢迎界面，包含快速操作按钮
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import {
  Sparkles,
  Search,
  FolderOpen,
  BarChart3,
  BookOpen,
} from "lucide-react";

// =============================================================================
// 类型定义
// =============================================================================

export interface AIWelcomeScreenProps {
  /** 设置输入内容的回调 */
  onSetInput: (input: string) => void;
}

// =============================================================================
// 快捷操作配置
// =============================================================================

const QUICK_ACTIONS = [
  {
    id: "search",
    label: "搜索收藏",
    input: "搜索关于 AI 的文章",
    icon: Search,
    colorClass:
      "text-pink-600 border-pink-200 hover:bg-pink-50 hover:border-pink-300",
  },
  {
    id: "review",
    label: "知识复习",
    input: "帮我制定知识复习计划",
    icon: BookOpen,
    colorClass:
      "text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300",
  },
  {
    id: "folders",
    label: "查看文件夹",
    input: "我有哪些文件夹",
    icon: FolderOpen,
    colorClass:
      "text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300",
  },
  {
    id: "stats",
    label: "统计分析",
    input: "统计我的收藏情况",
    icon: BarChart3,
    colorClass:
      "text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300",
  },
] as const;

// =============================================================================
// 组件实现
// =============================================================================

export function AIWelcomeScreen({ onSetInput }: AIWelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8 px-4">
      <div className="w-full max-w-sm bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-5 border border-pink-100 shadow-sm mb-6">
        {/* 欢迎消息 */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 flex items-center justify-center flex-shrink-0 shadow-md">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <p className="text-gray-700 font-medium text-sm">
              你好！我是你的 AI 助手 ✨
            </p>
            <p className="text-gray-500 text-xs mt-1">有什么可以帮你的吗？</p>
          </div>
        </div>

        {/* 快捷操作按钮 */}
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => onSetInput(action.input)}
                className={`px-2.5 py-1 bg-white rounded-full text-[10px] border transition-colors flex items-center gap-0.5 shadow-sm ${action.colorClass}`}
              >
                <Icon className="size-2.5" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
