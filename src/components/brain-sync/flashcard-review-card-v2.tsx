/**
 * Flashcard 复习卡片组件 v2
 *
 * 支持深度问题、思考提示、理解评估的增强版复习界面
 *
 * @version 2.0.0
 * @since 2026-01-01
 */

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  XCircle,
  ExternalLink,
  Clock,
  Archive,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Brain,
  Sparkles,
  BookOpen,
  Microscope,
  Scale,
} from "lucide-react";
import { RelatedBookmarks } from "./related-bookmarks";
import type { QuestionDepth, ComprehensionLevel } from "@/types/brain-sync";

// ============================================
// 类型定义
// ============================================

export interface FlashcardDataV2 {
  flashcardId: number;
  bookmarkId: number;
  bookmarkTitle: string;
  bookmarkUrl: string;
  question: string;
  answer?: string; // v1 兼容
  sourceParagraph?: string;
  status: "pending" | "learning" | "mastered" | "archived";
  daysOverdue: number;
  intervalDays: number;
  easeFactor: number;
  // v2 新增字段
  questionDepth?: QuestionDepth;
  thinkingHint?: string;
  keyPoints?: string[];
}

type ReviewResponse = "mastered" | "fuzzy" | "forgotten" | "archived";

interface FlashcardReviewCardV2Props {
  flashcard: FlashcardDataV2;
  onResponse: (
    flashcardId: number,
    response: ReviewResponse,
    comprehension?: ComprehensionLevel,
    userNote?: string,
  ) => void;
  isSubmitting?: boolean;
  currentIndex?: number;
  totalCount?: number;
  /** 是否显示延伸阅读 */
  showRelatedBookmarks?: boolean;
}

// ============================================
// 常量
// ============================================

const DEPTH_CONFIG: Record<
  QuestionDepth,
  { label: string; icon: React.ReactNode; color: string }
> = {
  understand: {
    label: "理解层",
    icon: <BookOpen className="h-3 w-3" />,
    color: "bg-blue-100 text-blue-700",
  },
  apply: {
    label: "应用层",
    icon: <Microscope className="h-3 w-3" />,
    color: "bg-green-100 text-green-700",
  },
  analyze: {
    label: "分析层",
    icon: <Brain className="h-3 w-3" />,
    color: "bg-purple-100 text-purple-700",
  },
  evaluate: {
    label: "评价层",
    icon: <Scale className="h-3 w-3" />,
    color: "bg-orange-100 text-orange-700",
  },
};

const COMPREHENSION_OPTIONS: Array<{
  value: ComprehensionLevel;
  label: string;
  description: string;
  color: string;
}> = [
  {
    value: "new_insight",
    label: "有新收获",
    description: "这次思考让我有了新的理解",
    color: "bg-green-50 border-green-300 text-green-700",
  },
  {
    value: "reinforced",
    label: "巩固已知",
    description: "加深了原有理解",
    color: "bg-blue-50 border-blue-300 text-blue-700",
  },
  {
    value: "still_confused",
    label: "仍有困惑",
    description: "还需要进一步学习",
    color: "bg-yellow-50 border-yellow-300 text-yellow-700",
  },
  {
    value: "skipped",
    label: "跳过",
    description: "暂时不想思考这个问题",
    color: "bg-gray-50 border-gray-300 text-gray-500",
  },
];

// ============================================
// 组件实现
// ============================================

export function FlashcardReviewCardV2({
  flashcard,
  onResponse,
  isSubmitting = false,
  currentIndex = 0,
  totalCount = 1,
  showRelatedBookmarks = true,
}: FlashcardReviewCardV2Props) {
  // 是否是 v2 卡片（有 questionDepth）
  const isV2Card = !!flashcard.questionDepth;

  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showKeyPoints, setShowKeyPoints] = useState(false);
  const [selectedResponse, setSelectedResponse] =
    useState<ReviewResponse | null>(null);
  const [selectedComprehension, setSelectedComprehension] =
    useState<ComprehensionLevel | null>(null);
  const [userNote, setUserNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleResponse = (response: ReviewResponse) => {
    setSelectedResponse(response);
    // 对于 v2 卡片，等待理解评估后再提交
    if (!isV2Card || response === "archived") {
      onResponse(flashcard.flashcardId, response);
    }
  };

  const handleComprehensionSelect = (level: ComprehensionLevel) => {
    setSelectedComprehension(level);
    // 提交时包含理解评估
    if (selectedResponse) {
      onResponse(
        flashcard.flashcardId,
        selectedResponse,
        level,
        userNote.trim() || undefined,
      );
    }
  };

  const getStatusBadge = () => {
    if (flashcard.daysOverdue > 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          逾期 {flashcard.daysOverdue} 天
        </Badge>
      );
    }
    switch (flashcard.status) {
      case "mastered":
        return (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-700 text-xs"
          >
            已掌握
          </Badge>
        );
      case "learning":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-700 text-xs"
          >
            学习中
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            待学习
          </Badge>
        );
    }
  };

  const depthConfig = flashcard.questionDepth
    ? DEPTH_CONFIG[flashcard.questionDepth]
    : null;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* 进度指示 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          卡片 {currentIndex + 1} / {totalCount}
        </span>
        <div className="flex items-center gap-2">
          {depthConfig && (
            <Badge className={cn("text-xs", depthConfig.color)}>
              {depthConfig.icon}
              <span className="ml-1">{depthConfig.label}</span>
            </Badge>
          )}
          {getStatusBadge()}
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            间隔 {flashcard.intervalDays} 天
          </Badge>
        </div>
      </div>

      {/* 卡片主体 */}
      <Card
        className={cn(
          "cursor-pointer transition-all duration-300 min-h-[300px]",
          "hover:shadow-lg",
          isFlipped && "bg-muted/30",
        )}
        onClick={handleFlip}
      >
        <CardContent className="p-6 flex flex-col h-full">
          {/* 来源标题 */}
          <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
            <span className="truncate max-w-[80%]">
              📖 {flashcard.bookmarkTitle}
            </span>
            <a
              href={flashcard.bookmarkUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline flex items-center gap-1"
            >
              原文
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* 卡片内容 */}
          <div className="flex-1 flex flex-col justify-center">
            {!isFlipped ? (
              // 问题面
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
                  {isV2Card ? "深度问题" : "问题"}
                </div>
                <div className="text-xl font-medium leading-relaxed">
                  {flashcard.question}
                </div>

                {/* v2: 思考提示（可展开） */}
                {isV2Card && flashcard.thinkingHint && (
                  <div className="mt-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHint(!showHint);
                      }}
                      className="text-muted-foreground"
                    >
                      <Lightbulb className="h-4 w-4 mr-1 text-yellow-500" />
                      {showHint ? "收起提示" : "思考方向提示"}
                      {showHint ? (
                        <ChevronUp className="h-4 w-4 ml-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </Button>
                    {showHint && (
                      <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800 text-left">
                        {flashcard.thinkingHint}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 text-sm text-muted-foreground">
                  {isV2Card ? "思考后点击卡片查看参考要点" : "点击卡片查看答案"}
                </div>
              </div>
            ) : (
              // 答案面（v2: 参考要点）
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
                  {isV2Card ? "参考要点" : "答案"}
                </div>

                {isV2Card && flashcard.keyPoints ? (
                  // v2: 要点列表
                  <div className="text-left">
                    <ul className="space-y-2">
                      {flashcard.keyPoints.map((point, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-base leading-relaxed">
                            {point}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  // v1: 直接答案
                  <div className="text-lg leading-relaxed">
                    {flashcard.answer}
                  </div>
                )}

                {/* 原文片段 */}
                {flashcard.sourceParagraph && (
                  <div className="mt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowKeyPoints(!showKeyPoints);
                      }}
                      className="text-muted-foreground"
                    >
                      {showKeyPoints ? "收起原文" : "查看相关原文"}
                      {showKeyPoints ? (
                        <ChevronUp className="h-4 w-4 ml-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </Button>
                    {showKeyPoints && (
                      <div className="mt-3 p-3 bg-muted rounded-lg text-sm text-muted-foreground italic text-left">
                        &ldquo;{flashcard.sourceParagraph}&rdquo;
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 翻转提示 */}
          <div className="flex justify-center pt-4">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <RotateCcw className="h-4 w-4 mr-2" />
              {isFlipped ? "返回问题" : isV2Card ? "查看参考要点" : "查看答案"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 反馈区域（翻转后显示） */}
      {isFlipped && (
        <div className="space-y-4">
          {/* v2: 理解评估（在选择回忆度后显示） */}
          {isV2Card && selectedResponse && selectedResponse !== "archived" && (
            <div className="p-4 border rounded-lg bg-muted/20">
              <div className="text-sm font-medium mb-3 flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                这次思考带给你什么？
              </div>
              <div className="grid grid-cols-2 gap-2">
                {COMPREHENSION_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    className={cn(
                      "h-auto py-2 px-3 justify-start transition-colors",
                      selectedComprehension === option.value && option.color,
                    )}
                    onClick={() => handleComprehensionSelect(option.value)}
                    disabled={isSubmitting}
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium">{option.label}</div>
                      <div className="text-xs opacity-70">
                        {option.description}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>

              {/* 可选：用户笔记 */}
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNoteInput(!showNoteInput)}
                  className="text-muted-foreground"
                >
                  {showNoteInput ? "收起" : "记录我的思考..."}
                </Button>
                {showNoteInput && (
                  <Textarea
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder="记录你对这个问题的思考..."
                    className="mt-2 min-h-[80px]"
                    maxLength={1000}
                  />
                )}
              </div>
            </div>
          )}

          {/* 回忆度反馈按钮 */}
          {(!isV2Card || !selectedResponse) && (
            <>
              <div className="text-center text-sm text-muted-foreground">
                你记住了吗？
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  className={cn(
                    "h-20 flex-col gap-1 transition-colors",
                    "hover:bg-red-50 hover:border-red-300 hover:text-red-700",
                    selectedResponse === "forgotten" &&
                      "bg-red-50 border-red-300 text-red-700",
                  )}
                  onClick={() => handleResponse("forgotten")}
                  disabled={isSubmitting}
                >
                  <XCircle className="h-5 w-5" />
                  <div>
                    <div className="font-medium text-sm">遗忘</div>
                    <div className="text-xs opacity-70">明天复习</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className={cn(
                    "h-20 flex-col gap-1 transition-colors",
                    "hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700",
                    selectedResponse === "fuzzy" &&
                      "bg-yellow-50 border-yellow-300 text-yellow-700",
                  )}
                  onClick={() => handleResponse("fuzzy")}
                  disabled={isSubmitting}
                >
                  <HelpCircle className="h-5 w-5" />
                  <div>
                    <div className="font-medium text-sm">模糊</div>
                    <div className="text-xs opacity-70">需要巩固</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className={cn(
                    "h-20 flex-col gap-1 transition-colors",
                    "hover:bg-green-50 hover:border-green-300 hover:text-green-700",
                    selectedResponse === "mastered" &&
                      "bg-green-50 border-green-300 text-green-700",
                  )}
                  onClick={() => handleResponse("mastered")}
                  disabled={isSubmitting}
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <div>
                    <div className="font-medium text-sm">掌握</div>
                    <div className="text-xs opacity-70">间隔延长</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className={cn(
                    "h-20 flex-col gap-1 transition-colors",
                    "hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700",
                    selectedResponse === "archived" &&
                      "bg-purple-50 border-purple-300 text-purple-700",
                  )}
                  onClick={() => handleResponse("archived")}
                  disabled={isSubmitting}
                >
                  <Archive className="h-5 w-5" />
                  <div>
                    <div className="font-medium text-sm">永久掌握</div>
                    <div className="text-xs opacity-70">不再复习</div>
                  </div>
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 延伸阅读 */}
      {showRelatedBookmarks && isFlipped && (
        <RelatedBookmarks
          bookmarkId={flashcard.bookmarkId}
          defaultExpanded={false}
          className="mt-4"
        />
      )}
    </div>
  );
}
