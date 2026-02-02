import type { Bookmark } from '@/types/bookmark';
import type { PredictionResult } from '../types';
import { ruleRegistry } from './rule-registry';
import { telemetryManager } from '../telemetry/telemetry-manager';

class PredictionEngine {
  /**
   * 根据选中内容预测推荐操作
   * @param selection 选中的书签
   * @param limit 返回数量限制
   */
  predict(selection: Bookmark[], limit: number = 3): PredictionResult[] {
    if (selection.length === 0) {
      return [];
    }

    const enabledRules = ruleRegistry.getEnabled();
    const matches: PredictionResult[] = [];

    for (const rule of enabledRules) {
      // 已达到限制，停止匹配
      if (matches.length >= limit) {
        break;
      }

      try {
        // 执行规则条件判断
        if (rule.condition(selection)) {
          const result: PredictionResult = {
            ruleId: rule.id,
            action: rule.action,
            icon: rule.icon,
            label: rule.name,
            confidence: rule.priority,
            affectedCount: selection.length,
            params: rule.params?.(selection),
          };

          matches.push(result);

          // 记录遥测（异步，不阻塞）
          telemetryManager.recordMatch(rule.id, selection.length).catch(() => {
            // 静默失败，不影响主流程
          });
        }
      } catch (error) {
        // 单条规则执行失败不影响其他规则
        console.error(`[PredictionEngine] Rule ${rule.id} failed:`, error);
      }
    }

    return matches;
  }

  /**
   * 记录用户对推荐的反馈
   */
  async recordFeedback(ruleId: string, accepted: boolean): Promise<void> {
    // 遥测记录
    await telemetryManager.recordDecision(ruleId, accepted);

    // 本地存储（用于未来权重学习）
    try {
      const key = `rule_feedback_${ruleId}`;
      const current = JSON.parse(
        localStorage.getItem(key) || '{"accept":0,"reject":0}'
      );

      if (accepted) {
        current.accept++;
      } else {
        current.reject++;
      }

      localStorage.setItem(key, JSON.stringify(current));
    } catch {
      // localStorage 不可用时静默失败
    }
  }

  /**
   * 获取规则的本地反馈统计
   */
  getLocalFeedback(ruleId: string): { accept: number; reject: number } {
    try {
      const key = `rule_feedback_${ruleId}`;
      return JSON.parse(
        localStorage.getItem(key) || '{"accept":0,"reject":0}'
      );
    } catch {
      return { accept: 0, reject: 0 };
    }
  }
}

export const predictionEngine = new PredictionEngine();
