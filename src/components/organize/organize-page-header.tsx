"use client";

import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, ArrowLeft, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface OrganizePageHeaderProps {
  showOneClick: boolean;
  isOrganizing: boolean;
  isRefreshing: boolean;
  isLoadingTab: boolean;
  onOneClickOrganize: () => void;
  onRefresh: () => void;
}

export function OrganizePageHeader({
  showOneClick,
  isOrganizing,
  isRefreshing,
  isLoadingTab,
  onOneClickOrganize,
  onRefresh,
}: OrganizePageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/home")}
          className="text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">
          整理中心
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {showOneClick && (
          <Button
            size="sm"
            onClick={onOneClickOrganize}
            disabled={isOrganizing || isRefreshing}
            className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white"
          >
            <Wand2
              className={cn("w-4 h-4 mr-1.5", isOrganizing && "animate-pulse")}
            />
            {isOrganizing ? "整理中..." : "一键整理"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing || isOrganizing || isLoadingTab}
        >
          <RefreshCw
            className={cn(
              "w-4 h-4",
              (isRefreshing || isLoadingTab) && "animate-spin",
            )}
          />
        </Button>
      </div>
    </div>
  );
}
