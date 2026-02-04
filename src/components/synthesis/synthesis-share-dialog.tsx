/**
 * 综述分享对话框组件
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import { useState, useCallback } from "react";
import {
  Share2,
  Copy,
  Check,
  MessageSquare,
  Twitter,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SynthesisReport } from "@/lib/synthesis";
import { clientLogger } from "@/lib/client-logger";

interface SynthesisShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: SynthesisReport;
}

export function SynthesisShareDialog({
  open,
  onOpenChange,
  report,
}: SynthesisShareDialogProps) {
  const [copied, setCopied] = useState<"link" | "text" | null>(null);

  // 生成分享链接（当前页面 URL）
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/synthesis/${report.id}`
      : "";

  // 生成分享文本
  const shareText = `【${report.title}】\n\n${report.overview?.slice(0, 200)}${(report.overview?.length || 0) > 200 ? "..." : ""}\n\n📊 共识：${report.consensusCount} | ⚡ 分歧：${report.divergenceCount} | 💡 盲区：${report.blindSpotCount}`;

  // 复制链接
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied("link");
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      clientLogger.error({ error }, "Copy failed:");
    }
  }, [shareUrl]);

  // 复制文本
  const handleCopyText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied("text");
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      clientLogger.error({ error }, "Copy failed:");
    }
  }, [shareText]);

  // 分享到 Twitter
  const handleShareTwitter = useCallback(() => {
    const text = encodeURIComponent(`${report.title}\n\n${shareUrl}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  }, [report.title, shareUrl]);

  // 分享到微信（显示二维码提示）
  const handleShareWeChat = useCallback(() => {
    // 复制链接后提示用户
    navigator.clipboard.writeText(shareUrl);
    setCopied("link");
    setTimeout(() => setCopied(null), 2000);
  }, [shareUrl]);

  // 发送邮件
  const handleShareEmail = useCallback(() => {
    const subject = encodeURIComponent(`分享：${report.title}`);
    const body = encodeURIComponent(`${shareText}\n\n查看详情：${shareUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }, [report.title, shareText, shareUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            分享综述
          </DialogTitle>
          <DialogDescription>复制链接或分享到社交平台</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 链接复制 */}
          <div className="space-y-2">
            <Label>分享链接</Label>
            <div className="flex gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className="flex-shrink-0"
              >
                {copied === "link" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* 分享文本 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>分享文本</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyText}
                className="h-7"
              >
                {copied === "text" ? (
                  <>
                    <Check className="h-3 w-3 mr-1 text-green-500" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    复制
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={shareText}
              readOnly
              className="resize-none text-sm"
              rows={5}
            />
          </div>

          {/* 社交分享按钮 */}
          <div className="space-y-2">
            <Label>分享到</Label>
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="flex flex-col items-center gap-1 h-auto py-3"
                onClick={handleShareWeChat}
              >
                <MessageSquare className="h-5 w-5 text-green-500" />
                <span className="text-xs">微信</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-1 h-auto py-3"
                onClick={handleShareTwitter}
              >
                <Twitter className="h-5 w-5 text-blue-400" />
                <span className="text-xs">Twitter</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-1 h-auto py-3"
                onClick={handleShareEmail}
              >
                <Mail className="h-5 w-5 text-gray-500" />
                <span className="text-xs">邮件</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
