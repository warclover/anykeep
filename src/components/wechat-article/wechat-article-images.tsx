/**
 * 微信文章图片画廊组件
 *
 * @module wechat-article
 */

"use client";

import { useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future optimization
import Image from "next/image";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, ImageOff, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WechatArticleImage } from "@/lib/wechat-article/wechat-article.types";

// =============================================================================
// 类型定义
// =============================================================================

export interface WechatArticleImagesProps {
  /** 图片列表 */
  images: WechatArticleImage[];
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 组件实现
// =============================================================================

/**
 * 图片画廊组件
 */
export function WechatArticleImages({
  images,
  className,
}: WechatArticleImagesProps) {
  const [selectedImage, setSelectedImage] = useState<WechatArticleImage | null>(
    null,
  );
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  if (!images || images.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-8 text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-8 mr-2" />
        <span>暂无图片</span>
      </div>
    );
  }

  // 处理图片加载错误
  const handleImageError = (originalUrl: string) => {
    setImageErrors((prev) => new Set(prev).add(originalUrl));
  };

  // 获取显示 URL
  const getDisplayUrl = (image: WechatArticleImage): string => {
    return image.persistedUrl || image.originalUrl;
  };

  // 下载图片
  const handleDownload = async (image: WechatArticleImage) => {
    const url = getDisplayUrl(image);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Failed to download image:", error);
    }
  };

  return (
    <>
      {/* 图片网格 */}
      <div
        className={cn(
          "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3",
          className,
        )}
      >
        {images.map((image, index) => {
          const displayUrl = getDisplayUrl(image);
          const hasError = imageErrors.has(image.originalUrl);
          const isFailed = image.status === "failed" || hasError;
          const isFallback = image.status === "fallback";

          return (
            <div
              key={image.originalUrl}
              className={cn(
                "relative aspect-square rounded-lg overflow-hidden border cursor-pointer",
                "hover:ring-2 hover:ring-primary/50 transition-all",
                isFailed && "opacity-50",
              )}
              onClick={() => !isFailed && setSelectedImage(image)}
            >
              {/* 图片 */}
              {!isFailed ? (
                // eslint-disable-next-line @next/next/no-img-element -- External WeChat images with dynamic URLs
                <img
                  src={displayUrl}
                  alt={image.alt || `图片 ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => handleImageError(image.originalUrl)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <ImageOff className="size-8 text-muted-foreground" />
                </div>
              )}

              {/* 状态指示器 */}
              <div className="absolute top-2 right-2">
                {image.status === "success" && (
                  <span className="size-5 rounded-full bg-green-500/80 flex items-center justify-center">
                    <CheckCircle2 className="size-3 text-white" />
                  </span>
                )}
                {isFallback && (
                  <span
                    className="size-5 rounded-full bg-yellow-500/80 flex items-center justify-center"
                    title="使用代理"
                  >
                    <AlertCircle className="size-3 text-white" />
                  </span>
                )}
                {isFailed && (
                  <span
                    className="size-5 rounded-full bg-red-500/80 flex items-center justify-center"
                    title="加载失败"
                  >
                    <AlertCircle className="size-3 text-white" />
                  </span>
                )}
              </div>

              {/* 序号 */}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">
                {index + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* 图片预览对话框 */}
      <Dialog
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedImage?.alt || "图片预览"}</span>
              {selectedImage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(selectedImage)}
                >
                  <Download className="size-4 mr-1" />
                  下载
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="relative w-full overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element -- External WeChat images with dynamic URLs */}
              <img
                src={getDisplayUrl(selectedImage)}
                alt={selectedImage.alt || "图片预览"}
                className="max-w-full max-h-[70vh] mx-auto"
              />
              {selectedImage.fileSize && (
                <div className="mt-2 text-center text-sm text-muted-foreground">
                  {(selectedImage.fileSize / 1024).toFixed(1)} KB
                  {selectedImage.width && selectedImage.height && (
                    <span className="ml-2">
                      {selectedImage.width} × {selectedImage.height}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WechatArticleImages;
