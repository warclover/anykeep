/**
 * 健康检测页面 - 重定向到整理中心
 *
 * 该页面已合并到整理中心的"内容健康"Tab
 * 保留此重定向以兼容旧链接
 *
 * @deprecated 请使用 /organize?tab=content
 * @since 2026-02-13
 */

import { redirect } from "next/navigation";

export const metadata = {
  title: "健康检测 - AnyKeep",
  description: "检测失效链接、重复内容和过期内容，全面诊断收藏夹健康状况",
};

export default function HealthPage() {
  redirect("/organize?tab=content");
}
