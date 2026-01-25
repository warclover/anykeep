/**
 * 智能分类 v5.0 - L0 规则匹配器
 *
 * 基于规则的快速匹配（URL域名、关键词、标签）
 * v5.1: 新增 AI 标签优先匹配（Phase 0）
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type { FolderId } from "@/lib/shared/types";
import type { ClassificationRequest, L0MatchResult } from "./types";
import { AiTagMatcher } from "./ai-tag-matcher";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";

/**
 * 规则定义
 */
export interface Rule {
  /** 规则名称 */
  name: string;
  /** 目标文件夹ID */
  folderId: FolderId;
  /** URL域名匹配 */
  urlDomains?: string[];
  /** 标题关键词匹配 */
  titleKeywords?: string[];
  /** 标签匹配 */
  tags?: string[];
  /** 置信度 */
  confidence: number;
}

/**
 * L0 规则匹配器类
 */
export class L0RuleMatcher {
  private logger: LoggerService;
  private rules: Rule[];
  private aiTagMatcher: AiTagMatcher | null = null;

  constructor(
    logger: LoggerService,
    rules: Rule[] = [],
    supabase?: SupabaseClient,
  ) {
    this.logger = logger.child({ service: "L0RuleMatcher" });
    this.rules = rules;

    // 初始化 AI 标签匹配器
    if (supabase && FeatureFlags.ENABLE_AI_TAG_MATCHER) {
      this.aiTagMatcher = new AiTagMatcher(supabase);
      this.logger.debug("AI 标签匹配器已启用");
    }
  }

  /**
   * 匹配规则
   */
  async match(request: ClassificationRequest): Promise<L0MatchResult> {
    this.logger.debug("开始L0规则匹配", {
      bookmarkId: request.bookmarkId,
      ruleCount: this.rules.length,
      hasAiTagMatcher: !!this.aiTagMatcher,
    });

    // 【新增】Phase 0: AI 标签匹配（最高优先级）
    if (this.aiTagMatcher && request.tags?.length) {
      try {
        const tagMatch = await this.aiTagMatcher.match(request);
        if (tagMatch) {
          this.logger.info("AI标签匹配成功", {
            folderId: tagMatch.folderId,
            matchType: tagMatch.matchType,
            confidence: tagMatch.confidence,
          });

          return {
            matched: true,
            folderId: tagMatch.folderId,
            ruleName: `ai_tag:${tagMatch.matchType}`,
            confidence: tagMatch.confidence,
          };
        }
      } catch (err) {
        this.logger.warn("AI 标签匹配出错，继续规则匹配", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Phase 1: 用户自定义规则匹配（现有逻辑）
    for (const rule of this.rules) {
      if (this.matchRule(request, rule)) {
        this.logger.info("L0规则匹配成功", {
          ruleName: rule.name,
          folderId: rule.folderId,
        });

        return {
          matched: true,
          folderId: rule.folderId,
          ruleName: rule.name,
          confidence: rule.confidence,
        };
      }
    }

    // 无匹配规则
    return {
      matched: false,
    };
  }

  /**
   * 同步匹配方法（兼容现有调用）
   * @deprecated 使用异步 match() 方法
   */
  matchSync(request: ClassificationRequest): L0MatchResult {
    this.logger.debug("开始L0规则匹配（同步）", {
      bookmarkId: request.bookmarkId,
      ruleCount: this.rules.length,
    });

    // 遍历所有规则
    for (const rule of this.rules) {
      if (this.matchRule(request, rule)) {
        this.logger.info("L0规则匹配成功", {
          ruleName: rule.name,
          folderId: rule.folderId,
        });

        return {
          matched: true,
          folderId: rule.folderId,
          ruleName: rule.name,
          confidence: rule.confidence,
        };
      }
    }

    // 无匹配规则
    return {
      matched: false,
    };
  }

  /**
   * 清除 AI 标签匹配器缓存
   */
  clearAiTagMatcherCache(userId: string): void {
    this.aiTagMatcher?.clearCache(userId);
  }

  /**
   * 匹配单个规则
   */
  private matchRule(request: ClassificationRequest, rule: Rule): boolean {
    // URL域名匹配
    if (rule.urlDomains && rule.urlDomains.length > 0) {
      const domain = this.extractDomain(request.url);
      if (domain && rule.urlDomains.some((d) => domain.includes(d))) {
        return true;
      }
    }

    // 标题关键词匹配
    if (rule.titleKeywords && rule.titleKeywords.length > 0) {
      const title = request.title.toLowerCase();
      if (rule.titleKeywords.some((kw) => title.includes(kw.toLowerCase()))) {
        return true;
      }
    }

    // 标签匹配
    if (rule.tags && rule.tags.length > 0 && request.tags) {
      const requestTags = request.tags.map((t) => t.toLowerCase());
      if (rule.tags.some((tag) => requestTags.includes(tag.toLowerCase()))) {
        return true;
      }
    }

    return false;
  }

  /**
   * 提取URL域名
   */
  private extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  /**
   * 添加规则
   */
  addRule(rule: Rule): void {
    this.rules.push(rule);
    this.logger.debug("添加L0规则", { ruleName: rule.name });
  }

  /**
   * 获取所有规则
   */
  getRules(): Rule[] {
    return [...this.rules];
  }
}
