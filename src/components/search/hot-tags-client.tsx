/**
 * 热门标签客户端组件 - 处理标签点击交互
 */

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";

interface HotTagsClientProps {
  tags: string[];
}

export function HotTagsClient({ tags }: HotTagsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTagClick = (tag: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("q", tag);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        🔥 热门标签
      </h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50 text-sm"
            onClick={() => handleTagClick(tag)}
          >
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}
