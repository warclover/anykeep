# 意图理解增强 - Phase 1 实现规范

> **版本**: 1.0.0
> **日期**: 2026-01-09
> **状态**: 待审核
> **预估工时**: 3-4 天

---

## 1. 目标与范围

### 1.1 目标

通过规则层增强，将高频场景的意图识别准确率从 ~70% 提升至 ≥90%。

### 1.2 范围

- ✅ 新增/优化意图分类规则
- ✅ 添加消歧义规则
- ✅ 支持中文数字提取
- ✅ 增强 Skill 参数解析
- ✅ 完善测试用例覆盖
- ❌ 不涉及 LLM 消歧义（Phase 2）
- ❌ 不涉及用户反馈学习（Phase 3）

---

## 2. 高频场景完整测试集

### 2.1 测试用例设计原则

1. **覆盖用户自然表达的多样性**：同一意图的不同说法
2. **包含口语化表达**：省略、简化、模糊表述
3. **包含歧义场景**：需要上下文或消歧的情况
4. **标注期望行为**：意图类型、子类型、Skill、关键参数

### 2.2 搜索查找类（Search）- 20 个用例

| ID  | 用户表达                       | 意图  | 子类型 | Skill  | 关键实体               | 优先级 |
| --- | ------------------------------ | ----- | ------ | ------ | ---------------------- | ------ |
| S01 | "找一下关于 React 的文章"      | query | search | atomic | topic: React           | P0     |
| S02 | "我收藏过一篇讲 TypeScript 的" | query | search | atomic | topic: TypeScript      | P0     |
| S03 | "最近收藏的视频在哪"           | query | list   | atomic | time: 最近, type: 视频 | P0     |
| S04 | "有没有 B站 的收藏"            | query | search | atomic | platform: bilibili     | P0     |
| S05 | "找出所有技术类的"             | query | search | atomic | tag: 技术              | P0     |
| S06 | "帮我找那篇讲架构的"           | query | search | atomic | topic: 架构            | P0     |
| S07 | "上周收藏了什么"               | query | list   | atomic | time: 上周             | P0     |
| S08 | "工作文件夹里有什么"           | query | list   | atomic | folder: 工作           | P0     |
| S09 | "看看我的收藏"                 | query | list   | atomic | -                      | P1     |
| S10 | "有关于 AI 的吗"               | query | search | atomic | topic: AI              | P1     |
| S11 | "找找微信文章"                 | query | search | atomic | platform: wechat       | P1     |
| S12 | "那个讲设计模式的在哪"         | query | search | atomic | topic: 设计模式        | P1     |
| S13 | "今天收藏的"                   | query | list   | atomic | time: 今天             | P1     |
| S14 | "学习资料文件夹"               | query | list   | atomic | folder: 学习资料       | P1     |
| S15 | "带有 前端 标签的"             | query | search | atomic | tag: 前端              | P1     |
| S16 | "搜索 JavaScript"              | query | search | atomic | keyword: JavaScript    | P1     |
| S17 | "查一下有没有关于数据库的"     | query | search | atomic | topic: 数据库          | P2     |
| S18 | "我想看看之前收藏的教程"       | query | list   | atomic | type: 教程             | P2     |
| S19 | "找出收藏时间最早的"           | query | list   | atomic | sort: time_asc         | P2     |
| S20 | "显示所有未读的"               | query | list   | atomic | status: unread         | P2     |

### 2.3 内容理解类（Understanding）- 25 个用例 ⚠️ 歧义高发

#### 2.3.1 快速摘要意图（digest）

| ID  | 用户表达             | 意图   | 子类型 | Skill        | 关键实体 | 优先级 |
| --- | -------------------- | ------ | ------ | ------------ | -------- | ------ |
| U01 | "生成这些书签的摘要" | create | digest | quick_digest | -        | P0     |
| U02 | "给我看看每篇的要点" | create | digest | quick_digest | -        | P0     |
| U03 | "快速过一遍这些内容" | create | digest | quick_digest | -        | P0     |
| U04 | "帮我列出关键点"     | create | digest | quick_digest | -        | P1     |
| U05 | "逐条总结一下"       | create | digest | quick_digest | -        | P1     |
| U06 | "分别概括每篇"       | create | digest | quick_digest | -        | P1     |
| U07 | "提取要点"           | create | digest | quick_digest | -        | P1     |
| U08 | "速览这几篇"         | create | digest | quick_digest | -        | P2     |

#### 2.3.2 主题合成意图（synthesis）⚠️ 重点优化区

| ID      | 用户表达                   | 意图   | 子类型    | Skill              | 关键实体             | 优先级 | 当前问题               |
| ------- | -------------------------- | ------ | --------- | ------------------ | -------------------- | ------ | ---------------------- |
| **U09** | "结合最近三个收藏写个总结" | create | synthesis | thematic_synthesis | limit: 3, time: 最近 | P0     | ❌ 路由到 digest       |
| **U10** | "帮我总结一下这几篇"       | create | synthesis | thematic_synthesis | -                    | P0     | ⚠️ 歧义                |
| **U11** | "把这些内容整合成一篇文章" | create | synthesis | thematic_synthesis | -                    | P0     | ❌ 可能路由到 organize |
| **U12** | "写一篇关于这个主题的综述" | create | synthesis | thematic_synthesis | -                    | P0     | ✅ 有"综述"            |
| **U13** | "帮我把这些知识点融合一下" | create | synthesis | thematic_synthesis | -                    | P0     | ❌ "融合"未覆盖        |
| **U14** | "生成一篇综合报告"         | create | synthesis | thematic_synthesis | -                    | P0     | ✅ 有"综合"            |
| **U15** | "汇总这些文章的观点"       | create | synthesis | thematic_synthesis | -                    | P1     | ⚠️ "汇总"歧义          |
| **U16** | "把这几篇合成一个文档"     | create | synthesis | thematic_synthesis | -                    | P1     | ⚠️ 有"合成"            |
| **U17** | "整理成一篇完整的笔记"     | create | synthesis | thematic_synthesis | -                    | P1     | ⚠️ "整理"可能误判      |
| **U18** | "归纳总结一下这些内容"     | create | synthesis | thematic_synthesis | -                    | P1     | ⚠️ "归纳"歧义          |
| **U19** | "写个学习笔记"             | create | synthesis | thematic_synthesis | -                    | P1     | ⚠️ 可能路由到 note     |
| **U20** | "形成一份报告"             | create | synthesis | thematic_synthesis | -                    | P2     | ⚠️ 歧义                |
| **U21** | "把最近五篇整合一下"       | create | synthesis | thematic_synthesis | limit: 5, time: 最近 | P0     | ❌ 数字+整合           |
| **U22** | "融合成一篇"               | create | synthesis | thematic_synthesis | -                    | P1     | ❌ "融合"未覆盖        |
| **U23** | "综合分析这些"             | create | synthesis | thematic_synthesis | -                    | P1     | ✅ 有"综合"            |
| **U24** | "提炼成一份文档"           | create | synthesis | thematic_synthesis | -                    | P2     | ⚠️ "提炼"未覆盖        |
| **U25** | "帮我做个知识梳理"         | create | synthesis | thematic_synthesis | -                    | P2     | ⚠️ "梳理"歧义          |

### 2.4 整理归档类（Organize）- 15 个用例

| ID  | 用户表达             | 意图     | 子类型    | Skill             | 关键实体     | 优先级 |
| --- | -------------------- | -------- | --------- | ----------------- | ------------ | ------ |
| O01 | "整理一下我的收藏"   | organize | cleanup   | batch_organize    | -            | P0     |
| O02 | "给这些打上标签"     | action   | tag       | atomic            | -            | P0     |
| O03 | "移到学习文件夹"     | action   | move      | atomic            | folder: 学习 | P0     |
| O04 | "清理重复的书签"     | organize | dedupe    | duplicate_cleanup | -            | P0     |
| O05 | "帮我分类一下"       | organize | classify  | smart_tagging     | -            | P0     |
| O06 | "把过期的链接找出来" | organize | expire    | link_health_check | -            | P1     |
| O07 | "归档到工作文件夹"   | action   | move      | atomic            | folder: 工作 | P1     |
| O08 | "加个 技术 标签"     | action   | tag       | atomic            | tag: 技术    | P1     |
| O09 | "删除这几个"         | action   | delete    | atomic            | -            | P1     |
| O10 | "批量打标签"         | action   | tag       | atomic            | batch: true  | P1     |
| O11 | "清理无效链接"       | organize | expire    | link_health_check | -            | P1     |
| O12 | "重新分类"           | organize | classify  | smart_tagging     | -            | P2     |
| O13 | "合并重复"           | organize | dedupe    | duplicate_cleanup | -            | P2     |
| O14 | "整理到文件夹"       | action   | move      | atomic            | -            | P2     |
| O15 | "标记为已读"         | action   | mark_read | atomic            | -            | P2     |

### 2.5 数据统计类（Analytics）- 12 个用例

| ID  | 用户表达               | 意图    | 子类型  | Skill           | 关键实体       | 优先级 |
| --- | ---------------------- | ------- | ------- | --------------- | -------------- | ------ |
| A01 | "我有多少收藏"         | query   | count   | atomic          | -              | P0     |
| A02 | "分析一下我的阅读习惯" | analyze | insight | insight_report  | -              | P0     |
| A03 | "生成本周的阅读报告"   | analyze | report  | periodic_report | time: 本周     | P0     |
| A04 | "看看各平台的分布"     | analyze | insight | insight_report  | -              | P1     |
| A05 | "统计一下标签使用情况" | query   | count   | atomic          | entity: tag    | P1     |
| A06 | "月度报告"             | analyze | report  | periodic_report | time: 本月     | P1     |
| A07 | "最近收藏趋势"         | analyze | insight | insight_report  | time: 最近     | P1     |
| A08 | "有多少未读"           | query   | count   | atomic          | status: unread | P2     |
| A09 | "分析收藏来源"         | analyze | insight | insight_report  | -              | P2     |
| A10 | "本周收藏了多少"       | query   | count   | atomic          | time: 本周     | P2     |
| A11 | "阅读量统计"           | analyze | insight | insight_report  | -              | P2     |
| A12 | "生成洞察报告"         | analyze | insight | insight_report  | -              | P2     |

### 2.6 导出分享类（Export）- 10 个用例

| ID  | 用户表达           | 意图   | 子类型 | Skill        | 关键实体         | 优先级 |
| --- | ------------------ | ------ | ------ | ------------ | ---------------- | ------ |
| E01 | "导出成 Markdown"  | create | share  | data_export  | format: markdown | P0     |
| E02 | "分享这几篇给朋友" | create | share  | share_bundle | -                | P0     |
| E03 | "备份我的收藏"     | create | share  | data_export  | -                | P0     |
| E04 | "导出到 Obsidian"  | create | share  | data_export  | format: obsidian | P1     |
| E05 | "生成 PDF"         | create | share  | data_export  | format: pdf      | P1     |
| E06 | "导出 CSV"         | create | share  | data_export  | format: csv      | P1     |
| E07 | "打包下载"         | create | share  | data_export  | -                | P2     |
| E08 | "导出这个文件夹"   | create | share  | data_export  | scope: folder    | P2     |
| E09 | "分享链接"         | create | share  | share_bundle | -                | P2     |
| E10 | "生成分享包"       | create | share  | share_bundle | -                | P2     |

### 2.7 学习复习类（Learn）- 10 个用例

| ID  | 用户表达                | 意图  | 子类型              | Skill            | 关键实体     | 优先级 |
| --- | ----------------------- | ----- | ------------------- | ---------------- | ------------ | ------ |
| L01 | "开始复习"              | learn | active_recall_start | active_recall    | -            | P0     |
| L02 | "帮我制定学习计划"      | learn | path                | learning_path    | -            | P0     |
| L03 | "复习一下 React 相关的" | learn | review              | knowledge_review | topic: React | P0     |
| L04 | "今天要复习什么"        | learn | active_recall_start | active_recall    | -            | P1     |
| L05 | "学习路径规划"          | learn | path                | learning_path    | -            | P1     |
| L06 | "回顾最近学的"          | learn | review              | knowledge_review | time: 最近   | P1     |
| L07 | "知识巩固"              | learn | review              | knowledge_review | -            | P2     |
| L08 | "复习进度"              | query | mastery_stats       | atomic           | -            | P2     |
| L09 | "我掌握了多少"          | query | mastery_stats       | atomic           | -            | P2     |
| L10 | "继续学习"              | learn | active_recall_start | active_recall    | -            | P2     |

### 2.8 语音朗读类（TTS）- 6 个用例

| ID  | 用户表达     | 意图   | 子类型 | Skill         | 关键实体 | 优先级 |
| --- | ------------ | ------ | ------ | ------------- | -------- | ------ |
| T01 | "读给我听"   | create | tts    | tts_synthesis | -        | P0     |
| T02 | "朗读这篇"   | create | tts    | tts_synthesis | -        | P0     |
| T03 | "播放摘要"   | create | tts    | tts_synthesis | -        | P1     |
| T04 | "语音播放"   | create | tts    | tts_synthesis | -        | P1     |
| T05 | "念一下"     | create | tts    | tts_synthesis | -        | P2     |
| T06 | "听这篇文章" | create | tts    | tts_synthesis | -        | P2     |

### 2.9 闲聊/帮助类（Chitchat）- 8 个用例

| ID  | 用户表达     | 意图     | 子类型   | Skill  | 优先级 |
| --- | ------------ | -------- | -------- | ------ | ------ |
| C01 | "你好"       | chitchat | greeting | atomic | P0     |
| C02 | "你能做什么" | chitchat | help     | atomic | P0     |
| C03 | "帮助"       | chitchat | help     | atomic | P0     |
| C04 | "谢谢"       | chitchat | thanks   | atomic | P1     |
| C05 | "有什么功能" | chitchat | help     | atomic | P1     |
| C06 | "怎么用"     | chitchat | help     | atomic | P1     |
| C07 | "介绍一下"   | chitchat | help     | atomic | P2     |
| C08 | "再见"       | chitchat | greeting | atomic | P2     |

### 2.10 测试用例统计

| 类别     | P0     | P1     | P2     | 总计    | 歧义用例 |
| -------- | ------ | ------ | ------ | ------- | -------- |
| 搜索查找 | 8      | 6      | 6      | 20      | 0        |
| 内容理解 | 10     | 10     | 5      | 25      | **17**   |
| 整理归档 | 5      | 6      | 4      | 15      | 2        |
| 数据统计 | 3      | 5      | 4      | 12      | 0        |
| 导出分享 | 3      | 4      | 3      | 10      | 0        |
| 学习复习 | 3      | 4      | 3      | 10      | 0        |
| 语音朗读 | 2      | 2      | 2      | 6       | 0        |
| 闲聊帮助 | 3      | 3      | 2      | 8       | 0        |
| **总计** | **37** | **40** | **29** | **106** | **19**   |

---

## 3. 规则变更方案

### 3.1 新增 synthesis 规则

**文件**: `src/lib/ai-skills/router/intent-classifier.ts`

```typescript
// ============================================
// 新增规则：融合式内容理解（synthesis）
// 优先级高于普通 digest，确保融合信号被正确识别
// ============================================

// 规则 1: 结合/融合 + 写/生成 + 总结/报告
{
  id: "synthesis-combine-write",
  pattern: /(结合|融合|整合|汇总).{0,15}(写|生成|做|来).{0,5}(总结|报告|文章|笔记)/,
  type: "create",
  subType: "synthesis",
  complexity: "complex",
  weight: 96,
},

// 规则 2: "写一篇" 结构
{
  id: "synthesis-write-article",
  pattern: /写一篇.{0,10}(总结|报告|综述|文章|笔记)/,
  type: "create",
  subType: "synthesis",
  complexity: "complex",
  weight: 94,
},

// 规则 3: 内容 + 融合/合成
{
  id: "synthesis-content-fusion",
  pattern: /(内容|知识|要点|观点).{0,5}(融合|合成|整合|汇总)/,
  type: "create",
  subType: "synthesis",
  complexity: "complex",
  weight: 92,
},

// 规则 4: 整合/合成 + 成一篇/成文档
{
  id: "synthesis-merge-into",
  pattern: /(整合|合成|融合|汇总|归纳).{0,5}(成|为).{0,3}(一篇|一份|一个|文档|文章|报告)/,
  type: "create",
  subType: "synthesis",
  complexity: "complex",
  weight: 95,
},

// 规则 5: 把...整理成一篇
{
  id: "synthesis-organize-into-article",
  pattern: /把.{0,15}(整理|写|做|形成).{0,3}(成|为)?.{0,3}(一篇|完整|一份)/,
  type: "create",
  subType: "synthesis",
  complexity: "complex",
  weight: 93,
},

// 规则 6: 提炼/梳理成文档
{
  id: "synthesis-refine",
  pattern: /(提炼|梳理|凝练).{0,5}(成|为)?.{0,5}(文档|报告|文章|笔记)/,
  type: "create",
  subType: "synthesis",
  complexity: "complex",
  weight: 91,
},
```

### 3.2 新增消歧规则

**文件**: `src/lib/ai-skills/router/disambiguation-rules.ts`

```typescript
// ============================================
// 新增消歧规则：digest vs synthesis
// ============================================

// 规则 1: 融合信号 → synthesis
{
  id: "digest-vs-synthesis-fusion",
  conflictTypes: ["create"],
  subTypes: ["digest", "synthesis"],
  pattern: /(结合|融合|整合|汇总|合成|归纳).{0,10}(写|生成|做|成)/,
  winner: "synthesis",
  priority: 105,
  reason: "融合动词 + 创作动词 → 综合性输出",
},

// 规则 2: "一篇/一份" 结构 → synthesis
{
  id: "digest-vs-synthesis-single-output",
  conflictTypes: ["create"],
  subTypes: ["digest", "synthesis"],
  pattern: /(写|生成|做|形成|整理成).{0,5}(一篇|一份|一个)/,
  winner: "synthesis",
  priority: 100,
  reason: "单一输出期望 → 综合性文章",
},

// 规则 3: 列表信号 → digest
{
  id: "digest-vs-synthesis-list",
  conflictTypes: ["create"],
  subTypes: ["digest", "synthesis"],
  pattern: /(逐条|分别|每篇|每个|列出|要点)/,
  winner: "digest",
  priority: 100,
  reason: "列表信号 → 独立摘要",
},

// 规则 4: organize vs synthesis (整理成文章)
{
  id: "organize-vs-synthesis-article",
  conflictTypes: ["organize", "create"],
  subTypes: ["cleanup", "synthesis"],
  pattern: /(整理|梳理).{0,5}(成|为).{0,5}(文章|报告|笔记|文档)/,
  winner: "synthesis",
  priority: 95,
  reason: "整理成文章 → 内容合成而非书签整理",
},
```

### 3.3 中文数字支持

**新建文件**: `src/lib/ai-skills/search/chinese-number-parser.ts`

```typescript
/**
 * 中文数字解析器
 *
 * 支持:
 * - 基础数字: 一二三四五六七八九十
 * - 组合数字: 十一、二十、三十五
 * - 模糊数字: 几、若干
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

// 中文数字映射表
const CHINESE_DIGIT_MAP: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  壹: 1,
  二: 2,
  贰: 2,
  两: 2,
  三: 3,
  叁: 3,
  四: 4,
  肆: 4,
  五: 5,
  伍: 5,
  六: 6,
  陆: 6,
  七: 7,
  柒: 7,
  八: 8,
  捌: 8,
  九: 9,
  玖: 9,
  十: 10,
  拾: 10,
};

// 模糊数字默认值
const FUZZY_NUMBER_MAP: Record<string, number> = {
  几: 5,
  若干: 5,
  一些: 5,
  数: 5,
  多: 10,
};

/**
 * 解析中文数字
 *
 * @param str 中文数字字符串
 * @returns 解析后的数字，无法解析返回 null
 *
 * @example
 * parseChineseNumber("三") // 3
 * parseChineseNumber("十五") // 15
 * parseChineseNumber("二十") // 20
 * parseChineseNumber("几") // 5
 */
export function parseChineseNumber(str: string): number | null {
  if (!str) return null;

  const trimmed = str.trim();

  // 检查是否是阿拉伯数字
  const arabicNum = parseInt(trimmed, 10);
  if (!isNaN(arabicNum)) {
    return arabicNum;
  }

  // 检查模糊数字
  if (FUZZY_NUMBER_MAP[trimmed] !== undefined) {
    return FUZZY_NUMBER_MAP[trimmed];
  }

  // 单字符中文数字
  if (trimmed.length === 1 && CHINESE_DIGIT_MAP[trimmed] !== undefined) {
    return CHINESE_DIGIT_MAP[trimmed];
  }

  // 组合数字解析 (如 "十五", "二十", "二十三")
  if (trimmed.includes("十")) {
    const parts = trimmed.split("十");
    const tens = parts[0] ? (CHINESE_DIGIT_MAP[parts[0]] ?? 1) : 1;
    const ones = parts[1] ? (CHINESE_DIGIT_MAP[parts[1]] ?? 0) : 0;
    return tens * 10 + ones;
  }

  return null;
}

/**
 * 从文本中提取数量
 *
 * @param text 用户输入文本
 * @returns 提取的数量信息
 *
 * @example
 * extractQuantity("最近三个收藏") // { count: 3, expression: "三个", position: 2 }
 * extractQuantity("前5篇文章") // { count: 5, expression: "5篇", position: 1 }
 */
export function extractQuantity(text: string): {
  count: number;
  expression: string;
  position: number;
} | null {
  // 模式 1: 中文数字 + 量词
  const chinesePattern =
    /(最近|前)?([一二三四五六七八九十两几若干]+)[个篇条份]/g;
  const chineseMatch = chinesePattern.exec(text);
  if (chineseMatch) {
    const count = parseChineseNumber(chineseMatch[2]);
    if (count !== null) {
      return {
        count,
        expression: chineseMatch[0],
        position: chineseMatch.index,
      };
    }
  }

  // 模式 2: 阿拉伯数字 + 量词
  const arabicPattern = /(最近|前)?(\d+)[个篇条份]/g;
  const arabicMatch = arabicPattern.exec(text);
  if (arabicMatch) {
    const count = parseInt(arabicMatch[2], 10);
    if (!isNaN(count) && count > 0 && count <= 100) {
      return {
        count,
        expression: arabicMatch[0],
        position: arabicMatch.index,
      };
    }
  }

  // 模式 3: "前N个" / "top N"
  const topPattern = /前(\d+)|top\s*(\d+)/gi;
  const topMatch = topPattern.exec(text);
  if (topMatch) {
    const count = parseInt(topMatch[1] || topMatch[2], 10);
    if (!isNaN(count) && count > 0 && count <= 100) {
      return {
        count,
        expression: topMatch[0],
        position: topMatch.index,
      };
    }
  }

  return null;
}

export const CHINESE_NUMBER_UTILS = {
  parseChineseNumber,
  extractQuantity,
};
```

### 3.4 更新 filter-extraction-rules

**文件**: `src/lib/ai-skills/search/filter-extraction-rules.ts`

```typescript
// 更新 limitRules，添加中文数字支持

import { parseChineseNumber } from "./chinese-number-parser";

const limitRules: FilterExtractionRule[] = [
  // 原有规则保留...

  // 新增规则: 中文数字支持
  {
    id: "limit-chinese-number",
    description: "中文数字数量限制",
    filterType: "limit",
    pattern: /(最近|前)?([一二三四五六七八九十两几若干]+)[个篇条份]/,
    extract: (match): LimitFilter | null => {
      const count = parseChineseNumber(match[2]);
      if (count === null || count < 1 || count > 100) return null;
      return {
        type: "limit",
        count,
        expression: match[0],
      };
    },
    priority: 75,
    removeFromQuery: true,
  },
];
```

### 3.5 更新 ThematicSynthesisSkill.parseInput

**文件**: `src/lib/ai-skills/skills/thematic-synthesis/thematic-synthesis.skill.ts`

```typescript
import { extractQuantity } from "../../search/chinese-number-parser";

async parseInput(
  message: string,
  context: OrchestrationContext,
): Promise<ThematicSynthesisInput> {
  // 解析深度模式
  let depthMode: "quick" | "standard" | "academic" = "standard";
  if (/快速|简要|概要|快读/.test(message)) {
    depthMode = "quick";
  } else if (/深度|学术|详细|完整/.test(message)) {
    depthMode = "academic";
  }

  // ============================================
  // 1. 优先使用附件书签（用户显式选择）
  // ============================================
  if (
    context.attachmentBookmarkIds &&
    context.attachmentBookmarkIds.length > 0
  ) {
    return {
      sourceType: "selection",
      bookmarkIds: context.attachmentBookmarkIds.map(String),
      depthMode,
    };
  }

  // ============================================
  // 2. 从消息中提取数量限制（新增）
  // ============================================
  const quantityInfo = extractQuantity(message);
  const limit = quantityInfo?.count;

  // ============================================
  // 3. 解析时间范围
  // ============================================
  let timeScope: "today" | "week" | "month" | "recent" | undefined;
  if (/今天|今日/.test(message)) {
    timeScope = "today";
  } else if (/本周|这周/.test(message)) {
    timeScope = "week";
  } else if (/本月|这月/.test(message)) {
    timeScope = "month";
  } else if (/最近|近期/.test(message)) {
    timeScope = "recent";
  }

  // ============================================
  // 4. 构建输入参数
  // ============================================

  // 如果有数量限制，按最近 N 条处理
  if (limit && limit <= 20) {
    return {
      sourceType: "recent_limit",
      limit,
      timeScope,
      depthMode,
    };
  }

  // 如果有时间范围，按时间筛选
  if (timeScope) {
    return {
      sourceType: "time_range",
      timeScope,
      depthMode,
    };
  }

  // 默认：AI 推荐
  return {
    sourceType: "ai_recommend",
    depthMode,
  };
}
```

---

## 4. 测试用例实现

### 4.1 测试文件结构

```
src/lib/ai-skills/router/__tests__/
├── intent-classifier.test.ts      # 现有测试
├── intent-classifier-p0.test.ts   # 新增：P0 高频场景测试
├── intent-classifier-synthesis.test.ts  # 新增：synthesis 专项测试
├── disambiguation-synthesis.test.ts     # 新增：synthesis 消歧测试
└── chinese-number-parser.test.ts        # 新增：中文数字测试

src/lib/ai-skills/search/__tests__/
└── chinese-number-parser.test.ts  # 新增：中文数字解析测试
```

### 4.2 P0 场景测试用例

**文件**: `src/lib/ai-skills/router/__tests__/intent-classifier-p0.test.ts`

```typescript
/**
 * P0 高频场景意图分类测试
 *
 * 覆盖用户最常用的 37 个 P0 级场景
 */

import { IntentClassifier } from "../intent-classifier";

describe("IntentClassifier - P0 高频场景", () => {
  let classifier: IntentClassifier;

  beforeEach(() => {
    classifier = new IntentClassifier();
  });

  // ============================================
  // 搜索查找类 (8 个 P0)
  // ============================================
  describe("搜索查找", () => {
    const searchCases = [
      {
        input: "找一下关于 React 的文章",
        expectedType: "query",
        expectedSubType: "search",
      },
      {
        input: "我收藏过一篇讲 TypeScript 的",
        expectedType: "query",
        expectedSubType: "search",
      },
      {
        input: "最近收藏的视频在哪",
        expectedType: "query",
        expectedSubType: "list",
      },
      {
        input: "有没有 B站 的收藏",
        expectedType: "query",
        expectedSubType: "search",
      },
      {
        input: "找出所有技术类的",
        expectedType: "query",
        expectedSubType: "search",
      },
      {
        input: "帮我找那篇讲架构的",
        expectedType: "query",
        expectedSubType: "search",
      },
      {
        input: "上周收藏了什么",
        expectedType: "query",
        expectedSubType: "list",
      },
      {
        input: "工作文件夹里有什么",
        expectedType: "query",
        expectedSubType: "list",
      },
    ];

    test.each(searchCases)(
      '应将 "$input" 分类为 $expectedType:$expectedSubType',
      async ({ input, expectedType, expectedSubType }) => {
        const result = await classifier.classify(input);
        expect(result.type).toBe(expectedType);
        expect(result.subType).toBe(expectedSubType);
        expect(result.confidence).toBeGreaterThan(0.7);
      },
    );
  });

  // ============================================
  // 内容理解类 - digest (3 个 P0)
  // ============================================
  describe("快速摘要 (digest)", () => {
    const digestCases = [
      { input: "生成这些书签的摘要", expectedSubType: "digest" },
      { input: "给我看看每篇的要点", expectedSubType: "digest" },
      { input: "快速过一遍这些内容", expectedSubType: "digest" },
    ];

    test.each(digestCases)(
      '应将 "$input" 分类为 create:$expectedSubType',
      async ({ input, expectedSubType }) => {
        const result = await classifier.classify(input);
        expect(result.type).toBe("create");
        expect(result.subType).toBe(expectedSubType);
      },
    );
  });

  // ============================================
  // 内容理解类 - synthesis (7 个 P0) ⚠️ 重点
  // ============================================
  describe("主题合成 (synthesis)", () => {
    const synthesisCases = [
      { input: "结合最近三个收藏写个总结", expectedSubType: "synthesis" },
      { input: "帮我总结一下这几篇", expectedSubType: "synthesis" },
      { input: "把这些内容整合成一篇文章", expectedSubType: "synthesis" },
      { input: "写一篇关于这个主题的综述", expectedSubType: "synthesis" },
      { input: "帮我把这些知识点融合一下", expectedSubType: "synthesis" },
      { input: "生成一篇综合报告", expectedSubType: "synthesis" },
      { input: "把最近五篇整合一下", expectedSubType: "synthesis" },
    ];

    test.each(synthesisCases)(
      '应将 "$input" 分类为 create:$expectedSubType',
      async ({ input, expectedSubType }) => {
        const result = await classifier.classify(input);
        expect(result.type).toBe("create");
        expect(result.subType).toBe(expectedSubType);
        expect(result.confidence).toBeGreaterThan(0.8);
      },
    );
  });

  // ============================================
  // 整理归档类 (5 个 P0)
  // ============================================
  describe("整理归档", () => {
    const organizeCases = [
      { input: "整理一下我的收藏", type: "organize", subType: "cleanup" },
      { input: "给这些打上标签", type: "action", subType: "tag" },
      { input: "移到学习文件夹", type: "action", subType: "move" },
      { input: "清理重复的书签", type: "organize", subType: "dedupe" },
      { input: "帮我分类一下", type: "organize", subType: "classify" },
    ];

    test.each(organizeCases)(
      '应将 "$input" 分类为 $type:$subType',
      async ({ input, type, subType }) => {
        const result = await classifier.classify(input);
        expect(result.type).toBe(type);
        expect(result.subType).toBe(subType);
      },
    );
  });

  // ============================================
  // 数据统计类 (3 个 P0)
  // ============================================
  describe("数据统计", () => {
    const analyticsCases = [
      { input: "我有多少收藏", type: "query", subType: "count" },
      { input: "分析一下我的阅读习惯", type: "analyze", subType: "insight" },
      { input: "生成本周的阅读报告", type: "analyze", subType: "report" },
    ];

    test.each(analyticsCases)(
      '应将 "$input" 分类为 $type:$subType',
      async ({ input, type, subType }) => {
        const result = await classifier.classify(input);
        expect(result.type).toBe(type);
        expect(result.subType).toBe(subType);
      },
    );
  });

  // ============================================
  // 导出分享类 (3 个 P0)
  // ============================================
  describe("导出分享", () => {
    const exportCases = [
      { input: "导出成 Markdown", subType: "share" },
      { input: "分享这几篇给朋友", subType: "share" },
      { input: "备份我的收藏", subType: "share" },
    ];

    test.each(exportCases)(
      '应将 "$input" 分类为 create:$subType',
      async ({ input, subType }) => {
        const result = await classifier.classify(input);
        expect(result.type).toBe("create");
        expect(result.subType).toBe(subType);
      },
    );
  });

  // ============================================
  // 学习复习类 (3 个 P0)
  // ============================================
  describe("学习复习", () => {
    const learnCases = [
      { input: "开始复习", subType: "active_recall_start" },
      { input: "帮我制定学习计划", subType: "path" },
      { input: "复习一下 React 相关的", subType: "review" },
    ];

    test.each(learnCases)(
      '应将 "$input" 分类为 learn:$subType',
      async ({ input, subType }) => {
        const result = await classifier.classify(input);
        expect(result.type).toBe("learn");
        expect(result.subType).toBe(subType);
      },
    );
  });

  // ============================================
  // 语音朗读类 (2 个 P0)
  // ============================================
  describe("语音朗读", () => {
    const ttsCases = [{ input: "读给我听" }, { input: "朗读这篇" }];

    test.each(ttsCases)(
      '应将 "$input" 分类为 create:tts',
      async ({ input }) => {
        const result = await classifier.classify(input);
        expect(result.type).toBe("create");
        expect(result.subType).toBe("tts");
      },
    );
  });

  // ============================================
  // 闲聊帮助类 (3 个 P0)
  // ============================================
  describe("闲聊帮助", () => {
    const chitchatCases = [
      { input: "你好", subType: "greeting" },
      { input: "你能做什么", subType: "help" },
      { input: "帮助", subType: "help" },
    ];

    test.each(chitchatCases)(
      '应将 "$input" 分类为 chitchat:$subType',
      async ({ input, subType }) => {
        const result = await classifier.classify(input);
        expect(result.type).toBe("chitchat");
        expect(result.subType).toBe(subType);
      },
    );
  });
});
```

### 4.3 中文数字解析测试

**文件**: `src/lib/ai-skills/search/__tests__/chinese-number-parser.test.ts`

```typescript
import { parseChineseNumber, extractQuantity } from "../chinese-number-parser";

describe("ChineseNumberParser", () => {
  describe("parseChineseNumber", () => {
    const testCases = [
      // 基础数字
      { input: "一", expected: 1 },
      { input: "二", expected: 2 },
      { input: "两", expected: 2 },
      { input: "三", expected: 3 },
      { input: "四", expected: 4 },
      { input: "五", expected: 5 },
      { input: "六", expected: 6 },
      { input: "七", expected: 7 },
      { input: "八", expected: 8 },
      { input: "九", expected: 9 },
      { input: "十", expected: 10 },

      // 组合数字
      { input: "十一", expected: 11 },
      { input: "十五", expected: 15 },
      { input: "二十", expected: 20 },
      { input: "二十三", expected: 23 },

      // 模糊数字
      { input: "几", expected: 5 },
      { input: "若干", expected: 5 },

      // 阿拉伯数字
      { input: "3", expected: 3 },
      { input: "15", expected: 15 },

      // 无效输入
      { input: "", expected: null },
      { input: "abc", expected: null },
    ];

    test.each(testCases)(
      'parseChineseNumber("$input") 应返回 $expected',
      ({ input, expected }) => {
        expect(parseChineseNumber(input)).toBe(expected);
      },
    );
  });

  describe("extractQuantity", () => {
    const testCases = [
      {
        input: "最近三个收藏",
        expected: { count: 3, expression: "最近三个" },
      },
      {
        input: "前五篇文章",
        expected: { count: 5, expression: "前五篇" },
      },
      {
        input: "结合最近三个收藏写个总结",
        expected: { count: 3, expression: "最近三个" },
      },
      {
        input: "把最近五篇整合一下",
        expected: { count: 5, expression: "最近五篇" },
      },
      {
        input: "前10条",
        expected: { count: 10, expression: "前10条" },
      },
      {
        input: "top 5",
        expected: { count: 5, expression: "top 5" },
      },
      {
        input: "没有数字的句子",
        expected: null,
      },
    ];

    test.each(testCases)(
      'extractQuantity("$input") 应提取 $expected',
      ({ input, expected }) => {
        const result = extractQuantity(input);
        if (expected === null) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
          expect(result?.count).toBe(expected.count);
          expect(result?.expression).toContain(
            expected.expression.replace("最近", ""),
          );
        }
      },
    );
  });
});
```

---

## 5. 文件变更清单

### 5.1 新增文件

| 文件路径                                                                 | 说明               | 优先级 |
| ------------------------------------------------------------------------ | ------------------ | ------ |
| `src/lib/ai-skills/search/chinese-number-parser.ts`                      | 中文数字解析器     | P0     |
| `src/lib/ai-skills/search/__tests__/chinese-number-parser.test.ts`       | 中文数字测试       | P0     |
| `src/lib/ai-skills/router/__tests__/intent-classifier-p0.test.ts`        | P0 场景测试        | P0     |
| `src/lib/ai-skills/router/__tests__/intent-classifier-synthesis.test.ts` | synthesis 专项测试 | P0     |
| `src/lib/ai-skills/router/__tests__/disambiguation-synthesis.test.ts`    | 消歧测试           | P1     |

### 5.2 修改文件

| 文件路径                                                                  | 变更内容                      | 优先级 |
| ------------------------------------------------------------------------- | ----------------------------- | ------ |
| `src/lib/ai-skills/router/intent-classifier.ts`                           | 新增 6 条 synthesis 规则      | P0     |
| `src/lib/ai-skills/router/disambiguation-rules.ts`                        | 新增 4 条消歧规则             | P0     |
| `src/lib/ai-skills/search/filter-extraction-rules.ts`                     | 新增中文数字 limit 规则       | P0     |
| `src/lib/ai-skills/search/index.ts`                                       | 导出中文数字解析器            | P0     |
| `src/lib/ai-skills/skills/thematic-synthesis/thematic-synthesis.skill.ts` | 更新 parseInput 支持数量限制  | P1     |
| `src/lib/ai-skills/skills/thematic-synthesis/types.ts`                    | 新增 sourceType 和 limit 字段 | P1     |

---

## 6. 验收标准

### 6.1 功能验收

| 验收项             | 标准                                | 验证方式        |
| ------------------ | ----------------------------------- | --------------- |
| P0 场景全部通过    | 37 个 P0 测试用例 100% 通过         | Jest 测试       |
| synthesis 规则生效 | 7 个 synthesis 专项用例通过         | Jest 测试       |
| 消歧规则生效       | digest vs synthesis 消歧正确率 ≥95% | 手动测试 + Jest |
| 中文数字解析       | 20 个解析用例 100% 通过             | Jest 测试       |
| 无回归             | 现有测试无失败                      | CI 门禁         |

### 6.2 性能验收

| 验收项   | 标准         | 验证方式 |
| -------- | ------------ | -------- |
| 分类延迟 | P99 ≤ 20ms   | 性能测试 |
| 内存占用 | 新增 < 100KB | 内存分析 |

### 6.3 质量验收

| 验收项   | 标准                      | 验证方式      |
| -------- | ------------------------- | ------------- |
| 类型检查 | `npm run type-check` 通过 | CI            |
| 代码检查 | `npm run lint` 无错误     | CI            |
| 测试覆盖 | 新增代码覆盖率 ≥ 80%      | Jest coverage |

---

## 7. 实施检查清单

### Phase 1.1: 中文数字支持（Day 1）

- [ ] 创建 `chinese-number-parser.ts`
- [ ] 编写 `parseChineseNumber` 函数
- [ ] 编写 `extractQuantity` 函数
- [ ] 编写单元测试（20+ 用例）
- [ ] 运行测试确保通过
- [ ] 更新 `search/index.ts` 导出

### Phase 1.2: synthesis 规则增强（Day 1-2）

- [ ] 在 `intent-classifier.ts` 添加 6 条 synthesis 规则
- [ ] 调整规则权重确保优先级正确
- [ ] 编写 synthesis 专项测试用例
- [ ] 运行测试确保通过
- [ ] 验证不影响现有测试

### Phase 1.3: 消歧规则增强（Day 2）

- [ ] 在 `disambiguation-rules.ts` 添加 4 条消歧规则
- [ ] 编写消歧测试用例
- [ ] 运行测试确保通过

### Phase 1.4: Skill 参数解析增强（Day 2-3）

- [ ] 更新 `ThematicSynthesisInput` 类型
- [ ] 更新 `thematic-synthesis.skill.ts` 的 `parseInput`
- [ ] 编写 Skill 参数解析测试
- [ ] 运行测试确保通过

### Phase 1.5: P0 场景测试（Day 3）

- [ ] 创建 `intent-classifier-p0.test.ts`
- [ ] 添加 37 个 P0 测试用例
- [ ] 运行全量测试
- [ ] 修复失败用例
- [ ] 确保 100% 通过

### Phase 1.6: 集成验证（Day 3-4）

- [ ] 运行 `npm run type-check`
- [ ] 运行 `npm run lint`
- [ ] 运行 `npm run test`
- [ ] 手动测试关键场景
- [ ] 更新文档

---

## 8. 风险与缓解

| 风险                 | 可能性 | 影响 | 缓解措施              |
| -------------------- | ------ | ---- | --------------------- |
| 新规则与现有规则冲突 | 中     | 高   | 全量测试 + 权重调整   |
| 消歧规则过于激进     | 中     | 中   | 限定冲突类型范围      |
| 中文数字边界情况     | 低     | 低   | 完善测试覆盖          |
| 性能下降             | 低     | 中   | 预编译正则 + 性能测试 |

---

## 9. 附录

### 9.1 权重设计原则

```
synthesis 相关规则: 91-96 (高于 digest 的 70)
digest 相关规则: 70 (保持不变)
消歧规则优先级: 95-105

权重分层:
- 95+: 融合信号明确 (结合...写..., 整合成一篇)
- 90-94: 融合信号中等 (融合, 合成, 提炼)
- 70: 普通总结/摘要
- 消歧规则优先于同权重的分类规则
```

### 9.2 正则表达式设计原则

```
1. 使用非贪婪匹配: .{0,N} 而非 .*
2. 限定匹配范围: 融合动词之间最多 15 个字符
3. 可选分组: (成|为)? 处理可选字符
4. 负向断言: (?<!阅|已)读 排除 "阅读"
```

---

**文档状态**: 待审核
**最后更新**: 2026-01-09
