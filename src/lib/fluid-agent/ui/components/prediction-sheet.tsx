"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { PredictionResult } from "../../types";

interface PredictionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  predictions: PredictionResult[];
  onSelect: (prediction: PredictionResult) => void;
  loading?: boolean;
  selectionCount: number;
}

export function PredictionSheet({
  open,
  onOpenChange,
  predictions,
  onSelect,
  loading = false,
  selectionCount,
}: PredictionSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[60vh]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>✨</span>
            <span>智能推荐</span>
            <span className="text-sm font-normal text-muted-foreground">
              已选 {selectionCount} 项
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {predictions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              暂无推荐操作
            </div>
          ) : (
            predictions.map((prediction) => (
              <Button
                key={prediction.ruleId}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => onSelect(prediction)}
                disabled={loading}
              >
                <span className="text-xl">{prediction.icon}</span>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{prediction.label}</span>
                  <span className="text-xs text-muted-foreground">
                    将影响 {prediction.affectedCount} 项
                  </span>
                </div>
                {loading && (
                  <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                )}
              </Button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
