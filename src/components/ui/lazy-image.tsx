/**
 * 懒加载图片组件
 * V5.1: 使用 Next.js Image 组件优化性能
 *
 * 特点：
 * - 使用 next/image 实现自动优化
 * - 使用 Intersection Observer 实现懒加载
 * - 支持加载占位符
 * - 加载失败时显示默认图片
 * - 渐变显示效果
 */

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageOff } from "lucide-react";

/**
 * 懒加载图片 Props
 */
interface LazyImageProps {
  /** 图片 URL */
  src: string;
  /** 替代文本 */
  alt: string;
  /** 占位符 URL（可选） */
  placeholder?: string;
  /** 加载失败时的备用图片 */
  fallbackSrc?: string;
  /** 容器类名 */
  containerClassName?: string;
  /** 图片类名 */
  className?: string;
  /** 是否禁用懒加载 */
  eager?: boolean;
  /** 视口触发阈值 (0-1)，默认 0.1 */
  threshold?: number;
  /** 根边距，默认 "100px" */
  rootMargin?: string;
  /** 是否显示加载骨架屏 */
  showSkeleton?: boolean;
  /** 图片加载完成回调 */
  onLoad?: () => void;
  /** 图片加载失败回调 */
  onError?: () => void;
  /** 图片宽度（用于非 fill 模式） */
  width?: number;
  /** 图片高度（用于非 fill 模式） */
  height?: number;
  /** 图片尺寸提示（用于响应式加载） */
  sizes?: string;
  /** 图片质量 (1-100)，默认 75 */
  quality?: number;
  /** 图片加载优先级 */
  priority?: boolean;
}

/**
 * 懒加载图片组件
 */
export function LazyImage({
  src,
  alt,
  placeholder,
  fallbackSrc = "/images/placeholder.png",
  containerClassName,
  className,
  eager = false,
  threshold = 0.1,
  rootMargin = "100px",
  showSkeleton = true,
  onLoad,
  onError,
  width,
  height,
  sizes = "100vw",
  quality = 75,
  priority = false,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(eager || priority);
  const containerRef = useRef<HTMLDivElement>(null);

  // 设置 Intersection Observer
  useEffect(() => {
    if (eager || priority || !containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
      },
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [eager, priority, threshold, rootMargin]);

  // 处理图片加载完成
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  // 处理图片加载失败
  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
    onError?.();
  }, [onError]);

  // 确定要显示的图片 URL
  const displaySrc = hasError ? fallbackSrc : src;

  // 判断是否使用 fill 模式
  const useFillMode = !width || !height;

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", containerClassName)}
    >
      {/* 加载骨架屏 */}
      {showSkeleton && !isLoaded && (
        <Skeleton className="absolute inset-0 h-full w-full" />
      )}

      {/* 占位符图片（低质量预览） */}
      {placeholder && !isLoaded && (
        <Image
          src={placeholder}
          alt=""
          fill={useFillMode}
          width={useFillMode ? undefined : width}
          height={useFillMode ? undefined : height}
          className={cn(
            "absolute inset-0 object-cover blur-sm",
            useFillMode && "h-full w-full",
            className,
          )}
          aria-hidden="true"
          unoptimized // 占位符不需要优化
        />
      )}

      {/* 错误状态 */}
      {hasError && !fallbackSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <ImageOff className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      {/* 实际图片 */}
      {isInView && (
        <Image
          src={displaySrc}
          alt={alt}
          fill={useFillMode}
          width={useFillMode ? undefined : width}
          height={useFillMode ? undefined : height}
          sizes={sizes}
          quality={quality}
          priority={priority}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            useFillMode && "object-cover",
            className,
          )}
          onLoad={handleLoad}
          onError={handleError}
          unoptimized // 支持任意外部 URL
        />
      )}
    </div>
  );
}

/**
 * 带比例的懒加载图片
 * 用于需要保持固定宽高比的场景
 */
export function LazyImageWithAspectRatio({
  aspectRatio = 16 / 9,
  ...props
}: LazyImageProps & { aspectRatio?: number }) {
  return (
    <div
      className="relative w-full"
      style={{ paddingBottom: `${(1 / aspectRatio) * 100}%` }}
    >
      <div className="absolute inset-0">
        <LazyImage
          {...props}
          containerClassName="h-full w-full"
          className={cn("h-full w-full object-cover", props.className)}
        />
      </div>
    </div>
  );
}

/**
 * 头像懒加载组件
 */
export function LazyAvatar({
  src,
  alt,
  size = 40,
  fallbackInitial,
  className,
  ...props
}: Omit<LazyImageProps, "containerClassName" | "width" | "height"> & {
  size?: number;
  fallbackInitial?: string;
}) {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-full bg-muted",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {hasError && fallbackInitial ? (
        <span className="text-sm font-medium text-muted-foreground">
          {fallbackInitial.charAt(0).toUpperCase()}
        </span>
      ) : (
        <LazyImage
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          showSkeleton={true}
          onError={() => setHasError(true)}
          {...props}
        />
      )}
    </div>
  );
}
