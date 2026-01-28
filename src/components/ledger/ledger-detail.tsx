"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  ArrowLeft,
  Calendar,
  ExternalLink,
  Clock,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/supabase";
import type { LedgerItem } from "@/lib/ledger/types/ledger.types";

type LedgerReport = Database["public"]["Tables"]["ledger_reports"]["Row"];

interface LedgerDetailProps {
  reportId: string;
}

export function LedgerDetail({ reportId }: LedgerDetailProps) {
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function fetchReport() {
      if (!reportId) return;

      try {
        const { data, error } = await supabase
          .from("ledger_reports")
          .select("*")
          .eq("id", parseInt(reportId))
          .single();

        if (error) {
          console.error("Error fetching report:", error);
          return;
        }

        setReport(data);
      } catch (err) {
        console.error("Failed to fetch report:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchReport();
  }, [reportId, supabase]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">未找到报告</p>
        <Button variant="link" onClick={() => router.back()}>
          返回列表
        </Button>
      </div>
    );
  }

  const items = (report.content as unknown as LedgerItem[]) || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings/ledger">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回列表
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="bg-muted/30 pb-6 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl mb-2">
                {report.report_type === "weekly"
                  ? "周度收藏账单"
                  : "月度收藏账单"}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                统计周期:{" "}
                {format(new Date(report.period_start), "yyyy年MM月dd日", {
                  locale: zhCN,
                })}{" "}
                -{" "}
                {format(new Date(report.period_end), "MM月dd日", {
                  locale: zhCN,
                })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="text-base px-3 py-1">
                共 {report.item_count} 条收藏
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {items.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                本周期内没有收藏记录
              </div>
            ) : (
              items.map((item, index) => (
                <div
                  key={index}
                  className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.time}
                      </span>
                      <span className="text-muted-foreground/30">|</span>
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {item.platform}
                      </span>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-medium hover:text-primary hover:underline line-clamp-1 block"
                    >
                      {item.title}
                    </a>
                  </div>
                  <div className="shrink-0">
                    {item.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="text-muted-foreground"
                      >
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          查看原文
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
