"use client";

import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  FileText,
  Scissors,
  MessageSquare,
  Download,
  Volume2,
  Pause,
  Share2,
  Copy,
  BookmarkPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  StructuredOutputViewer,
  CondenseSlider,
  type OutputType,
} from "@/components/knowledge-studio/v2";
import type { Ks2TextFn } from "./utils";

function getOutputType(structuredOutput: unknown): OutputType {
  if (!structuredOutput) return "markdown";
  if (typeof structuredOutput === "string") return "markdown";
  if (typeof structuredOutput !== "object") return "json";

  const output = structuredOutput as object;

  if ("swotAnalysis" in output || "strengths" in output) return "swot";
  if ("featureMatrix" in output || "headers" in output) return "feature_matrix";
  if ("scenes" in output) return "script_timeline";
  if ("sections" in output) return "sections";
  if (
    "items" in output &&
    Array.isArray((output as { items: unknown }).items)
  ) {
    return "checklist";
  }

  return "json";
}

interface ResultSectionProps {
  generatedContent: string;
  condensedContent: string;
  structuredOutput: unknown;
  selectedBlueprintDisplayName: string;
  reportId: string | undefined;
  isCondensing: boolean;
  condenseProgress: number;
  isSavingCondensed: boolean;
  onCondense: (targetWords?: number) => void;
  onCopyCondensed: () => void;
  onSaveCondensed: () => void;
  isIterating: boolean;
  iterationProgress: number;
  setIsFeedbackDialogOpen: (v: boolean) => void;
  setIsMultiPlatformDialogOpen: (v: boolean) => void;
  setIsExportDialogOpen: (v: boolean) => void;
  setExportContent: (v: string) => void;
  isTTSLoading: boolean;
  isPlaying: boolean;
  playTTS: (text: string) => void;
  pauseTTS: () => void;
  onViewReport: () => void;
  onRegenerate: () => void;
  k: Ks2TextFn;
}

export function ResultSection({
  generatedContent,
  condensedContent,
  structuredOutput,
  selectedBlueprintDisplayName,
  reportId,
  isCondensing,
  condenseProgress,
  isSavingCondensed,
  onCondense,
  onCopyCondensed,
  onSaveCondensed,
  isIterating,
  iterationProgress,
  setIsFeedbackDialogOpen,
  setIsMultiPlatformDialogOpen,
  setIsExportDialogOpen,
  setExportContent,
  isTTSLoading,
  isPlaying,
  playTTS,
  pauseTTS,
  onViewReport,
  onRegenerate,
  k,
}: ResultSectionProps) {
  return (
    <div className="space-y-6">
      <Alert>
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <AlertTitle>{k("resultDone")}</AlertTitle>
        <AlertDescription>
          {k("resultSaved")}
          {reportId && (
            <Button
              variant="link"
              onClick={onViewReport}
              className="p-0 h-auto ml-1"
            >
              {k("viewFullDraft")}
            </Button>
          )}
        </AlertDescription>
      </Alert>

      {generatedContent && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-muted-foreground">
                {condensedContent ? (
                  <>
                    {k("originalWords", {
                      count: generatedContent.length.toLocaleString(),
                    })}
                    {" | "}
                    {k("condensedWords", {
                      count: condensedContent.length.toLocaleString(),
                    })}
                  </>
                ) : (
                  <>
                    {k("currentWords", {
                      count: generatedContent.length.toLocaleString(),
                    })}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {condensedContent ? (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(generatedContent)
                          .then(() => toast.success(k("copyOriginalToast")))
                      }
                    >
                      <Copy className="mr-1.5 h-4 w-4" />
                      {k("copyOriginal")}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(condensedContent)
                          .then(() => toast.success(k("copyCondensedToast")))
                      }
                    >
                      <Copy className="mr-1.5 h-4 w-4" />
                      {k("copyCondensed")}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setExportContent(condensedContent);
                        setIsExportDialogOpen(true);
                      }}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      {k("exportCondensed")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setExportContent(generatedContent);
                        setIsExportDialogOpen(true);
                      }}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      {k("exportOriginal")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(generatedContent)
                          .then(() => toast.success(k("copyToast")))
                      }
                    >
                      <Copy className="mr-1.5 h-4 w-4" />
                      {k("copy")}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setExportContent(generatedContent);
                        setIsExportDialogOpen(true);
                      }}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      {k("export")}
                    </Button>
                  </>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      {k("moreActions")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setIsFeedbackDialogOpen(true)}
                      disabled={isCondensing || isIterating}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      {k("feedbackOptimize")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setIsMultiPlatformDialogOpen(true)}
                      disabled={isCondensing || isIterating}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      {k("multiPlatform")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (isPlaying) {
                          pauseTTS();
                        } else {
                          const paragraphs = generatedContent.split(/\n\n+/);
                          let textToRead = "";
                          for (const p of paragraphs) {
                            if (textToRead.length + p.length > 500) break;
                            textToRead += (textToRead ? "\n\n" : "") + p;
                          }
                          if (!textToRead)
                            textToRead = generatedContent.slice(0, 500);
                          playTTS(textToRead);
                        }
                      }}
                      disabled={isTTSLoading}
                    >
                      {isTTSLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="mr-2 h-4 w-4" />
                      ) : (
                        <Volume2 className="mr-2 h-4 w-4" />
                      )}
                      {isPlaying ? k("pause") : k("readAloud")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <CondenseSlider
                        currentWords={generatedContent.length}
                        onCondense={onCondense}
                        isCondensing={isCondensing}
                        disabled={isCondensing}
                      />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {isCondensing && (
              <div className="mt-4 space-y-2">
                <Progress value={condenseProgress} className="h-2" />
                <div className="text-sm text-muted-foreground text-center">
                  {k("condensingProgress", {
                    percent: condenseProgress,
                  })}
                </div>
              </div>
            )}

            {isIterating && (
              <div className="mt-4 space-y-2">
                <Progress value={iterationProgress} className="h-2" />
                <div className="text-sm text-muted-foreground text-center">
                  {k("iteratingProgress", {
                    percent: iterationProgress,
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {structuredOutput ? (
        <StructuredOutputViewer
          type={getOutputType(structuredOutput)}
          data={structuredOutput}
          title={selectedBlueprintDisplayName}
        />
      ) : (
        generatedContent && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {k("generatedContentTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {condensedContent ? (
                <Tabs defaultValue="condensed" className="w-full">
                  <div className="flex items-center justify-between mb-4">
                    <TabsList>
                      <TabsTrigger value="condensed" className="gap-1.5">
                        <Scissors className="h-4 w-4" />
                        {k("condensedTab")}
                        <Badge variant="secondary" className="ml-1">
                          {condensedContent.length.toLocaleString()} 字
                        </Badge>
                      </TabsTrigger>
                      <TabsTrigger value="original" className="gap-1.5">
                        <FileText className="h-4 w-4" />
                        {k("originalTab")}
                        <Badge variant="secondary" className="ml-1">
                          {generatedContent.length.toLocaleString()} 字
                        </Badge>
                      </TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onCopyCondensed}
                        title={k("copyCondensed")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onSaveCondensed}
                        disabled={isSavingCondensed}
                        title={k("condenseSaved")}
                      >
                        {isSavingCondensed ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <BookmarkPlus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <TabsContent value="condensed">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap">
                        {condensedContent}
                      </pre>
                    </div>
                  </TabsContent>
                  <TabsContent value="original">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap">
                        {generatedContent}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap">{generatedContent}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        )
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onRegenerate}>
          {k("regenerate")}
        </Button>
        <Button onClick={onViewReport} disabled={!reportId}>
          {k("viewFullDraftButton")}
        </Button>
      </div>
    </div>
  );
}
