/**
 * IntentClassifier - 意图分类器
 *
 * @deprecated 自 v2.8.3 起废弃
 * 请使用 `IntentAnalyzer` 作为统一的意图分析入口。
 * IntentAnalyzer 合并了 IntentClassifier、ComplexityEvaluator、ModeSelector 的功能。
 *
 * @see IntentAnalyzer - 推荐使用的统一意图分析器
 *
 * 迁移指南:
 * ```typescript
 * // 旧代码
 * const classifier = new IntentClassifier();
 * const result = await classifier.classify(message);
 *
 * // 新代码
 * const analyzer = new IntentAnalyzer();
 * const result = await analyzer.analyze(message, context);
 * ```
 *
 * 职责：
 * - 分析用户输入，识别意图类型
 * - 提取实体（主题、时间、数量等）
 * - 判断是否需要多步骤处理
 * - 判断是否期望交付物
 *
 * 策略：规则优先 + LLM 兜底
 *
 * Code Review P1-4: 权重校准策略说明
 *
 * 权重分层设计：
 * - 95-100: 高置信度精准意图（synthesis, active_recall_start, digest）
 * - 85-94:  明确专业意图（learn, analyze, create 的专项功能）
 * - 75-84:  标准操作意图（organize, action 的常规操作）
 * - 60-74:  通用查询意图（query:search, query:list 的变体）
 * - 40-59:  低置信度通用意图（基础 list、explain）
 * - 10-39:  闲聊兜底意图（chitchat）
 *
 * 冲突解决原则：
 * 1. 更具体的意图权重更高（如 organize:move > action:move）
 * 2. 有明确动词的意图权重更高（如 "整理" > "看看"）
 * 3. 多词匹配的意图权重更高（如 "帮我整理收藏" > "整理"）
 *
 * @version 2.2.0
 * @since 2025-12-24
 * @updated 2025-12-26 - 添加 LLM 分类兜底支持
 * @updated 2026-01-10 - 添加权重校准策略说明 (Code Review P1-4)
 * @updated 2026-01-11 - 标记为废弃，推荐使用 IntentAnalyzer
 */

import { logger } from "@/lib/logger";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import type {
  IntentType,
  IntentClassification,
  IntentRule,
  ExtractedEntity,
  IntentClassifierConfig,
  IntentCandidate,
  MultiCandidateResult,
  DisambiguationRule,
  IntentSlotSchema,
} from "./types";
import { DISAMBIGUATION_RULES, findMatchingRule } from "./disambiguation-rules";
import type { LLMIntentClassifier } from "./llm-classifier";
import { createLLMClassifier } from "./llm-classifier";
import { extractTimeRangeFromText } from "@/lib/ai-agent/tools/shared/time-range.utils";

/**
 * 默认意图分类规则
 *
 * 规则按优先级排序，匹配后立即返回
 */
export const DEFAULT_RULES: IntentRule[] = [
  // ============================================
  // ============================================
  // 学习类（高优先级，通常需要编排）
  // ============================================
  {
    pattern: /复习|回顾|巩固|温习|重温/,
    type: "learn",
    subType: "review",
    complexity: "complex",
    weight: 90,
  },
  {
    pattern: /准备.{0,5}面试|面试.{0,5}准备/,
    type: "learn",
    subType: "interview",
    complexity: "complex",
    weight: 90,
  },
  // 阅读计划规则（更具体，权重更高）
  // 匹配：帮我制定阅读计划、执行阅读计划、阅读计划等
  {
    pattern: /阅读计划|读书计划|每日阅读/,
    type: "learn",
    subType: "plan",
    complexity: "medium",
    weight: 88,
  },
  // 学习路径规则（较通用，权重较低）
  {
    pattern: /学习路径|学习计划|学习规划/,
    type: "learn",
    subType: "path",
    complexity: "complex",
    weight: 85,
  },

  // ============================================
  // 整理类（通常需要编排）
  // ============================================
  {
    // Phase 1 新增：隐含整理意图（抱怨式表达）
    // 示例："太多了"、"有点乱"、"乱七八糟"
    pattern: /^(太多了|有点乱|乱七八糟|好乱|很乱|太乱了)$/,
    type: "organize",
    subType: "cleanup",
    complexity: "complex",
    weight: 65,
  },
  {
    // Phase 1.1 新增：隐含整理意图（增长式表达）
    // 示例："收藏越来越多了"、"书签太多了"、"感觉乱糟糟的"
    pattern: /(收藏|书签).{0,5}(越来越多|太多)|感觉.{0,3}(乱|糟)/,
    type: "organize",
    subType: "cleanup",
    complexity: "complex",
    weight: 68,
  },
  {
    pattern: /整理|清理|规整|梳理/,
    type: "organize",
    subType: "cleanup",
    complexity: "complex",
    weight: 80,
  },
  {
    pattern: /去重|重复|找出重复|清理重复/,
    type: "organize",
    subType: "dedupe",
    complexity: "complex",
    weight: 85,
  },
  {
    pattern: /过期|失效|无效.{0,3}链接/,
    type: "organize",
    subType: "expire",
    complexity: "medium",
    weight: 75,
  },
  {
    pattern: /分类|归类|归档/,
    type: "organize",
    subType: "classify",
    complexity: "medium",
    weight: 70,
  },
  {
    pattern: /监控|变更检测|页面监控|变化检测|内容变化|监控列表|我的监控/,
    type: "organize",
    subType: "monitor",
    complexity: "simple",
    weight: 80,
  },
  {
    // Phase 1 新增：合并/组合操作
    pattern:
      /放(到)?一起|合并.{0,3}(书签|收藏|这[几个些])|组合|打包.{0,3}(书签|收藏)/,
    type: "organize",
    subType: "merge",
    complexity: "medium",
    weight: 78,
  },
  // --------------------------------------------
  // Phase 3: 整理操作增强规则 (2026-01-09)
  // --------------------------------------------
  {
    // 规则 P3-O1: 标签整理操作（区别于 action:tag 的"添加标签"）
    // 示例: "给这些打上标签"、"帮我贴个标签"
    // 注意: "添加标签"属于 action:tag，此规则不匹配
    pattern: /(给|为|帮).{0,5}(打上|贴).{0,3}(标签|tag)/i,
    type: "organize",
    subType: "tag",
    complexity: "simple",
    weight: 85,
  },
  {
    // 规则 P3-O2: 移动整理操作（独立表达，非"把...移动到"结构）
    // 示例: "移到学习文件夹"、"放到工作目录"
    // 注意: "把这些移动到..."属于 action:move（有显式宾语指示）
    pattern:
      /^(?!.*把.{0,5}移).*(移到|放到|挪到|转到|移入|放入).{0,10}(文件夹|目录|分类)/,
    type: "organize",
    subType: "move",
    complexity: "simple",
    weight: 86,
  },
  {
    // Golden Dataset 增强：宽松移动规则（权重高于 classify:70）
    // 示例: "移动到学习"、"移动书签到归档"、"移动这个书签"
    pattern: /移动.{0,5}(到|书签)|转移.{0,5}到/,
    type: "organize",
    subType: "move",
    complexity: "simple",
    weight: 75,
  },
  // --------------------------------------------

  // ============================================
  // 分析类
  // ============================================
  {
    pattern:
      /微信.{0,3}(文章|阅读|收藏).{0,3}(摘要|总结|整理|报告)|公众号.{0,3}(摘要|总结)/,
    type: "analyze",
    subType: "wechat",
    complexity: "medium",
    weight: 88,
  },
  {
    pattern: /周报|月报|报告|统计报告/,
    type: "analyze",
    subType: "report",
    complexity: "complex",
    weight: 80,
  },
  {
    // Phase 1 新增：看看+习惯/行为（分析意图）
    // 示例："看看我的阅读习惯"、"了解我的收藏习惯"
    pattern: /(看看|了解|分析).{0,5}(我的)?.{0,5}(阅读|收藏|使用).{0,3}习惯/,
    type: "analyze",
    subType: "insight",
    complexity: "medium",
    weight: 75,
  },
  {
    pattern: /分析|洞察|趋势/,
    type: "analyze",
    subType: "insight",
    complexity: "medium",
    weight: 70,
  },

  // --------------------------------------------
  // 统计意图规则增强 - 时间范围支持 (2026-01-10)
  // 带时间词的统计意图优先级更高
  // --------------------------------------------
  {
    // 时间词 + 统计意图（前置时间）
    // 示例: "今天有多少收藏"、"本周新增几条"、"这个月收藏了多少"
    pattern:
      /(今天|今日|昨天|昨日|本周|这周|本月|这个月|今年).{0,5}(有多少|多少条|几条|几个|新增|收藏了|添加了)/,
    type: "query",
    subType: "count",
    complexity: "simple",
    weight: 75, // 高于普通 count 规则 (65)
  },
  {
    // 统计意图 + 后置时间
    // 示例: "多少条是今天的"、"有多少今天的收藏"、"收藏了多少今天的"
    pattern:
      /(有多少|多少条|几条|几个|收藏了多少).{0,5}(今天|今日|昨天|昨日|本周|这周|本月|这个月)/,
    type: "query",
    subType: "count",
    complexity: "simple",
    weight: 75,
  },
  {
    // 统计意图增强：覆盖更多口语化表达
    // 示例: "有多少书签"、"书签总数是多少"、"收藏了多少条"
    pattern: /统计|有多少|数量|总共|总数|多少条|是多少|几条|几个/,
    type: "query",
    subType: "count",
    complexity: "simple",
    weight: 65,
  },

  // ============================================
  // 创建类
  // ============================================
  {
    // 使用负向后行断言排除「阅读」和「已读」中的「读」
    pattern: /(?<!阅|已)读|朗读|播放.{0,3}摘要|听|语音|念|tts/i,
    type: "create",
    subType: "tts",
    complexity: "simple",
    weight: 85,
  },

  // --------------------------------------------
  // Phase 2: Digest 意图增强规则 (2026-01-09)
  // 这些规则优先级高于基础 digest，用于识别更多摘要场景
  // --------------------------------------------
  {
    // 规则 D1: 要点/关键点信号
    // 示例: "给我看看每篇的要点"、"列出关键点"
    pattern: /(看看|列出|提取|总结|给我).{0,5}(要点|关键点|重点|核心|关键)/,
    type: "create",
    subType: "digest",
    complexity: "medium",
    weight: 78,
  },
  {
    // 规则 D2: 快速浏览信号
    // 示例: "快速过一遍这些内容"、"扫一眼"
    pattern: /(快速|迅速)?.{0,3}(过一遍|扫一眼|浏览一下|翻阅|看一遍)/,
    type: "create",
    subType: "digest",
    complexity: "medium",
    weight: 76,
  },
  {
    // 规则 D3: 每篇/分别处理信号（强化）
    // 示例: "每篇的要点"、"分别概括"
    pattern: /(每篇|每个|分别|各自).{0,5}(的)?.{0,5}(要点|摘要|概要|内容|总结)/,
    type: "create",
    subType: "digest",
    complexity: "medium",
    weight: 79,
  },
  {
    // 规则 D4: 逐条/逐个信号（强 digest 信号）
    // 示例: "逐条总结这些文章"、"逐个分析"
    // 注意：权重高于 synthesis 规则 (Y2: 95)，确保逐条处理优先于融合
    pattern: /(逐条|逐个|逐篇|一条条|一个个).{0,5}(总结|分析|处理|看看|概括)/,
    type: "create",
    subType: "digest",
    complexity: "medium",
    weight: 98,
  },
  // --------------------------------------------

  {
    // 摘要/总结规则 - 修复 NLU-06: 添加英文 summarize/summary 支持
    pattern: /摘要|总结|概括|速览|summarize|summary/i,
    type: "create",
    subType: "digest",
    complexity: "medium",
    weight: 70,
  },
  {
    pattern: /笔记|记录|心得/,
    type: "create",
    subType: "note",
    complexity: "medium",
    weight: 65,
  },
  // --------------------------------------------
  // Phase 3: 导出分享增强规则 (2026-01-09)
  // --------------------------------------------
  {
    // 规则 P3-E1: 备份信号
    // 示例: "备份我的收藏"、"备份全部书签"
    pattern: /备份.{0,5}(我的|全部|所有)?.{0,5}(收藏|书签|内容)/,
    type: "create",
    subType: "share",
    complexity: "medium",
    weight: 84,
  },
  // --------------------------------------------
  {
    // 规则 P3-E2: 导出意图（Code Review #8 修复）
    // 示例: "导出为Markdown"、"导出所有收藏"、"把书签导出来"
    pattern: /导出|export/i,
    type: "create",
    subType: "export",
    complexity: "medium",
    weight: 85, // 高于分享规则
  },
  // --------------------------------------------
  {
    // 规则 P3-E3: 分享/文档生成意图
    // 示例: "分享给朋友"、"生成文档"
    pattern: /分享|生成.{0,3}文档/,
    type: "create",
    subType: "share",
    complexity: "medium",
    weight: 65,
  },

  // ============================================
  // 综述类（v2.8.0 新增 - 主题合成器）
  // ============================================

  // --------------------------------------------
  // Phase 2: Synthesis 边界优化规则 (2026-01-09)
  // 这些规则处理时间词干扰和边界情况
  // --------------------------------------------
  {
    // 规则 Y1: 时间词 + 整合一下（优先级高于时间查询）
    // 示例: "把最近五篇整合一下"、"前三个合并一下"
    pattern:
      /(把)?.{0,3}(最近|前).{0,5}(几|[一二三四五六七八九十\d]+).{0,3}(篇|个|条).{0,5}(整合|合并|综合|融合)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 97,
  },
  {
    // 规则 Y2: 总结一下这几篇（增强）
    // 示例: "帮我总结一下这几篇"、"总结这些内容"
    pattern: /(帮我)?总结.{0,3}(一下)?.{0,5}(这[几个些]篇?|这些|它们)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 95,
  },
  // --------------------------------------------
  // Phase 3: Synthesis 边界补充规则 (2026-01-09)
  // --------------------------------------------
  {
    // 规则 P3-Y1: "把...整合成一篇文章" 模式
    // 示例: "把这些内容整合成一篇文章"、"把这些合并成一份"
    pattern:
      /(把).{0,10}(内容|这些|这几篇).{0,5}(整合|合并|综合|融合).{0,3}(成|为).{0,3}(一篇|一份)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 96,
  },
  {
    // 规则 P3-Y2: "生成一篇综合..." 模式
    // 示例: "生成一篇综合报告"、"写一份综合性总结"
    // 注意：优先于 analyze:report，因为"综合"表示合成而非分析
    pattern: /(生成|写|做|来).{0,3}(一篇|一份).{0,5}(综合|汇总|整体|全面)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 97,
  },
  // --------------------------------------------

  // --------------------------------------------
  // Phase 1: 融合式意图增强规则 (2026-01-09)
  // 这些规则优先级高于 digest，用于识别融合创作意图
  // --------------------------------------------
  {
    // 规则 1: 结合/融合 + 写/生成 + 总结/报告
    // 示例: "结合最近三个收藏写个总结"、"融合这些内容生成报告"
    pattern:
      /(结合|融合|整合|汇总).{0,15}(写|生成|做|来|给).{0,5}(总结|报告|文章|笔记)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 96,
  },
  {
    // 规则 2: "写一篇" 结构
    // 示例: "写一篇总结"、"写一篇综述"
    pattern: /写一篇.{0,10}(总结|报告|综述|文章|笔记)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 94,
  },
  {
    // 规则 3: 内容 + 融合/合成
    // 示例: "把这些知识点融合一下"、"内容整合"
    pattern: /(内容|知识|要点|观点).{0,5}(融合|合成|整合|汇总)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 92,
  },
  {
    // 规则 4: 整合/合成 + 成一篇/成文档
    // 示例: "整合成一篇文章"、"汇总为一份报告"
    pattern:
      /(整合|合成|融合|汇总|归纳).{0,5}(成|为).{0,3}(一篇|一份|一个|文档|文章|报告)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 95,
  },
  {
    // 规则 5: 把...整理成一篇
    // 示例: "把这些整理成一篇笔记"、"把最近的整理成文章"
    pattern: /把.{0,15}(整理|写|做|形成).{0,3}(成|为)?.{0,3}(一篇|完整|一份)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 93,
  },
  {
    // 规则 6: 提炼/梳理成文档
    // 示例: "提炼成一份报告"、"梳理成文章"
    pattern: /(提炼|梳理|凝练).{0,5}(成|为)?.{0,5}(文档|报告|文章|笔记)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 91,
  },
  {
    // 规则 7: 帮我 + 总结/归纳 + 这几篇/这些
    // 示例: "帮我总结一下这几篇"、"帮我归纳这些内容"
    pattern: /帮我.{0,3}(总结|归纳|整理).{0,5}(一下)?.{0,3}(这[几个些]|最近)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 94,
  },
  // --------------------------------------------
  // 原有综述规则
  // --------------------------------------------
  {
    // 通用综述请求
    pattern:
      /综述|合成|整合.{0,5}(收藏|文章)|归纳.{0,5}(收藏|文章)|生成.{0,3}(综述|报告|合成)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 90,
  },
  {
    // 按文件夹综述
    pattern: /(综述|合成|整合|归纳).{0,5}(文件夹|目录)|文件夹.{0,5}(综述|合成)/,
    type: "create",
    subType: "synthesis_folder",
    complexity: "complex",
    weight: 92,
  },
  {
    // 按标签综述
    pattern: /(综述|合成|整合|归纳).{0,5}标签|标签.{0,5}(综述|合成)/,
    type: "create",
    subType: "synthesis_tag",
    complexity: "complex",
    weight: 92,
  },
  {
    // 最近收藏综述
    pattern: /(综述|合成|整合|归纳).{0,5}(最近|近期|这周|今天|昨天)/,
    type: "create",
    subType: "synthesis_recent",
    complexity: "complex",
    weight: 91,
  },
  {
    // 特定主题综述
    pattern:
      /(综述|合成|整合|归纳).{0,5}(关于|有关)|关于.{0,5}(综述|合成|整合)/,
    type: "create",
    subType: "synthesis_topic",
    complexity: "complex",
    weight: 93,
  },

  // ============================================
  // 过滤/筛选类（需要上下文有搜索结果）
  // ============================================
  {
    pattern: /里面|其中|当中/,
    type: "refine",
    subType: "filter",
    complexity: "simple",
    weight: 75,
  },
  {
    pattern: /有没有.{1,10}的|有.{1,10}的吗/,
    type: "refine",
    subType: "check",
    complexity: "simple",
    weight: 70,
  },
  {
    pattern: /哪[几个篇条]+.{0,5}是.{0,10}的|哪[几个篇条]+.{0,5}关于/,
    type: "refine",
    subType: "filter",
    complexity: "simple",
    weight: 72,
  },
  {
    pattern: /筛选|过滤|只看|只要/,
    type: "refine",
    subType: "filter",
    complexity: "simple",
    weight: 68,
  },

  // ============================================
  // 设置/配置类
  // ============================================
  {
    pattern:
      /推荐.{0,5}(模式|信任|托管)|适合.{0,5}(模式|信任)|哪个模式.{0,3}(好|适合)|优化.{0,5}(AI|设置)/,
    type: "query",
    subType: "trust_mode_recommend",
    complexity: "simple",
    weight: 85,
  },
  {
    pattern:
      /(信任|托管).{0,5}模式.{0,5}(是|什么)|当前.{0,5}(模式|托管|信任)|我的.{0,5}(模式|托管|信任)/,
    type: "query",
    subType: "trust_mode",
    complexity: "simple",
    weight: 80,
  },

  // ============================================
  // 插件授权类（v2.3.0 新增）
  // ============================================
  {
    pattern:
      /插件.{0,5}(授权|登录|设备)|设备.{0,5}(登录|授权)|浏览器.{0,5}(插件|授权)/,
    type: "query",
    subType: "plugin_auth",
    complexity: "simple",
    weight: 75,
  },
  {
    pattern:
      /退出.{0,5}(插件|所有设备)|撤销.{0,5}(授权|插件)|登出.{0,5}(插件|设备)/,
    type: "action",
    subType: "revoke_plugin_auth",
    complexity: "simple",
    weight: 80,
  },

  // ============================================
  // 知识图谱类（v2.4.0 新增）
  // ============================================
  {
    pattern:
      /知识.{0,3}(图谱|网络|关系)|关联.{0,3}(图|网络|分析)|图谱.{0,3}(数据|统计)/,
    type: "query",
    subType: "knowledge_graph",
    complexity: "simple",
    weight: 78,
  },
  {
    pattern:
      /相关.{0,3}(内容|书签|文章)|同.{0,3}主题|主题.{0,3}(聚类|分组|相似)/,
    type: "query",
    subType: "related_by_topic",
    complexity: "simple",
    weight: 75,
  },

  // ============================================
  // Skills v1.1.0（2025-01-08 新增）
  // ============================================
  // InboxTriageSkill - 收件箱智能分拣
  {
    pattern:
      /整理.*(收件箱|inbox)|收件箱.*整理|(帮我|自动).*(分类|分拣|归档).*(未读|未整理|新)|inbox.*(organize|triage|sort)/i,
    type: "action",
    subType: "inbox_triage",
    complexity: "complex",
    weight: 85,
  },
  {
    pattern:
      /(有多少|几条).*(未整理|未分类|待处理)|收件箱.*状态|inbox.*(status|overview)/i,
    type: "query",
    subType: "inbox_status",
    complexity: "simple",
    weight: 80,
  },
  // FolderRecommendSkill - 文件夹智能推荐
  {
    pattern:
      /推荐.*(文件夹|目录|分类)|(建议|应该).*创建.*(文件夹|目录)|(文件夹|目录).*建议|folder.*(recommend|suggest)/i,
    type: "query",
    subType: "folder_recommend",
    complexity: "simple",
    weight: 85,
  },
  // FolderHealthCheckSkill - 文件夹健康检查
  {
    pattern:
      /文件夹.*(健康|检查|诊断)|(健康|检查|诊断).*文件夹|folder.*(health|check|diagnose)/i,
    type: "analyze",
    subType: "folder_health_check",
    complexity: "complex",
    weight: 84,
  },

  // ============================================
  // 微信文章类（v2.4.0 新增）
  // ============================================
  {
    pattern:
      /微信.{0,3}(文章|收藏).{0,3}(列表|清单|有哪些)|公众号.{0,3}(文章|收藏).{0,3}(列表|有)/,
    type: "query",
    subType: "wechat_articles",
    complexity: "simple",
    weight: 76,
  },
  {
    pattern:
      /微信.{0,3}(文章|收藏).{0,3}(统计|概览|数据)|公众号.{0,3}(统计|多少)/,
    type: "query",
    subType: "wechat_article_stats",
    complexity: "simple",
    weight: 74,
  },

  // ============================================
  // 查询类（简单任务）
  // ============================================
  {
    // Phase 1 新增：链接状态检查（需高优先级避免被 expire 规则匹配）
    pattern:
      /(这个|那个|它)?.{0,3}链接.{0,3}(还|能)?.{0,3}(用|有效|打开|访问)|能.{0,3}访问.{0,3}(吗|不|么)/,
    type: "query",
    subType: "link_status",
    complexity: "simple",
    weight: 82,
  },

  // --------------------------------------------
  // Phase 2: 搜索意图增强规则 (2026-01-09)
  // 这些规则优先级高于基础搜索，用于识别更多搜索场景
  // --------------------------------------------
  {
    // 规则 S0: 显式搜索指令 (修复测试失败)
    // 示例: "搜索 React", "找一下那篇文章"
    pattern: /^(搜索|查找|搜|找一下|找一找).{0,20}/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 75,
  },
  {
    // 规则 S1: 收藏动作信号
    // 示例: "我收藏过一篇讲 TypeScript 的"、"之前保存过"
    // Golden Dataset 修复：排除统计词（多少、几个）
    pattern:
      /^(?!.*(多少|几个|几条)).*(收藏|保存|存)(过|了).{0,20}(的|一篇|那个)?/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 88,
  },
  {
    // 规则 S2: 平台名称识别
    // 示例: "有没有 B站 的收藏"、"微信的文章"
    pattern:
      /(B站|bilibili|哔哩哔哩|微信|公众号|小红书|知乎|抖音|掘金|CSDN|GitHub|SegmentFault|博客园|豆瓣|微博|今日头条|虎嗅|36氪).{0,10}(的)?.{0,5}(收藏|文章|内容|书签)?/i,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 85,
  },
  {
    // 规则 S3: 有没有 + 平台/类型 查询（覆盖 refine:check）
    // 示例: "有没有 B站 的收藏"、"有微信的文章吗"
    pattern:
      /有没有.{0,5}(B站|bilibili|微信|公众号|小红书|知乎|视频|文章|图片|链接|笔记).{0,5}(的)?(收藏|内容|书签)?|有.{0,5}(B站|bilibili|微信|公众号|小红书|知乎|视频|文章|图片|链接|笔记).{0,5}(的)?(收藏|内容|书签)?吗/i,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 86,
  },
  {
    // 规则 S4: 媒体类型查询
    // 示例: "最近收藏的视频在哪"、"收藏的文章"
    pattern: /(收藏|保存).{0,5}(的)?.{0,5}(视频|文章|图片|链接|笔记|音频)/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 84,
  },
  {
    // 规则 S5: 时间范围查询 → 改为 list 意图
    // 示例: "上周收藏了什么"、"本月保存的"、"最近收藏"
    // Golden Dataset 修复：时间范围查询应返回列表，而非搜索
    pattern:
      /^(?!.*(列出|列表|显示)).*(上周|本周|上月|本月|昨天|今天|最近|近期|这周|一周).{0,5}(收藏|保存|添加)(了|的|什么)?/,
    type: "query",
    subType: "list",
    complexity: "simple",
    weight: 87,
  },
  {
    // 规则 S6: 文件夹/分类查询
    // 示例: "工作文件夹里有什么"、"学习分类下有什么"
    pattern: /.{1,10}(文件夹|分类|标签)(里|中|下)?(有|是)?什么/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 83,
  },
  // --------------------------------------------
  // 文件夹列表查询规则 (2026-01-11 修复空响应问题)
  // --------------------------------------------
  {
    // 规则 FL1: "我有哪些文件夹" 模式
    // 示例: "我有哪些文件夹"、"有哪些文件夹"、"我的文件夹有哪些"
    pattern: /(我|用户)?(有哪些|有什么|都有什么).{0,3}(文件夹|目录|收藏夹)/,
    type: "query",
    subType: "list_folders",
    complexity: "simple",
    weight: 85,
  },
  {
    // 规则 FL2: "文件夹有哪些" 模式
    // 示例: "文件夹有哪些"、"我的文件夹有哪些"、"收藏夹都有哪些"
    // 注意：排除 "X文件夹里有什么"（这是搜索文件夹内容，不是列出文件夹）
    pattern:
      /^(我的|用户的)?(文件夹|目录|收藏夹)(有哪些|有什么|都有什么|是什么|一共有几个)/,
    type: "query",
    subType: "list_folders",
    complexity: "simple",
    weight: 85,
  },
  {
    // 规则 FL3: "列出/显示文件夹" 模式
    // 示例: "列出文件夹"、"显示所有文件夹"、"查看文件夹列表"
    pattern: /(列出|显示|查看).{0,5}(所有|全部)?.{0,3}(文件夹|目录|收藏夹)/,
    type: "query",
    subType: "list_folders",
    complexity: "simple",
    weight: 86,
  },
  {
    // 规则 FL4: "文件夹列表" 模式
    // 示例: "文件夹列表"、"目录结构"、"收藏夹结构"
    pattern: /(文件夹|目录|收藏夹).{0,3}(列表|结构|清单)/,
    type: "query",
    subType: "list_folders",
    complexity: "simple",
    weight: 84,
  },
  {
    // 规则 S7: 分类筛选查询
    // 示例: "找出所有技术类的"、"全部学习相关的"
    pattern:
      /(找出|列出)?(所有|全部).{0,5}(技术|学习|工作|生活|娱乐|编程|设计)(类|相关)?(的)?/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 82,
  },
  // --------------------------------------------
  // Phase 3: 搜索意图补充规则 (2026-01-09)
  // --------------------------------------------
  {
    // 规则 P3-S1: 媒体类型 + 疑问词查询
    // 示例: "最近收藏的视频在哪"、"那个文章去哪了"
    pattern:
      /(收藏|保存).{0,5}(的)?.{0,5}(视频|文章|图片|链接|笔记).{0,5}(在哪|去哪|哪里|哪儿|在哪里)/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 89,
  },
  {
    // Phase 1 新增：隐含搜索意图（找不到表达）
    // 示例："找不到那个了"、"找不到"
    pattern: /找不到/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 75,
  },
  {
    // Phase 1 新增：那个...在哪（指代+搜索）
    // 示例："那个AI的文章在哪"、"那篇文章在哪"
    pattern: /(那个|那篇).{1,15}(在哪|去哪)/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 78,
  },
  {
    // Phase 1.1 新增：忘了放哪/忘记存哪（隐含搜索）
    // 示例："有个关于 Docker 的教程我忘了放哪了"
    pattern: /忘了(放|存)(哪|在哪)/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 80,
  },
  {
    // Phase 1.1 新增：XX相关的（简短搜索）
    // 示例："AI相关的"、"Python相关的"
    pattern: /^.{1,15}相关的?$/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 60,
  },
  {
    // Phase 1.1 新增：那个+媒体类型（指代搜索）
    // 示例："那个视频"、"那篇文章"
    pattern: /^(那个|那篇|那条).{0,5}(视频|文章|链接|图片|笔记)$/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 65,
  },
  {
    // Phase 1.1 新增：英文 search 指令
    // 示例："search React hooks"、"Search typescript"
    pattern: /^search\s+.+$/i,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 85,
  },
  // --------------------------------------------

  {
    // Golden Dataset 增强：时间范围列表查询
    // 示例: "最近收藏"、"今天的收藏"、"本周收藏"、"近期添加的"
    pattern:
      /(最近|今天|昨天|本周|上周|近期|这周).{0,5}(的)?.{0,3}(收藏|书签|添加)/,
    type: "query",
    subType: "list",
    complexity: "simple",
    weight: 55,
  },
  {
    // Golden Dataset 增强：查看+时间范围列表查询
    // 示例: "查看最近收藏"、"查看今天添加的"
    pattern: /查看.{0,3}(最近|今天|昨天|本周|上周|近期).{0,5}(收藏|书签|添加)/,
    type: "query",
    subType: "list",
    complexity: "simple",
    weight: 60,
  },
  {
    // Phase 1 新增：看看+书签/收藏（口语化列表查询）
    // 示例："看看我的书签"、"看看收藏"
    pattern: /看看.{0,5}(我的)?.{0,3}(书签|收藏)/,
    type: "query",
    subType: "list",
    complexity: "simple",
    weight: 58,
  },
  {
    // Phase 1.1 新增：单独"看看"（简短列表查询）
    // 示例："看看"
    pattern: /^看看$/,
    type: "query",
    subType: "list",
    complexity: "simple",
    weight: 55,
  },
  {
    // Phase 1 新增：有没有+主题（口语化搜索）
    // 示例："有没有 Python 相关的"、"有没有 AI 的"
    // 注意：优先于 refine:check 规则（weight 70）
    pattern: /有没有.{1,20}(相关|的)$/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 72,
  },
  {
    pattern: /什么是|介绍|解释/,
    type: "query",
    subType: "explain",
    complexity: "simple",
    weight: 40,
  },

  // ============================================
  // 操作类
  // ============================================
  {
    // Phase 1 新增：稍后阅读/待阅
    pattern: /稍后.{0,3}(看|读|阅读)|待阅|read.?later|一会儿?再看/i,
    type: "action",
    subType: "read_later",
    complexity: "simple",
    weight: 72,
  },
  {
    // Phase 1 新增：设置提醒
    pattern: /提醒.{0,3}(我|看|读)|设置?.{0,3}提醒|加入?.{0,3}待办/,
    type: "action",
    subType: "reminder",
    complexity: "simple",
    weight: 70,
  },
  {
    // Phase 1 新增：标记已读（权重需高于 tag 规则的 75）
    pattern: /标记?.{0,3}已读|设为.{0,3}已读|已经.{0,3}看过|读过了/,
    type: "action",
    subType: "mark_read",
    complexity: "simple",
    weight: 76,
  },
  {
    // Phase 1 新增：取消收藏（与删除区分）
    // 权重 65：高于 delete (63)，因为更具体
    pattern: /取消.{0,3}收藏|移出.{0,3}收藏|不再.{0,3}收藏|从收藏.{0,3}移除/,
    type: "action",
    subType: "unsave",
    complexity: "simple",
    weight: 65,
  },
  {
    // 修复 NLU-01: 添加收藏/保存操作规则
    // 使用更精确的模式，避免匹配到"删除收藏"、"找收藏"等场景
    pattern:
      /收藏.{0,2}(一下|下|它|这|起来)|保存.{0,2}(一下|下|它|这)|存下来?|加入收藏|添加到收藏|把.{0,5}收藏/,
    type: "action",
    subType: "save",
    complexity: "simple",
    weight: 55,
  },
  {
    // P1-4: action:move 权重从 50 调整到 62，区分于 list (45-60)
    pattern: /移动|转移|放到/,
    type: "action",
    subType: "move",
    complexity: "simple",
    weight: 62,
  },
  {
    // P1-4: action:delete 权重从 50 调整到 63，区分于 list (45-60)
    pattern: /删除|移除|清除|删掉/,
    type: "action",
    subType: "delete",
    complexity: "simple",
    weight: 63,
  },
  {
    // Phase 1.1 新增：口语化删除（删了吧、删了）
    // 示例："删了吧"、"删了"、"删它"
    pattern: /^删了(吧|它)?$/,
    type: "action",
    subType: "delete",
    complexity: "simple",
    weight: 65,
  },
  {
    // 修复 NLU-02: 提高标签规则权重，优先于摘要（weight 70）
    // Golden Dataset 增强：覆盖"加个标签"、"加标签"等口语化表达
    // Phase 1 增强：覆盖"给...加上...标签"、"打个标签叫"等结构
    pattern:
      /添加.{0,3}标签|打标签|标记|标为|设为.{0,3}标签|加.{0,2}标签|给.{0,5}加上.{0,5}标签|打.{0,2}标签.{0,2}叫/,
    type: "action",
    subType: "tag",
    complexity: "simple",
    weight: 75,
  },
  {
    // Phase 1.1 新增：口语化/英文 tag 操作
    // 示例："帮我 tag 一下这个"、"tag it"
    pattern: /tag.{0,5}(一下|下|它|这|这个)|帮我.{0,3}tag/i,
    type: "action",
    subType: "tag",
    complexity: "simple",
    weight: 72,
  },
  {
    // Phase 1 新增：创建文件夹/收藏夹
    // 示例："新建一个文件夹叫技术"、"创建学习收藏夹"
    pattern:
      /新建.{0,5}文件夹|创建.{0,5}(文件夹|收藏夹)|建.{0,3}(文件夹|收藏夹)/,
    type: "action",
    subType: "create_folder",
    complexity: "simple",
    weight: 70,
  },
  {
    // Phase 1 新增：短移动指令
    // 示例："移到工作收藏"
    pattern: /移到.{1,10}(收藏|文件夹)?$/,
    type: "action",
    subType: "move",
    complexity: "simple",
    weight: 55,
  },
  {
    pattern: /重命名|改名/,
    type: "action",
    subType: "rename",
    complexity: "simple",
    weight: 45,
  },

  // ============================================
  // Phase 1.2: 边界场景增强规则 (2026-01-10)
  // 覆盖情感表达、省略主语、动词变形、英文混合等边界场景
  // ============================================

  // --------------------------------------------
  // 情感表达类（带情绪的隐含意图）
  // --------------------------------------------
  {
    // 情感表达：烦躁 + 找不到 → 搜索意图
    // 示例："好烦啊找不到那个网页了"
    pattern: /好?烦.{0,5}找不到/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 70,
  },
  {
    // 情感表达：终于 + 整理 → 整理意图
    // 示例："终于想起来要整理书签了"
    pattern: /终于.{0,5}(整理|清理)/,
    type: "organize",
    subType: "cleanup",
    complexity: "complex",
    weight: 66,
  },
  {
    // 情感表达：头疼/崩溃 + 乱/多 → 整理意图
    // 示例："头疼，收藏太乱了"
    pattern: /(头疼|头痛|崩溃).{0,5}(乱|多|杂)/,
    type: "organize",
    subType: "cleanup",
    complexity: "complex",
    weight: 64,
  },
  {
    // 情感表达：好久没 + 看/整理 → 列表意图
    // 示例："好久没看收藏了"
    // 权重 89：高于 S1 收藏动作信号 (88)，确保情感表达优先
    pattern: /好久没.{0,5}(看|整理|管|打开)/,
    type: "query",
    subType: "list",
    complexity: "simple",
    weight: 89,
  },

  // --------------------------------------------
  // 省略主语类（单词/极简指令）
  // --------------------------------------------
  {
    // 省略主语："整理下" → 整理意图
    pattern: /^整理(下|一下)?$/,
    type: "organize",
    subType: "cleanup",
    complexity: "complex",
    weight: 62,
  },
  {
    // 省略主语："分类" → 分类意图
    pattern: /^分类$/,
    type: "organize",
    subType: "classify",
    complexity: "medium",
    weight: 58,
  },
  {
    // 省略主语："备份" → 分享/备份意图
    pattern: /^备份$/,
    type: "create",
    subType: "share",
    complexity: "medium",
    weight: 68,
  },

  // --------------------------------------------
  // 动词变形类（叠词/变体动词）
  // --------------------------------------------
  {
    // 动词变形："找一找" → 搜索意图
    // 示例："找一找 AI 相关"
    pattern: /找一找.{1,20}/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 68,
  },
  {
    // 动词变形："看一眼" → 列表意图
    pattern: /看一眼/,
    type: "query",
    subType: "list",
    complexity: "simple",
    weight: 50,
  },
  {
    // 动词变形："理一理" → 整理意图
    pattern: /理一理/,
    type: "organize",
    subType: "cleanup",
    complexity: "complex",
    weight: 60,
  },
  {
    // 动词变形："翻一翻" → 列表意图
    pattern: /翻一翻/,
    type: "query",
    subType: "list",
    complexity: "simple",
    weight: 48,
  },

  // --------------------------------------------
  // 英文混合类（中英文混合表达）
  // --------------------------------------------
  {
    // 英文指令："export to markdown" → 导出意图
    pattern: /^export\s+(to\s+)?(markdown|json|csv|html)?$/i,
    type: "create",
    subType: "export",
    complexity: "medium",
    weight: 82,
  },
  {
    // 英文指令："find React" → 搜索意图
    pattern: /^find\s+.+$/i,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 80,
  },
  {
    // 英文指令："delete this" → 删除意图
    pattern: /^delete\s+(this|it|them)?$/i,
    type: "action",
    subType: "delete",
    complexity: "simple",
    weight: 68,
  },
  {
    // 英文指令："tag as important" → 标签意图
    pattern: /^tag\s+(as\s+)?/i,
    type: "action",
    subType: "tag",
    complexity: "simple",
    weight: 70,
  },

  // --------------------------------------------
  // Phase 2A: 隐含意图识别 (2026-01-10)
  // 修复测试失败 B1: 口语化抱怨/模糊请求被误判为 chitchat
  // --------------------------------------------
  {
    // 隐含整理意图："收藏太乱了" → 整理意图
    // 示例："收藏太乱了"、"书签好乱"
    pattern: /(收藏|书签|东西|内容).{0,3}(太|好|很)(乱|杂)/,
    type: "organize",
    subType: "cleanup",
    complexity: "complex",
    weight: 68,
  },
  {
    // 隐含统计意图："东西太多了" → 统计意图
    // 示例："东西太多了"、"收藏好多啊"
    pattern: /(收藏|书签|东西|内容).{0,3}(太|好|很)多/,
    type: "query",
    subType: "stats",
    complexity: "simple",
    weight: 66,
  },
  {
    // 模糊查看请求："帮我看看" → 列表意图
    // 示例："帮我看看"、"看看吧"
    pattern: /(帮我|给我)?看看(吧|呗)?/,
    type: "query",
    subType: "list",
    complexity: "simple",
    weight: 55,
  },
  {
    // 口语化统计："有点多啊" → 统计意图
    // 示例："有点多啊"、"有点儿多"
    pattern: /有点(儿)?多/,
    type: "query",
    subType: "stats",
    complexity: "simple",
    weight: 56,
  },
  {
    // 单字标签指令："标签" → 标签操作帮助
    // 示例："标签"（单独一个词，询问如何打标签）
    pattern: /^标签$/,
    type: "chitchat",
    subType: "help",
    complexity: "simple",
    weight: 52,
  },
  {
    // 批量删除变体："这些都删了" → 删除意图
    // 示例："这些都删了"、"全部删掉"、"都删了吧"
    pattern: /(这些|那些|全部|都).{0,3}删/,
    type: "action",
    subType: "delete",
    complexity: "simple",
    weight: 72,
  },
  {
    // 问题报告类："那个收藏有问题" → 诊断意图
    // 示例："那个收藏有问题"、"这个链接不对"
    pattern: /(有问题|出错|不对|坏了|失效)/,
    type: "query",
    subType: "diagnose",
    complexity: "simple",
    weight: 58,
  },

  // --------------------------------------------
  // Phase 2B: 英文规则扩展 (2026-01-10)
  // 修复测试失败 B2: 英文规则过于严格
  // --------------------------------------------
  {
    // 扩展英文删除："delete bookmark" → 删除意图
    // 示例："delete bookmark"、"delete item"、"delete selected"
    pattern: /^delete\s+(bookmark|item|selected|all)s?$/i,
    type: "action",
    subType: "delete",
    complexity: "simple",
    weight: 70,
  },

  // --------------------------------------------
  // 功能询问类（如何使用/功能查询）
  // 权重设置较高 (86-92)，确保询问类优先于操作类规则
  // --------------------------------------------
  {
    // 功能询问："怎么导出书签" → 帮助意图
    // 权重 90：高于 export (85)，怎么 + 动词 = 询问用法
    pattern: /怎么.{0,5}(导出|整理|搜索|分类|标签|备份)/,
    type: "chitchat",
    subType: "help",
    complexity: "simple",
    weight: 90,
  },
  {
    // 功能询问："有没有自动分类功能" → 帮助意图
    // 权重 88：高于 classify (70)，有没有...功能 = 询问能力
    pattern: /有没有.{0,5}(自动|智能).{0,5}功能/,
    type: "chitchat",
    subType: "help",
    complexity: "simple",
    weight: 88,
  },
  {
    // 功能询问："能自动整理吗" → 帮助意图
    // 权重 88：高于 cleanup (80)，能...吗 = 询问能力
    pattern: /能.{0,3}(自动|智能).{0,5}(整理|分类|标签)吗?/,
    type: "chitchat",
    subType: "help",
    complexity: "simple",
    weight: 88,
  },
  // --------------------------------------------
  // Phase 2C: 权重调整 - 询问模式优先 (2026-01-10)
  // 修复测试失败 B3: 询问被误判为操作
  // --------------------------------------------
  {
    // 询问模式："可以批量删除吗" → 帮助意图
    // 权重 92：高于 delete (63)，"可以...吗" = 询问能力
    pattern: /可以.{0,8}(删除|整理|导出|搜索|分类|标签)吗/,
    type: "chitchat",
    subType: "help",
    complexity: "simple",
    weight: 92,
  },
  {
    // 询问模式："支持搜索吗" → 帮助意图
    // 权重 92：高于 search (70)，"支持...吗" = 询问能力
    pattern: /支持.{0,8}(搜索|删除|导出|分类|标签)吗/,
    type: "chitchat",
    subType: "help",
    complexity: "simple",
    weight: 92,
  },
  {
    // 询问模式："该怎么组织" → 帮助意图
    // 示例："文件夹该怎么组织"
    pattern: /该怎么.{0,8}(组织|整理|分类|管理)/,
    type: "chitchat",
    subType: "help",
    complexity: "simple",
    weight: 91,
  },
  {
    // 数量询问模式："有多少没整理的" → 统计意图
    // 权重 88：高于 cleanup (80)，"有多少" = 询问数量
    pattern: /有多少.{0,5}(没|未|不|还)/,
    type: "query",
    subType: "count",
    complexity: "simple",
    weight: 88,
  },
  {
    // 多步骤请求识别："整理一下然后导出" → 整理+导出
    // 识别主意图（整理），subType 标记为复合操作
    pattern: /整理.{0,5}(然后|再|接着|完了).{0,5}导出/,
    type: "organize",
    subType: "cleanup_then_export",
    complexity: "complex",
    weight: 88,
  },

  // ============================================
  // 闲聊类（最低优先级）
  // ============================================
  // --------------------------------------------
  // Phase 3: 闲聊增强规则 (2026-01-09)
  // --------------------------------------------
  {
    // 规则 P3-C1: 能力询问
    // 示例: "你能做什么"、"AI可以帮我什么"
    pattern: /(你|AI).{0,3}(能|可以|会).{0,5}(做什么|干什么|帮我|处理)/,
    type: "chitchat",
    subType: "help",
    complexity: "simple",
    weight: 25,
  },
  {
    // Phase 2D: 纯符号表达式 → 闲聊
    // 示例: "???"、"??"、"！！！"
    pattern: /^[?？!！.。…]+$/,
    type: "chitchat",
    subType: "general",
    complexity: "simple",
    weight: 45,
  },
  // --------------------------------------------
  {
    pattern: /你好|您好|嗨|hi|hello/i,
    type: "chitchat",
    subType: "greeting",
    complexity: "simple",
    weight: 10,
  },
  {
    pattern: /帮助|怎么用|如何使用|功能/,
    type: "chitchat",
    subType: "help",
    complexity: "simple",
    weight: 15,
  },
  {
    pattern: /谢谢|感谢|辛苦/,
    type: "chitchat",
    subType: "thanks",
    complexity: "simple",
    weight: 10,
  },
];

/**
 * 实体提取模式
 */
const ENTITY_PATTERNS: Array<{
  type: ExtractedEntity["type"];
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => string;
}> = [
  // 时间实体
  {
    type: "time",
    pattern: /今[天日]|昨[天日]|前[天日]|本周|上周|这周|本月|上月|这个月/,
    extractor: (m) => m[0],
  },
  {
    type: "time",
    pattern: /最近(\d+)[天日周月]/,
    extractor: (m) => m[0],
  },
  {
    type: "time",
    pattern: /(\d+)[天日周月][前内以]?来?/,
    extractor: (m) => m[0],
  },

  // 数量实体
  {
    type: "quantity",
    pattern: /(\d+)\s*[条个篇份]/,
    extractor: (m) => m[1],
  },
  {
    type: "quantity",
    pattern: /前\s*(\d+)/,
    extractor: (m) => m[1],
  },

  // 主题实体（关于xxx的）
  {
    type: "topic",
    pattern: /关于(.+?)的|(.+?)相关|(.+?)方面/,
    extractor: (m) => m[1] || m[2] || m[3],
  },

  // 平台实体
  {
    type: "platform",
    pattern: /微信|公众号|B站|bilibili|小红书|知乎|掘金|GitHub|twitter|x\.com/i,
    extractor: (m) => m[0].toLowerCase(),
  },

  // 文件夹实体
  {
    type: "folder",
    pattern: /[「「【\[](.+?)[」」】\]]|"(.+?)"|'(.+?)'/,
    extractor: (m) => m[1] || m[2] || m[3],
  },
];

/**
 * 意图分类器
 */
export class IntentClassifier {
  private rules: IntentRule[];
  private config: IntentClassifierConfig;
  private llmClassifier: LLMIntentClassifier | null = null;

  constructor(config: IntentClassifierConfig = {}) {
    this.config = {
      enableEntityExtraction: true,
      llmTimeoutMs: 5000,
      llmFallbackThreshold: 0.6,
      debug: false,
      ...config,
    };

    // 合并自定义规则和默认规则
    this.rules = [...(config.customRules || []), ...DEFAULT_RULES].sort(
      (a, b) => (b.weight || 0) - (a.weight || 0),
    );

    // 初始化 LLM 分类器（如果启用）
    if (config.enableLLMFallback) {
      this.llmClassifier = createLLMClassifier({
        timeoutMs: config.llmTimeoutMs,
        ...config.llmClassifierConfig,
        debug: config.debug,
      });
    }
  }

  /**
   * 分类用户意图
   *
   * @param message - 用户输入的消息
   * @returns 意图分类结果
   */
  async classify(message: string): Promise<IntentClassification> {
    const startTime = performance.now();

    // 1. 规则快速匹配
    const ruleMatch = this.matchRules(message);

    if (ruleMatch && ruleMatch.confidence >= 0.8) {
      if (this.config.debug) {
        logger.debug(
          {
            message: message.substring(0, 50),
            intent: ruleMatch.type,
            subType: ruleMatch.subType,
            confidence: ruleMatch.confidence,
            source: "rule",
            durationMs: Math.round(performance.now() - startTime),
          },
          "IntentClassifier: Rule match succeeded",
        );
      }
      return ruleMatch;
    }

    // 2. 规则置信度不足，尝试 LLM 兜底
    const llmFallbackThreshold = this.config.llmFallbackThreshold ?? 0.6;

    if (
      this.llmClassifier &&
      (!ruleMatch || ruleMatch.confidence < llmFallbackThreshold)
    ) {
      const llmResult = await this.llmClassifier.classify(message);

      if (llmResult && llmResult.confidence > (ruleMatch?.confidence ?? 0)) {
        if (this.config.debug) {
          logger.debug(
            {
              message: message.substring(0, 50),
              ruleConfidence: ruleMatch?.confidence,
              llmConfidence: llmResult.confidence,
              llmType: llmResult.type,
            },
            "IntentClassifier: LLM fallback used",
          );
        }

        const entities = this.config.enableEntityExtraction
          ? this.extractEntities(message)
          : [];

        // 提取时间范围槽位
        const slots = this.extractTimeRangeSlot(
          message,
          llmResult.type as IntentType,
          llmResult.subType,
        );

        const classification: IntentClassification = {
          type: llmResult.type as IntentType,
          subType: llmResult.subType,
          confidence: llmResult.confidence,
          entities,
          requiresMultiStep: this.isMultiStepByType(
            llmResult.type as IntentType,
          ),
          hasDeliverableExpectation: this.expectsDeliverableByType(
            llmResult.type as IntentType,
            llmResult.subType,
          ),
          source: "llm",
          slots,
        };

        return classification;
      }
    }

    // 3. 规则匹配置信度不足但有结果，返回规则结果
    if (ruleMatch) {
      if (this.config.debug) {
        logger.debug(
          {
            message: message.substring(0, 50),
            intent: ruleMatch.type,
            confidence: ruleMatch.confidence,
            source: "rule",
            note: "Low confidence, LLM unavailable or no improvement",
          },
          "IntentClassifier: Using rule match with low confidence",
        );
      }
      return ruleMatch;
    }

    // 4. 无规则匹配，返回默认结果
    const defaultResult = this.getDefaultClassification(message);
    if (this.config.debug) {
      logger.debug(
        {
          message: message.substring(0, 50),
          intent: defaultResult.type,
          source: "default",
        },
        "IntentClassifier: No rule match, using default",
      );
    }

    return defaultResult;
  }

  /**
   * 根据意图类型判断是否需要多步骤
   */
  private isMultiStepByType(type: IntentType): boolean {
    const multiStepTypes: IntentType[] = ["organize", "analyze", "learn"];
    return multiStepTypes.includes(type);
  }

  /**
   * 根据意图类型判断是否期望交付物
   */
  private expectsDeliverableByType(
    type: IntentType,
    subType?: string,
  ): boolean {
    const deliverableTypes: IntentType[] = ["analyze", "create", "learn"];
    if (deliverableTypes.includes(type)) {
      return true;
    }
    const deliverableSubTypes = ["report", "digest", "path", "share", "review"];
    return subType ? deliverableSubTypes.includes(subType) : false;
  }

  /**
   * 规则匹配
   */
  private matchRules(message: string): IntentClassification | null {
    for (const rule of this.rules) {
      if (rule.pattern.test(message)) {
        const entities = this.config.enableEntityExtraction
          ? this.extractEntities(message)
          : [];

        // 提取时间范围槽位
        const slots = this.extractTimeRangeSlot(
          message,
          rule.type,
          rule.subType,
        );

        return {
          type: rule.type,
          subType: rule.subType,
          confidence: this.calculateConfidence(message, rule),
          entities,
          requiresMultiStep: this.isMultiStepTask(rule),
          hasDeliverableExpectation: this.expectsDeliverable(rule),
          source: "rule",
          slots,
        };
      }
    }
    return null;
  }

  /**
   * 提取实体
   */
  private extractEntities(message: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    for (const { type, pattern, extractor } of ENTITY_PATTERNS) {
      const matches = message.matchAll(new RegExp(pattern, "g"));
      for (const match of matches) {
        const value = extractor(match);
        if (value) {
          entities.push({
            type,
            value: value.trim(),
            raw: match[0],
            confidence: 0.9,
          });
        }
      }
    }

    return entities;
  }

  /**
   * 从用户输入提取时间范围槽位
   *
   * @param message - 用户输入
   * @param intentType - 意图类型
   * @param subType - 意图子类型
   * @returns IntentSlotSchema 或 undefined
   */
  private extractTimeRangeSlot(
    message: string,
    intentType: IntentType,
    subType?: string,
  ): IntentSlotSchema | undefined {
    const timeRange = extractTimeRangeFromText(message);

    if (!timeRange) {
      return undefined;
    }

    const intentKey = subType
      ? `${intentType}:${subType}`
      : `${intentType}:general`;

    return {
      intentType: intentKey as `${IntentType}:${string}`,
      slots: {
        timeRange: {
          name: "timeRange",
          value: timeRange,
          type: "string",
          confidence: 0.9,
          required: false,
          source: "extracted",
        },
      },
      completeness: 1.0,
    };
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(message: string, rule: IntentRule): number {
    let confidence = 0.85;

    // 消息长度影响置信度（太短可能不够明确）
    if (message.length < 5) {
      confidence -= 0.1;
    } else if (message.length > 50) {
      confidence -= 0.05;
    }

    // 规则权重影响置信度
    if (rule.weight && rule.weight >= 80) {
      confidence += 0.05;
    }

    // 确保在有效范围内
    return Math.max(0.5, Math.min(1, confidence));
  }

  /**
   * 判断是否需要多步骤
   */
  private isMultiStepTask(rule: IntentRule): boolean {
    // 复杂任务通常需要多步骤
    if (rule.complexity === "complex") {
      return true;
    }

    // 特定意图类型通常需要多步骤
    const multiStepTypes: IntentType[] = ["organize", "analyze", "learn"];
    return multiStepTypes.includes(rule.type);
  }

  /**
   * 判断是否期望交付物
   */
  private expectsDeliverable(rule: IntentRule): boolean {
    // 这些类型通常期望获得文档/报告等交付物
    const deliverableTypes: IntentType[] = ["analyze", "create", "learn"];
    if (deliverableTypes.includes(rule.type)) {
      return true;
    }

    // 特定子类型也期望交付物
    const deliverableSubTypes = ["report", "digest", "path", "share", "review"];
    return rule.subType ? deliverableSubTypes.includes(rule.subType) : false;
  }

  /**
   * 获取默认分类结果（无规则匹配时）
   */
  private getDefaultClassification(message: string): IntentClassification {
    const entities = this.config.enableEntityExtraction
      ? this.extractEntities(message)
      : [];

    // 根据消息特征推断
    // 如果包含问号，可能是查询
    if (message.includes("?") || message.includes("？")) {
      return {
        type: "query",
        subType: "general",
        confidence: 0.5,
        entities,
        requiresMultiStep: false,
        hasDeliverableExpectation: false,
        source: "rule",
      };
    }

    // 默认当作闲聊处理
    return {
      type: "chitchat",
      subType: "general",
      confidence: 0.4,
      entities,
      requiresMultiStep: false,
      hasDeliverableExpectation: false,
      source: "rule",
    };
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: IntentRule): void {
    this.rules.unshift(rule);
    this.rules.sort((a, b) => (b.weight || 0) - (a.weight || 0));
  }

  /**
   * 获取所有规则（用于调试）
   */
  getRules(): IntentRule[] {
    return [...this.rules];
  }

  // ============================================
  // 多候选收集机制 (Phase 1.1)
  // ============================================

  /**
   * 收集所有匹配的意图候选项
   *
   * 遍历所有规则，返回所有匹配结果，不立即返回
   *
   * @param message - 用户输入的消息
   * @returns 所有匹配的候选项列表
   */
  collectAllMatches(message: string): IntentCandidate[] {
    const candidates: IntentCandidate[] = [];

    for (const rule of this.rules) {
      const match = rule.pattern.exec(message);
      if (match) {
        const confidence = this.calculateConfidence(message, rule);
        const candidate: IntentCandidate = {
          pattern: rule.pattern.source,
          type: rule.type,
          subType: rule.subType,
          weight: rule.weight || 0,
          matchIndex: match.index,
          confidence,
          complexity: rule.complexity,
        };
        candidates.push(candidate);

        // ========================================
        // 高权重规则短路优化
        // 权重 ≥95 且置信度 ≥0.9 时，跳过剩余规则遍历
        // ========================================
        if (
          FeatureFlags.ENABLE_EARLY_RETURN &&
          (rule.weight || 0) >= 95 &&
          confidence >= 0.9
        ) {
          logger.debug(
            {
              pattern: rule.pattern.source.slice(0, 50),
              weight: rule.weight,
              confidence,
              skippedRules: this.rules.length - this.rules.indexOf(rule) - 1,
            },
            "IntentClassifier: Early return (high weight rule)",
          );
          break; // 跳过剩余规则
        }
      }
    }

    // 按置信度降序排序
    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 候选去重：相同意图类型只保留最高权重的候选
   *
   * @param candidates - 原始候选列表
   * @returns 去重后的候选列表
   */
  deduplicateCandidates(candidates: IntentCandidate[]): IntentCandidate[] {
    const typeMap = new Map<IntentType, IntentCandidate>();

    for (const candidate of candidates) {
      const existing = typeMap.get(candidate.type);
      if (!existing || candidate.weight > existing.weight) {
        typeMap.set(candidate.type, candidate);
      }
    }

    // 按置信度降序排序后返回
    return Array.from(typeMap.values()).sort(
      (a, b) => b.confidence - a.confidence,
    );
  }

  /**
   * 多候选分类（完整流程）
   *
   * 1. 收集所有匹配
   * 2. 去重
   * 3. 判断是否需要消歧
   * 4. 返回结果
   *
   * @param message - 用户输入的消息
   * @returns 多候选分类结果
   */
  async classifyWithCandidates(message: string): Promise<MultiCandidateResult> {
    const startTime = performance.now();

    // 1. 收集所有匹配
    const allMatches = this.collectAllMatches(message);

    // 2. 去重
    const candidates = this.deduplicateCandidates(allMatches);

    // 3. 提取实体
    const entities = this.config.enableEntityExtraction
      ? this.extractEntities(message)
      : [];

    // 4. 无候选时返回默认结果
    if (candidates.length === 0) {
      const defaultResult = this.getDefaultClassification(message);
      logger.debug(
        {
          message: message.substring(0, 50),
          candidates: 0,
          durationMs: Math.round(performance.now() - startTime),
        },
        "IntentClassifier: No candidates found, using default",
      );
      return {
        primary: defaultResult,
        candidates: [],
        disambiguated: false,
      };
    }

    // 5. 单一候选直接返回
    if (candidates.length === 1) {
      const primary = this.candidateToClassification(candidates[0], entities);
      logger.debug(
        {
          message: message.substring(0, 50),
          intent: primary.type,
          candidates: 1,
          durationMs: Math.round(performance.now() - startTime),
        },
        "IntentClassifier: Single candidate",
      );
      return {
        primary,
        candidates,
        disambiguated: false,
      };
    }

    // 6. 多候选：检查是否需要消歧
    const threshold = this.config.disambiguationThreshold ?? 0.2;
    const top1 = candidates[0];
    const top2 = candidates[1];
    const needsDisambiguation = top1.confidence - top2.confidence < threshold;

    if (needsDisambiguation) {
      logger.debug(
        {
          message: message.substring(0, 50),
          top1: { type: top1.type, confidence: top1.confidence },
          top2: { type: top2.type, confidence: top2.confidence },
          gap: top1.confidence - top2.confidence,
        },
        "IntentClassifier: Disambiguation needed",
      );

      // 调用消歧规则引擎
      const disambiguationResult = this.disambiguate(message, candidates);

      if (disambiguationResult.disambiguated) {
        const winner = candidates.find(
          (c) => c.type === disambiguationResult.winnerType,
        );

        if (winner) {
          const primary = this.candidateToClassification(winner, entities);

          logger.debug(
            {
              message: message.substring(0, 50),
              intent: primary.type,
              rule: disambiguationResult.ruleId,
              reason: disambiguationResult.reason,
              durationMs: Math.round(performance.now() - startTime),
            },
            "IntentClassifier: Disambiguation succeeded",
          );

          return {
            primary,
            candidates,
            disambiguated: true,
            disambiguationReason: disambiguationResult.reason,
          };
        }
      }
    }

    // 无消歧或消歧失败，返回 top1 作为主意图
    const primary = this.candidateToClassification(top1, entities);

    logger.debug(
      {
        message: message.substring(0, 50),
        intent: primary.type,
        candidates: candidates.length,
        needsDisambiguation,
        durationMs: Math.round(performance.now() - startTime),
      },
      "IntentClassifier: Multi-candidate result",
    );

    return {
      primary,
      candidates,
      disambiguated: false,
      disambiguationReason: needsDisambiguation
        ? "Confidence gap below threshold"
        : undefined,
    };
  }

  /**
   * 将候选项转换为完整的分类结果
   */
  private candidateToClassification(
    candidate: IntentCandidate,
    entities: ExtractedEntity[],
  ): IntentClassification {
    return {
      type: candidate.type,
      subType: candidate.subType,
      confidence: candidate.confidence,
      entities,
      requiresMultiStep: this.isMultiStepByCandidate(candidate),
      hasDeliverableExpectation: this.expectsDeliverableByCandidate(candidate),
      source: "rule",
    };
  }

  /**
   * 根据候选判断是否需要多步骤
   */
  private isMultiStepByCandidate(candidate: IntentCandidate): boolean {
    if (candidate.complexity === "complex") {
      return true;
    }
    const multiStepTypes: IntentType[] = ["organize", "analyze", "learn"];
    return multiStepTypes.includes(candidate.type);
  }

  /**
   * 根据候选判断是否期望交付物
   */
  private expectsDeliverableByCandidate(candidate: IntentCandidate): boolean {
    const deliverableTypes: IntentType[] = ["analyze", "create", "learn"];
    if (deliverableTypes.includes(candidate.type)) {
      return true;
    }
    const deliverableSubTypes = ["report", "digest", "path", "share", "review"];
    return candidate.subType
      ? deliverableSubTypes.includes(candidate.subType)
      : false;
  }

  // ============================================
  // 消歧规则引擎 (Phase 1.2)
  // ============================================

  /**
   * 消歧结果类型
   */
  private disambiguationRules: DisambiguationRule[] = DISAMBIGUATION_RULES;

  /**
   * 执行消歧逻辑
   *
   * 当多个意图候选置信度接近时，使用消歧规则选择正确的意图
   *
   * @param message - 用户输入的消息
   * @param candidates - 候选意图列表
   * @returns 消歧结果
   */
  disambiguate(
    message: string,
    candidates: IntentCandidate[],
  ): {
    disambiguated: boolean;
    winnerType?: IntentType;
    ruleId?: string;
    reason?: string;
  } {
    if (candidates.length < 2) {
      return { disambiguated: false };
    }

    // 获取所有冲突的意图类型
    const conflictTypes = candidates.map((c) => c.type);

    // 查找匹配的消歧规则
    const matchedRule = findMatchingRule(message, conflictTypes);

    if (matchedRule) {
      // 确保 winner 类型在候选列表中
      const winnerExists = candidates.some(
        (c) => c.type === matchedRule.winner,
      );

      if (winnerExists) {
        logger.debug(
          {
            message: message.substring(0, 50),
            ruleId: matchedRule.id,
            winner: matchedRule.winner,
            conflictTypes,
          },
          "IntentClassifier: Disambiguation rule matched",
        );

        return {
          disambiguated: true,
          winnerType: matchedRule.winner,
          ruleId: matchedRule.id,
          reason: matchedRule.reason,
        };
      }
    }

    // 无匹配规则，尝试基于位置消歧
    // 规则：如果多个意图匹配，优先选择匹配位置更靠后的（通常是核心动词）
    const sortedByPosition = [...candidates].sort(
      (a, b) => b.matchIndex - a.matchIndex,
    );

    // 如果位置差距大于 5 个字符，使用位置消歧
    if (
      sortedByPosition.length >= 2 &&
      sortedByPosition[0].matchIndex - sortedByPosition[1].matchIndex > 5
    ) {
      logger.debug(
        {
          message: message.substring(0, 50),
          winner: sortedByPosition[0].type,
          positions: candidates.map((c) => ({
            type: c.type,
            index: c.matchIndex,
          })),
        },
        "IntentClassifier: Position-based disambiguation",
      );

      return {
        disambiguated: true,
        winnerType: sortedByPosition[0].type,
        ruleId: "position-based",
        reason: "后置核心动词优先",
      };
    }

    return { disambiguated: false };
  }

  /**
   * 添加自定义消歧规则
   *
   * @param rule - 消歧规则
   */
  addDisambiguationRule(rule: DisambiguationRule): void {
    this.disambiguationRules.unshift(rule);
    this.disambiguationRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取所有消歧规则（用于调试）
   */
  getDisambiguationRules(): DisambiguationRule[] {
    return [...this.disambiguationRules];
  }

  /**
   * 获取 LLM 分类器（用于调试和状态监控）
   */
  getLLMClassifier(): LLMIntentClassifier | null {
    return this.llmClassifier;
  }

  /**
   * 检查 LLM 分类器是否已启用
   */
  isLLMFallbackEnabled(): boolean {
    return this.llmClassifier !== null;
  }

  /**
   * 获取 LLM 分类器缓存统计（用于监控）
   */
  getLLMCacheStats(): {
    size: number;
    activeCount: number;
    expiredCount: number;
  } | null {
    return this.llmClassifier?.getCacheStats() ?? null;
  }

  /**
   * 清理 LLM 分类器缓存
   */
  cleanupLLMCache(): number {
    return this.llmClassifier?.cleanupCache() ?? 0;
  }
}

/**
 * 创建意图分类器实例
 */
export function createIntentClassifier(
  config?: IntentClassifierConfig,
): IntentClassifier {
  return new IntentClassifier(config);
}

/**
 * 默认意图分类器实例
 */
export const intentClassifier = new IntentClassifier();
