/**
 * 整理专家响应模板
 *
 * 提供专业、结构化的整理诊断报告输出格式，
 * 让用户感知到 AI 整理助手的专业能力
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

/**
 * 整理专家响应模板集合
 *
 * 使用 Mustache 语法进行模板变量替换
 */
export const ORGANIZE_EXPERT_TEMPLATES = {
  /**
   * 诊断报告模板 - 分析阶段输出
   *
   * 变量:
   * - {{total}}: 收藏总数
   * - {{#issues}}: 问题列表循环
   *   - {{severityIcon}}: 严重程度图标
   *   - {{severityLabel}}: 严重程度标签
   *   - {{title}}: 问题标题
   *   - {{count}}: 问题数量
   *   - {{percentage}}: 问题占比
   * - {{optionCount}}: 方案数量
   * - {{#options}}: 方案列表循环
   *   - {{index}}: 方案序号
   *   - {{label}}: 方案标签（推荐/快速/自定义）
   *   - {{name}}: 方案名称
   *   - {{actions}}: 操作描述
   *   - {{duration}}: 预计耗时
   */
  diagnosis: `📋 **收藏诊断报告**

我分析了您的 **{{total}}** 条收藏，发现以下可优化项：

┌─ 🔍 发现的问题 ─────────────────────────┐
│                                          │
{{#issues}}
│  {{severityIcon}} {{severityLabel}}                                 │
│  └── {{title}}（{{count}}条，{{percentage}}%）          │
{{/issues}}
│                                          │
└──────────────────────────────────────────┘

💡 **整理方案**（{{optionCount}} 选 1）

{{#options}}
{{index}}️⃣ 【{{label}}】{{name}}
   操作：{{actions}}
   耗时：约 {{duration}}

{{/options}}

回复数字选择方案，或说"我想只整理 XXX"自定义`,

  /**
   * 执行确认模板 - 确认执行前展示
   *
   * 变量:
   * - {{optionName}}: 选择的方案名称
   * - {{#actions}}: 操作列表循环
   *   - {{icon}}: 操作图标
   *   - {{name}}: 操作名称
   *   - {{count}}: 操作数量
   * - {{totalAffected}}: 总影响数量
   * - {{canUndo}}: 是否可撤销
   */
  confirm: `⚠️ **确认执行整理**

即将执行【{{optionName}}】方案：

{{#actions}}
  {{icon}} {{name}}：{{count}} 条
{{/actions}}

📊 **影响范围**：共 {{totalAffected}} 条书签
{{#canUndo}}
🔙 **可撤销**：执行后可一键恢复
{{/canUndo}}

[确认执行] [取消]`,

  /**
   * 执行完成模板 - 整理完成后展示
   *
   * 变量:
   * - {{#stats}}: 统计列表循环
   *   - {{label}}: 统计项标签
   *   - {{before}}: 整理前数量
   *   - {{after}}: 整理后数量
   *   - {{statusIcon}}: 状态图标（改善/无变化）
   * - {{hasNextSuggestion}}: 是否有下一步建议
   * - {{nextSuggestion}}: 下一步建议内容
   */
  complete: `✅ **整理完成！**

📊 **执行统计**
{{#stats}}
├── {{label}}: {{before}} → {{after}} {{statusIcon}}
{{/stats}}

{{#hasNextSuggestion}}
💡 **下一步建议**
{{nextSuggestion}}
{{/hasNextSuggestion}}

[查看详细报告] [分享整理成果] [撤销操作]`,

  /**
   * 空状态模板 - 没有需要整理的内容时展示
   */
  empty: `✨ **收藏库状态良好！**

经检查，您的收藏库目前：
- 📁 所有内容已分类
- 🏷️ 所有书签已打标签
- 🔄 无重复书签
- 📦 无需归档内容

💡 **保持良好习惯**
- 新收藏后及时分类
- 定期回顾长期未读内容
- 使用标签便于快速查找`,

  /**
   * 进度更新模板 - 执行过程中展示
   *
   * 变量:
   * - {{currentStep}}: 当前步骤名称
   * - {{progress}}: 进度百分比
   * - {{processed}}: 已处理数量
   * - {{total}}: 总数量
   */
  progress: `⏳ **正在整理中...**

当前步骤：{{currentStep}}
进度：{{progress}}%（{{processed}}/{{total}}）

请稍候，这不会影响您的其他操作`,

  /**
   * 错误模板 - 整理过程出错时展示
   *
   * 变量:
   * - {{errorMessage}}: 错误信息
   * - {{canRetry}}: 是否可重试
   */
  error: `❌ **整理遇到问题**

{{errorMessage}}

{{#canRetry}}
[重试] [取消]
{{/canRetry}}
{{^canRetry}}
请稍后再试，或联系支持团队
{{/canRetry}}`,
} as const;

/**
 * 严重程度图标映射
 */
export const SEVERITY_ICONS: Record<string, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "🟢",
};

/**
 * 严重程度标签映射
 */
export const SEVERITY_LABELS: Record<string, string> = {
  critical: "严重",
  warning: "中等",
  info: "建议",
};

/**
 * 操作图标映射
 */
export const ACTION_ICONS: Record<string, string> = {
  categorize: "📁",
  tag: "🏷️",
  duplicate: "🔄",
  archive: "📦",
  validate: "🔗",
};

/**
 * 方案标签配置
 */
export const OPTION_LABELS = {
  recommended: "推荐",
  quick: "快速",
  custom: "自定义",
  thorough: "彻底",
} as const;

export type OptionLabel = (typeof OPTION_LABELS)[keyof typeof OPTION_LABELS];
