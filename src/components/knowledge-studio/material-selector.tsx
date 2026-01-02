"use client";

/**
 * Material Selector - 素材选择器
 * @module components/knowledge-studio
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface MaterialItem {
  id: string;
  title: string;
  url: string;
  platform?: string;
  summary?: string;
  createdAt: Date;
}

interface MaterialSelectorProps {
  materials: MaterialItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  maxSelection?: number;
  className?: string;
}

export function MaterialSelector({
  materials,
  selected,
  onChange,
  maxSelection = 10,
  className,
}: MaterialSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMaterials = materials.filter(
    (m) =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.summary?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleToggle = useCallback(
    (id: string) => {
      if (selected.includes(id)) {
        onChange(selected.filter((s) => s !== id));
      } else if (selected.length < maxSelection) {
        onChange([...selected, id]);
      }
    },
    [selected, onChange, maxSelection],
  );

  const handleSelectAll = useCallback(() => {
    const newSelection = filteredMaterials
      .slice(0, maxSelection)
      .map((m) => m.id);
    onChange(newSelection);
  }, [filteredMaterials, maxSelection, onChange]);

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">选择素材</span>
          <Badge variant="secondary">
            {selected.length} / {maxSelection}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleSelectAll}>
            全选
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClearAll}>
            清空
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative my-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索素材..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Material List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {filteredMaterials.map((material) => {
            const isSelected = selected.includes(material.id);
            const isDisabled = !isSelected && selected.length >= maxSelection;

            return (
              <label
                key={material.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                  isSelected && "border-primary bg-accent",
                  isDisabled && "cursor-not-allowed opacity-50",
                  !isSelected && !isDisabled && "hover:bg-accent/50",
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(material.id)}
                  disabled={isDisabled}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium leading-tight line-clamp-2">
                      {material.title}
                    </span>
                    {material.platform && (
                      <Badge variant="outline" className="shrink-0">
                        {material.platform}
                      </Badge>
                    )}
                  </div>
                  {material.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {material.summary}
                    </p>
                  )}
                </div>
              </label>
            );
          })}

          {filteredMaterials.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              {searchQuery ? "没有找到匹配的素材" : "暂无可用素材"}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Selected Summary */}
      {selected.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <div className="flex flex-wrap gap-2">
            {selected.map((id) => {
              const material = materials.find((m) => m.id === id);
              if (!material) return null;

              return (
                <Badge
                  key={id}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  <span className="max-w-[150px] truncate">
                    {material.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggle(id)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
