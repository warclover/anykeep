import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type ClassificationHistoryItem,
} from "./types";

interface HistoryItemProps {
  item: ClassificationHistoryItem;
}

export function HistoryItem({ item }: HistoryItemProps) {
  const StatusIcon =
    item.status === "accepted"
      ? CheckCircle2
      : item.status === "rejected"
        ? XCircle
        : Clock;

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <StatusIcon
        className={cn(
          "size-5 shrink-0",
          item.status === "accepted" && "text-green-500",
          item.status === "rejected" && "text-red-500",
          item.status === "pending" && "text-yellow-500",
          item.status === "expired" && "text-gray-400",
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
          {item.bookmarkTitle}
        </p>
        <p className="text-xs text-gray-500">→ {item.suggestedFolderName}</p>
      </div>
      <div className="text-right shrink-0">
        <Badge
          variant="outline"
          className={cn("text-xs", STATUS_COLORS[item.status])}
        >
          {STATUS_LABELS[item.status]}
        </Badge>
        <p className="text-xs text-gray-400 mt-1">{item.confidence}% 置信度</p>
      </div>
    </div>
  );
}
