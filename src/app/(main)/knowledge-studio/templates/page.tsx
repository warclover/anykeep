/**
 * Knowledge Studio - 模板管理页面
 * @route /knowledge-studio/templates
 * @description Phase 3 存根 - 自定义模板管理
 */

import type { Metadata } from "next";
import { TemplatesPageClient } from "./templates-page-client";

export const metadata: Metadata = {
  title: "模板管理 - Knowledge Studio",
  description: "创建和管理自定义报告模板",
};

export default function TemplatesPage() {
  return <TemplatesPageClient />;
}
