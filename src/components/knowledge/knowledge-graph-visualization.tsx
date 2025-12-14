/**
 * Knowledge Graph Visualization Component
 *
 * 知识图谱可视化组件
 * 使用 SVG + Force-directed 布局展示书签之间的关联
 *
 * @version 1.0.0
 * @since 2025-12-14
 */

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Brain,
  Users,
  Tag,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
// cn utility removed - not currently needed
import type { GraphData, GraphNode, GraphEdge } from "@/lib/knowledge-link";
import type { LinkType } from "@/lib/knowledge-link";

// ============================================================================
// Types
// ============================================================================

interface KnowledgeGraphVisualizationProps {
  userId: string;
  className?: string;
  /** 初始聚焦的书签 ID */
  focusBookmarkId?: number;
  /** 最大节点数 */
  maxNodes?: number;
  /** 高度 */
  height?: number;
}

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

// ============================================================================
// Constants
// ============================================================================

const LINK_TYPE_COLORS: Record<LinkType, string> = {
  semantic: "#8b5cf6", // purple
  entity: "#3b82f6", // blue
  tag: "#22c55e", // green
  topic: "#f97316", // orange
};

const LINK_TYPE_ICONS: Record<LinkType, typeof Brain> = {
  semantic: Brain,
  entity: Users,
  tag: Tag,
  topic: Layers,
};

// ============================================================================
// Force Simulation Helpers
// ============================================================================

/**
 * 简单的力导向布局算法
 */
function runForceSimulation(
  nodes: LayoutNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  iterations: number = 100,
): LayoutNode[] {
  const alpha = 0.1;
  const repulsion = 1000;
  const attraction = 0.01;
  const centerForce = 0.01;

  // 初始化位置
  for (const node of nodes) {
    if (node.x === 0 && node.y === 0) {
      node.x = width / 2 + (Math.random() - 0.5) * width * 0.8;
      node.y = height / 2 + (Math.random() - 0.5) * height * 0.8;
    }
    node.vx = 0;
    node.vy = 0;
  }

  const nodeMap = new Map<number, LayoutNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // 迭代模拟
  for (let iter = 0; iter < iterations; iter++) {
    const decay = 1 - iter / iterations;

    // 排斥力（节点之间）
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = (repulsion * decay) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    // 吸引力（边连接的节点）
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // 边的强度影响吸引力
      const force = attraction * dist * edge.strength * decay;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // 中心引力
    for (const node of nodes) {
      node.vx += (width / 2 - node.x) * centerForce * decay;
      node.vy += (height / 2 - node.y) * centerForce * decay;
    }

    // 更新位置
    for (const node of nodes) {
      if (node.fx !== undefined) {
        node.x = node.fx;
        node.vx = 0;
      } else {
        node.x += node.vx * alpha;
        node.x = Math.max(40, Math.min(width - 40, node.x));
      }

      if (node.fy !== undefined) {
        node.y = node.fy;
        node.vy = 0;
      } else {
        node.y += node.vy * alpha;
        node.y = Math.max(40, Math.min(height - 40, node.y));
      }
    }
  }

  return nodes;
}

// ============================================================================
// Component
// ============================================================================

export function KnowledgeGraphVisualization({
  userId: _userId, // Reserved for future use (e.g., user-specific settings)
  className,
  focusBookmarkId,
  maxNodes = 100,
  height = 500,
}: KnowledgeGraphVisualizationProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [width, setWidth] = useState(800);

  // 加载图谱数据
  const loadGraphData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("maxNodes", String(maxNodes));
      params.set("minStrength", "0.3");

      const response = await fetch(
        `/api/knowledge-link/graph?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load graph data");
      }

      const data = await response.json();

      if (data.success && data.data) {
        setGraphData(data.data);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [maxNodes]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  // 响应容器宽度变化
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width || 800);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 计算布局后的节点
  const layoutNodes = useMemo(() => {
    if (!graphData || graphData.nodes.length === 0) return [];

    const nodes: LayoutNode[] = graphData.nodes.map((node) => ({
      ...node,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    }));

    // 如果有聚焦节点，将其固定在中心
    if (focusBookmarkId) {
      const focusNode = nodes.find((n) => n.id === focusBookmarkId);
      if (focusNode) {
        focusNode.fx = width / 2;
        focusNode.fy = height / 2;
      }
    }

    return runForceSimulation(nodes, graphData.edges, width, height);
  }, [graphData, width, height, focusBookmarkId]);

  // 计算节点大小（基于连接数）
  const getNodeRadius = useCallback((node: GraphNode): number => {
    const baseRadius = 8;
    const connectionBonus = Math.min(node.connectionCount * 2, 20);
    return baseRadius + connectionBonus;
  }, []);

  // 处理缩放
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  // 处理节点点击
  const handleNodeClick = (node: LayoutNode) => {
    if (selectedNode?.id === node.id) {
      // 双击导航到详情页
      router.push(`/bookmark/${node.id}`);
    } else {
      setSelectedNode(node);
    }
  };

  // 获取与选中节点相连的边
  const connectedEdges = useMemo(() => {
    if (!selectedNode || !graphData) return new Set<string>();

    const connected = new Set<string>();
    for (const edge of graphData.edges) {
      if (edge.source === selectedNode.id || edge.target === selectedNode.id) {
        connected.add(`${edge.source}-${edge.target}`);
      }
    }
    return connected;
  }, [selectedNode, graphData]);

  // 渲染加载状态
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-5 text-purple-500" />
            知识图谱
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center" style={{ height }}>
            <Skeleton className="w-full h-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-5 text-purple-500" />
            知识图谱
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{ height }}
          >
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={loadGraphData}>
              <RefreshCw className="size-4 mr-2" />
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 渲染空状态
  if (!graphData || graphData.nodes.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-5 text-purple-500" />
            知识图谱
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{ height }}
          >
            <Brain className="size-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">暂无知识关联数据</p>
            <p className="text-xs text-muted-foreground mt-1">
              收藏更多内容后将自动建立关联
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-5 text-purple-500" />
            知识图谱
            <Badge variant="secondary" className="ml-1">
              {graphData.nodes.length} 节点 · {graphData.edges.length} 关联
            </Badge>
          </CardTitle>

          {/* 工具栏 */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleZoomIn}>
                  <ZoomIn className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>放大</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleZoomOut}>
                  <ZoomOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>缩小</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleReset}>
                  <Maximize2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>重置视图</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={loadGraphData}>
                  <RefreshCw className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>刷新</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div
          ref={containerRef}
          className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-b-lg"
          style={{ height }}
        >
          {/* SVG 图谱 */}
          <svg
            width="100%"
            height="100%"
            viewBox={`${-pan.x / zoom} ${-pan.y / zoom} ${width / zoom} ${height / zoom}`}
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onMouseMove={(e) => {
              if (isDragging) {
                setPan((p) => ({
                  x: p.x + e.movementX,
                  y: p.y + e.movementY,
                }));
              }
            }}
          >
            <defs>
              {/* 边渐变定义 */}
              {Object.entries(LINK_TYPE_COLORS).map(([type, color]) => (
                <linearGradient
                  key={type}
                  id={`edge-gradient-${type}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="50%" stopColor={color} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.3} />
                </linearGradient>
              ))}
            </defs>

            {/* 渲染边 */}
            <g className="edges">
              {graphData.edges.map((edge, i) => {
                const source = layoutNodes.find((n) => n.id === edge.source);
                const target = layoutNodes.find((n) => n.id === edge.target);
                if (!source || !target) return null;

                const edgeKey = `${edge.source}-${edge.target}`;
                const isHighlighted =
                  !selectedNode || connectedEdges.has(edgeKey);
                const opacity = selectedNode
                  ? isHighlighted
                    ? 0.8
                    : 0.1
                  : 0.4;

                return (
                  <motion.line
                    key={`edge-${i}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={LINK_TYPE_COLORS[edge.type]}
                    strokeWidth={edge.strength * 3 + 1}
                    strokeOpacity={opacity}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: i * 0.01 }}
                  />
                );
              })}
            </g>

            {/* 渲染节点 */}
            <g className="nodes">
              {layoutNodes.map((node, i) => {
                const radius = getNodeRadius(node);
                const isSelected = selectedNode?.id === node.id;
                const isConnected =
                  !selectedNode ||
                  isSelected ||
                  connectedEdges.has(`${selectedNode.id}-${node.id}`) ||
                  connectedEdges.has(`${node.id}-${selectedNode.id}`);
                const opacity = selectedNode ? (isConnected ? 1 : 0.2) : 1;

                return (
                  <motion.g
                    key={`node-${node.id}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity }}
                    transition={{ duration: 0.3, delay: i * 0.02 }}
                    style={{ cursor: "pointer" }}
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    {/* 节点光晕 */}
                    {(isSelected || hoveredNode?.id === node.id) && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={radius + 8}
                        fill="none"
                        stroke={isSelected ? "#8b5cf6" : "#6b7280"}
                        strokeWidth={2}
                        strokeOpacity={0.5}
                      />
                    )}

                    {/* 节点圆形 */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={radius}
                      fill={isSelected ? "#8b5cf6" : "#3b82f6"}
                      stroke="#fff"
                      strokeWidth={2}
                      className="transition-colors"
                    />

                    {/* 节点标签（仅在 hover 或选中时显示） */}
                    {(isSelected ||
                      hoveredNode?.id === node.id ||
                      node.connectionCount > 5) && (
                      <text
                        x={node.x}
                        y={node.y + radius + 14}
                        textAnchor="middle"
                        fontSize={11}
                        fill="currentColor"
                        className="text-slate-700 dark:text-slate-300 pointer-events-none"
                      >
                        {node.title.length > 20
                          ? `${node.title.slice(0, 20)}...`
                          : node.title}
                      </text>
                    )}
                  </motion.g>
                );
              })}
            </g>
          </svg>

          {/* 图例 */}
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
            {Object.entries(LINK_TYPE_COLORS).map(([type, color]) => {
              const Icon = LINK_TYPE_ICONS[type as LinkType];
              const labels: Record<string, string> = {
                semantic: "语义相似",
                entity: "共享实体",
                tag: "共享标签",
                topic: "同主题",
              };

              return (
                <Badge
                  key={type}
                  variant="outline"
                  className="text-xs gap-1"
                  style={{
                    borderColor: color,
                    color: color,
                    backgroundColor: `${color}10`,
                  }}
                >
                  <Icon className="size-3" />
                  {labels[type]}
                </Badge>
              );
            })}
          </div>

          {/* 选中节点信息面板 */}
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 right-4 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg border p-3"
            >
              <h4 className="font-medium text-sm mb-2 line-clamp-2">
                {selectedNode.title}
              </h4>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>{selectedNode.connectionCount} 个关联</span>
                <span>·</span>
                <span>
                  平均强度 {Math.round(selectedNode.avgStrength * 100)}%
                </span>
              </div>

              {selectedNode.platform && (
                <Badge variant="secondary" className="text-xs mb-2">
                  {selectedNode.platform}
                </Badge>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => router.push(`/bookmark/${selectedNode.id}`)}
              >
                <ExternalLink className="size-3 mr-1" />
                查看详情
              </Button>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default KnowledgeGraphVisualization;
