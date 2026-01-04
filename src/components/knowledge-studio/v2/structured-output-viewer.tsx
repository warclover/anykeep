/**
 * Structured Output Viewer v2 - 结构化输出查看器
 * @module knowledge-studio/v2
 *
 * 功能:
 * - 根据输出类型渲染：
 *   - feature_matrix: 表格组件
 *   - swot: 四象限布局
 *   - script_timeline: 时间线组件
 *   - sections: 折叠面板
 *   - checklist: 任务列表
 *   - markdown: Markdown 渲染
 */

"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Circle,
  Clock,
  FileText,
  List,
  Table2,
  Grid3X3,
} from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ============================================================
// Types
// ============================================================

export type OutputType =
  | "feature_matrix"
  | "swot"
  | "script_timeline"
  | "sections"
  | "checklist"
  | "markdown"
  | "json"
  | "unknown";

export interface StructuredOutputViewerProps {
  /** 输出类型 */
  type: OutputType;
  /** 输出数据 */
  data: unknown;
  /** 标题 */
  title?: string;
  /** 最大高度 */
  maxHeight?: string;
  /** 类名 */
  className?: string;
}

// Type-specific data interfaces
interface FeatureMatrixData {
  title?: string;
  headers: string[];
  rows: Array<{
    feature: string;
    values: Array<string | boolean | number>;
  }>;
}

interface SwotData {
  title?: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface ScriptTimelineData {
  title?: string;
  scenes: Array<{
    id: string;
    timestamp: string;
    duration?: string;
    title: string;
    description: string;
    visualNotes?: string;
    audioNotes?: string;
  }>;
}

interface SectionsData {
  title?: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    subsections?: Array<{
      id: string;
      title: string;
      content: string;
    }>;
  }>;
}

interface ChecklistData {
  title?: string;
  items: Array<{
    id: string;
    text: string;
    checked?: boolean;
    priority?: "high" | "medium" | "low";
    category?: string;
  }>;
}

// ============================================================
// Sub-Components
// ============================================================

/**
 * Feature Matrix Renderer
 */
function FeatureMatrixRenderer({ data }: { data: FeatureMatrixData }) {
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

/**
 * SWOT Renderer
 */
function SwotRenderer({ data }: { data: SwotData }) {
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

/**
 * Script Timeline Renderer
 */
function ScriptTimelineRenderer({ data }: { data: ScriptTimelineData }) {
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

/**
 * Sections Renderer
 */
function SectionsRenderer({ data }: { data: SectionsData }) {
  const [openSections, setOpenSections] = useState<string[]>(
    data.sections.slice(0, 2).map((s) => s.id),
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
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
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors py-3">
                <div className="flex items-center gap-2">
                  {openSections.includes(section.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
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
                      <div key={sub.id}>
                        <h4 className="font-medium text-sm mb-1">
                          {sub.title}
                        </h4>
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

/**
 * Checklist Renderer
 */
function ChecklistRenderer({ data }: { data: ChecklistData }) {
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

/**
 * Markdown Renderer
 */
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

/**
 * JSON Renderer
 */
function JsonRenderer({ data }: { data: unknown }) {
  return (
    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
      <code>{JSON.stringify(data, null, 2)}</code>
    </pre>
  );
}

// ============================================================
// Type Icons
// ============================================================

const TYPE_ICONS: Record<OutputType, React.ReactNode> = {
  feature_matrix: <Table2 className="h-5 w-5" />,
  swot: <Grid3X3 className="h-5 w-5" />,
  script_timeline: <Clock className="h-5 w-5" />,
  sections: <FileText className="h-5 w-5" />,
  checklist: <List className="h-5 w-5" />,
  markdown: <FileText className="h-5 w-5" />,
  json: <FileText className="h-5 w-5" />,
  unknown: <FileText className="h-5 w-5" />,
};

const TYPE_LABELS: Record<OutputType, string> = {
  feature_matrix: "功能矩阵",
  swot: "SWOT 分析",
  script_timeline: "脚本时间线",
  sections: "章节内容",
  checklist: "检查清单",
  markdown: "Markdown",
  json: "JSON 数据",
  unknown: "原始输出",
};

// ============================================================
// Main Component
// ============================================================

export function StructuredOutputViewer({
  type,
  data,
  title,
  maxHeight = "600px",
  className,
}: StructuredOutputViewerProps) {
  const renderContent = () => {
    switch (type) {
      case "feature_matrix":
        return <FeatureMatrixRenderer data={data as FeatureMatrixData} />;
      case "swot":
        return <SwotRenderer data={data as SwotData} />;
      case "script_timeline":
        return <ScriptTimelineRenderer data={data as ScriptTimelineData} />;
      case "sections":
        return <SectionsRenderer data={data as SectionsData} />;
      case "checklist":
        return <ChecklistRenderer data={data as ChecklistData} />;
      case "markdown":
        return <MarkdownRenderer content={data as string} />;
      case "json":
        return <JsonRenderer data={data} />;
      default:
        // Try to render as JSON if unknown
        return <JsonRenderer data={data} />;
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {TYPE_ICONS[type]}
          <CardTitle className="text-lg">
            {title || TYPE_LABELS[type]}
          </CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {TYPE_LABELS[type]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea style={{ maxHeight }}>{renderContent()}</ScrollArea>
      </CardContent>
    </Card>
  );
}

export default StructuredOutputViewer;
