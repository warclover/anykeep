/**
 * 思维导图内容（简化展示）
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { DefaultContent } from "./default-content";

interface MindmapNode {
  label: string;
  children?: MindmapNode[];
}

export const MindmapContent = memo(function MindmapContent({
  content,
}: {
  content: unknown;
}) {
  // 简化实现：树形结构展示
  // 实际可集成 mind-map 组件库

  const renderNode = (
    node: MindmapNode,
    depth: number = 0,
  ): React.ReactNode => {
    return (
      <div key={node.label} style={{ marginLeft: depth * 16 }}>
        <div className="flex items-center gap-2 py-1">
          <span
            className={cn(
              "size-2 rounded-full",
              depth === 0
                ? "bg-purple-500"
                : depth === 1
                  ? "bg-indigo-400"
                  : "bg-gray-400",
            )}
          />
          <span
            className={cn(
              "text-sm",
              depth === 0 ? "font-medium text-gray-800" : "text-gray-600",
            )}
          >
            {node.label}
          </span>
        </div>
        {node.children?.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  if (typeof content === "object" && content !== null && "label" in content) {
    return <div className="py-2">{renderNode(content as MindmapNode)}</div>;
  }

  return <DefaultContent content={content} />;
});
