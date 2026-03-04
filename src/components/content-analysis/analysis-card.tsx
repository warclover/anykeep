import Link from "next/link";
import {
  MoreVertical,
  Trash2,
  RefreshCcw,
  BookOpen,
  FileText,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SynthesisReportSummary } from "@/lib/synthesis";
import { DEPTH_MODE_LABELS, STATUS_CONFIG, getReportType } from "./types";

interface AnalysisCardProps {
  report: SynthesisReportSummary;
  onDelete: (report: SynthesisReportSummary) => void;
  onRetry: (reportId: string) => void;
}

export function AnalysisCard({ report, onDelete, onRetry }: AnalysisCardProps) {
  const depthConfig = DEPTH_MODE_LABELS[report.depthMode];
  const statusConfig = STATUS_CONFIG[report.status];
  const reportType = getReportType(report.outputStyle, report.sourceCount);
  const TypeIcon = reportType.icon;

  return (
    <Card className="hover:bg-muted/50 transition-colors group relative">
      <Link href={`/synthesis/${report.id}`} className="block">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base line-clamp-1 pr-8">
              {report.title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${reportType.color} border-current`}
              >
                <TypeIcon className="h-3 w-3 mr-1" />
                {reportType.label}
              </Badge>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.overviewPreview && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {report.overviewPreview}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {depthConfig.icon} {depthConfig.label}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {report.sourceCount} 来源
            </span>
            {report.wordCount > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {report.wordCount} 字
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(report.createdAt).toLocaleDateString()}
            </span>
          </div>

          {report.status === "completed" && (
            <div className="flex gap-2">
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                共识 {report.consensusCount}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              >
                分歧 {report.divergenceCount}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
              >
                盲区 {report.blindSpotCount}
              </Badge>
            </div>
          )}
        </CardContent>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.preventDefault()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {report.status === "failed" && (
            <>
              <DropdownMenuItem onClick={() => onRetry(report.id)}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                重新生成
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(report)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
