/**
 * 通用返回按钮组件
 *
 * 用于页面顶部的返回导航
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export interface BackButtonProps {
  /** 返回链接，默认 /home */
  href?: string;
  /** 按钮文本，默认"返回首页" */
  label?: string;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 主组件
// ============================================

export function BackButton({
  href = "/home",
  label = "返回首页",
  className,
}: BackButtonProps) {
  return (
    <Link href={href}>
      <Button
        variant="ghost"
        size="sm"
        className={cn("gap-1", className)}
        aria-label={label}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
    </Link>
  );
}
