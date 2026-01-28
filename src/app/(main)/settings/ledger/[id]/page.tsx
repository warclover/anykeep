import type { Metadata } from "next";
import { LedgerDetail } from "@/components/ledger/ledger-detail";

interface LedgerDetailPageProps {
  params: {
    id: string;
  };
}

export const metadata: Metadata = {
  title: "账单详情 - AnyKeep",
  description: "查看收藏账单详情",
};

export default function LedgerDetailPage({ params }: LedgerDetailPageProps) {
  return (
    <div className="container py-6">
      <LedgerDetail reportId={params.id} />
    </div>
  );
}
