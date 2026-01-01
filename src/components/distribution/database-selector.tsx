/**
 * Notion Database 选择器组件
 *
 * @description 从用户 Notion 工作空间选择 Database
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Database, AlertCircle } from "lucide-react";

interface NotionDatabase {
  id: string;
  title: string;
  icon: string | null;
  description?: string;
}

interface DatabaseSelectorProps {
  /** 当前选中的 Database ID */
  value?: string;
  /** 选择变化回调 */
  onChange: (database: NotionDatabase | null) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

export function DatabaseSelector({
  value,
  onChange,
  disabled = false,
}: DatabaseSelectorProps) {
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDatabases = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/distribution/notion/databases");

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "获取 Database 列表失败");
      }

      const data = await response.json();
      setDatabases(data.databases || []);
    } catch (err) {
      console.error("Failed to fetch databases:", err);
      setError(err instanceof Error ? err.message : "获取 Database 列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatabases();
  }, [fetchDatabases]);

  const handleValueChange = (id: string) => {
    const database = databases.find((db) => db.id === id) || null;
    onChange(database);
  };

  const selectedDatabase = databases.find((db) => db.id === value);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/50 bg-destructive/10 text-destructive text-sm">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">{error}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchDatabases}
          className="h-7 px-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (databases.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-md border border-muted bg-muted/50 text-muted-foreground text-sm">
        <Database className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">
          未找到可用的 Database。请确保已在 Notion 中授权访问相关页面。
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchDatabases}
          className="h-7 px-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={value}
          onValueChange={handleValueChange}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="选择 Database">
              {selectedDatabase && (
                <span className="flex items-center gap-2">
                  {selectedDatabase.icon && (
                    <span className="text-base">{selectedDatabase.icon}</span>
                  )}
                  <span>{selectedDatabase.title}</span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {databases.map((db) => (
              <SelectItem key={db.id} value={db.id}>
                <span className="flex items-center gap-2">
                  {db.icon && <span className="text-base">{db.icon}</span>}
                  <span>{db.title}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchDatabases}
          disabled={loading || disabled}
          title="刷新 Database 列表"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {selectedDatabase?.description && (
        <p className="text-xs text-muted-foreground">
          {selectedDatabase.description}
        </p>
      )}
    </div>
  );
}
