/**
 * AI 能力中心客户端组件
 *
 * 展示所有 AI Skills 和工作流，支持：
 * - 按分类浏览和搜索
 * - 快捷操作（立即使用/前往页面）
 * - 详情查看
 * - 工作流直接执行
 *
 * @version 1.2.0
 * @since 2026-01-08
 * @updated 2026-01-09 - 添加工作流 Tab
 */

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  ArrowLeft,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ALL_SKILLS_METADATA,
  CATEGORY_INFO,
  getSkillsByCategory,
  getSkillsStats,
  type ExtendedSkillMetadata,
} from "@/lib/ai-skills/get-all-skills-metadata";
import type { SkillCategory } from "@/lib/ai-skills/core/types";
import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { useWorkflowList } from "@/hooks/workflow/use-workflow-list";
import { useWorkflowTrigger } from "@/hooks/workflow/use-workflow-trigger";
import { WorkflowHubCard, WorkflowEmptyState } from "./workflow-hub-card";
import {
  type FilterCategory,
  type WorkflowHubItem,
  workflowToHubItem,
  WORKFLOW_TAB_INFO,
} from "./workflow-hub-types";

// ============================================
// 类型定义（使用 workflow-hub-types 导出的 FilterCategory）
// ============================================

// ============================================
// 常量
// ============================================

const AI_HUB = {
  TITLE: "AI 能力中心",
  DESCRIPTION:
    "探索和使用 AnyKeep 的所有 AI 能力，让智能助手帮你更高效地管理知识",
  SEARCH_PLACEHOLDER: "搜索 AI 能力...",
  FILTER: {
    ALL: "全部",
    UNDERSTANDING: "理解增强",
    ORGANIZING: "整理优化",
    LEARNING: "学习助手",
    UTILITY: "实用工具",
    WORKFLOW: "工作流",
  },
  STATS: {
    TOTAL: "总计",
    ORCHESTRATION: "编排型",
    ATOMIC: "原子型",
    FEATURE_FLAG: "需开关",
    WORKFLOW: "工作流",
  },
  SKILL_CARD: {
    ORCHESTRATION: "编排",
    ATOMIC: "原子",
    REQUIRES_CONFIRM: "需确认",
    DURATION: "预计耗时",
    CAPABILITIES: "能力",
    DELIVERABLES: "交付物",
    OUTPUT_FORMATS: "输出格式",
    FEATURE_FLAG: "Feature Flag",
    USE_NOW: "立即使用",
    GO_TO_PAGE: "前往页面",
    VIEW_DETAILS: "查看详情",
  },
  EMPTY: {
    TITLE: "未找到匹配的 AI 能力",
    DESCRIPTION: "尝试使用不同的搜索词或筛选条件",
  },
};

// Skill 到页面的映射
const SKILL_PAGE_MAP: Record<string, string> = {
  knowledge_review: "/brain-sync",
  active_recall: "/brain-sync",
  thematic_synthesis: "/synthesis",
  data_export: "/export",
  batch_organize: "/batch",
  link_health_check: "/link-health",
  insight_report: "/analytics",
};

// Skill 触发提示词映射
const SKILL_TRIGGER_PROMPTS: Record<string, string> = {
  // 原子 Skills
  search: "帮我搜索书签",
  classify: "帮我分类这些书签",
  summary: "帮我生成书签摘要",
  folder_recommend: "推荐文件夹结构",
  search_optimize: "优化我的搜索词",
  snapshot_compare: "对比书签内容变化",

  // 编排 Skills - 理解增强
  knowledge_review: "帮我复习最近的收藏内容",
  quick_digest: "快速摘要我的收藏",
  knowledge_extract: "提取我收藏中的关键知识点",

  // 编排 Skills - 整理优化
  batch_organize: "智能整理我的书签",
  duplicate_cleanup: "检查并清理重复的书签",
  smart_tagging: "自动为书签添加标签",
  link_health_check: "检查书签链接是否有效",
  data_export: "导出我的书签数据",
  inbox_triage: "整理收件箱里的未分类书签",
  folder_health_check: "检查文件夹健康状态",

  // 编排 Skills - 学习助手
  learning_path: "为我规划一个学习路径",
  reading_planner: "帮我制定阅读计划",
  periodic_report: "生成我的学习周报",
  active_recall: "开始今日复习",
  related_discovery: "发现与我收藏相关的内容",
  share_bundle: "创建一个分享包",
  knowledge_graph_explore: "探索我的知识图谱",

  // 编排 Skills - 实用工具
  insight_report: "生成我的收藏洞察报告",
  tts_synthesis: "朗读这个书签的内容",
  wechat_digest: "生成微信文章摘要",
  bilibili_transcript: "提取 B 站视频字幕",
  inbox_digest: "整理我的收件箱",
  content_change_monitor: "监控这个页面的内容变化",
  thematic_synthesis: "合成一个主题报告",
};

// ============================================
// 辅助函数
// ============================================

function formatDuration(ms?: number): string {
  if (!ms) return "未知";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function getCategoryStyle(category: SkillCategory): {
  bg: string;
  text: string;
  border: string;
} {
  const styles: Record<
    SkillCategory,
    { bg: string; text: string; border: string }
  > = {
    understanding: {
      bg: "bg-purple-50 dark:bg-purple-900/20",
      text: "text-purple-600 dark:text-purple-400",
      border: "border-purple-200 dark:border-purple-800",
    },
    organizing: {
      bg: "bg-cyan-50 dark:bg-cyan-900/20",
      text: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-200 dark:border-cyan-800",
    },
    learning: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800",
    },
    utility: {
      bg: "bg-slate-50 dark:bg-slate-900/20",
      text: "text-slate-600 dark:text-slate-400",
      border: "border-slate-200 dark:border-slate-800",
    },
  };
  return styles[category];
}

// ============================================
// 子组件
// ============================================

function StatsCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border",
        "bg-white dark:bg-gray-900",
      )}
    >
      <div className={cn("p-2 rounded-lg", color)}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  onClick,
  onUseNow,
  onGoToPage,
}: {
  skill: ExtendedSkillMetadata;
  onClick: () => void;
  onUseNow: () => void;
  onGoToPage?: () => void;
}) {
  const categoryInfo = CATEGORY_INFO[skill.category];
  const categoryStyle = getCategoryStyle(skill.category);
  const hasPage = SKILL_PAGE_MAP[skill.id];

  return (
    <Card
      className={cn(
        "group transition-all duration-200",
        "hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600",
        "border",
        categoryStyle.border,
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={onClick}
          >
            <span className="text-xl">{categoryInfo.icon}</span>
            <CardTitle className="text-base font-semibold hover:text-primary transition-colors">
              {skill.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {skill.isOrchestration ? (
              <Badge
                variant="secondary"
                className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
              >
                <Sparkles className="size-3 mr-1" />
                {AI_HUB.SKILL_CARD.ORCHESTRATION}
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
              >
                <Zap className="size-3 mr-1" />
                {AI_HUB.SKILL_CARD.ATOMIC}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p
          className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 cursor-pointer"
          onClick={onClick}
        >
          {skill.description}
        </p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(skill.estimatedDurationMs)}
          </span>
          {skill.requiresConfirmation && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertCircle className="size-3" />
              {AI_HUB.SKILL_CARD.REQUIRES_CONFIRM}
            </span>
          )}
          {skill.featureFlag && (
            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
              <CheckCircle2 className="size-3" />
              Flag
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {skill.capabilities.slice(0, 3).map((cap) => (
            <Badge
              key={cap}
              variant="outline"
              className={cn("text-xs", categoryStyle.text, categoryStyle.bg)}
            >
              {cap}
            </Badge>
          ))}
          {skill.capabilities.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{skill.capabilities.length - 3}
            </Badge>
          )}
        </div>

        {/* 快捷操作按钮 */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="default"
            className="flex-1 gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onUseNow();
            }}
          >
            <MessageCircle className="size-3" />
            {AI_HUB.SKILL_CARD.USE_NOW}
          </Button>
          {hasPage && onGoToPage && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onGoToPage();
              }}
            >
              <ExternalLink className="size-3" />
              {AI_HUB.SKILL_CARD.GO_TO_PAGE}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SkillDetailSheet({
  skill,
  open,
  onClose,
  onUseNow,
  onGoToPage,
}: {
  skill: ExtendedSkillMetadata | null;
  open: boolean;
  onClose: () => void;
  onUseNow: () => void;
  onGoToPage?: () => void;
}) {
  if (!skill) return null;

  const categoryInfo = CATEGORY_INFO[skill.category];
  const categoryStyle = getCategoryStyle(skill.category);
  const hasPage = SKILL_PAGE_MAP[skill.id];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{categoryInfo.icon}</span>
            <div>
              <SheetTitle className="text-xl">{skill.name}</SheetTitle>
              <SheetDescription className="text-sm">
                {skill.id} · v{skill.version}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* 快捷操作 */}
          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={onUseNow}>
              <MessageCircle className="size-4" />
              {AI_HUB.SKILL_CARD.USE_NOW}
            </Button>
            {hasPage && onGoToPage && (
              <Button variant="outline" className="gap-2" onClick={onGoToPage}>
                <ExternalLink className="size-4" />
                {AI_HUB.SKILL_CARD.GO_TO_PAGE}
              </Button>
            )}
          </div>

          {/* 类型和分类 */}
          <div className="flex flex-wrap gap-2">
            {skill.isOrchestration ? (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                <Sparkles className="size-3 mr-1" />
                {AI_HUB.SKILL_CARD.ORCHESTRATION}型 Skill
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                <Zap className="size-3 mr-1" />
                {AI_HUB.SKILL_CARD.ATOMIC}型 Skill
              </Badge>
            )}
            <Badge className={cn(categoryStyle.bg, categoryStyle.text)}>
              {categoryInfo.name}
            </Badge>
            {skill.requiresConfirmation && (
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-300"
              >
                <AlertCircle className="size-3 mr-1" />
                {AI_HUB.SKILL_CARD.REQUIRES_CONFIRM}
              </Badge>
            )}
          </div>

          {/* 描述 */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              描述
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {skill.description}
            </p>
          </div>

          {/* 能力 */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              {AI_HUB.SKILL_CARD.CAPABILITIES}
            </h4>
            <div className="flex flex-wrap gap-2">
              {skill.capabilities.map((cap) => (
                <Badge
                  key={cap}
                  variant="outline"
                  className={cn(categoryStyle.bg, categoryStyle.text)}
                >
                  {cap}
                </Badge>
              ))}
            </div>
          </div>

          {/* 交付物 */}
          {skill.deliverableTypes && skill.deliverableTypes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                {AI_HUB.SKILL_CARD.DELIVERABLES}
              </h4>
              <ul className="space-y-1">
                {skill.deliverableTypes.map((d: string, i: number) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <CheckCircle2 className="size-4 text-green-500" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 输出格式 */}
          {skill.outputFormats && skill.outputFormats.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                {AI_HUB.SKILL_CARD.OUTPUT_FORMATS}
              </h4>
              <div className="flex flex-wrap gap-2">
                {skill.outputFormats.map((format) => (
                  <Badge key={format} variant="secondary" className="text-xs">
                    {format}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Feature Flag */}
          {skill.featureFlag && (
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                {AI_HUB.SKILL_CARD.FEATURE_FLAG}
              </h4>
              <code className="text-xs bg-purple-100 dark:bg-purple-800 px-2 py-1 rounded">
                {skill.featureFlag}
              </code>
            </div>
          )}

          {/* 预计耗时 */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Clock className="size-4" />
            {AI_HUB.SKILL_CARD.DURATION}:{" "}
            {formatDuration(skill.estimatedDurationMs)}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// 主组件
// ============================================

export function AIHubClient() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");
  const [selectedSkill, setSelectedSkill] =
    useState<ExtendedSkillMetadata | null>(null);

  // AI 对话面板状态
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiInitialMessage, setAiInitialMessage] = useState("");

  // 工作流数据
  const { workflows, isLoading: workflowsLoading } = useWorkflowList();
  const {
    triggerWorkflow,
    isLoading: triggerLoading,
    loadingWorkflowId,
  } = useWorkflowTrigger();

  const stats = getSkillsStats();
  const skillsByCategory = getSkillsByCategory();

  // 转换工作流为 Hub 展示格式
  const workflowHubItems: WorkflowHubItem[] = useMemo(() => {
    return workflows.map(workflowToHubItem);
  }, [workflows]);

  // 过滤工作流
  const filteredWorkflows = useMemo(() => {
    if (!searchQuery.trim()) return workflowHubItems;

    const query = searchQuery.toLowerCase();
    return workflowHubItems.filter(
      (workflow) =>
        workflow.name.toLowerCase().includes(query) ||
        workflow.description.toLowerCase().includes(query),
    );
  }, [workflowHubItems, searchQuery]);

  // 过滤 skills（排除 workflow tab）
  const filteredSkills = useMemo(() => {
    // workflow tab 不显示 skills
    if (filterCategory === "workflow") {
      return [];
    }

    let skills = ALL_SKILLS_METADATA;

    // 按分类过滤
    if (filterCategory !== "all") {
      skills = skillsByCategory[filterCategory] || [];
    }

    // 按搜索词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      skills = skills.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query) ||
          skill.capabilities.some((cap) => cap.toLowerCase().includes(query)),
      );
    }

    return skills;
  }, [filterCategory, searchQuery, skillsByCategory]);

  // 按分类分组
  const groupedSkills = useMemo(() => {
    // workflow tab 不需要分组 skills
    if (filterCategory === "workflow") {
      return {};
    }

    if (filterCategory !== "all") {
      return { [filterCategory]: filteredSkills };
    }

    const groups: Record<SkillCategory, ExtendedSkillMetadata[]> = {
      understanding: [],
      organizing: [],
      learning: [],
      utility: [],
    };

    filteredSkills.forEach((skill) => {
      groups[skill.category].push(skill);
    });

    return groups;
  }, [filteredSkills, filterCategory]);

  // 处理工作流执行
  const handleWorkflowExecute = async (workflowId: string) => {
    await triggerWorkflow(workflowId);
  };

  // 处理立即使用
  const handleUseNow = (skill: ExtendedSkillMetadata) => {
    // 获取对应的触发提示词
    const prompt = SKILL_TRIGGER_PROMPTS[skill.id] || `使用 ${skill.name}`;
    setAiInitialMessage(prompt);
    setAiPanelOpen(true);
    // 关闭详情面板
    setSelectedSkill(null);
  };

  // 处理前往页面
  const handleGoToPage = (skill: ExtendedSkillMetadata) => {
    const page = SKILL_PAGE_MAP[skill.id];
    if (page) {
      router.push(page);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="container mx-auto p-4 lg:p-8 max-w-7xl space-y-8">
          {/* 标题区域 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/home">
                <Button variant="ghost" size="sm" className="gap-1">
                  <ArrowLeft className="h-4 w-4" />
                  返回首页
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Zap className="size-8 text-yellow-500" />
              {AI_HUB.TITLE}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {AI_HUB.DESCRIPTION}
            </p>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              label={AI_HUB.STATS.TOTAL}
              value={stats.total}
              icon={<Sparkles className="size-5 text-blue-600" />}
              color="bg-blue-100 dark:bg-blue-900/30"
            />
            <StatsCard
              label={AI_HUB.STATS.ORCHESTRATION}
              value={stats.orchestration}
              icon={<Sparkles className="size-5 text-purple-600" />}
              color="bg-purple-100 dark:bg-purple-900/30"
            />
            <StatsCard
              label={AI_HUB.STATS.ATOMIC}
              value={stats.atomic}
              icon={<Zap className="size-5 text-green-600" />}
              color="bg-green-100 dark:bg-green-900/30"
            />
            <StatsCard
              label={AI_HUB.STATS.WORKFLOW}
              value={workflows.length}
              icon={<Workflow className="size-5 text-amber-600" />}
              color="bg-amber-100 dark:bg-amber-900/30"
            />
          </div>

          {/* 搜索和筛选 */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder={AI_HUB.SEARCH_PLACEHOLDER}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs
              value={filterCategory}
              onValueChange={(v) => setFilterCategory(v as FilterCategory)}
            >
              <TabsList>
                <TabsTrigger value="all">{AI_HUB.FILTER.ALL}</TabsTrigger>
                <TabsTrigger value="understanding">
                  {AI_HUB.FILTER.UNDERSTANDING}
                </TabsTrigger>
                <TabsTrigger value="organizing">
                  {AI_HUB.FILTER.ORGANIZING}
                </TabsTrigger>
                <TabsTrigger value="learning">
                  {AI_HUB.FILTER.LEARNING}
                </TabsTrigger>
                <TabsTrigger value="utility">
                  {AI_HUB.FILTER.UTILITY}
                </TabsTrigger>
                <TabsTrigger value="workflow">
                  {AI_HUB.FILTER.WORKFLOW}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* 工作流列表（仅在 workflow tab 显示） */}
          {filterCategory === "workflow" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{WORKFLOW_TAB_INFO.icon}</span>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {WORKFLOW_TAB_INFO.name}
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {filteredWorkflows.length}
                </Badge>
              </div>
              {workflowsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-pulse">
                    <Workflow className="size-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">加载工作流中...</p>
                  </div>
                </div>
              ) : filteredWorkflows.length === 0 ? (
                <WorkflowEmptyState searchQuery={searchQuery} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredWorkflows.map((workflow) => (
                    <WorkflowHubCard
                      key={workflow.id}
                      workflow={workflow}
                      onExecute={handleWorkflowExecute}
                      isExecuting={
                        triggerLoading && loadingWorkflowId === workflow.id
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Skills 列表（非 workflow tab 显示） */}
          {filterCategory !== "workflow" && filteredSkills.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="size-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {AI_HUB.EMPTY.TITLE}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {AI_HUB.EMPTY.DESCRIPTION}
              </p>
            </div>
          )}

          {filterCategory !== "workflow" && filteredSkills.length > 0 && (
            <div className="space-y-8">
              {(
                Object.entries(groupedSkills) as [
                  SkillCategory,
                  ExtendedSkillMetadata[],
                ][]
              )
                .filter(([, skills]) => skills.length > 0)
                .map(([category, skills]) => (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">
                        {CATEGORY_INFO[category].icon}
                      </span>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {CATEGORY_INFO[category].name}
                      </h2>
                      <Badge variant="secondary" className="text-xs">
                        {skills.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {skills.map((skill) => (
                        <SkillCard
                          key={skill.id}
                          skill={skill}
                          onClick={() => setSelectedSkill(skill)}
                          onUseNow={() => handleUseNow(skill)}
                          onGoToPage={
                            SKILL_PAGE_MAP[skill.id]
                              ? () => handleGoToPage(skill)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* 详情面板 */}
          <SkillDetailSheet
            skill={selectedSkill}
            open={!!selectedSkill}
            onClose={() => setSelectedSkill(null)}
            onUseNow={() => {
              if (selectedSkill) {
                handleUseNow(selectedSkill);
              }
            }}
            onGoToPage={
              selectedSkill && SKILL_PAGE_MAP[selectedSkill.id]
                ? () => handleGoToPage(selectedSkill)
                : undefined
            }
          />

          {/* AI 对话面板 */}
          <AIAssistantPanel
            open={aiPanelOpen}
            onOpenChange={setAiPanelOpen}
            initialMessage={aiInitialMessage}
            autoSendInitialMessage={false}
          />
        </div>
      </div>
    </div>
  );
}
