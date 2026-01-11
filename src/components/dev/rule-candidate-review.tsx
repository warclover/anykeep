/**
 * 候选规则审核组件
 *
 * 用于在开发者工具中审核 RuleMiner 生成的候选规则
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Clock,
  GitMerge,
  RefreshCw,
  Eye,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

type CandidateStatus = "pending_review" | "approved" | "rejected" | "merged";

interface CandidateRule {
  id: number;
  type: string;
  subtype: string | null;
  pattern: string;
  weight: number;
  sample_inputs: string[];
  discovery_confidence: number;
  discovery_method: string;
  status: CandidateStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface CandidateListResponse {
  candidates: CandidateRule[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================
// 常量
// ============================================

const STATUS_CONFIG: Record<
  CandidateStatus,
  {
    label: string;
    icon: React.ReactNode;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending_review: {
    label: "待审核",
    icon: <Clock className="h-3 w-3" />,
    variant: "outline",
  },
  approved: {
    label: "已批准",
    icon: <CheckCircle2 className="h-3 w-3" />,
    variant: "default",
  },
  rejected: {
    label: "已拒绝",
    icon: <XCircle className="h-3 w-3" />,
    variant: "destructive",
  },
  merged: {
    label: "已合并",
    icon: <GitMerge className="h-3 w-3" />,
    variant: "secondary",
  },
};

// ============================================
// 组件
// ============================================

export function RuleCandidateReview() {
  const [candidates, setCandidates] = useState<CandidateRule[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | "all">(
    "pending_review",
  );
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateRule | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // 加载候选规则
  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      params.set("limit", "50");

      const res = await fetch(`/api/dev/rule-candidates?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch candidates");
      }

      const data: CandidateListResponse = await res.json();
      setCandidates(data.candidates);
      setTotal(data.total);
    } catch (err) {
      toast.error("加载失败", {
        description: err instanceof Error ? err.message : "未知错误",
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // 更新状态
  const updateStatus = async (id: number, status: CandidateStatus) => {
    try {
      const res = await fetch("/api/dev/rule-candidates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      toast.success("状态已更新", {
        description: `规则已标记为「${STATUS_CONFIG[status].label}」`,
      });

      // 刷新列表
      loadCandidates();
      setDetailDialogOpen(false);
    } catch (err) {
      toast.error("更新失败", {
        description: err instanceof Error ? err.message : "未知错误",
      });
    }
  };

  // 删除候选规则
  const deleteCandidate = async (id: number) => {
    try {
      const res = await fetch(`/api/dev/rule-candidates?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete candidate");
      }

      toast.success("已删除", {
        description: "候选规则已被删除",
      });

      // 刷新列表
      loadCandidates();
      setDeleteDialogOpen(false);
      setSelectedCandidate(null);
    } catch (err) {
      toast.error("删除失败", {
        description: err instanceof Error ? err.message : "未知错误",
      });
    }
  };

  // 测试正则表达式
  const testPattern = (pattern: string, samples: string[]): boolean[] => {
    try {
      const regex = new RegExp(pattern, "i");
      return samples.map((s) => regex.test(s));
    } catch {
      return samples.map(() => false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as CandidateStatus | "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="筛选状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pending_review">待审核</SelectItem>
              <SelectItem value="approved">已批准</SelectItem>
              <SelectItem value="rejected">已拒绝</SelectItem>
              <SelectItem value="merged">已合并</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            共 {total} 条规则
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={loadCandidates}>
          <RefreshCw
            className={cn("h-4 w-4 mr-1", loading && "animate-spin")}
          />
          刷新
        </Button>
      </div>

      {/* 规则列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">候选规则</CardTitle>
          <CardDescription>
            由 RuleMiner 从 LLM 兜底案例中自动挖掘的候选规则
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              加载中...
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无候选规则
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">意图类型</TableHead>
                  <TableHead>正则模式</TableHead>
                  <TableHead className="w-[80px]">权重</TableHead>
                  <TableHead className="w-[80px]">置信度</TableHead>
                  <TableHead className="w-[100px]">状态</TableHead>
                  <TableHead className="w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => {
                  const statusConfig = STATUS_CONFIG[candidate.status];
                  return (
                    <TableRow key={candidate.id}>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {candidate.type}
                        </div>
                        {candidate.subtype && (
                          <div className="text-xs text-muted-foreground">
                            {candidate.subtype}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">
                          {candidate.pattern.length > 60
                            ? `${candidate.pattern.slice(0, 60)}...`
                            : candidate.pattern}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{candidate.weight}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {(candidate.discovery_confidence * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="gap-1">
                          {statusConfig.icon}
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setSelectedCandidate(candidate);
                              setDetailDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {candidate.status === "pending_review" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() =>
                                  updateStatus(candidate.id, "approved")
                                }
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() =>
                                  updateStatus(candidate.id, "rejected")
                                }
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>候选规则详情</DialogTitle>
            <DialogDescription>查看规则详情并进行审核操作</DialogDescription>
          </DialogHeader>
          {selectedCandidate && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">意图类型</label>
                  <div className="mt-1">
                    <Badge variant="outline" className="text-sm">
                      {selectedCandidate.type}
                      {selectedCandidate.subtype &&
                        `:${selectedCandidate.subtype}`}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">发现方法</label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedCandidate.discovery_method}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">初始权重</label>
                  <div className="mt-1 text-sm">{selectedCandidate.weight}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">发现置信度</label>
                  <div className="mt-1 text-sm">
                    {(selectedCandidate.discovery_confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* 正则模式 */}
              <div>
                <label className="text-sm font-medium">正则表达式</label>
                <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                  {selectedCandidate.pattern}
                </pre>
              </div>

              {/* 示例消息及匹配测试 */}
              <div>
                <label className="text-sm font-medium">示例消息</label>
                <div className="mt-1 space-y-1">
                  {selectedCandidate.sample_inputs?.map((sample, i) => {
                    const matches = testPattern(selectedCandidate.pattern, [
                      sample,
                    ])[0];
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded text-sm",
                          matches
                            ? "bg-green-50 dark:bg-green-950"
                            : "bg-red-50 dark:bg-red-950",
                        )}
                      >
                        {matches ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                        )}
                        <span className="break-all">{sample}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 时间信息 */}
              <div className="text-xs text-muted-foreground">
                创建于 {new Date(selectedCandidate.created_at).toLocaleString()}
                {selectedCandidate.reviewed_at && (
                  <>
                    {" · "}
                    审核于{" "}
                    {new Date(selectedCandidate.reviewed_at).toLocaleString()}
                    {selectedCandidate.reviewed_by &&
                      ` by ${selectedCandidate.reviewed_by}`}
                  </>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => {
                setDetailDialogOpen(false);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除
            </Button>
            <div className="flex-1" />
            {selectedCandidate?.status === "pending_review" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => updateStatus(selectedCandidate.id, "rejected")}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  拒绝
                </Button>
                <Button
                  onClick={() => updateStatus(selectedCandidate.id, "approved")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  批准
                </Button>
              </>
            )}
            {selectedCandidate?.status === "approved" && (
              <Button
                onClick={() => updateStatus(selectedCandidate.id, "merged")}
              >
                <GitMerge className="h-4 w-4 mr-1" />
                合并到规则库
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              删除后无法恢复，确定要删除这条候选规则吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedCandidate && deleteCandidate(selectedCandidate.id)
              }
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
