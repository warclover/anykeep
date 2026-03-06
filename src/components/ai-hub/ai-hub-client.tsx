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
import { Search, Sparkles, Zap, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ALL_SKILLS_METADATA,
  CATEGORY_INFO,
  getSkillsByCategory,
  getSkillsStats,
  type ExtendedSkillMetadata,
} from "@/lib/ai-skills/get-all-skills-metadata";
import type { SkillCategory } from "@/lib/ai-skills/core/types";
import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import {
  AI_HUB,
  SKILL_PAGE_MAP,
  SKILL_TRIGGER_PROMPTS,
  type FilterCategory,
} from "./ai-hub-constants";
import { StatsCard } from "./ai-hub-stats-card";
import { SkillCard } from "./ai-hub-skill-card";
import { SkillDetailSheet } from "./ai-hub-skill-detail-sheet";

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

  // NOTE: Workflow hooks removed - migrated to workflow-lite
  // const { workflows, isLoading: workflowsLoading } = useWorkflowList();
  // const { triggerWorkflow, isLoading: triggerLoading, loadingWorkflowId } = useWorkflowTrigger();

  const stats = getSkillsStats();
  const skillsByCategory = getSkillsByCategory();

  // 过滤 skills
  const filteredSkills = useMemo(() => {
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
              </TabsList>
            </Tabs>
          </div>

          {/* Skills 列表 */}
          {filteredSkills.length === 0 && (
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

          {filteredSkills.length > 0 && (
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
