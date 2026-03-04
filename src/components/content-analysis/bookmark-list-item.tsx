import { CheckSquare, Square, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getPlatformLabel,
  formatRelativeTime,
  type BookmarkItem,
} from "./types";

interface BookmarkListItemProps {
  bookmark: BookmarkItem;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function BookmarkListItem({
  bookmark,
  isSelected,
  onToggle,
  disabled,
}: BookmarkListItemProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "w-full flex items-start gap-3 p-3 text-left transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-primary/5",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {isSelected ? (
        <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      ) : (
        <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{bookmark.title}</span>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-primary shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {getPlatformLabel(bookmark.platform)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(bookmark.created_at)}
          </span>
          {bookmark.folder_name && (
            <span className="text-xs text-muted-foreground truncate">
              · {bookmark.folder_name}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
