"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MaterialRecommendations } from "@/components/knowledge-studio/v2";
import { MaterialSelector } from "@/components/knowledge-studio/material-selector";
import { MATERIAL_LIMITS } from "@/lib/knowledge-studio/v2/constants";
import type { MaterialInput } from "@/lib/knowledge-studio/blueprint/types";
import type { Ks2TextFn } from "./utils";

interface MaterialsStepCardProps {
  selectedMaterialIds: string[];
  onMaterialsChange: (ids: string[]) => void;
  onAddMaterial: (id: string, material?: MaterialInput) => void;
  isManualSelectExpanded: boolean;
  setIsManualSelectExpanded: (v: boolean) => void;
  platformFilter: string | null;
  setPlatformFilter: (v: string | null) => void;
  materialSearchQuery: string;
  setMaterialSearchQuery: (v: string) => void;
  allMaterials: {
    id: string;
    title: string;
    url: string;
    platform?: string;
    summary?: string;
    createdAt: Date;
  }[];
  isLoading: boolean;
  isSearching: boolean;
  k: Ks2TextFn;
}

export function MaterialsStepCard({
  selectedMaterialIds,
  onMaterialsChange,
  onAddMaterial,
  isManualSelectExpanded,
  setIsManualSelectExpanded,
  platformFilter,
  setPlatformFilter,
  materialSearchQuery,
  setMaterialSearchQuery,
  allMaterials,
  isLoading,
  isSearching,
  k,
}: MaterialsStepCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
            2
          </span>
          <CardTitle>{k("step2Title")}</CardTitle>
          <Badge variant="secondary">
            {selectedMaterialIds.length} / {MATERIAL_LIMITS.HARD_MAX}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-3">{k("step2AiRecommend")}</h3>
          <MaterialRecommendations
            selectedMaterialIds={selectedMaterialIds}
            onAddMaterial={onAddMaterial}
            maxSelection={MATERIAL_LIMITS.HARD_MAX}
          />
        </div>

        <Collapsible
          open={isManualSelectExpanded}
          onOpenChange={setIsManualSelectExpanded}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-center" size="sm">
              {isManualSelectExpanded ? (
                <>
                  {k("step2CollapseManual")}
                  <ChevronDown className="ml-2 h-4 w-4 rotate-180 transition-transform" />
                </>
              ) : (
                <>
                  {k("step2ExpandManual")}
                  <ChevronDown className="ml-2 h-4 w-4 transition-transform" />
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Select
                  value={platformFilter ?? "all"}
                  onValueChange={(v) =>
                    setPlatformFilter(v === "all" ? null : v)
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={k("allPlatforms")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{k("allPlatforms")}</SelectItem>
                    <SelectItem value="WECHAT_OFFICIAL_ACCOUNT">
                      {k("platformWechat")}
                    </SelectItem>
                    <SelectItem value="BILIBILI">
                      {k("platformBilibili")}
                    </SelectItem>
                    <SelectItem value="ZHIHU">{k("platformZhihu")}</SelectItem>
                    <SelectItem value="XIAOHONGSHU">
                      {k("platformXiaohongshu")}
                    </SelectItem>
                    <SelectItem value="browser">
                      {k("platformBrowser")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {platformFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPlatformFilter(null)}
                  >
                    {k("clearFilter")}
                  </Button>
                )}
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-muted-foreground">
                  {k("loading")}
                </div>
              ) : allMaterials.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    {k("noBookmarks")}
                  </p>
                  <Button asChild variant="outline">
                    <a href="/home">{k("goAddBookmarks")}</a>
                  </Button>
                </div>
              ) : (
                <MaterialSelector
                  materials={allMaterials}
                  selected={selectedMaterialIds}
                  onChange={onMaterialsChange}
                  maxSelection={MATERIAL_LIMITS.HARD_MAX}
                  searchQuery={materialSearchQuery}
                  onSearchChange={setMaterialSearchQuery}
                  isSearching={isSearching}
                />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
