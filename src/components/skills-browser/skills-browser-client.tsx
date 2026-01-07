/**
 * Skills 浏览器客户端组件
 *
 * 展示所有 AI Skills，按分类组织
 * 支持搜索、筛选和详情查看
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Sparkles,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Filter,
} from "lucide-react";
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

// ============================================
// 类型定义
// ============================================

type FilterCategory = SkillCategory | "all";

// ============================================
// 常量
// ============================================

const SKILLS_BROWSER = {
  TITLE: "Skills 浏览器",
  DESCRIPTION: "探索 AnyKeep 的所有 AI 能力，了解每个 Skill 的功能和使用方式",
  SEARCH_PLACEHOLDER: "搜索 Skill 名称、描述或能力...",
  FILTER: {
    ALL: "全部",
    UNDERSTANDING: "理解增强",
    ORGANIZING: "整理优化",
    LEARNING: "学习助手",
    UTILITY: "实用工具",
  },
  STATS: {
    TOTAL: "总计",
    ORCHESTRATION: "编排型",
    ATOMIC: "原子型",
    FEATURE_FLAG: "需开关",
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
    VERSION: "版本",
    AUTHOR: "作者",
    VIEW_DETAILS: "查看详情",
  },
  EMPTY: {
    TITLE: "未找到匹配的 Skill",
    DESCRIPTION: "尝试使用不同的搜索词或筛选条件",
  },
};

// ============================================
// 辅助函数
// ============================================

/**
 * 格式化预计耗时
 */
function formatDuration(ms?: number): string {
  if (!ms) return "未知";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

/**
 * 获取分类样式
 */
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

/**
 * 统计卡片组件
 */
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

/**
 * Skill 卡片组件
 */
function SkillCard({
  skill,
  onClick,
}: {
  skill: ExtendedSkillMetadata;
  onClick: () => void;
}) {
  const categoryInfo = CATEGORY_INFO[skill.category];
  const categoryStyle = getCategoryStyle(skill.category);

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-200",
        "hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600",
        "border",
        categoryStyle.border,
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{categoryInfo.icon}</span>
            <CardTitle className="text-base font-semibold">
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
                {SKILLS_BROWSER.SKILL_CARD.ORCHESTRATION}
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
              >
                <Zap className="size-3 mr-1" />
                {SKILLS_BROWSER.SKILL_CARD.ATOMIC}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
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
              {SKILLS_BROWSER.SKILL_CARD.REQUIRES_CONFIRM}
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

        <div className="flex items-center justify-end pt-2">
          <span className="text-xs text-gray-400 group-hover:text-primary transition-colors flex items-center gap-1">
            {SKILLS_BROWSER.SKILL_CARD.VIEW_DETAILS}
            <ChevronRight className="size-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skill 详情面板
 */
function SkillDetailSheet({
  skill,
  open,
  onClose,
}: {
  skill: ExtendedSkillMetadata | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!skill) return null;

  const categoryInfo = CATEGORY_INFO[skill.category];
  const categoryStyle = getCategoryStyle(skill.category);

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
          {/* 类型和分类 */}
          <div className="flex flex-wrap gap-2">
            {skill.isOrchestration ? (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                <Sparkles className="size-3 mr-1" />
                {SKILLS_BROWSER.SKILL_CARD.ORCHESTRATION}型 Skill
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                <Zap className="size-3 mr-1" />
                {SKILLS_BROWSER.SKILL_CARD.ATOMIC}型 Skill
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
                {SKILLS_BROWSER.SKILL_CARD.REQUIRES_CONFIRM}
              </Badge>
            )}
          </div>

          {/* 描述 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              描述
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {skill.description}
            </p>
          </div>

          {/* 能力 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {SKILLS_BROWSER.SKILL_CARD.CAPABILITIES}
            </h4>
            <div className="flex flex-wrap gap-2">
              {skill.capabilities.map((cap) => (
                <Badge
                  key={cap}
                  variant="outline"
                  className={cn(
                    "text-xs",
                    categoryStyle.text,
                    categoryStyle.bg,
                  )}
                >
                  {cap}
                </Badge>
              ))}
            </div>
          </div>

          {/* 交付物类型（仅编排型） */}
          {skill.isOrchestration && skill.deliverableTypes && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {SKILLS_BROWSER.SKILL_CARD.DELIVERABLES}
              </h4>
              <div className="flex flex-wrap gap-2">
                {skill.deliverableTypes.map((type) => (
                  <Badge key={type} variant="secondary" className="text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 输出格式（仅编排型） */}
          {skill.isOrchestration && skill.outputFormats && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {SKILLS_BROWSER.SKILL_CARD.OUTPUT_FORMATS}
              </h4>
              <div className="flex flex-wrap gap-2">
                {skill.outputFormats.map((format) => (
                  <Badge key={format} variant="outline" className="text-xs">
                    {format}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 技术信息 */}
          <div className="border-t pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  {SKILLS_BROWSER.SKILL_CARD.DURATION}
                </span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDuration(skill.estimatedDurationMs)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  {SKILLS_BROWSER.SKILL_CARD.VERSION}
                </span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {skill.version}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  {SKILLS_BROWSER.SKILL_CARD.AUTHOR}
                </span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {skill.author}
                </p>
              </div>
              {skill.featureFlag && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    {SKILLS_BROWSER.SKILL_CARD.FEATURE_FLAG}
                  </span>
                  <p className="font-mono text-xs text-purple-600 dark:text-purple-400">
                    {skill.featureFlag}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// 主组件
// ============================================

export function SkillsBrowserClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");
  const [selectedSkill, setSelectedSkill] =
    useState<ExtendedSkillMetadata | null>(null);

  // 获取统计数据
  const stats = useMemo(() => getSkillsStats(), []);

  // 获取按分类组织的 Skills
  const skillsByCategory = useMemo(() => getSkillsByCategory(), []);

  // 筛选 Skills
  const filteredSkills = useMemo(() => {
    let skills =
      filterCategory === "all"
        ? ALL_SKILLS_METADATA
        : skillsByCategory[filterCategory];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      skills = skills.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query) ||
          skill.id.toLowerCase().includes(query) ||
          skill.capabilities.some((cap) => cap.toLowerCase().includes(query)),
      );
    }

    return skills;
  }, [filterCategory, searchQuery, skillsByCategory]);

  // 按分类分组筛选后的 Skills
  const groupedFilteredSkills = useMemo(() => {
    if (filterCategory !== "all") {
      return { [filterCategory]: filteredSkills };
    }

    const grouped: Partial<Record<SkillCategory, ExtendedSkillMetadata[]>> = {};
    for (const skill of filteredSkills) {
      const category = skill.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(skill);
    }
    return grouped;
  }, [filterCategory, filteredSkills]);

  const categoryOrder: SkillCategory[] = [
    "understanding",
    "organizing",
    "learning",
    "utility",
  ];

  return (
    <div className="container mx-auto p-4 lg:p-8 max-w-7xl space-y-8">
      {/* 页面标题 */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Sparkles className="size-8 text-primary" />
          {SKILLS_BROWSER.TITLE}
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          {SKILLS_BROWSER.DESCRIPTION}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label={SKILLS_BROWSER.STATS.TOTAL}
          value={stats.total}
          icon={<Sparkles className="size-5 text-primary" />}
          color="bg-primary/10"
        />
        <StatsCard
          label={SKILLS_BROWSER.STATS.ORCHESTRATION}
          value={stats.orchestration}
          icon={<Sparkles className="size-5 text-blue-600" />}
          color="bg-blue-100 dark:bg-blue-900/30"
        />
        <StatsCard
          label={SKILLS_BROWSER.STATS.ATOMIC}
          value={stats.atomic}
          icon={<Zap className="size-5 text-green-600" />}
          color="bg-green-100 dark:bg-green-900/30"
        />
        <StatsCard
          label={SKILLS_BROWSER.STATS.FEATURE_FLAG}
          value={stats.withFeatureFlag}
          icon={<CheckCircle2 className="size-5 text-purple-600" />}
          color="bg-purple-100 dark:bg-purple-900/30"
        />
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder={SKILLS_BROWSER.SEARCH_PLACEHOLDER}
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
            <TabsTrigger value="all" className="flex items-center gap-1">
              <Filter className="size-3" />
              {SKILLS_BROWSER.FILTER.ALL}
            </TabsTrigger>
            <TabsTrigger value="understanding">
              🧠 {SKILLS_BROWSER.FILTER.UNDERSTANDING}
            </TabsTrigger>
            <TabsTrigger value="organizing">
              📁 {SKILLS_BROWSER.FILTER.ORGANIZING}
            </TabsTrigger>
            <TabsTrigger value="learning">
              📚 {SKILLS_BROWSER.FILTER.LEARNING}
            </TabsTrigger>
            <TabsTrigger value="utility">
              🔧 {SKILLS_BROWSER.FILTER.UTILITY}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Skills 列表 */}
      {filteredSkills.length === 0 ? (
        <div className="text-center py-16">
          <Search className="size-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {SKILLS_BROWSER.EMPTY.TITLE}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {SKILLS_BROWSER.EMPTY.DESCRIPTION}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSearchQuery("");
              setFilterCategory("all");
            }}
          >
            清除筛选条件
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {categoryOrder.map((category) => {
            const skills = groupedFilteredSkills[category];
            if (!skills || skills.length === 0) return null;

            const categoryInfo = CATEGORY_INFO[category];
            const categoryStyle = getCategoryStyle(category);

            return (
              <div key={category}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{categoryInfo.icon}</span>
                  <div>
                    <h2
                      className={cn(
                        "text-lg font-semibold",
                        categoryStyle.text,
                      )}
                    >
                      {categoryInfo.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {categoryInfo.description}
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-auto">
                    {skills.length} 个
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {skills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onClick={() => setSelectedSkill(skill)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Skill 详情面板 */}
      <SkillDetailSheet
        skill={selectedSkill}
        open={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
      />
    </div>
  );
}
