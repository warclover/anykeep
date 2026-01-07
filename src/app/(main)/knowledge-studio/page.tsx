/**
 * Knowledge Studio - 主页面 (重定向)
 * @route /knowledge-studio
 * @description 自动重定向到 V2 版本
 */

import { redirect } from "next/navigation";

export default function KnowledgeStudioPage() {
  redirect("/knowledge-studio/v2");
}
