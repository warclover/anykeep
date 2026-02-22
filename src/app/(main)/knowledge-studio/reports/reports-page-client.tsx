"use client";

/**
 * Knowledge Studio - 草稿列表页面客户端组件
 * @module app/(main)/knowledge-studio/reports
 * @description 显示用户生成的所有草稿列表
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  UNIFIED_BLUEPRINT_DISPLAY_CONFIG,
  getBlueprintDisplayConfig,
  getBlueprintsByCategory,
} from "@/lib/knowledge-studio/blueprint/unified-display-config";

interface Report {
  id: string;
  title: string | null;
  blueprint_type: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export function KnowledgeStudioReportsPageClient() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [blueprintFilter, setBlueprintFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"created_at" | "updated_at" | "title">(
    "created_at",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // 加载草稿列表
  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortOrder,
      });

      if (blueprintFilter !== "all") {
        params.append("blueprintType", blueprintFilter);
      }

      const response = await fetch(`/api/knowledge-studio/reports?${params}`);
      if (!response.ok) {
        throw new Error("加载失败");
      }

      const data = await response.json();
      setReports(data.data || []);
      setTotal(data.meta?.total || data.total || 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载草稿列表失败");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortBy, sortOrder, blueprintFilter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // 删除草稿
  const handleDelete = useCallback(
    async (reportId: string) => {
      if (!confirm("确定要删除这个草稿吗？此操作不可恢复。")) {
        return;
      }

      try {
        const response = await fetch(
          `/api/knowledge-studio/reports/${reportId}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          throw new Error("删除失败");
        }

        toast.success("草稿已删除");
        loadReports();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    },
    [loadReports],
  );

  // 过滤草稿
  const filteredReports = reports.filter((report) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        report.title?.toLowerCase().includes(query) ||
        report.id.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container mx-auto max-w-6xl py-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            我的草稿
          </h1>
          <p className="text-muted-foreground mt-1">
            查看和管理您生成的所有知识草稿
          </p>
        </div>
        <Button asChild>
          <Link href="/knowledge-studio">
            <Sparkles className="h-4 w-4 mr-2" />
            新建草稿
          </Link>
        </Button>
      </div>

      {/* 筛选和搜索 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* 搜索 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索草稿标题或 ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* 模板筛选 */}
            <Select
              value={blueprintFilter}
              onValueChange={(v) => setBlueprintFilter(v)}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部模板</SelectItem>
                {/* V1 模板 */}
                <SelectItem
                  value="__v1_header"
                  disabled
                  className="font-semibold text-xs uppercase text-muted-foreground"
                >
                  经典模板 (v1)
                </SelectItem>
                {Object.entries(UNIFIED_BLUEPRINT_DISPLAY_CONFIG)
                  .filter(([, config]) => config.version === "v1")
                  .map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      {config.icon} {config.name}
                    </SelectItem>
                  ))}
                {/* V2 蓝图 - 按分类分组 */}
                {Object.entries(getBlueprintsByCategory())
                  .filter(([category]) => category !== "v1")
                  .map(
                    ([category, blueprints]) =>
                      blueprints.length > 0 && (
                        <>
                          <SelectItem
                            key={`header-${category}`}
                            value={`__${category}_header`}
                            disabled
                            className="font-semibold text-xs uppercase text-muted-foreground"
                          >
                            {category === "geek" && "极客模板"}
                            {category === "creator" && "创作者模板"}
                            {category === "business" && "商业模板"}
                            {category === "professional" && "专业模板"}
                          </SelectItem>
                          {blueprints.map(({ id, config }) => (
                            <SelectItem key={id} value={id}>
                              {config.icon} {config.name}
                            </SelectItem>
                          ))}
                        </>
                      ),
                  )}
              </SelectContent>
            </Select>

            {/* 排序 */}
            <Select
              value={`${sortBy}-${sortOrder}`}
              onValueChange={(v) => {
                const [by, order] = v.split("-");
                setSortBy(by as typeof sortBy);
                setSortOrder(order as typeof sortOrder);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at-desc">最新创建</SelectItem>
                <SelectItem value="created_at-asc">最早创建</SelectItem>
                <SelectItem value="updated_at-desc">最近更新</SelectItem>
                <SelectItem value="updated_at-asc">最早更新</SelectItem>
                <SelectItem value="title-asc">标题 A-Z</SelectItem>
                <SelectItem value="title-desc">标题 Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 草稿列表 */}
      <div className="grid gap-4">
        {isLoading ? (
          // 加载骨架
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredReports.length === 0 ? (
          // 空状态
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery || blueprintFilter !== "all"
                  ? "没有找到匹配的草稿"
                  : "还没有生成任何草稿"}
              </p>
              {!searchQuery && blueprintFilter === "all" && (
                <Button asChild>
                  <Link href="/knowledge-studio">创建第一个草稿</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          // 草稿卡片
          filteredReports.map((report) => {
            const blueprintConfig = getBlueprintDisplayConfig(
              report.blueprint_type,
            );

            return (
              <Card
                key={report.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{blueprintConfig.icon}</span>
                        <h3 className="text-lg font-semibold line-clamp-1">
                          {report.title || "未命名草稿"}
                        </h3>
                        <Badge variant="outline">{blueprintConfig.name}</Badge>
                        {blueprintConfig.version === "v2" && (
                          <Badge variant="secondary" className="text-xs">
                            v2
                          </Badge>
                        )}
                        {report.version > 1 && (
                          <Badge variant="secondary">
                            修订 {report.version}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(report.created_at).toLocaleDateString(
                              "zh-CN",
                            )}
                          </span>
                        </div>
                        {report.updated_at !== report.created_at && (
                          <span>
                            更新于{" "}
                            {new Date(report.updated_at).toLocaleDateString(
                              "zh-CN",
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/synthesis/${report.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          查看
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/synthesis/${report.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              查看草稿
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/synthesis/${report.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              编辑草稿
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(report.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除草稿
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            共 {total} 个草稿，第 {page} / {totalPages} 页
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              下一页
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
