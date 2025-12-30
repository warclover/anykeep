/**
 * MindmapViewer - 思维导图查看器组件
 *
 * 用于显示 QuickDigestSkill 生成的思维导图格式数据，
 * 支持树形展开/收起、节点高亮和简单交互。
 *
 * 注意：这是一个轻量级的思维导图展示组件，
 * 不依赖复杂的图形库，使用纯 CSS 实现。
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

"use client";

import { memo, useState, useCallback, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Circle,
  ExternalLink,
  Folder,
  FileText,
  Tag,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ============================================
// 类型定义
// ============================================

/**
 * 思维导图节点
 */
export interface MindmapNode {
  /** 节点 ID */
  id: string;
  /** 节点标题 */
  label: string;
  /** 节点类型 */
  type: "root" | "topic" | "bookmark" | "tag" | "insight";
  /** 子节点 */
  children?: MindmapNode[];
  /** 节点数据 */
  data?: {
    /** URL（bookmark 类型） */
    url?: string;
    /** 平台（bookmark 类型） */
    platform?: string;
    /** 摘要 */
    summary?: string;
    /** 数量统计 */
    count?: number;
  };
}

interface MindmapViewerProps {
  /** 思维导图数据 */
  data: MindmapNode;
  /** 点击节点回调 */
  onNodeClick?: (node: MindmapNode) => void;
  /** 打开链接回调 */
  onOpenLink?: (url: string) => void;
  /** 默认展开层级 */
  defaultExpandLevel?: number;
  /** 自定义类名 */
  className?: string;
  /** 紧凑模式 */
  compact?: boolean;
}

interface MindmapNodeItemProps {
  /** 节点数据 */
  node: MindmapNode;
  /** 当前层级 */
  level: number;
  /** 是否展开 */
  isExpanded: boolean;
  /** 切换展开状态 */
  onToggle: (nodeId: string) => void;
  /** 点击节点回调 */
  onNodeClick?: (node: MindmapNode) => void;
  /** 打开链接回调 */
  onOpenLink?: (url: string) => void;
  /** 展开状态映射 */
  expandedNodes: Set<string>;
  /** 紧凑模式 */
  compact?: boolean;
}

// ============================================
// 常量配置
// ============================================

/**
 * 节点类型配置
 */
const NODE_TYPE_CONFIG: Record<
  MindmapNode["type"],
  {
    icon: typeof Circle;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  root: {
    icon: Sparkles,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  topic: {
    icon: Folder,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  bookmark: {
    icon: FileText,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  tag: {
    icon: Tag,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  insight: {
    icon: Sparkles,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    borderColor: "border-pink-200",
  },
};

/**
 * 层级缩进（px）
 */
const LEVEL_INDENT = 24;

/**
 * 连接线颜色
 */
const LINE_COLORS = [
  "border-purple-300",
  "border-blue-300",
  "border-emerald-300",
  "border-amber-300",
  "border-pink-300",
  "border-gray-300",
];

// ============================================
// 辅助函数
// ============================================

/**
 * 获取节点的所有子节点 ID
 */
function getAllChildIds(node: MindmapNode): string[] {
  const ids: string[] = [node.id];
  if (node.children) {
    for (const child of node.children) {
      ids.push(...getAllChildIds(child));
    }
  }
  return ids;
}

/**
 * 获取默认展开的节点 ID
 */
function getDefaultExpandedIds(
  node: MindmapNode,
  maxLevel: number,
  currentLevel = 0,
): string[] {
  const ids: string[] = [];
  if (currentLevel < maxLevel) {
    ids.push(node.id);
    if (node.children) {
      for (const child of node.children) {
        ids.push(...getDefaultExpandedIds(child, maxLevel, currentLevel + 1));
      }
    }
  }
  return ids;
}

// ============================================
// 子组件
// ============================================

/**
 * 思维导图节点项
 */
const MindmapNodeItem = memo(function MindmapNodeItem({
  node,
  level,
  isExpanded,
  onToggle,
  onNodeClick,
  onOpenLink,
  expandedNodes,
  compact = false,
}: MindmapNodeItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const config = NODE_TYPE_CONFIG[node.type];
  const Icon = config.icon;
  const lineColor = LINE_COLORS[level % LINE_COLORS.length];

  return (
    <div className="relative">
      {/* 连接线 */}
      {level > 0 && (
        <div
          className={cn("absolute left-0 top-0 h-full border-l-2", lineColor)}
          style={{ left: (level - 1) * LEVEL_INDENT + 12 }}
        />
      )}

      {/* 节点内容 */}
      <div
        className={cn(
          "relative flex items-start gap-2 py-1.5 px-2 rounded-lg transition-colors",
          "hover:bg-gray-50 cursor-pointer",
          level === 0 && "bg-gradient-to-r from-purple-50 to-indigo-50 mb-2",
        )}
        style={{ marginLeft: level * LEVEL_INDENT }}
        onClick={() => onNodeClick?.(node)}
      >
        {/* 展开/收起按钮 */}
        {hasChildren ? (
          <button
            className="flex-shrink-0 size-5 flex items-center justify-center text-gray-400 hover:text-gray-600"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        ) : (
          <div className="flex-shrink-0 size-5 flex items-center justify-center">
            <Circle className="size-2 text-gray-300" />
          </div>
        )}

        {/* 节点图标 */}
        <div
          className={cn(
            "flex-shrink-0 size-6 rounded flex items-center justify-center",
            config.bgColor,
          )}
        >
          <Icon className={cn("size-3.5", config.color)} />
        </div>

        {/* 节点内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-medium",
                level === 0 ? "text-purple-800" : "text-gray-700",
                compact && "text-sm",
              )}
            >
              {node.label}
            </span>

            {/* 数量徽章 */}
            {node.data?.count && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {node.data.count}
              </Badge>
            )}

            {/* 平台徽章 */}
            {node.data?.platform && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {node.data.platform}
              </Badge>
            )}

            {/* 链接按钮 */}
            {node.data?.url && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  if (node.data?.url) {
                    onOpenLink?.(node.data.url);
                  }
                }}
              >
                <ExternalLink className="size-3" />
              </Button>
            )}
          </div>

          {/* 摘要 */}
          {!compact && node.data?.summary && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
              {node.data.summary}
            </p>
          )}
        </div>
      </div>

      {/* 子节点 */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {(node.children ?? []).map((child) => (
            <MindmapNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              isExpanded={expandedNodes.has(child.id)}
              onToggle={onToggle}
              onNodeClick={onNodeClick}
              onOpenLink={onOpenLink}
              expandedNodes={expandedNodes}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * 思维导图查看器组件
 */
export const MindmapViewer = memo(function MindmapViewer({
  data,
  onNodeClick,
  onOpenLink,
  defaultExpandLevel = 2,
  className,
  compact = false,
}: MindmapViewerProps) {
  // 计算默认展开的节点
  const defaultExpanded = useMemo(
    () => new Set(getDefaultExpandedIds(data, defaultExpandLevel)),
    [data, defaultExpandLevel],
  );

  // 展开状态管理
  const [expandedNodes, setExpandedNodes] =
    useState<Set<string>>(defaultExpanded);

  // 切换节点展开状态
  const handleToggle = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // 全部展开
  const handleExpandAll = useCallback(() => {
    const allIds = getAllChildIds(data);
    setExpandedNodes(new Set(allIds));
  }, [data]);

  // 全部收起
  const handleCollapseAll = useCallback(() => {
    setExpandedNodes(new Set([data.id]));
  }, [data.id]);

  // 计算统计信息
  const stats = useMemo(() => {
    let nodeCount = 0;
    let bookmarkCount = 0;

    const countNodes = (node: MindmapNode) => {
      nodeCount++;
      if (node.type === "bookmark") bookmarkCount++;
      if (node.children) {
        for (const child of node.children) {
          countNodes(child);
        }
      }
    };

    countNodes(data);
    return { nodeCount, bookmarkCount };
  }, [data]);

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden",
        className,
      )}
    >
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Sparkles className="size-4 text-purple-500" />
          <span>思维导图</span>
          <span className="text-gray-400">·</span>
          <span>{stats.nodeCount} 个节点</span>
          {stats.bookmarkCount > 0 && (
            <>
              <span className="text-gray-400">·</span>
              <span>{stats.bookmarkCount} 个书签</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleExpandAll}
          >
            全部展开
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleCollapseAll}
          >
            全部收起
          </Button>
        </div>
      </div>

      {/* 思维导图内容 */}
      <div className="p-4 overflow-auto max-h-[600px]">
        <MindmapNodeItem
          node={data}
          level={0}
          isExpanded={expandedNodes.has(data.id)}
          onToggle={handleToggle}
          onNodeClick={onNodeClick}
          onOpenLink={onOpenLink}
          expandedNodes={expandedNodes}
          compact={compact}
        />
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50">
        <span className="text-xs text-gray-400">图例:</span>
        {Object.entries(NODE_TYPE_CONFIG).map(([type, config]) => (
          <div key={type} className="flex items-center gap-1">
            <div
              className={cn(
                "size-4 rounded flex items-center justify-center",
                config.bgColor,
              )}
            >
              <config.icon className={cn("size-2.5", config.color)} />
            </div>
            <span className="text-xs text-gray-500">
              {type === "root"
                ? "根节点"
                : type === "topic"
                  ? "主题"
                  : type === "bookmark"
                    ? "书签"
                    : type === "tag"
                      ? "标签"
                      : "洞察"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ============================================
// 工具函数：从 QuickDigest 输出转换为思维导图数据
// ============================================

/**
 * 将 QuickDigest 输出转换为思维导图数据
 */
export function convertDigestToMindmap(
  digest: {
    title: string;
    topics: Array<{
      name: string;
      keywords: string[];
      bookmarks: Array<{
        id: number;
        title: string;
        url: string;
        platform?: string;
        summary?: string;
      }>;
    }>;
    insights?: Array<{
      type: string;
      content: string;
    }>;
  },
  rootId = "root",
): MindmapNode {
  const root: MindmapNode = {
    id: rootId,
    label: digest.title,
    type: "root",
    children: [],
  };

  // 添加主题节点
  for (const topic of digest.topics) {
    const topicNode: MindmapNode = {
      id: `topic-${topic.name}`,
      label: topic.name,
      type: "topic",
      data: {
        count: topic.bookmarks.length,
      },
      children: [],
    };

    // 添加书签节点
    for (const bookmark of topic.bookmarks) {
      topicNode.children.push({
        id: `bookmark-${bookmark.id}`,
        label: bookmark.title,
        type: "bookmark",
        data: {
          url: bookmark.url,
          platform: bookmark.platform,
          summary: bookmark.summary,
        },
      });
    }

    // 添加标签节点
    if (topic.keywords.length > 0) {
      const tagsNode: MindmapNode = {
        id: `tags-${topic.name}`,
        label: "关键词",
        type: "tag",
        children: topic.keywords.slice(0, 5).map((keyword) => ({
          id: `tag-${topic.name}-${keyword}`,
          label: keyword,
          type: "tag",
        })),
      };
      topicNode.children.push(tagsNode);
    }

    root.children.push(topicNode);
  }

  // 添加洞察节点
  if (digest.insights && digest.insights.length > 0) {
    const insightsNode: MindmapNode = {
      id: "insights",
      label: "洞察",
      type: "insight",
      children: digest.insights.map((insight, index) => ({
        id: `insight-${index}`,
        label: insight.content,
        type: "insight",
      })),
    };
    root.children.push(insightsNode);
  }

  return root;
}

export default MindmapViewer;
