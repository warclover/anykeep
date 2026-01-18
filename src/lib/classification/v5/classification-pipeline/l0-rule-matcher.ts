/**
 * 智能分类 v5.0 - L0 规则匹配器
 *
 * 基于规则的快速匹配（URL域名、关键词、标签）
 */

import type { LoggerService } from '../shared/logger';
import type { ClassificationRequest, L0MatchResult } from './types';

/**
 * 规则定义
 */
export interface Rule {
  /** 规则名称 */
  name: string;
  /** 目标文件夹ID */
  folderId: string;
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

  constructor(logger: LoggerService, rules: Rule[] = []) {
    this.logger = logger.child({ service: 'L0RuleMatcher' });
    this.rules = rules;
  }

  /**
   * 匹配规则
   */
  match(request: ClassificationRequest): L0MatchResult {
    this.logger.debug('开始L0规则匹配', {
      bookmarkId: request.bookmarkId,
      ruleCount: this.rules.length,
    });

    // 遍历所有规则
    for (const rule of this.rules) {
      if (this.matchRule(request, rule)) {
        this.logger.info('L0规则匹配成功', {
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
   * 匹配单个规则
   */
  private matchRule(request: ClassificationRequest, rule: Rule): boolean {
    // URL域名匹配
    if (rule.urlDomains && rule.urlDomains.length > 0) {
      const domain = this.extractDomain(request.url);
      if (domain && rule.urlDomains.some(d => domain.includes(d))) {
        return true;
      }
    }

    // 标题关键词匹配
    if (rule.titleKeywords && rule.titleKeywords.length > 0) {
      const title = request.title.toLowerCase();
      if (rule.titleKeywords.some(kw => title.includes(kw.toLowerCase()))) {
        return true;
      }
    }

    // 标签匹配
    if (rule.tags && rule.tags.length > 0 && request.tags) {
      const requestTags = request.tags.map(t => t.toLowerCase());
      if (rule.tags.some(tag => requestTags.includes(tag.toLowerCase()))) {
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
    this.logger.debug('添加L0规则', { ruleName: rule.name });
  }

  /**
   * 获取所有规则
   */
  getRules(): Rule[] {
    return [...this.rules];
  }
}
