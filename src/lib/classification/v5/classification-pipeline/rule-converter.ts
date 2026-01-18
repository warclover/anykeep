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
    folderId: String(userRule.targetFolderId),
    confidence: userRule.confidence,
  };

  // 根据规则类型和模式类型转换
  switch (userRule.ruleType) {
    case "url":
      if (userRule.patternType === "domain") {
        l0Rule.urlDomains = [userRule.pattern];
      }
      // regex 和 keyword 类型的 URL 规则暂不支持
      break;

    case "title":
      if (userRule.patternType === "keyword") {
        l0Rule.titleKeywords = [userRule.pattern];
      }
      // regex 类型的标题规则暂不支持
      break;

    case "content":
      // content 规则暂不支持（L0 不处理内容）
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
