"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FeedbackService } from "@/lib/feedback/feedback.service";
import type { UserFeedback } from "@/types/user-feedback";
import { FEEDBACK_STATUS_MAP, FEEDBACK_TYPES } from "@/lib/constants/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Trash2,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function FeedbackDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<UserFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadFeedback = useCallback(async () => {
    try {
      const data = await FeedbackService.getDetail(params.id);
      setFeedback(data);
    } catch {
      toast.error("加载反馈详情失败");
      router.push("/settings/feedback");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleDelete = async () => {
    if (!feedback) return;
    try {
      await FeedbackService.delete(feedback.id);
      toast.success("反馈已撤销");
      router.push("/settings/feedback");
    } catch {
      toast.error("删除失败");
    }
  };

  const handleAddComment = async () => {
    if (!feedback || !comment.trim()) return;
    setSubmitting(true);
    try {
      const updated = await FeedbackService.update(feedback.id, {
        additional_comment: comment,
      });
      setFeedback(updated);
      setComment("");
      toast.success("补充信息已提交");
    } catch {
      toast.error("提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!feedback) return null;

  const typeInfo =
    FEEDBACK_TYPES.find((t) => t.value === feedback.type) || FEEDBACK_TYPES[2];
  const statusInfo = FEEDBACK_STATUS_MAP[feedback.status];

  const context = (feedback.context as Record<string, unknown>) || {};
  const comments = (
    Array.isArray(context.comments) ? context.comments : []
  ) as Array<{
    role: string;
    created_at: string;
    content: string;
  }>;

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      {/* 头部导航 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">反馈详情</h1>
          <p className="text-sm text-muted-foreground">
            ID: {feedback.id.slice(0, 8)}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {feedback.status === "pending" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  撤销反馈
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确定要撤销这条反馈吗？</AlertDialogTitle>
                  <AlertDialogDescription>
                    撤销后，管理员将不再处理此反馈。此操作无法撤销。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    确认撤销
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* 状态卡片 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${typeInfo.color} px-2 py-1`}
              >
                <typeInfo.icon className="mr-1 h-3 w-3" />
                {typeInfo.label}
              </Badge>
              {feedback.category && (
                <Badge variant="secondary">{feedback.category}</Badge>
              )}
            </div>
            <Badge className={`${statusInfo.color} border-0 px-3 py-1 text-sm`}>
              {statusInfo.label}
            </Badge>
          </div>
          <CardTitle className="mt-4 text-xl">{feedback.title}</CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span className="flex items-center">
              <Clock className="mr-1 h-3 w-3" />
              {format(new Date(feedback.created_at), "yyyy-MM-dd HH:mm")}
            </span>
            {feedback.is_anonymous && (
              <span className="flex items-center">
                <AlertCircle className="mr-1 h-3 w-3" />
                匿名提交
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 描述内容 */}
          <div className="prose prose-sm max-w-none text-foreground">
            <p className="whitespace-pre-wrap">{feedback.description}</p>
          </div>

          {/* 附件展示 */}
          {feedback.attachments && feedback.attachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                附件
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {feedback.attachments.map((url, index) => (
                  <div
                    key={index}
                    className="relative aspect-video rounded-md border overflow-hidden bg-muted"
                  >
                    <Image
                      src={url}
                      alt={`附件 ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 管理员回复 (如果有) */}
          {(feedback.resolution || feedback.admin_notes) && (
            <div className="rounded-lg bg-muted/50 p-4 border-l-4 border-primary">
              <h4 className="flex items-center gap-2 font-medium mb-2 text-primary">
                <CheckCircle2 className="h-4 w-4" />
                管理员回复
              </h4>
              <div className="text-sm space-y-2">
                {feedback.resolution && (
                  <p className="whitespace-pre-wrap">{feedback.resolution}</p>
                )}
                {/* admin_notes 通常是内部的，但如果我们在 API 返回了，可能也显示给用户看？
                    根据之前 API 实现，这里只返回了 *，所以 admin_notes 也会返回。
                    通常 admin_notes 是内部备注，resolution 是对用户回复。
                    这里仅展示 resolution。
                */}
                {feedback.resolved_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    处理时间：
                    {format(new Date(feedback.resolved_at), "yyyy-MM-dd HH:mm")}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 补充信息/对话历史 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          沟通记录
        </h3>

        {/* 历史记录列表 */}
        <div className="space-y-4">
          {comments.map((comment, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex-1 bg-card border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm">
                    {comment.role === "admin" ? "管理员" : "我"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(comment.created_at), "MM-dd HH:mm")}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 补充输入框 */}
        {["pending", "reviewing", "in_progress"].includes(feedback.status) && (
          <div className="flex gap-4 mt-6">
            <div className="flex-1">
              <Textarea
                placeholder="有新的情况？可以在这里补充..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-end mt-2">
                <Button
                  onClick={handleAddComment}
                  disabled={submitting || !comment.trim()}
                  size="sm"
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  发送
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
