/**
 * 收件箱页面 - 已整合到整理中心
 *
 * 此路由保留用于向后兼容，自动重定向到 /organize
 *
 * @deprecated 请使用 /organize 路由
 */

import { redirect } from "next/navigation";

export default function InboxPage() {
  redirect("/organize");
}
