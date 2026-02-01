/**
 * 分类预览组件
 *
 * 显示分类结果列表，支持批量操作
 *
 * @module components/batch-classification/classification-preview
 * @version 1.0.0
 * @since 2026-02-01
 */

"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClusterCard } from "./cluster-card";
import {
  ConfirmationModeSwitcher,
  getSuggestedConfirmationMode,
} from "./confirmation-mode-switcher";
import { Check, X, Search, Filter } from "lucide-react";
import type {
  ClusterResult,
  UserDecision,
  ConfirmationMode,
} from "@/lib/classification/services/batch-classification";

// ============================================
// Props
// ============================================

interface ClassificationPreviewProps {
  clusters: ClusterResult[];
  onConfirm: (decisions: UserDecision[]) => void;
  onCancel: () => void;
  className?: string;
}

// ============================================
// 组件
// ============================================

export function ClassificationPreview({
  clusters,
  onConfirm,
  onCancel,
  className,
}: ClassificationPreviewProps) {
  const [decisions, setDecisions] = useState<Map<string, UserDecision>>(
    new Map(),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "conflict"
  >("all");
  const [confirmationMode, setConfirmationMode] =
    useState<ConfirmationMode>("list");

  // 计算统计
  const stats = useMemo(() => {
    const conflictCount = clusters.filter(
      (c) => c.conflictType !== "none",
    ).length;
    const pendingCount = clusters.filter((c) => c.status === "pending").length;
    const confirmedCount = decisions.size;

    return {
      conflictCount,
      pendingCount,
      confirmedCount,
      totalCount: clusters.length,
    };
  }, [clusters, decisions]);

  // 建议的确认模式
  const suggestedMode = useMemo(
    () => getSuggestedConfirmationMode(stats.conflictCount, stats.totalCount),
    [stats.conflictCount, stats.totalCount],
  );

  // 过滤簇
  const filteredClusters = useMemo(() => {
    return clusters.filter((cluster) => {
      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = cluster.suggestedName
          ?.toLowerCase()
          .includes(query);
        const matchesFolder = cluster.suggestedFolderName
          ?.toLowerCase()
          .includes(query);
        if (!matchesName && !matchesFolder) return false;
      }

      // 状态过滤
      if (filterStatus === "pending" && cluster.status !== "pending")
        return false;
      if (filterStatus === "conflict" && cluster.conflictType === "none")
        return false;

      return true;
    });
  }, [clusters, searchQuery, filterStatus]);

  // 处理单个决策
  const handleDecision = (
    clusterId: string,
    action: "accept" | "reject" | "modify",
    options?: { targetFolderId?: number; customName?: string },
  ) => {
    const newDecisions = new Map(decisions);
    newDecisions.set(clusterId, {
      clusterId,
      action,
      targetFolderId: options?.targetFolderId,
      customName: options?.customName,
    });
    setDecisions(newDecisions);
  };

  // 批量接受
  const handleBatchAccept = () => {
    const newDecisions = new Map(decisions);
    const idsToAccept =
      selectedIds.size > 0
        ? selectedIds
        : new Set(filteredClusters.map((c) => c.id));

    idsToAccept.forEach((id) => {
      if (!newDecisions.has(id)) {
        newDecisions.set(id, { clusterId: id, action: "accept" });
      }
    });

    setDecisions(newDecisions);
    setSelectedIds(new Set());
  };

  // 批量拒绝
  const handleBatchReject = () => {
    const newDecisions = new Map(decisions);
    const idsToReject =
      selectedIds.size > 0
        ? selectedIds
        : new Set(filteredClusters.map((c) => c.id));

    idsToReject.forEach((id) => {
      newDecisions.set(id, { clusterId: id, action: "reject" });
    });

    setDecisions(newDecisions);
    setSelectedIds(new Set());
  };

  // 确认提交
  const handleConfirm = () => {
    const allDecisions = Array.from(decisions.values());
    onConfirm(allDecisions);
  };

  // 选择切换
  const toggleSelection = (clusterId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(clusterId)) {
      newSelected.delete(clusterId);
    } else {
      newSelected.add(clusterId);
    }
    setSelectedIds(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredClusters.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClusters.map((c) => c.id)));
    }
  };

  return (
    <div className={className}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索分类..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          {/* 过滤 */}
          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
          >
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部 ({stats.totalCount})</SelectItem>
              <SelectItem value="pending">
                待确认 ({stats.pendingCount})
              </SelectItem>
              <SelectItem value="conflict">
                有冲突 ({stats.conflictCount})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* 确认模式切换 */}
          <ConfirmationModeSwitcher
            mode={confirmationMode}
            onModeChange={setConfirmationMode}
            conflictCount={stats.conflictCount}
            totalCount={stats.totalCount}
            suggestedMode={suggestedMode}
          />

          {/* 批量操作 */}
          {selectedIds.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleBatchReject}>
                <X className="h-4 w-4 mr-1" />
                拒绝选中 ({selectedIds.size})
              </Button>
              <Button size="sm" onClick={handleBatchAccept}>
                <Check className="h-4 w-4 mr-1" />
                接受选中 ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 统计摘要 */}
      <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
        <span>共 {stats.totalCount} 个分类</span>
        <span>·</span>
        <span className="text-green-600">{decisions.size} 个已决定</span>
        {stats.conflictCount > 0 && (
          <>
            <span>·</span>
            <span className="text-amber-600">{stats.conflictCount} 个冲突</span>
          </>
        )}
      </div>

      {/* 全选 */}
      <div className="flex items-center gap-2 mb-4">
        <Checkbox
          checked={
            selectedIds.size === filteredClusters.length &&
            filteredClusters.length > 0
          }
          onCheckedChange={toggleSelectAll}
        />
        <span className="text-sm text-muted-foreground">
          {selectedIds.size === filteredClusters.length ? "取消全选" : "全选"}
        </span>
      </div>

      {/* 簇列表 */}
      <div className="space-y-4">
        {filteredClusters.map((cluster) => {
          const decision = decisions.get(cluster.id);
          const displayCluster = decision
            ? {
                ...cluster,
                status:
                  decision.action === "reject"
                    ? "rejected"
                    : ("confirmed" as const),
              }
            : cluster;

          return (
            <div key={cluster.id} className="flex items-start gap-3">
              <Checkbox
                checked={selectedIds.has(cluster.id)}
                onCheckedChange={() => toggleSelection(cluster.id)}
                className="mt-4"
              />
              <div className="flex-1">
                <ClusterCard
                  cluster={displayCluster}
                  onAccept={(id) => handleDecision(id, "accept")}
                  onReject={(id) => handleDecision(id, "reject")}
                  onModify={(id) => handleDecision(id, "modify")}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex items-center justify-between">
        <Button variant="outline" onClick={onCancel}>
          暂不处理
        </Button>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            已决定 {decisions.size} / {stats.totalCount}
          </span>
          <Button variant="outline" onClick={handleBatchAccept}>
            全部接受
          </Button>
          <Button onClick={handleConfirm} disabled={decisions.size === 0}>
            确认 ({decisions.size})
          </Button>
        </div>
      </div>
    </div>
  );
}
