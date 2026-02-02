/**
 * 数据导入页面 - 重定向到数据中心
 * @deprecated 已合并到 /data?tab=import
 */

import { redirect } from "next/navigation";

export default function ImportPage() {
  redirect("/data?tab=import");
}
