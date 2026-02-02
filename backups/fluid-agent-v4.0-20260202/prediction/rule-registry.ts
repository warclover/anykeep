import type { PredictionRule } from '../types';

class RuleRegistry {
  private rules: Map<string, PredictionRule> = new Map();
  private sortedRules: PredictionRule[] = [];
  private isDirty = true;

  /**
   * 注册单条规则
   */
  register(rule: PredictionRule): void {
    this.rules.set(rule.id, rule);
    this.isDirty = true;
  }

  /**
   * 批量注册规则
   */
  registerMany(rules: PredictionRule[]): void {
    rules.forEach(rule => this.rules.set(rule.id, rule));
    this.isDirty = true;
  }

  /**
   * 获取规则 by ID
   */
  getById(ruleId: string): PredictionRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * 获取所有启用的规则（按优先级排序）
   */
  getEnabled(): PredictionRule[] {
    if (this.isDirty) {
      this.rebuildSortedList();
    }
    return this.sortedRules.filter(r => r.enabled);
  }

  /**
   * 获取所有规则
   */
  getAll(): PredictionRule[] {
    if (this.isDirty) {
      this.rebuildSortedList();
    }
    return [...this.sortedRules];
  }

  /**
   * 启用/禁用规则
   */
  setEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * 动态调整优先级
   */
  setPriority(ruleId: string, priority: number): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.priority = Math.max(0, Math.min(100, priority));
      this.isDirty = true;
    }
  }

  /**
   * 按类别获取规则
   */
  getByCategory(category: PredictionRule['category']): PredictionRule[] {
    return this.getEnabled().filter(r => r.category === category);
  }

  /**
   * 清空所有规则（测试用）
   */
  clear(): void {
    this.rules.clear();
    this.sortedRules = [];
    this.isDirty = false;
  }

  private rebuildSortedList(): void {
    this.sortedRules = Array.from(this.rules.values())
      .sort((a, b) => b.priority - a.priority);
    this.isDirty = false;
  }
}

// 单例导出
export const ruleRegistry = new RuleRegistry();
