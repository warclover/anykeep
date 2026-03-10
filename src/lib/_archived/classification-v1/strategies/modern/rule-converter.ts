/**
 * 智能分类 v5.0 - 规则转换器
 *
 * 将用户自定义规则转换为 L0RuleMatcher 可用的格式
 */

import type { UserClassificationRule } from "../chat-to-rule/types";
import type { Rule } from "./l0-rule-matcher";

/**
 * 将用户自定义规则转换为 L0 规则
 */
export function convertUserRuleToL0Rule(
  userRule: UserClassificationRule,
): Rule | null {
  // 只转换启用的规则
  if (!userRule.isActive) {
    return null;
  }

  const l0Rule: Rule = {
    name: `user_rule_${userRule.id}`,
    folderId: userRule.targetFolderId,
    confidence: 0.95, // 用户自定义规则使用固定高置信度
  };

  // 根据模式类型转换
  switch (userRule.patternType) {
    case "domain":
      // domain 类型匹配 URL
      l0Rule.urlDomains = [userRule.pattern];
      break;

    case "keyword":
      // keyword 类型匹配标题
      l0Rule.titleKeywords = [userRule.pattern];
      break;

    case "regex":
      // regex 类型暂不支持
      return null;

    default:
      return null;
  }

  // 检查是否有有效的匹配条件
  if (!l0Rule.urlDomains && !l0Rule.titleKeywords && !l0Rule.tags) {
    return null;
  }

  return l0Rule;
}

/**
 * 批量转换用户规则
 */
export function convertUserRulesToL0Rules(
  userRules: UserClassificationRule[],
): Rule[] {
  return userRules
    .map(convertUserRuleToL0Rule)
    .filter((rule): rule is Rule => rule !== null);
}
