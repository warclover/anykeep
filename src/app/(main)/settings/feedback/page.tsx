"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useFeedback } from "@/components/feedback";
import { FeedbackService } from "@/lib/feedback/feedback.service";
import type { UserFeedback } from "@/types/user-feedback";
import { FEEDBACK_STATUS_MAP, FEEDBACK_TYPES } from "@/lib/constants/feedback";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  MessageSquarePlus,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";

export default function FeedbackListPage() {
  const { open } = useFeedback();
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter =
        activeTab === "pending"
          ? "pending"
          : activeTab === "resolved"
            ? "resolved"
            : undefined;

      const data = await FeedbackService.getList(1, 20, {
        status: statusFilter,
      });
      setFeedbacks(data);
    } catch {
      toast.error("获取反馈列表失败");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const getTypeInfo = (type: string) => {
    return FEEDBACK_TYPES.find((t) => t.value === type) || FEEDBACK_TYPES[2];
  };

  const getStatusInfo = (status: string) => {
    return (
      FEEDBACK_STATUS_MAP[status as keyof typeof FEEDBACK_STATUS_MAP] ||
      FEEDBACK_STATUS_MAP.pending
    );
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">我的反馈</h1>
          <p className="text-muted-foreground">查看历史反馈的处理进度和结果</p>
        </div>
        <Button onClick={() => open()}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          提交新反馈
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="pending">待处理</TabsTrigger>
          <TabsTrigger value="resolved">已解决</TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : feedbacks.length === 0 ? (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquarePlus className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                <h3 className="text-lg font-medium">暂无反馈记录</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  您还没有提交过任何反馈
                </p>
                <Button variant="outline" onClick={() => open()}>
                  提交第一条反馈
                </Button>
              </CardContent>
            </Card>
          ) : (
            feedbacks.map((item) => {
              const typeInfo = getTypeInfo(item.type);
              const statusInfo = getStatusInfo(item.status);

              return (
                <Link
                  key={item.id}
                  href={`/settings/feedback/${item.id}`}
                  className="block group"
                >
                  <Card className="transition-all hover:shadow-md hover:border-primary/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={typeInfo.color}>
                              <typeInfo.icon className="mr-1 h-3 w-3" />
                              {typeInfo.label}
                            </Badge>
                            <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                              {item.title}
                            </CardTitle>
                          </div>
                          <CardDescription className="line-clamp-2 text-sm mt-1">
                            {item.description}
                          </CardDescription>
                        </div>
                        <Badge
                          className={`${statusInfo.color} whitespace-nowrap ml-4 border-0`}
                        >
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Calendar className="mr-1 h-3 w-3" />
                        {format(
                          new Date(item.created_at),
                          "yyyy年MM月dd日 HH:mm",
                          {
                            locale: zhCN,
                          },
                        )}
                        <ChevronRight className="ml-auto h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </Tabs>
    </div>
  );
}
