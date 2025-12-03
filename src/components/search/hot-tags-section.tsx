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

export async function HotTagsSection({ userId }: HotTagsSectionProps) {
  const supabase = await createClient();

  // 使用数据库函数获取热门标签（SQL 聚合，性能更优）
  const { data: tagData } = await supabase.rpc("get_user_hot_tags", {
    p_user_id: userId,
    p_limit: ANALYTICS.TOP_TAGS_COUNT,
  });

  const hotTags = tagData?.map((item: { tag: string }) => item.tag) || [];

  if (hotTags.length === 0) {
    return null;
  }

  return <HotTagsClient tags={hotTags} />;
}
