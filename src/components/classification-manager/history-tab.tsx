import { History, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HistoryItem } from "./history-item";
import type { ClassificationHistoryItem } from "./types";

interface HistoryTabProps {
  history: ClassificationHistoryItem[];
  loading: boolean;
}

export function HistoryTab({ history, loading }: HistoryTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-5 text-purple-500" />
          分类建议历史
        </CardTitle>
        <CardDescription>最近 20 条分类建议记录</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="size-6 animate-spin text-gray-400" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="size-12 text-gray-300 mb-4" />
            <p className="text-gray-500">暂无分类历史记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <HistoryItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
