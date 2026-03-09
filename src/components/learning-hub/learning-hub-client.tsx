/**
 * 学习助手客户端组件
 *
 * 聚合学习相关的 AI Skills：
 * - 阅读计划制定 (reading_planner)
 * - 周期报告生成 (periodic_report)
 * - 相关发现 (related_discovery)
 * - 知识提取 (knowledge_extract)
 * - 分享包创建 (share_bundle)
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

"use client";

import { useState } from "react";
import {
  Calendar,
  FileText,
  Lightbulb,
  Link2,
  Share2,
  Brain,
  ArrowLeft,
  BookMarked,
  Target,
  TrendingUp,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";

// ============================================
// 常量定义
// ============================================

const LEARNING_HUB = {
  TITLE: "学习助手",
  DESCRIPTION: "AI 驱动的学习管理，让知识内化更高效",
  STATS: {
    READING_PROGRESS: "阅读进度",
    REVIEW_TASKS: "待复习",
    THIS_WEEK: "本周新增",
    LEARNING_TIME: "学习时长",
  },
  ACTIONS: {
    START: "开始",
    PLAN: "制定计划",
    GENERATE: "生成报告",
    DISCOVER: "发现",
    CREATE: "创建",
    REVIEW: "复习",
  },
};

// 学习相关 Skills 配置
const LEARNING_SKILLS = [
  {
    id: "reading_planner",
    name: "阅读规划",
    description: "制定每日或每周的阅读计划，合理安排阅读时间",
    icon: Calendar,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
    action: LEARNING_HUB.ACTIONS.PLAN,
    prompt: "帮我制定阅读计划",
  },
  {
    id: "periodic_report",
    name: "周期报告",
    description: "生成周报或月报，总结学习成果和收藏趋势",
    icon: FileText,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    borderColor: "border-purple-200 dark:border-purple-800",
    action: LEARNING_HUB.ACTIONS.GENERATE,
    prompt: "生成我的学习周报",
  },
  {
    id: "knowledge_extract",
    name: "知识提取",
    description: "从收藏中提取关键知识点和概念，形成知识卡片",
    icon: Lightbulb,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-200 dark:border-amber-800",
    action: LEARNING_HUB.ACTIONS.START,
    prompt: "提取我收藏中的关键知识点",
  },
  {
    id: "related_discovery",
    name: "相关发现",
    description: "发现与收藏相关的内容，扩展知识边界",
    icon: Link2,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
    borderColor: "border-cyan-200 dark:border-cyan-800",
    action: LEARNING_HUB.ACTIONS.DISCOVER,
    prompt: "发现与我收藏相关的内容",
  },
  {
    id: "share_bundle",
    name: "分享包",
    description: "打包收藏内容分享给同事或朋友",
    icon: Share2,
    color: "text-pink-600",
    bgColor: "bg-pink-50 dark:bg-pink-900/20",
    borderColor: "border-pink-200 dark:border-pink-800",
    action: LEARNING_HUB.ACTIONS.CREATE,
    prompt: "创建一个分享包",
  },
];

// ============================================
// 子组件
// ============================================

function StatsCard({
  label,
  value,
  unit,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; isUp: boolean };
}) {
  return (
    <Card className="border h-[50px] flex flex-col justify-center !py-0 gap-0">
      <CardContent className="flex items-center gap-1.5 px-2 py-0">
        <div className={cn("p-0.5 rounded shrink-0", color)}>
          <Icon className="size-2.5 text-white" />
        </div>
        <div className="flex items-baseline gap-0.5 min-w-0">
          <span className="text-xl font-bold text-gray-900 dark:text-white leading-none">
            {value}
          </span>
          {unit && <span className="text-sm text-gray-500">{unit}</span>}
          <span className="text-[14px] text-gray-500 dark:text-gray-400 ml-0.5">
            {label}
          </span>
        </div>
        {trend && (
          <Badge
            variant="secondary"
            className={cn(
              "text-[14px] px-1 py-0 h-[18px] ml-auto shrink-0",
              trend.isUp
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
            )}
          >
            {trend.isUp ? "↑" : "↓"} {trend.value}%
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function SkillActionCard({
  skill,
  onAction,
}: {
  skill: (typeof LEARNING_SKILLS)[0];
  onAction: () => void;
}) {
  const Icon = skill.icon;

  return (
    <Card
      className={cn(
        "group transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600",
        skill.borderColor,
      )}
      onClick={onAction}
    >
      <CardHeader className={cn("py-1.5 px-3", skill.bgColor)}>
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-white dark:bg-gray-900 shadow-sm">
            <Icon className={cn("size-4", skill.color)} />
          </div>
          <CardTitle className="text-sm font-semibold">{skill.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-1.5 pb-2 px-3">
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5 line-clamp-2 min-h-[2lh]">
          {skill.description}
        </p>
        <Button
          size="sm"
          className="w-full h-6 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
        >
          {skill.action}
        </Button>
      </CardContent>
    </Card>
  );
}

function LearningHistory() {
  // 模拟学习历程数据
  const history = [
    {
      id: 1,
      date: "2026-01-07",
      action: "生成了「React 性能优化」学习路径",
      detail: "12 个节点",
    },
    {
      id: 2,
      date: "2026-01-05",
      action: "完成本周阅读计划",
      detail: "8/10",
    },
    {
      id: 3,
      date: "2026-01-01",
      action: "生成 12 月学习月报",
      detail: "",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="size-4 text-gray-500" />
          学习历程
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">暂无学习记录</p>
        ) : (
          <ul className="space-y-3">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 text-sm border-l-2 border-gray-200 dark:border-gray-700 pl-3"
              >
                <div className="flex-1">
                  <p className="text-gray-700 dark:text-gray-300">
                    {item.action}
                    {item.detail && (
                      <span className="text-gray-500 ml-2">
                        ({item.detail})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{item.date}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// 主组件
// ============================================

export function LearningHubClient() {
  // AI 对话面板状态
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiInitialMessage, setAiInitialMessage] = useState("");

  // 处理 Skill 操作
  const handleSkillAction = (skill: (typeof LEARNING_SKILLS)[0]) => {
    setAiInitialMessage(skill.prompt);
    setAiPanelOpen(true);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="container mx-auto p-4 lg:p-8 max-w-6xl space-y-8">
          {/* 标题区域：学习助手 + 返回首页（右对齐） */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <BookMarked className="size-8 text-amber-500" />
                {LEARNING_HUB.TITLE}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {LEARNING_HUB.DESCRIPTION}
              </p>
            </div>
            <Link href="/home" className="shrink-0">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                返回首页
              </Button>
            </Link>
          </div>

          {/* 统计概览 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xl h-[50px]">
            <StatsCard
              label={LEARNING_HUB.STATS.READING_PROGRESS}
              value="80"
              unit="%"
              icon={Target}
              color="bg-blue-500"
              trend={{ value: 12, isUp: true }}
            />
            <StatsCard
              label={LEARNING_HUB.STATS.REVIEW_TASKS}
              value="12"
              unit="项"
              icon={Brain}
              color="bg-purple-500"
            />
            <StatsCard
              label={LEARNING_HUB.STATS.THIS_WEEK}
              value="23"
              unit="条"
              icon={TrendingUp}
              color="bg-green-500"
              trend={{ value: 8, isUp: true }}
            />
            <StatsCard
              label={LEARNING_HUB.STATS.LEARNING_TIME}
              value="4.5"
              unit="小时"
              icon={Clock}
              color="bg-amber-500"
            />
          </div>

          {/* 快捷操作 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              快捷操作
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {LEARNING_SKILLS.map((skill) => (
                <SkillActionCard
                  key={skill.id}
                  skill={skill}
                  onAction={() => handleSkillAction(skill)}
                />
              ))}
            </div>
          </div>

          {/* 学习历程 */}
          <LearningHistory />

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
