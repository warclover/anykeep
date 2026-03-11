/**
 * 根页面 - Middleware 兜底
 *
 * 主要重定向逻辑已移至 middleware.ts（pathname === "/"），
 * 此页面仅作为 fallback 防御，正常流程不会到达。
 */

import { redirect } from "next/navigation";

export default function RootPage() {
  // Middleware 应已处理重定向，此处为兜底
  redirect("/home");
}
