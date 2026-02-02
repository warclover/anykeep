import { ruleRegistry } from '../rule-registry';
import { languageRules } from './language-rules';
import { contentRules } from './content-rules';
import { quantityRules } from './quantity-rules';
import { timeRules } from './time-rules';
import { sourceRules } from './source-rules';
import { organizationRules } from './organization-rules';

// 聚合所有规则
export const allRules = [
  ...languageRules,
  ...contentRules,
  ...quantityRules,
  ...timeRules,
  ...sourceRules,
  ...organizationRules,
];

// 注册所有规则
export function registerAllRules(): void {
  ruleRegistry.registerMany(allRules);
}

// 模块加载时自动注册
registerAllRules();

// 导出各规则集
export {
  languageRules,
  contentRules,
  quantityRules,
  timeRules,
  sourceRules,
  organizationRules,
};
