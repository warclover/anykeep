/**
 * AI 响应模板定义
 *
 * 用于约束 AI 输出格式，保持一致性
 *
 * @version 1.1.0
 * @since 2025-12-27
 * @updated 2026-01-11 迁移类型到 shared/types
 */

// 从共享类型导入
import type { ConfidenceLevel, RiskLevel } from "@/lib/shared/types";
import {
  CONFIDENCE_THRESHOLDS,
  RISK_OPERATIONS,
  BATCH_CONFIRMATION_THRESHOLD,
  getConfidenceLevel,
  getOperationRiskLevel,
  requiresConfirmation,
} from "@/lib/shared/types";

// 重新导出以保持向后兼容
export type { ConfidenceLevel, RiskLevel };
export {
  CONFIDENCE_THRESHOLDS,
  RISK_OPERATIONS,
  BATCH_CONFIRMATION_THRESHOLD,
  getConfidenceLevel,
  getOperationRiskLevel,
  requiresConfirmation,
};

/**
 * 响应模板 - Prompt 注入部分
 *
 * 这些模板会被注入到 System Prompt 中，指导 AI 输出格式
 */
export const RESPONSE_TEMPLATES_PROMPT = `
## 响应模板

### 高置信度响应（静默执行）
\`\`\`
✅ [结果描述]
[可选：1行补充信息]
\`\`\`

### 中置信度响应（执行+说明）
\`\`\`
✅ [结果描述]
💡 我理解为 [你的理解]，如需调整可以告诉我。
\`\`\`

### 低置信度响应（轻量澄清）
\`\`\`
我理解你想 [初步理解]。请确认：
[问题]？
→ A. [推荐选项]（默认）
→ B. [备选]
\`\`\`

### 高风险操作响应
\`\`\`
⚠️ 即将 [操作描述]（影响 X 条内容）
确认执行？回复"确认"继续，或告诉我调整。
\`\`\`
`;
