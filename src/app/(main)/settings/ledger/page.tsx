import type { Metadata } from "next";
import { LedgerList } from "@/components/ledger/ledger-list";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "我的账单 - AnyKeep",
  description: "查看您的收藏周报和月报",
};

export default function LedgerPage() {
  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">我的收藏账单</h1>
        <p className="text-muted-foreground">
          查看您的收藏周报和月报，回顾您的信息摄入历史。
        </p>
      </div>
      <Separator />
      <LedgerList />
    </div>
  );
}
