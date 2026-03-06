/**
 * Structured Output Viewer - 渲染器组件
 */

"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Circle,
  Clock,
  Copy,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CollapsibleCodeBlock } from "@/components/ai/collapsible-code-block";
import type {
  FeatureMatrixData,
  SwotData,
  ScriptTimelineData,
  SectionsData,
  ChecklistData,
} from "./viewer-types";

// ============================================================
// Copy Button
// ============================================================

interface CopyButtonProps {
  text: string;
  label?: string;
  variant?: "icon" | "button";
  className?: string;
}

export function CopyButton({
  text,
  label = "复制",
  variant = "icon",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  };

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", className)}
        onClick={handleCopy}
        title={label}
      >
        {copied ? (
          <CheckCheck className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <CheckCheck className="h-3.5 w-3.5 mr-1.5 text-green-500" />
          已复制
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          {label}
        </>
      )}
    </Button>
  );
}

// ============================================================
// Feature Matrix Renderer
// ============================================================

export function FeatureMatrixRenderer({ data }: { data: FeatureMatrixData }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">功能</TableHead>
            {data.headers.map((header, index) => (
              <TableHead key={index} className="text-center">
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              <TableCell className="font-medium">{row.feature}</TableCell>
              {row.values.map((value, colIndex) => (
                <TableCell key={colIndex} className="text-center">
                  {typeof value === "boolean" ? (
                    value ? (
                      <Check className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground mx-auto" />
                    )
                  ) : (
                    <span>{String(value)}</span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================
// SWOT Renderer
// ============================================================

export function SwotRenderer({ data }: { data: SwotData }) {
  const quadrants = [
    {
      key: "strengths",
      title: "优势 (S)",
      items: data.strengths,
      color:
        "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
      textColor: "text-green-700 dark:text-green-300",
    },
    {
      key: "weaknesses",
      title: "劣势 (W)",
      items: data.weaknesses,
      color: "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800",
      textColor: "text-red-700 dark:text-red-300",
    },
    {
      key: "opportunities",
      title: "机会 (O)",
      items: data.opportunities,
      color: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
      textColor: "text-blue-700 dark:text-blue-300",
    },
    {
      key: "threats",
      title: "威胁 (T)",
      items: data.threats,
      color:
        "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800",
      textColor: "text-amber-700 dark:text-amber-300",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {quadrants.map((quadrant) => (
        <Card key={quadrant.key} className={cn("border-2", quadrant.color)}>
          <CardHeader className="pb-2">
            <CardTitle
              className={cn("text-sm font-semibold", quadrant.textColor)}
            >
              {quadrant.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1.5">
              {quadrant.items.map((item, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Script Timeline Renderer
// ============================================================

export function ScriptTimelineRenderer({ data }: { data: ScriptTimelineData }) {
  return (
    <div className="space-y-4">
      {data.scenes.map((scene, index) => (
        <div key={scene.id} className="flex gap-4">
          {/* 时间线 */}
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium">
              {index + 1}
            </div>
            {index < data.scenes.length - 1 && (
              <div className="w-0.5 flex-1 bg-border mt-2" />
            )}
          </div>

          {/* 内容 */}
          <Card className="flex-1 mb-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{scene.title}</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{scene.timestamp}</span>
                  {scene.duration && <span>({scene.duration})</span>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <p className="text-sm">{scene.description}</p>
              {scene.visualNotes && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">画面：</span>
                  {scene.visualNotes}
                </div>
              )}
              {scene.audioNotes && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">音效：</span>
                  {scene.audioNotes}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Sections Renderer
// ============================================================

export function SectionsRenderer({ data }: { data: SectionsData }) {
  const [openSections, setOpenSections] = useState<string[]>(
    data.sections.slice(0, 2).map((s) => s.id),
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  /** 生成章节的完整文本内容（用于复制） */
  const getSectionText = (section: SectionsData["sections"][0]) => {
    let text = `## ${section.title}\n\n${section.content}`;
    if (section.subsections && section.subsections.length > 0) {
      text += "\n\n";
      text += section.subsections
        .map((sub) => `### ${sub.title}\n\n${sub.content}`)
        .join("\n\n");
    }
    return text;
  };

  return (
    <div className="space-y-2">
      {data.sections.map((section) => (
        <Collapsible
          key={section.id}
          open={openSections.includes(section.id)}
          onOpenChange={() => toggleSection(section.id)}
        >
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-2 flex-1 cursor-pointer hover:text-primary transition-colors">
                    {openSections.includes(section.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </div>
                </CollapsibleTrigger>
                {/* Phase 2: 分段复制按钮 */}
                <CopyButton text={getSectionText(section)} label="复制本章节" />
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {section.content}
                  </ReactMarkdown>
                </div>
                {section.subsections && section.subsections.length > 0 && (
                  <div className="mt-4 space-y-3 pl-4 border-l-2">
                    {section.subsections.map((sub) => (
                      <div key={sub.id} className="relative group">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-sm">{sub.title}</h4>
                          {/* Phase 2: 子章节复制按钮 */}
                          <CopyButton
                            text={`### ${sub.title}\n\n${sub.content}`}
                            label="复制子章节"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </div>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {sub.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}

// ============================================================
// Checklist Renderer
// ============================================================

export function ChecklistRenderer({ data }: { data: ChecklistData }) {
  const [checkedItems, setCheckedItems] = useState<string[]>(
    data.items.filter((item) => item.checked).map((item) => item.id),
  );

  const toggleItem = (id: string) => {
    setCheckedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const priorityColors = {
    high: "text-red-500",
    medium: "text-amber-500",
    low: "text-green-500",
  };

  // Group by category if available
  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof data.items> = {};
    data.items.forEach((item) => {
      const category = item.category || "未分类";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });
    return groups;
  }, [data]);

  return (
    <div className="space-y-4">
      {Object.entries(groupedItems).map(([category, items]) => (
        <div key={category}>
          {Object.keys(groupedItems).length > 1 && (
            <h4 className="font-medium text-sm text-muted-foreground mb-2">
              {category}
            </h4>
          )}
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                  checkedItems.includes(item.id)
                    ? "bg-accent/50 border-accent"
                    : "hover:bg-accent/30",
                )}
              >
                <Checkbox
                  id={item.id}
                  checked={checkedItems.includes(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                <label
                  htmlFor={item.id}
                  className={cn(
                    "flex-1 text-sm cursor-pointer",
                    checkedItems.includes(item.id) &&
                      "line-through text-muted-foreground",
                  )}
                >
                  {item.text}
                </label>
                {item.priority && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", priorityColors[item.priority])}
                  >
                    {item.priority}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Markdown Renderer
// ============================================================

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// ============================================================
// JSON Renderer
// ============================================================

export function JsonRenderer({ data }: { data: unknown }) {
  const jsonString = JSON.stringify(data, null, 2);
  return (
    <CollapsibleCodeBlock
      language="json"
      collapseThreshold={15}
      visibleLines={10}
    >
      {jsonString}
    </CollapsibleCodeBlock>
  );
}
