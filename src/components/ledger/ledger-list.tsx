"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Calendar, ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/supabase";

type LedgerReport = Database["public"]["Tables"]["ledger_reports"]["Row"];

export function LedgerList() {
  const [reports, setReports] = useState<LedgerReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchReports() {
      try {
        const { data, error } = await supabase
          .from("ledger_reports")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching ledger reports:", error);
          return;
        }

        setReports(data || []);
      } catch (err) {
        console.error("Failed to fetch reports:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchReports();
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="mx-auto h-12 w-12 opacity-50 mb-4" />
        <p>暂无账单报告</p>
        <p className="text-sm mt-2">每周一和每月1号会自动生成</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <Link href={`/settings/ledger/${report.id}`} key={report.id}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-l-4 border-l-primary/20 hover:border-l-primary">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">
                      {report.report_type === "weekly"
                        ? "周度收藏账单"
                        : "月度收藏账单"}
                    </h3>
                    <Badge variant="outline" className="text-xs font-normal">
                      {format(new Date(report.created_at), "yyyy-MM-dd", {
                        locale: zhCN,
                      })}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    统计周期: {format(new Date(report.period_start), "MM.dd")} -{" "}
                    {format(new Date(report.period_end), "MM.dd")}
                    <span className="mx-2">·</span>共 {report.item_count} 条收藏
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
