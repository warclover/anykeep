"use client";

import { Sparkles, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ElapsedTimeDisplay } from "./elapsed-time-display";
import {
  WAITING_MESSAGE_KEYS,
  type GenerationProgress,
  type Ks2TextFn,
} from "./utils";

interface GeneratingProgressCardProps {
  progress: GenerationProgress;
  generationStartTime: number | null;
  waitingMessageIndex: number;
  onCancel: () => void;
  generatedContent: string;
  prefersReducedMotion: boolean;
  k: Ks2TextFn;
}

export function GeneratingProgressCard({
  progress,
  generationStartTime,
  waitingMessageIndex,
  onCancel,
  generatedContent,
  prefersReducedMotion,
  k,
}: GeneratingProgressCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles
                className={`h-5 w-5 ${prefersReducedMotion ? "" : "animate-pulse"}`}
              />
              {k("generatingTitle")}
            </CardTitle>
            <p
              className={`text-sm text-muted-foreground mt-1 ${prefersReducedMotion ? "" : "animate-pulse"}`}
            >
              {k(WAITING_MESSAGE_KEYS[waitingMessageIndex])}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onCancel}>
            {k("cancelGenerate")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress.percent} className="h-2" />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {progress.message ||
              (progress.step === "preparing"
                ? k("progressStepPreparing")
                : progress.step === "generating"
                  ? k("progressStepGenerating")
                  : progress.step)}
          </span>
          <span>{progress.percent}%</span>
        </div>

        {generationStartTime && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-3">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <ElapsedTimeDisplay startTime={generationStartTime} label={k} />
            </div>
            {progress.generatedWords !== undefined &&
              progress.generatedWords > 0 && (
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  <span>
                    {k("generatedWords", {
                      count: progress.generatedWords.toLocaleString(),
                    })}
                  </span>
                </div>
              )}
          </div>
        )}

        {generatedContent && (
          <div className="mt-6 p-4 bg-muted rounded-lg max-h-[300px] overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm">
              {generatedContent}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
