/**
 * 分类管理页面 - 重定向到规则设置
 *
 * @deprecated 此页面已迁移到 /rules
 * @since 2026-01-31
 */

import { redirect } from "next/navigation";

export const metadata = {
  title: "分类管理 | AnyKeep",
  description: "管理智能分类规则、查看分类历史、调整分类权重",
};

export default function ClassificationManagerPage() {
  redirect("/rules");
}
