/**
 * 图表类型内容（简化展示）
 */

import { memo } from "react";
import { DefaultContent } from "./default-content";

export const GraphContent = memo(function GraphContent({
  content,
  metadata,
}: {
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  // 简化实现：显示数据摘要
  // 实际可集成 recharts 等图表库
  if (!Array.isArray(content)) {
    return <DefaultContent content={content} />;
  }

  return (
    <div className="space-y-3">
      {metadata?.chartType !== undefined && (
        <div className="text-xs text-gray-500">
          图表类型: {String(metadata.chartType)}
        </div>
      )}

      {/* 简化的数据条形图 */}
      <div className="space-y-2">
        {content.slice(0, 10).map((item, index) => {
          const dataItem = item as Record<string, unknown>;
          const label = String(
            dataItem.label || dataItem.name || `项目 ${index + 1}`,
          );
          const value = Number(dataItem.value || dataItem.count || 0);
          const maxValue = Math.max(
            ...content.map((i) =>
              Number(
                (i as Record<string, unknown>).value ||
                  (i as Record<string, unknown>).count ||
                  0,
              ),
            ),
          );
          const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

          return (
            <div key={index} className="flex items-center gap-3">
              <span className="w-24 text-xs text-gray-600 truncate">
                {label}
              </span>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-12 text-xs text-gray-500 text-right">
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {content.length > 10 && (
        <p className="text-xs text-gray-400">
          还有 {content.length - 10} 项数据...
        </p>
      )}
    </div>
  );
});
