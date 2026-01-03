/**
 * 热门标签组件 - 服务端组件
 * 使用数据库函数获取热门标签，支持 Suspense 流式渲染
 */

import { createClient } from "@/lib/supabase/server";
import { ANALYTICS } from "@/lib/constants/app";
import { HotTagsClient } from "./hot-tags-client";

interface HotTagsSectionProps {
  userId: string;
}

interface HotTagResult {
  tag: string;
  count: number;
}

export async function HotTagsSection({ userId }: HotTagsSectionProps) {
  const supabase = await createClient();

  // 使用数据库函数获取热门标签（SQL 聚合，性能更优）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tagData } = await (supabase.rpc as any)("get_user_hot_tags", {
    p_user_id: userId,
    p_limit: ANALYTICS.TOP_TAGS_COUNT,
  }) as { data: HotTagResult[] | null };

  const hotTags = tagData?.map((item) => item.tag) || [];

  if (hotTags.length === 0) {
    return null;
  }

  return <HotTagsClient tags={hotTags} />;
}
