"use client";

/**
 * Knowledge Studio - 模板管理客户端组件
 * @description P4 实现 - 自定义模板 CRUD 真实数据
 */

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  FileText,
  Settings,
  Share2,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Eye,
  Search,
  RefreshCw,
  Globe,
  Lock,
  Users,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================================
// 类型定义
// ============================================================================

interface TemplateVariable {
  name: string;
  type: "text" | "number" | "select" | "multiselect" | "boolean";
  label: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
}

interface TemplatePromptSection {
  id: string;
  name: string;
  content: string;
  order: number;
  required?: boolean;
}

interface Template {
  id: string;
  user_id: string;
  name: string;
  description: string;
  icon?: string;
  base_blueprint?: string;
  variables: TemplateVariable[];
  prompt_sections: TemplatePromptSection[];
  output_format?: string;
  visibility: "private" | "shared" | "public";
  status: "draft" | "active" | "archived";
  version: number;
  usage_count: number;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 辅助函数
// ============================================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getVisibilityIcon(visibility: string) {
  switch (visibility) {
    case "public":
      return <Globe className="h-4 w-4" />;
    case "shared":
      return <Users className="h-4 w-4" />;
    default:
      return <Lock className="h-4 w-4" />;
  }
}

function getStatusBadge(status: string) {
  const statusMap: Record<
    string,
    { label: string; variant: "default" | "secondary" | "outline" }
  > = {
    draft: { label: "草稿", variant: "outline" },
    active: { label: "已发布", variant: "default" },
    archived: { label: "已归档", variant: "secondary" },
  };
  const config = statusMap[status] || {
    label: status,
    variant: "outline" as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ============================================================================
// 模板卡片组件
// ============================================================================

interface TemplateCardProps {
  template: Template;
  onEdit: (template: Template) => void;
  onClone: (template: Template) => void;
  onDelete: (template: Template) => void;
  isOwner: boolean;
}

function TemplateCard({
  template,
  onEdit,
  onClone,
  onDelete,
  isOwner,
}: TemplateCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-2xl">{template.icon || "📄"}</span>
            {template.name}
          </CardTitle>
          <CardDescription className="line-clamp-2">
            {template.description || "暂无描述"}
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(template)}>
              <Eye className="h-4 w-4 mr-2" />
              查看详情
            </DropdownMenuItem>
            {isOwner && (
              <DropdownMenuItem onClick={() => onEdit(template)}>
                <Edit className="h-4 w-4 mr-2" />
                编辑模板
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onClone(template)}>
              <Copy className="h-4 w-4 mr-2" />
              复制模板
            </DropdownMenuItem>
            {isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(template)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除模板
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="flex flex-wrap gap-2">
          {getStatusBadge(template.status)}
          <Badge variant="outline" className="flex items-center gap-1">
            {getVisibilityIcon(template.visibility)}
            {template.visibility === "public"
              ? "公开"
              : template.visibility === "shared"
                ? "分享"
                : "私有"}
          </Badge>
          <Badge variant="secondary">v{template.version}</Badge>
        </div>
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{template.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground border-t pt-4">
        <div className="flex justify-between w-full">
          <span>使用 {template.usage_count} 次</span>
          <span>更新于 {formatDate(template.updated_at)}</span>
        </div>
      </CardFooter>
    </Card>
  );
}

// ============================================================================
// 创建模板对话框
// ============================================================================

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateTemplateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "shared" | "public">(
    "private",
  );

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("请输入模板名称");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/knowledge-studio/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          visibility,
          variables: [],
          promptSections: [],
        }),
      });

      const json = await res.json();
      if (res.ok) {
        toast.success("模板创建成功");
        onOpenChange(false);
        setName("");
        setDescription("");
        setVisibility("private");
        onCreated();
      } else {
        toast.error(json.error?.message || "创建失败");
      }
    } catch {
      toast.error("创建失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建模板</DialogTitle>
          <DialogDescription>
            创建一个新的自定义模板，您可以稍后编辑变量和 Prompt
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">模板名称</Label>
            <Input
              id="name"
              placeholder="输入模板名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              placeholder="描述模板的用途"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="visibility">可见性</Label>
            <Select
              value={visibility}
              onValueChange={(v) => setVisibility(v as typeof visibility)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    私有 - 仅自己可见
                  </div>
                </SelectItem>
                <SelectItem value="shared">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    分享 - 通过链接分享
                  </div>
                </SelectItem>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    公开 - 所有人可见
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "创建中..." : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// 主页面组件
// ============================================================================

export function TemplatesPageClient() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // 获取模板列表
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/knowledge-studio/templates?${params}`);
      const json = await res.json();

      if (res.ok) {
        setTemplates(json.data || []);
        // 从第一个模板获取 userId
        if (json.data?.[0]?.user_id) {
          setUserId(json.data[0].user_id);
        }
      } else {
        setTemplates([]);
      }
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // 克隆模板
  const handleClone = async (template: Template) => {
    try {
      const res = await fetch(
        `/api/knowledge-studio/templates/${template.id}/clone`,
        {
          method: "POST",
        },
      );

      if (res.ok) {
        toast.success("模板复制成功");
        fetchTemplates();
      } else {
        const json = await res.json();
        toast.error(json.error?.message || "复制失败");
      }
    } catch {
      toast.error("复制失败");
    }
  };

  // 删除模板
  const handleDelete = async (template: Template) => {
    if (!confirm(`确定要删除模板「${template.name}」吗？此操作不可撤销。`)) {
      return;
    }

    try {
      const res = await fetch(
        `/api/knowledge-studio/templates/${template.id}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        toast.success("模板已删除");
        fetchTemplates();
      } else {
        const json = await res.json();
        toast.error(json.error?.message || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  // 编辑模板（简化版，仅显示 toast）
  const handleEdit = (template: Template) => {
    toast.info(`编辑模板: ${template.name} - 完整编辑器开发中...`);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">模板管理</h1>
          <p className="text-muted-foreground">
            创建和管理自定义草稿模板，定制专属的知识生成流程
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新建模板
        </Button>
      </div>

      {/* 功能预览卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">自定义变量</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              支持文本、数字、下拉选择等多种变量类型，灵活定制 Prompt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">版本管理</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              自动保存版本历史，支持回滚到任意历史版本
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">模板分享</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              分享模板给好友，发现社区优质公开模板
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索模板..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="状态筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="active">已发布</SelectItem>
            <SelectItem value="archived">已归档</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchTemplates} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* 模板列表 */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-20" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-4 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium">加载失败</h3>
            <p className="text-muted-foreground mt-2">{error}</p>
          </CardContent>
        </Card>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">暂无模板</h3>
            <p className="text-muted-foreground mt-2">
              点击「新建模板」创建您的第一个自定义模板
            </p>
            <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新建模板
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={handleEdit}
              onClone={handleClone}
              onDelete={handleDelete}
              isOwner={template.user_id === userId}
            />
          ))}
        </div>
      )}

      {/* 创建模板对话框 */}
      <CreateTemplateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={fetchTemplates}
      />
    </div>
  );
}
