"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { UserFeedback } from "@/types/user-feedback";
import {
  FEEDBACK_STATUS_MAP,
  FEEDBACK_TYPES,
  FEEDBACK_PRIORITY_MAP,
} from "@/lib/constants/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Save, User, Smartphone } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface FeedbackProfile {
  nickname?: string;
  [key: string]: unknown;
}

interface FeedbackWithProfile extends UserFeedback {
  profiles?: FeedbackProfile;
}

export default function AdminFeedbackDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [resolution, setResolution] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const loadFeedback = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/feedback/${params.id}`);
      const result = await response.json();
      if (result.success) {
        const data = result.data;
        setFeedback(data);
        setStatus(data.status);
        setPriority(data.priority);
        setResolution(data.resolution || "");
        setAdminNotes(data.admin_notes || "");
      } else {
        toast.error("加载失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/feedback/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          priority,
          resolution,
          admin_notes: adminNotes,
        }),
      });
      const result = await response.json();

      if (result.success) {
        toast.success("保存成功");
        setFeedback(result.data);
      } else {
        toast.error("保存失败: " + result.error);
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!feedback) return <div>未找到反馈</div>;

  const typeInfo =
    FEEDBACK_TYPES.find((t) => t.value === feedback.type) || FEEDBACK_TYPES[2];
  const context = feedback.context as Record<string, unknown>;
  const comments = (
    Array.isArray(context?.comments) ? context.comments : []
  ) as { content: string; created_at: string }[];

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">
          工单详情 #{feedback.id.slice(0, 8)}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：反馈内容 */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={typeInfo.color}>
                    {typeInfo.label}
                  </Badge>
                  {feedback.category && (
                    <Badge variant="secondary">{feedback.category}</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  提交于{" "}
                  {format(new Date(feedback.created_at), "yyyy-MM-dd HH:mm")}
                </div>
              </div>
              <CardTitle className="mt-2 text-xl">{feedback.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose prose-sm max-w-none bg-muted/30 p-4 rounded-md">
                <p className="whitespace-pre-wrap">{feedback.description}</p>
              </div>

              {/* 附件 */}
              {feedback.attachments && feedback.attachments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">附件</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {feedback.attachments.map((url, i) => (
                      <div
                        key={i}
                        className="relative aspect-video bg-muted rounded border overflow-hidden"
                      >
                        <Image
                          src={url}
                          alt="attachment"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 上下文信息 */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  设备环境
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {(context.app_version as string) && (
                    <>
                      <span className="text-muted-foreground">App版本:</span>
                      <span>{context.app_version as string}</span>
                    </>
                  )}
                  {(context.page_path as string) && (
                    <>
                      <span className="text-muted-foreground">页面路径:</span>
                      <span>{context.page_path as string}</span>
                    </>
                  )}
                  {(context.screen_size as string) && (
                    <>
                      <span className="text-muted-foreground">屏幕尺寸:</span>
                      <span>{context.screen_size as string}</span>
                    </>
                  )}
                  {(context.user_agent as string) && (
                    <div className="col-span-2 text-xs text-muted-foreground break-all bg-muted p-2 rounded">
                      {context.user_agent as string}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 沟通记录 (只读) */}
          {comments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">用户补充记录</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {comments.map((c, i) => (
                  <div key={i} className="bg-muted/50 p-3 rounded text-sm">
                    <div className="flex justify-between mb-1 text-xs text-muted-foreground">
                      <span>用户</span>
                      <span>
                        {format(new Date(c.created_at), "MM-dd HH:mm")}
                      </span>
                    </div>
                    <p>{c.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：处理面板 */}
        <div className="space-y-6">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-muted/20 pb-4">
              <CardTitle className="text-lg">处理工单</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* 状态变更 */}
              <div className="space-y-2">
                <Label>当前状态</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FEEDBACK_STATUS_MAP).map(([key, conf]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${conf.color.includes("bg-") ? conf.color.split(" ")[0] : "bg-gray-400"}`}
                          />
                          {conf.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 优先级 */}
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FEEDBACK_PRIORITY_MAP).map(
                      ([key, conf]) => (
                        <SelectItem
                          key={key}
                          value={key}
                          className={conf.color}
                        >
                          {conf.label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* 回复用户 */}
              <div className="space-y-2">
                <Label className="text-primary">回复用户 (Resolution)</Label>
                <Textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="请输入解决方案或回复内容，用户将在详情页看到此消息..."
                  className="min-h-[120px]"
                />
              </div>

              {/* 内部备注 */}
              <div className="space-y-2">
                <Label>内部备注 (Admin Notes)</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="仅管理员可见..."
                  className="min-h-[80px] bg-muted/50"
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                保存更改
              </Button>
            </CardContent>
          </Card>

          {/* 用户信息摘要 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                用��信息
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono text-xs">{feedback.user_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">匿名:</span>
                <span>{feedback.is_anonymous ? "是" : "否"}</span>
              </div>
              {feedback.profiles && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">昵称:</span>
                  <span>{feedback.profiles.nickname || "-"}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
