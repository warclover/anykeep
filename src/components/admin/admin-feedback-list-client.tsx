"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import type { UserFeedback } from "@/types/user-feedback";
import {
  FEEDBACK_STATUS_MAP,
  FEEDBACK_TYPES,
  FEEDBACK_PRIORITY_MAP,
} from "@/lib/constants/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Filter, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";

interface AdminFeedbackListClientProps {
  initialFeedbacks: UserFeedback[];
}

export function AdminFeedbackListClient({
  initialFeedbacks,
}: AdminFeedbackListClientProps) {
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>(initialFeedbacks);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    type: "all",
    priority: "all",
  });

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", page_size: "50" });
      if (filters.status !== "all") params.append("status", filters.status);
      if (filters.type !== "all") params.append("type", filters.type);
      if (filters.priority !== "all")
        params.append("priority", filters.priority);

      const response = await fetch(`/api/admin/feedback?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setFeedbacks(result.data.feedbacks);
      } else {
        toast.error("获取列表失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // 跳过首次渲染（initialFeedbacks 已提供数据），filter 变化时自动重新获取
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">反馈管理</h1>
          <p className="text-muted-foreground">处理用户提交的问题和建议</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchFeedbacks}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* 筛选栏 */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">筛选:</span>
          </div>

          <Select
            value={filters.status}
            onValueChange={(val) => handleFilterChange("status", val)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有状态</SelectItem>
              {Object.entries(FEEDBACK_STATUS_MAP).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.type}
            onValueChange={(val) => handleFilterChange("type", val)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所���类型</SelectItem>
              {FEEDBACK_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.priority}
            onValueChange={(val) => handleFilterChange("priority", val)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="优先级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有优先级</SelectItem>
              {Object.entries(FEEDBACK_PRIORITY_MAP).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* 列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            没有找到相关反馈
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            {feedbacks.map((item) => {
              const typeInfo =
                FEEDBACK_TYPES.find((t) => t.value === item.type) ||
                FEEDBACK_TYPES[2];
              const statusInfo = FEEDBACK_STATUS_MAP[item.status];
              const priorityInfo = FEEDBACK_PRIORITY_MAP[item.priority];

              return (
                <Link key={item.id} href={`/admin/feedback/${item.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={typeInfo.color}>
                              {typeInfo.label}
                            </Badge>
                            <span className="font-semibold line-clamp-1">
                              {item.title}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
                          <span
                            className={`text-xs font-medium ${priorityInfo.color}`}
                          >
                            {priorityInfo.label}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>用户 ID: {item.user_id.slice(0, 8)}...</span>
                        <span>
                          {format(
                            new Date(item.created_at),
                            "yyyy-MM-dd HH:mm",
                            { locale: zhCN },
                          )}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
