/**
 * 通知中心页面
 * @description 统一通知系统入口页面
 */

import { NotificationPage } from "@/components/notifications";

export const metadata = {
  title: "通知 - AnyKeep",
  description: "查看所有通知消息",
};

export default function NotificationsPage() {
  return <NotificationPage />;
}
