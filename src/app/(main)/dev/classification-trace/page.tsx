"use client";

/**
 * V4.0 分类追踪调试面板
 *
 * 功能：
 * - 查看最近的分类追踪列表
 * - 输入 TraceID 查询详细决策路径
 * - 可视化展示匹配器得分分布
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, RefreshCw, Clock, Zap, Brain, Folder } from "lucide-react";
import type { DecisionPath, MatcherScoreDetail } from "@/lib/classification/types";

interface TraceListItem {
  traceId: string;
  timestamp: string;
  folderName: string;
  confidence: number;
}

export default function ClassificationTracePage() {
  const [traceId, setTraceId] = useState("");
  const [recentTraces, setRecentTraces] = useState<TraceListItem[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<DecisionPath | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载最近的追踪列表
  const loadRecentTraces = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/classification/trace?recent=50");
      const data = await res.json();
      if (data.success) {
        setRecentTraces(data.data || []);
      } else {
        setError(data.error || "加载失败");
      }
    } catch (err) {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  // 查询单个追踪
  const loadTrace = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/classification/trace?traceId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success) {
        setSelectedTrace(data.data);
      } else {
        setError(data.error || "未找到追踪");
        setSelectedTrace(null);
      }
    } catch (err) {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecentTraces();
  }, []);

  // 层级徽章
  const TierBadge = ({ tier }: { tier: 0 | 1 | 2 | 3 }) => {
    const variants: Record<number, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      1: { variant: "default", label: "Tier 1 快速" },
      2: { variant: "secondary", label: "Tier 2 AI" },
      3: { variant: "outline", label: "Tier 3 创建" },
      0: { variant: "destructive", label: "待整理" },
    };
    const { variant, label } = variants[tier] || variants[0];
    return <Badge variant={variant}>{label}</Badge>;
  };

  // 匹配器得分可视化
  const MatcherScoreBar = ({ score }: { score: MatcherScoreDetail }) => {
    const topScore = score.topCandidate?.score || 0;
    const barWidth = Math.min(topScore, 100);

    return (
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="font-medium">{score.matcherName}</span>
          <span className="text-muted-foreground">
            {score.available ? `${topScore.toFixed(1)}%` : "不可用"}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              score.available ? "bg-primary" : "bg-muted-foreground/30"
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        {score.topCandidate && (
          <div className="text-xs text-muted-foreground truncate">
            → {score.topCandidate.folderName}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          耗时: {score.durationMs}ms
        </div>
      </div>
    );
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">分类追踪调试台</h1>
          <p className="text-muted-foreground">V4.0 全链路追踪 - 开发者工具</p>
        </div>
        <Button variant="outline" onClick={loadRecentTraces} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {/* 搜索栏 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5" />
            追踪查询
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="输入 TraceID (如: clf_xxx_xxx)"
              value={traceId}
              onChange={(e) => setTraceId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadTrace(traceId)}
            />
            <Button onClick={() => loadTrace(traceId)} disabled={loading}>
              查询
            </Button>
          </div>
          {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        </CardContent>
      </Card>

      {/* 追踪详情 */}
      {selectedTrace && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5" />
              追踪详情
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 概览 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">TraceID</div>
                <div className="font-mono text-sm">{selectedTrace.traceId}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">决策层级</div>
                <TierBadge tier={selectedTrace.finalTier} />
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">AI 调用</div>
                <Badge variant={selectedTrace.aiCalled ? "secondary" : "outline"}>
                  {selectedTrace.aiCalled ? "是" : "否 (节省)"}
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">总耗时</div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {selectedTrace.tierTimings.totalMs}ms
                </div>
              </div>
            </div>

            <Separator />

            {/* 最终结果 */}
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Folder className="w-4 h-4" />
                最终结果
              </h3>
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{selectedTrace.finalResult.folderName}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedTrace.decisionReason.primary}
                    </div>
                    {selectedTrace.decisionReason.secondary && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {selectedTrace.decisionReason.secondary}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {selectedTrace.finalResult.confidence}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedTrace.decisionReason.confidenceExplanation}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* 匹配器得分 */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Brain className="w-4 h-4" />
                匹配器得分详情
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedTrace.matcherScores.map((score, i) => (
                  <Card key={i} className="p-4">
                    <MatcherScoreBar score={score} />
                    {score.candidates.length > 1 && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="text-xs text-muted-foreground mb-1">
                          其他候选:
                        </div>
                        {score.candidates.slice(1, 3).map((c, j) => (
                          <div key={j} className="text-xs text-muted-foreground">
                            {c.folderName}: {c.score.toFixed(1)}%
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            {/* 层级耗时 */}
            <div className="flex gap-4 text-sm text-muted-foreground">
              {selectedTrace.tierTimings.tier1Ms && (
                <span>Tier 1: {selectedTrace.tierTimings.tier1Ms}ms</span>
              )}
              {selectedTrace.tierTimings.tier2Ms && (
                <span>Tier 2: {selectedTrace.tierTimings.tier2Ms}ms</span>
              )}
              {selectedTrace.tierTimings.tier3Ms && (
                <span>Tier 3: {selectedTrace.tierTimings.tier3Ms}ms</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 最近追踪列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            最近追踪 ({recentTraces.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTraces.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无追踪记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>TraceID</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>分类结果</TableHead>
                  <TableHead>置信度</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTraces.map((trace) => (
                  <TableRow key={trace.traceId}>
                    <TableCell className="font-mono text-sm">
                      {trace.traceId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(trace.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>{trace.folderName}</TableCell>
                    <TableCell>{trace.confidence}%</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTraceId(trace.traceId);
                          loadTrace(trace.traceId);
                        }}
                      >
                        查看
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
