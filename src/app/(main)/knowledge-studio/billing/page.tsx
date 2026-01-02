/**
 * Knowledge Studio - 账单与用量页面
 * @route /knowledge-studio/billing
 * @description Phase 3 存根 - 查看使用量和账单
 */

import type { Metadata } from "next";
import { BillingPageClient } from "./billing-page-client";

export const metadata: Metadata = {
  title: "账单与用量 - Knowledge Studio",
  description: "查看使用量统计和账单明细",
};

export default function BillingPage() {
  return <BillingPageClient />;
}
