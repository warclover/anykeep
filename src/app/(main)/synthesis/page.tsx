/**
 * 综述列表页 - 重定向到内容分析页
 *
 * @version 2.0.0
 * @since 2026-02-13
 */

import { redirect } from "next/navigation";

export default function SynthesisPage() {
  redirect("/content-analysis");
}
