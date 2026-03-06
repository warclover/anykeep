"use client";

import {
  Search,
  FolderOpen,
  BarChart3,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { AICommandHints } from "./ai-command-hints";

interface PanelWelcomeProps {
  inputValue: string;
  onSetInput: (value: string) => void;
}

/** 欢迎界面 - 糖果风格 */
export function PanelWelcome({ inputValue, onSetInput }: PanelWelcomeProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8 px-4">
      <div className="w-full max-w-sm bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-5 border border-pink-100 shadow-sm mb-6">
        <div className="flex items-start gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 flex items-center justify-center flex-shrink-0 shadow-md">
            <Sparkles className="size-4 text-white" />
          </div>
          <div>
            <p className="text-gray-700 font-medium text-[10px]">
              你好！我是你的 AI 助手 ✨
            </p>
            <p className="text-gray-500 text-[10px] mt-0.5">
              有什么可以帮你的吗？
            </p>
          </div>
        </div>

        {/* 快捷功能按钮 */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSetInput("搜索关于 AI 的文章")}
            className="px-2.5 py-1 bg-white rounded-full text-[10px] text-pink-600 border border-pink-200 hover:bg-pink-50 hover:border-pink-300 transition-colors flex items-center gap-0.5 shadow-sm"
          >
            <Search className="size-2.5" />
            搜索收藏
          </button>
          <button
            onClick={() => onSetInput("帮我制定知识复习计划")}
            className="px-2.5 py-1 bg-white rounded-full text-[10px] text-amber-600 border border-amber-200 hover:bg-amber-50 hover:border-amber-300 transition-colors flex items-center gap-0.5 shadow-sm"
          >
            <BookOpen className="size-2.5" />
            知识复习
          </button>
          <button
            onClick={() => onSetInput("我有哪些文件夹")}
            className="px-2.5 py-1 bg-white rounded-full text-[10px] text-purple-600 border border-purple-200 hover:bg-purple-50 hover:border-purple-300 transition-colors flex items-center gap-0.5 shadow-sm"
          >
            <FolderOpen className="size-2.5" />
            查看文件夹
          </button>
          <button
            onClick={() => onSetInput("统计我的收藏情况")}
            className="px-2.5 py-1 bg-white rounded-full text-[10px] text-indigo-600 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-colors flex items-center gap-0.5 shadow-sm"
          >
            <BarChart3 className="size-2.5" />
            统计分析
          </button>
        </div>
      </div>

      {/* AI 特殊命令提示 */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm">
        <AICommandHints
          inputValue={inputValue}
          onCommandClick={(command) => onSetInput(command)}
          defaultExpanded={false}
        />
      </div>
    </div>
  );
}

interface PanelSuggestionBarProps {
  onSetInput: (value: string) => void;
}

/** 快捷建议栏 - 有消息时显示 */
export function PanelSuggestionBar({ onSetInput }: PanelSuggestionBarProps) {
  return (
    <div className="px-4 py-2 border-t border-pink-100 bg-gradient-to-r from-pink-50/50 to-purple-50/50 flex-shrink-0">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => onSetInput("继续")}
          className="flex-shrink-0 px-3 py-1.5 bg-white border border-pink-200 rounded-full text-xs text-pink-600 hover:bg-pink-50 hover:border-pink-300 transition-colors shadow-sm"
        >
          继续 →
        </button>
        <button
          onClick={() => onSetInput("帮我制定知识复习计划")}
          className="flex-shrink-0 px-3 py-1.5 bg-white border border-amber-200 rounded-full text-xs text-amber-600 hover:bg-amber-50 hover:border-amber-300 transition-colors shadow-sm flex items-center gap-1"
        >
          <BookOpen className="size-3" />
          知识复习
        </button>
        <button
          onClick={() => onSetInput("搜索相关内容")}
          className="flex-shrink-0 px-3 py-1.5 bg-white border border-purple-200 rounded-full text-xs text-purple-600 hover:bg-purple-50 hover:border-purple-300 transition-colors shadow-sm"
        >
          🔍 搜索相关
        </button>
        <button
          onClick={() => onSetInput("给我更多详情")}
          className="flex-shrink-0 px-3 py-1.5 bg-white border border-indigo-200 rounded-full text-xs text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-colors shadow-sm"
        >
          📋 更多详情
        </button>
      </div>
    </div>
  );
}
