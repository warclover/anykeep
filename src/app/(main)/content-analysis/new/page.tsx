/**
 * 内容分析创建页 - 重定向
 *
 * @version 2.0.0
 * @since 2026-02-13
 * @deprecated 已整合到 /content-analysis 页面，此路由保留用于向后兼容
 */

import { redirect } from "next/navigation";

export default function ContentAnalysisNewPage() {
  redirect("/content-analysis?tab=compare");
}
