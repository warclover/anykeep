/**
 * 分发中心页面 - 重定向到数据中心
 * @deprecated 已合并到 /data?tab=distribute
 */

import { redirect } from "next/navigation";

export default function DistributionPage() {
  redirect("/data?tab=distribute");
}
