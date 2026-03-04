"use client";

import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import type { Ks2TextFn } from "./utils";

interface RequirementsCardProps {
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  value: string;
  onChange: (v: string) => void;
  k: Ks2TextFn;
}

export function RequirementsCard({
  isExpanded,
  setIsExpanded,
  value,
  onChange,
  k,
}: RequirementsCardProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-muted-foreground text-muted-foreground text-sm font-bold">
                  3
                </span>
                <CardTitle className="text-base">
                  {k("step3Optional")}
                </CardTitle>
              </div>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <Textarea
              placeholder={k("step3Placeholder")}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[100px]"
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
