"use client";

import { Loader2, Check, AlertCircle, Link, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { extractUrlFromShareText } from "@/lib/utils/url-extractor";
import type { FetchStatus } from "./hooks/use-metadata-fetch";

interface UrlInputSectionProps {
  url: string;
  setUrl: (url: string) => void;
  fetchStatus: FetchStatus;
  fetchError: string;
  handleRefetch: () => void;
  errors: Record<string, string>;
}

export function UrlInputSection({
  url,
  setUrl,
  fetchStatus,
  fetchError,
  handleRefetch,
  errors,
}: UrlInputSectionProps) {
  const renderUrlStatus = () => {
    switch (fetchStatus) {
      case "loading":
        return (
          <div className="flex items-center gap-1.5 text-xs text-blue-600">
            <Loader2 className="size-3 animate-spin" />
            <span>正在获取网页信息...</span>
          </div>
        );
      case "success":
        return (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <Check className="size-3" />
            <span>已自动填充网页信息</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs"
              onClick={handleRefetch}
            >
              <RefreshCw className="size-3 mr-1" />
              重新获取
            </Button>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertCircle className="size-3" />
            <span>{fetchError || "获取失败，请手动填写"}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs"
              onClick={handleRefetch}
            >
              <RefreshCw className="size-3 mr-1" />
              重试
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50 p-4 space-y-3 border border-violet-100/50">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 size-9 rounded-xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
          <Link className="size-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Label htmlFor="url" className="text-sm font-medium text-gray-800">
              粘贴链接
            </Label>
            <span className="text-red-500 text-xs">*</span>
            {renderUrlStatus()}
          </div>
          <p className="text-xs text-muted-foreground">
            输入链接后自动获取网页信息，支持微信公众号、B站、小红书、抖音等平台
          </p>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm" />
        <Input
          id="url"
          type="text"
          placeholder="粘贴链接或分享文本..."
          value={url}
          onChange={(e) => setUrl(extractUrlFromShareText(e.target.value))}
          required
          className={`relative bg-white border-gray-200 focus:border-transparent focus:ring-2 focus:ring-violet-500/50 transition-all ${errors.url ? "border-red-500" : ""} ${fetchStatus === "loading" ? "pr-8" : ""}`}
        />
        {fetchStatus === "loading" && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="size-4 animate-spin text-violet-500" />
          </div>
        )}
      </div>

      {errors.url && <p className="text-xs text-red-500">{errors.url}</p>}
    </div>
  );
}
