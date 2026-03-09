/**
 * AI 摘要渲染组件
 * 智能解析纯文本摘要，提供结构化视觉呈现
 *
 * 支持两种格式：
 * - V1: 纯文本格式（智能解析）
 * - V2: JSON 结构化格式（直接渲染）
 *
 * @version 2.0.0
 */

import { cn } from "@/lib/utils";
import {
  parseStructuredSummary,
  isStructuredSummary,
} from "@/lib/summary/types/ai-summary";
import { parseSummary, isCoreSection } from "./summary-parser";
import { StructuredSummaryRenderer } from "./structured-summary-renderer";

interface SummaryRendererProps {
  summary: string;
  className?: string;
}

/**
 * AI 摘要渲染组件
 * 采用卡片式结构化布局，层次分明，便于阅读
 *
 * 自动检测摘要格式：
 * - JSON 格式：使用 StructuredSummaryRenderer
 * - 纯文本格式：使用智能解析后渲染
 */
export function SummaryRenderer({ summary, className }: SummaryRendererProps) {
  // 尝试解析为 JSON 结构化摘要
  if (isStructuredSummary(summary)) {
    const structured = parseStructuredSummary(summary);
    if (structured) {
      return (
        <StructuredSummaryRenderer data={structured} className={className} />
      );
    }
  }

  // 回退到纯文本解析（V1 逻辑）
  const sections = parseSummary(summary);

  // 如果解析失败或只有一个段落，降级到简单卡片渲染
  if (sections.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 border border-slate-200/60 dark:border-slate-700/50",
          className,
        )}
      >
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {summary}
        </p>
      </div>
    );
  }

  // 如果只有一个普通段落（无结构化内容），也使用简单卡片渲染
  if (sections.length === 1 && sections[0].type === "paragraph") {
    return (
      <div
        className={cn(
          "rounded-xl p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 border border-slate-200/60 dark:border-slate-700/50",
          className,
        )}
      >
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {sections[0].content}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 border border-slate-200/60 dark:border-slate-700/50 space-y-3",
        className,
      )}
    >
      {sections.map((section, idx) => {
        // 标题
        if (section.type === "heading" && section.title) {
          const isCore = isCoreSection(section.title);
          return (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-2 pt-2 first:pt-0",
                isCore && "pb-0.5",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center size-6 rounded-full bg-white dark:bg-slate-800 shadow-sm",
                  section.iconData?.colorClass,
                )}
              >
                {section.iconData?.icon}
              </span>
              <h4
                className={cn(
                  "text-sm font-semibold tracking-wide",
                  isCore
                    ? "text-slate-800 dark:text-slate-200"
                    : "text-slate-500 dark:text-slate-400 uppercase",
                )}
              >
                {section.title}
              </h4>
            </div>
          );
        }

        // 列表 - 带编号圆点样式
        if (section.type === "list" && section.items) {
          return (
            <ul key={idx} className="space-y-2 ml-1">
              {section.items.map((item, i) => {
                const cleanItem = item
                  .replace(/^[\d①②③④⑤⑥⑦⑧⑨⑩]+[）\)\.、\s]+/, "")
                  .trim();
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 flex items-center justify-center size-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {cleanItem}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // 引用块
        if (section.type === "quote" && section.content) {
          return (
            <blockquote
              key={idx}
              className="border-l-4 border-blue-400 dark:border-blue-500 pl-4 py-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-r-lg text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed"
            >
              {section.content}
            </blockquote>
          );
        }

        // 普通段落 - 核心主旨后的内容突出显示
        if (section.type === "paragraph" && section.content) {
          const prevSection = idx > 0 ? sections[idx - 1] : null;
          const isAfterCore =
            prevSection?.type === "heading" &&
            prevSection.title &&
            isCoreSection(prevSection.title);

          if (isAfterCore) {
            return (
              <div
                key={idx}
                className="border-l-4 border-blue-500 dark:border-blue-400 pl-3 py-2 bg-white/60 dark:bg-slate-800/50 rounded-r-lg"
              >
                <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {section.content}
                </p>
              </div>
            );
          }

          return (
            <p
              key={idx}
              className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed ml-1"
            >
              {section.content}
            </p>
          );
        }

        return null;
      })}
    </div>
  );
}
