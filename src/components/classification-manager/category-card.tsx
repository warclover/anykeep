import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { UniversalCategory } from "@/lib/classification/constants/universal-categories";

interface CategoryCardProps {
  category: UniversalCategory;
  isExpanded: boolean;
  onToggle: () => void;
}

export function CategoryCard({
  category,
  isExpanded,
  onToggle,
}: CategoryCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{category.icon}</span>
          <div className="text-left">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {category.name}
            </p>
            <p className="text-xs text-gray-500">
              {category.synonyms.length} 个同义词
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="size-4 text-gray-400" />
        ) : (
          <ChevronRight className="size-4 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex flex-wrap gap-1.5 mt-2">
            {category.synonyms.map((syn) => (
              <Badge key={syn} variant="secondary" className="text-xs">
                {syn}
              </Badge>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            推荐文件夹：
            <span className="font-medium text-gray-700 dark:text-gray-300 ml-1">
              {category.suggestedFolderName}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
