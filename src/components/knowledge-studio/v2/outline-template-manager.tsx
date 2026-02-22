/**
 * Outline Template Manager - 大纲模板管理组件
 * @module knowledge-studio/v2
 *
 * P2-3: 大纲模板保存与复用
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Save,
  FolderOpen,
  Trash2,
  MoreHorizontal,
  Check,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { BlueprintOutline } from "@/lib/knowledge-studio/blueprint/types";
import {
  getAllOutlineTemplates,
  getOutlineTemplatesByBlueprint,
  saveOutlineTemplate,
  deleteOutlineTemplate,
  isTemplateNameExists,
  type OutlineTemplate,
} from "@/lib/knowledge-studio/v2/outline-template-service";

// ============================================================
// Types
// ============================================================

interface OutlineTemplateManagerProps {
  /** 当前蓝图 ID */
  blueprintId: string;
  /** 当前大纲（用于保存） */
  currentOutline?: BlueprintOutline;
  /** 加载模板回调 */
  onLoadTemplate: (outline: BlueprintOutline) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 类名 */
  className?: string;
}

// ============================================================
// Component
// ============================================================

export function OutlineTemplateManager({
  blueprintId,
  currentOutline,
  onLoadTemplate,
  disabled = false,
  className,
}: OutlineTemplateManagerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"load" | "save">("load");
  const [templateName, setTemplateName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 获取模板列表
  const templates = useMemo(() => {
    if (!open) return [];
    return getOutlineTemplatesByBlueprint(blueprintId);
  }, [open, blueprintId]);

  // 所有模板（用于显示其他蓝图的模板）
  const allTemplates = useMemo(() => {
    if (!open) return [];
    return getAllOutlineTemplates().filter(
      (t) => t.blueprintId !== blueprintId,
    );
  }, [open, blueprintId]);

  // 保存模板
  const handleSave = useCallback(() => {
    if (!currentOutline || !templateName.trim()) {
      toast.error("请输入模板名称");
      return;
    }

    if (isTemplateNameExists(templateName, blueprintId)) {
      toast.error("模板名称已存在");
      return;
    }

    setIsSaving(true);
    try {
      saveOutlineTemplate(templateName.trim(), blueprintId, currentOutline);
      toast.success("模板保存成功");
      setTemplateName("");
      setActiveTab("load");
    } catch {
      toast.error("保存失败");
    } finally {
      setIsSaving(false);
    }
  }, [currentOutline, templateName, blueprintId]);

  // 加载模板
  const handleLoad = useCallback(
    (template: OutlineTemplate) => {
      onLoadTemplate(template.outline);
      setOpen(false);
      toast.success(`已加载模板「${template.name}」`);
    },
    [onLoadTemplate],
  );

  // 删除模板
  const handleDelete = useCallback((id: string, name: string) => {
    deleteOutlineTemplate(id);
    toast.success(`已删除模板「${name}」`);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("gap-1.5", className)}
        >
          <FolderOpen className="h-4 w-4" />
          模板
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "load" | "save")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="load">加载模板</TabsTrigger>
            <TabsTrigger value="save" disabled={!currentOutline}>
              保存模板
            </TabsTrigger>
          </TabsList>

          {/* 加载模板 */}
          <TabsContent value="load" className="space-y-3 mt-3">
            {templates.length === 0 && allTemplates.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                暂无保存的模板
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-3">
                  {/* 当前模板 */}
                  {templates.length > 0 && (
                    <>
                      <Label className="text-xs text-muted-foreground">
                        当前模板
                      </Label>
                      {templates.map((template) => (
                        <TemplateItem
                          key={template.id}
                          template={template}
                          onLoad={() => handleLoad(template)}
                          onDelete={() =>
                            handleDelete(template.id, template.name)
                          }
                        />
                      ))}
                    </>
                  )}

                  {/* 其他模板 */}
                  {allTemplates.length > 0 && (
                    <>
                      <Label className="text-xs text-muted-foreground mt-3">
                        其他模板
                      </Label>
                      {allTemplates.map((template) => (
                        <TemplateItem
                          key={template.id}
                          template={template}
                          onLoad={() => handleLoad(template)}
                          onDelete={() =>
                            handleDelete(template.id, template.name)
                          }
                          showBlueprintBadge
                        />
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* 保存模板 */}
          <TabsContent value="save" className="space-y-4 mt-3">
            <div className="space-y-2">
              <Label htmlFor="template-name">模板名称</Label>
              <Input
                id="template-name"
                placeholder="输入模板名称..."
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                保存后可在下次使用相同模板时快速加载
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={isSaving || !templateName.trim()}
            >
              <Save className="mr-1.5 h-4 w-4" />
              保存模板
            </Button>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Template Item
// ============================================================

interface TemplateItemProps {
  template: OutlineTemplate;
  onLoad: () => void;
  onDelete: () => void;
  showBlueprintBadge?: boolean;
}

function TemplateItem({
  template,
  onLoad,
  onDelete,
  showBlueprintBadge = false,
}: TemplateItemProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors">
      <button className="flex-1 text-left min-w-0" onClick={onLoad}>
        <div className="font-medium text-sm truncate">{template.name}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{template.outline.nodes.length} 个章节</span>
          {showBlueprintBadge && (
            <Badge variant="outline" className="text-xs">
              {template.blueprintId}
            </Badge>
          )}
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onLoad}>
            <Check className="mr-2 h-4 w-4" />
            使用此模板
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除模板
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default OutlineTemplateManager;
