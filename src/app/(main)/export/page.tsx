/**
 * 内容导出页面 - 重定向到数据中心
 * @deprecated 已合并到 /data?tab=export
 */

import { redirect } from "next/navigation";

export default function ExportPage() {
  redirect("/data?tab=export");
}
