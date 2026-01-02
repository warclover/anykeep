"use client";

/**
 * Knowledge Studio - 账单页面客户端组件
 * @description P4 实现 - 账单与用量统计真实数据
 */

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  Calendar,
  Coins,
  FileText,
  Download,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// 类型定义
// ============================================================================

interface UsageStats {
  usageByType?: {
    generation?: number;
    chat_edit?: number;
    ai_recommendation?: number;
    export?: number;
    storage?: number;
  };
  totalUsage?: number;
  quotaLimit?: number;
  usageRate?: number;
  periodStart?: string;
  periodEnd?: string;
}

interface BillLineItem {
  id: string;
  description: string;
  usage_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Bill {
  id: string;
  period_start: string;
  period_end: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  created_at: string;
  due_at: string;
  paid_at?: string;
  ks_bill_line_items?: BillLineItem[];
}

// ============================================================================
// 辅助函数
// ============================================================================

function formatCurrency(cents: number, currency = "CNY"): string {
  const yuan = cents / 100;
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
  }).format(yuan);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusBadge(status: string) {
  const statusMap: Record<
    string,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
    }
  > = {
    pending: { label: "待支付", variant: "outline" },
    paid: { label: "已支付", variant: "default" },
    overdue: { label: "已逾期", variant: "destructive" },
    cancelled: { label: "已取消", variant: "secondary" },
    refunded: { label: "已退款", variant: "secondary" },
  };
  const config = statusMap[status] || {
    label: status,
    variant: "outline" as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ============================================================================
// 使用统计卡片
// ============================================================================

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "stable";
  loading?: boolean;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  loading,
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-4 w-32" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold flex items-center gap-2">
              {value}
              {trend === "up" && (
                <TrendingUp className="h-4 w-4 text-green-500" />
              )}
              {trend === "down" && (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 账单列表组件
// ============================================================================

interface BillsListProps {
  bills: Bill[];
  loading: boolean;
  error?: string;
}

function BillsList({ bills, loading, error }: BillsListProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border rounded-lg"
          >
            <Skeleton className="h-10 w-10 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium">加载失败</h3>
        <p className="text-muted-foreground mt-2">{error}</p>
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">暂无账单</h3>
        <p className="text-muted-foreground mt-2">
          开始使用 Knowledge Studio 后将在这里显示账单
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>账单周期</TableHead>
          <TableHead>项目数</TableHead>
          <TableHead>金额</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>创建时间</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bills.map((bill) => (
          <TableRow key={bill.id}>
            <TableCell>
              <div className="font-medium">
                {formatDate(bill.period_start)} - {formatDate(bill.period_end)}
              </div>
            </TableCell>
            <TableCell>{bill.ks_bill_line_items?.length || 0} 项</TableCell>
            <TableCell className="font-medium">
              {formatCurrency(bill.total, bill.currency)}
            </TableCell>
            <TableCell>{getStatusBadge(bill.status)}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(bill.created_at)}
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm">
                <FileText className="h-4 w-4 mr-1" />
                详情
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================================================
// 主页面组件
// ============================================================================

export function BillingPageClient() {
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"monthly" | "weekly" | "daily">(
    "monthly",
  );

  // 获取使用统计
  const fetchUsageStats = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/knowledge-studio/billing/usage?period=${period}`,
      );
      const json = await res.json();
      if (res.ok) {
        setUsageStats(json.data || {});
      } else {
        // 如果 RPC 不存在，使用空数据
        setUsageStats({});
      }
    } catch {
      setUsageStats({});
    }
  }, [period]);

  // 获取账单列表
  const fetchBills = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge-studio/billing/bills?limit=10");
      const json = await res.json();
      if (res.ok) {
        setBills(json.data || []);
      } else {
        // 如果表不存在，使用空数组
        setBills([]);
      }
    } catch {
      setBills([]);
    }
  }, []);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchUsageStats(), fetchBills()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载数据失败");
    } finally {
      setLoading(false);
    }
  }, [fetchUsageStats, fetchBills]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 计算预估费用
  const estimatedCost = usageStats?.usageByType
    ? (usageStats.usageByType.generation || 0) * 0.1 +
      (usageStats.usageByType.chat_edit || 0) * 0.05 +
      (usageStats.usageByType.export || 0) * 0.02
    : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">账单与用量</h1>
          <p className="text-muted-foreground">
            查看 Knowledge Studio 使用量统计和账单明细
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw
            className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
          />
          刷新
        </Button>
      </div>

      {/* 周期选择 */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
        <TabsList>
          <TabsTrigger value="daily">今日</TabsTrigger>
          <TabsTrigger value="weekly">本周</TabsTrigger>
          <TabsTrigger value="monthly">本月</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="space-y-6">
          {/* 使用量概览 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="蓝图生成"
              value={usageStats?.usageByType?.generation ?? 0}
              subtitle="次"
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
              loading={loading}
            />
            <StatCard
              title="AI 对话编辑"
              value={usageStats?.usageByType?.chat_edit ?? 0}
              subtitle="次"
              icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
              loading={loading}
            />
            <StatCard
              title="导出次数"
              value={usageStats?.usageByType?.export ?? 0}
              subtitle="次"
              icon={<Download className="h-4 w-4 text-muted-foreground" />}
              loading={loading}
            />
            <StatCard
              title="预估费用"
              value={formatCurrency(Math.round(estimatedCost * 100))}
              subtitle={`配额使用 ${(usageStats?.usageRate ?? 0).toFixed(1)}%`}
              icon={<Coins className="h-4 w-4 text-muted-foreground" />}
              loading={loading}
            />
          </div>

          {/* 配额进度条 */}
          {usageStats?.quotaLimit && usageStats.quotaLimit > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  配额使用情况
                </CardTitle>
                <CardDescription>
                  本
                  {period === "daily"
                    ? "日"
                    : period === "weekly"
                      ? "周"
                      : "月"}
                  已使用 {usageStats.totalUsage ?? 0} / {usageStats.quotaLimit}{" "}
                  次
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      (usageStats.usageRate ?? 0) > 80
                        ? "bg-destructive"
                        : "bg-primary",
                    )}
                    style={{
                      width: `${Math.min(usageStats.usageRate ?? 0, 100)}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* 账单列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>账单明细</CardTitle>
            <CardDescription>查看历史账单和消费详情</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出账单
          </Button>
        </CardHeader>
        <CardContent>
          <BillsList
            bills={bills}
            loading={loading}
            error={error ?? undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
