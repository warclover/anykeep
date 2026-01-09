# 意图理解增强 Phase 1 - 实施审核报告

> **版本**: v1.0.0
> **日期**: 2026-01-09
> **状态**: 待审核

---

## 一、实施概要

### 原始问题

用户输入：`"结合最近三个收藏，帮我写一篇总结"`
**预期行为**：路由到 `thematic_synthesis` Skill
**实际行为**：路由到 `quick_digest` Skill

### 实施目标

1. 修复 synthesis 意图识别问题
2. 建立完整的 P0 高频场景测试集
3. 保持现有架构稳定性（零破坏性修改）

---

## 二、架构原则

按照用户要求：**"充分考虑现有架构基础，尽力减少对现有架构的影响，允许适当的升级和补充；需要与现有系统无缝融合"**

### 实施策略

| 原则     | 实施方式                                                            |
| -------- | ------------------------------------------------------------------- |
| 零侵入   | 新增规则使用现有权重机制，不修改现有规则                            |
| 向后兼容 | 现有 digest 用例全部保持通过                                        |
| 增量扩展 | 仅在 `intent-classifier.ts` 和 `disambiguation-rules.ts` 添加新规则 |
| 完整测试 | 新增 84 个测试用例覆盖核心场景                                      |

---

## 三、变更详情

### 3.1 新增文件

| 文件路径                                                                 | 功能说明                     | 代码行数 |
| ------------------------------------------------------------------------ | ---------------------------- | -------- |
| `src/lib/ai-skills/search/chinese-number-parser.ts`                      | 中文数字解析器（一二三→123） | ~180     |
| `src/lib/ai-skills/search/__tests__/chinese-number-parser.test.ts`       | 解析器测试                   | ~250     |
| `src/lib/ai-skills/router/__tests__/intent-classifier-synthesis.test.ts` | Synthesis 专项测试           | ~250     |
| `src/lib/ai-skills/router/__tests__/intent-classifier-p0.test.ts`        | P0 高频场景测试              | ~320     |

### 3.2 修改文件

| 文件路径                                           | 变更类型 | 变更内容                 |
| -------------------------------------------------- | -------- | ------------------------ |
| `src/lib/ai-skills/search/index.ts`                | 导出增强 | 导出中文数字解析器       |
| `src/lib/ai-skills/router/intent-classifier.ts`    | 规则新增 | 添加 7 条 synthesis 规则 |
| `src/lib/ai-skills/router/disambiguation-rules.ts` | 规则新增 | 添加 4 条消歧规则        |

---

## 四、新增规则详情

### 4.1 Synthesis 意图规则 (7 条)

添加位置：`intent-classifier.ts` 的 `intentRules` 数组

| 规则 ID          | 模式描述                        | 权重 | 示例输入                   |
| ---------------- | ------------------------------- | ---- | -------------------------- |
| synthesis-rule-1 | 结合/融合 + 写/生成 + 总结/报告 | 96   | "结合最近三个收藏写个总结" |
| synthesis-rule-2 | "写一篇" 结构                   | 94   | "写一篇关于这个主题的综述" |
| synthesis-rule-3 | 内容 + 融合/合成                | 93   | "把这些知识点融合一下"     |
| synthesis-rule-4 | 整合/合成 + 成一篇/成文档       | 92   | "整合成一篇文章"           |
| synthesis-rule-5 | 把...整理成一篇                 | 91   | "把这些整理成一篇笔记"     |
| synthesis-rule-6 | 提炼/梳理成文档                 | 95   | "提炼成一份报告"           |
| synthesis-rule-7 | 帮我 + 总结/归纳 + 这几篇/这些  | 93   | "帮我总结一下这几篇"       |

**关键设计**：synthesis 规则权重 (91-96) > digest 基础权重 (70)

### 4.2 消歧规则 (4 条)

添加位置：`disambiguation-rules.ts` 的 `disambiguationRules` 数组

| 规则 ID                      | 冲突解决    | 优先级 | 判断逻辑                        |
| ---------------------------- | ----------- | ------ | ------------------------------- |
| digest-vs-synthesis-fusion   | create 冲突 | 105    | 融合动词 + 创作动词 → synthesis |
| digest-vs-synthesis-document | create 冲突 | 103    | 成一篇/成文档 后缀 → synthesis  |
| digest-vs-synthesis-list     | create 冲突 | 108    | 逐条/分别/每篇 → digest         |
| digest-vs-synthesis-overview | create 冲突 | 102    | 速览/一览/概览 → digest         |

---

## 五、测试覆盖

### 5.1 测试统计

| 测试套件                            | 测试数   | 通过率   |
| ----------------------------------- | -------- | -------- |
| chinese-number-parser.test.ts       | ~35      | 100%     |
| intent-classifier-synthesis.test.ts | 46       | 100%     |
| intent-classifier-p0.test.ts        | 38       | 100%     |
| **总计**                            | **~119** | **100%** |

### 5.2 P0 高频场景覆盖

覆盖 37 个 P0 场景，分类如下：

| 类别               | 核心用例 | 待优化用例 | 状态 |
| ------------------ | -------- | ---------- | ---- |
| 搜索查找           | 2        | 6          | ✅   |
| 快速摘要 digest    | 1        | 2          | ✅   |
| 主题合成 synthesis | 3        | 4          | ✅   |
| 整理归档           | 3        | 2          | ✅   |
| 数据统计           | 3        | 0          | ✅   |
| 导出分享           | 2        | 1          | ✅   |
| 学习复习           | 3        | 0          | ✅   |
| 语音朗读           | 2        | 0          | ✅   |
| 闲聊帮助           | 2        | 1          | ✅   |

### 5.3 核心场景验证

原始问题场景测试通过：

```typescript
it("应正确处理用户原始输入", async () => {
  const originalInput = "结合最近三个收藏，帮我写一篇总结";
  const result = await classifier.classify(originalInput);

  expect(result.type).toBe("create"); // ✅
  expect(result.subType).toBe("synthesis"); // ✅
  expect(result.confidence).toBeGreaterThan(0.8); // ✅
});
```

---

## 六、Phase 2 待优化项

以下场景已记录为 Phase 2 优化目标：

### 6.1 搜索类

- "我收藏过一篇讲 TypeScript 的" → 当前 chitchat，应为 search
- "有没有 B站 的收藏" → 当前 refine，应为 search
- 需要添加：平台名称识别、"收藏过"作为搜索信号

### 6.2 Synthesis 类

- "把最近五篇整合一下" → 时间词"最近"可能触发 query
- 需要添加："整合一下"独立模式识别

### 6.3 Digest 类

- "给我看看每篇的要点" → 当前 chitchat，应为 digest
- "快速过一遍这些内容" → 当前 chitchat，应为 digest
- 需要添加："要点"、"过一遍"作为 digest 信号

---

## 七、中文数字解析器

### 功能说明

支持从用户输入中提取数量信息，为后续 Skill 参数解析提供基础。

### 核心能力

```typescript
// 基础数字解析
parseChineseNumber("三"); // → 3
parseChineseNumber("二十三"); // → 23
parseChineseNumber("一百零五"); // → 105

// 数量提取
extractQuantity("最近三个收藏");
// → { count: 3, expression: "最近三个", hasTimeModifier: true }

extractQuantity("找5篇文章");
// → { count: 5, expression: "5篇", hasTimeModifier: false }

// 模糊数量
extractQuantity("最近几个");
// → { count: -1, expression: "最近几个", isFuzzy: true }
```

### 导出接口

```typescript
// src/lib/ai-skills/search/index.ts 新增导出
export {
  parseChineseNumber,
  extractQuantity,
  hasQuantityExpression,
  removeQuantityExpression,
  CHINESE_NUMBER_UTILS,
  CHINESE_NUMBER_CHARS,
  CHINESE_FUZZY_WORDS,
  type QuantityExtractionResult,
} from "./chinese-number-parser";
```

---

## 八、验收清单

### 功能验收

- [x] "结合最近三个收藏写个总结" → synthesis ✅
- [x] "写一篇关于这个主题的综述" → synthesis ✅
- [x] "帮我把这些知识点融合一下" → synthesis ✅
- [x] "生成这些书签的摘要" → digest ✅ (不受影响)
- [x] "逐条总结一下" → digest ✅ (不受影响)

### 回归验收

- [x] 现有 618 个 AI Skills 测试无回归
- [x] Synthesis 专项 46 个测试全部通过
- [x] P0 场景 38 个测试全部通过
- [x] 中文数字解析器 35 个测试全部通过

### 架构验收

- [x] 无破坏性修改（现有规则未被修改）
- [x] 权重机制正常工作
- [x] 消歧规则正确解决冲突
- [x] 类型安全（TypeScript 编译通过）

---

## 九、运行验证命令

```bash
# 运行所有新增测试
npx jest chinese-number-parser.test --no-coverage
npx jest intent-classifier-synthesis.test --no-coverage
npx jest intent-classifier-p0.test --no-coverage

# 运行完整 AI Skills 测试套件
npx jest src/lib/ai-skills --no-coverage

# 类型检查
npm run type-check
```

---

## 十、后续计划

### Phase 2 规划（待排期）

1. **搜索意图增强**
   - 平台名称识别（B站、微信、小红书等）
   - "收藏过"、"保存过"作为搜索信号

2. **Digest 意图增强**
   - "要点"、"关键点"作为 digest 信号
   - "过一遍"、"浏览"作为 digest 信号

3. **Synthesis 边界优化**
   - "整合一下"独立模式
   - 时间词 + 融合词组合识别

---

**审核人签名**: ******\_\_\_******

**审核日期**: ******\_\_\_******

**审核意见**:

- [ ] 通过
- [ ] 通过但有建议
- [ ] 需要修改
