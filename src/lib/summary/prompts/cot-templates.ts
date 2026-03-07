/**
 * Chain-of-Thought 模板
 *
 * 引导 LLM 先进行内部分析再生成摘要，提升输出质量
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

/**
 * 通用 CoT 模板
 * 适用于大部分内容类型
 */
export const COT_GENERAL = `在生成摘要之前，请先在内部完成以下分析（不要输出分析过程，直接输出最终 JSON 结果）：

1. 【内容理解】这篇内容的核心主题是什么？作者想传达的关键信息是什么？
2. 【结构分析】内容的逻辑结构是什么？（论点-论据、问题-方案、背景-方法-结论等）
3. 【价值判断】对读者最有价值的信息是哪些？哪些是可以省略的细节？
4. 【信息提炼】将分析结果整合为结构化摘要。`;

/**
 * 教程类 CoT 模板
 */
export const COT_TUTORIAL = `在生成摘要之前，请先在内部完成以下分析（不要输出分析过程，直接输出最终 JSON 结果）：

1. 【目标识别】这篇教程教什么？最终目标/成果是什么？
2. 【前置知识】读者需要哪些前置知识？难度如何？
3. 【步骤提炼】核心步骤有哪些？哪些步骤最关键或最容易出错？
4. 【实用价值】读者学完后能立即应用什么？`;

/**
 * 新闻类 CoT 模板
 */
export const COT_NEWS = `在生成摘要之前，请先在内部完成以下分析（不要输出分析过程，直接输出最终 JSON 结果）：

1. 【5W1H】谁（Who）在什么时间（When）什么地点（Where）做了什么（What）？为什么（Why）？如何做的（How）？
2. 【时效性】这条新闻的时间敏感程度如何？
3. 【影响范围】这件事对哪些人群/行业有影响？
4. 【事实与评论区分】哪些是客观事实？哪些是评论或预测？`;

/**
 * 观点类 CoT 模板
 */
export const COT_OPINION = `在生成摘要之前，请先在内部完成以下分析（不要输出分析过程，直接输出最终 JSON 结果）：

1. 【核心论点】作者的核心主张/立场是什么？
2. 【论据分析】支撑论点的关键论据有哪些？数据？案例？
3. 【反面观点】文中是否提到或暗示了反对意见？
4. 【结论导向】作者最终的结论或呼吁行动是什么？`;

/**
 * 案例研究 CoT 模板
 */
export const COT_CASE_STUDY = `在生成摘要之前，请先在内部完成以下分析（不要输出分析过程，直接输出最终 JSON 结果）：

1. 【背景】案例的背景和面临的挑战是什么？
2. 【方案】采取了什么解决方案？关键决策是什么？
3. 【结果】最终结果如何？有哪些量化指标？
4. 【经验教训】可以借鉴的经验和需要避免的坑是什么？`;

/**
 * 参考资料 CoT 模板
 */
export const COT_REFERENCE = `在生成摘要之前，请先在内部完成以下分析（不要输出分析过程，直接输出最终 JSON 结果）：

1. 【功能范围】这个 API/工具/框架解决什么问题？
2. 【核心接口】最重要的 API、参数或配置有哪些？
3. 【使用方式】典型的使用场景和代码示例是什么？
4. 【注意事项】有什么限制、兼容性问题或常见陷阱？`;

/**
 * 根据内容类型获取对应的 CoT 模板
 */
export function getCotTemplate(contentType: string): string {
  const COT_MAP: Record<string, string> = {
    article: COT_GENERAL,
    tutorial: COT_TUTORIAL,
    news: COT_NEWS,
    opinion: COT_OPINION,
    case_study: COT_CASE_STUDY,
    reference: COT_REFERENCE,
    video: COT_GENERAL,
    tool: COT_GENERAL,
    research: COT_GENERAL,
    comparison: COT_GENERAL,
    social_post: COT_GENERAL,
    recipe: COT_TUTORIAL,
    unknown: COT_GENERAL,
  };

  return COT_MAP[contentType] || COT_GENERAL;
}
