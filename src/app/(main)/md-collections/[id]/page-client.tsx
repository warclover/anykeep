/**
 * MD 收藏详情页面 - 客户端组件
 * P2-007: Markdown 内容收藏 - 专业阅读视图
 */

"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { MdReaderView } from "@/features/md-collections/components";
import type { MdCollection } from "@/features/md-collections";

interface MdCollectionDetailClientProps {
  collection: MdCollection;
}

export function MdCollectionDetailClient({
  collection,
}: MdCollectionDetailClientProps) {
  const router = useRouter();

  const handleBack = useCallback(() => {
    router.push("/md-collections");
  }, [router]);

  return <MdReaderView collection={collection} onBack={handleBack} />;
}
