# AI摘要优化方案 - 2025-11-27

## 🔍 当前问题分析

### 现有实现位置

1. **前端实现**: `src/lib/utils/ai-generator.ts`
2. **Edge Function**: `supabase/functions/generate-ai-content/index.ts`

### 现有实现的局限性

1. **提示词过于简单**: 只要求"突出核心观点,简洁明了",缺少结构化指导
2. **内容截断太短**: 正文只保留前2000字符,可能丢失重要信息
3. **Token限制偏低**: `max_tokens: 500` 限制了摘要的质量
4. **缺少分层处理**: 没有区分不同类型内容(文章/视频/产品等)
5. **两处代码不一致**: Edge Function 固定50-100字,而 ai-generator.ts 有动态长度

---

## 💡 优化方案总览

### **方案1: 优化 Prompt Engineering (立即可行)** ⭐

#### 改进的提示词构建函数

```typescript
// 改进的提示词构建函数
function buildPrompt(
  title: string,
  description?: string,
  content?: string,
): string {
  // 计算内容长度
  const contentLength =
    (title?.length || 0) + (description?.length || 0) + (content?.length || 0);
  const { min, max } = getSummaryLimit(contentLength);

  let prompt = `你是一个专业的内容分析助手。请对以下内容进行深度分析,生成高质量摘要。

【内容信息】
标题: ${title}`;

  if (description) {
    prompt += `\n描述: ${description}`;
  }

  if (content) {
    // 提高到5000字符,确保关键信息不丢失
    const truncatedContent = content.substring(0, 5000);
    prompt += `\n\n正文内容:\n${truncatedContent}`;
  }

  prompt += `

【摘要要求】
1. **长度**: ${min}-${max}字,根据内容丰富度灵活调整
2. **结构**:
   - 核心主旨(用一句话概括)
   - 关键信息点(2-4个要点)
   - 适用场景或价值(可选)
3. **完整性**:
   - 保留所有关键信息和数据
   - 包含重要的专业术语
   - 如果有方法论/步骤,必须保留
4. **可读性**:
   - 使用清晰的逻辑结构
   - 避免笼统描述,优先具体信息

【标签要求】
- 生成3-5个精准标签
- 标签层次: 领域标签(如"前端开发") + 技术标签(如"React") + 场景标签(如"性能优化")
- 使用行业通用术语

【返回格式】(严格JSON)
{
  "summary": "完整摘要内容",
  "tags": ["标签1", "标签2", "标签3"]
}

只返回JSON,不要任何额外说明。`;

  return prompt;
}
```

#### 改进点

- ✅ 内容截断从 2000 → 5000 字符
- ✅ 明确要求保留"关键信息、数据、方法论"
- ✅ 结构化输出(主旨+要点+场景)
- ✅ 标签分层(领域+技术+场景)

---

### **方案2: 增加 Token 限制**

```typescript
// 在 API 调用中
body: JSON.stringify({
  model: 'deepseek-chat',
  messages: [...],
  temperature: 0.7,
  max_tokens: 1000,  // 从 500 提升到 1000
})
```

---

### **方案3: 两阶段处理(进阶方案)** 🚀

对于长内容,可以先提取关键信息,再生成摘要:

```typescript
// 第一阶段: 提取关键信息
async function extractKeyPoints(content: string): Promise<string[]> {
  const prompt = `请从以下内容中提取5-8个关键信息点,每个信息点用一句话概括:

${content.substring(0, 5000)}

返回JSON格式:
{
  "keyPoints": ["要点1", "要点2", ...]
}`;

  // 调用 AI...
  return keyPoints;
}

// 第二阶段: 基于关键点生成摘要
async function generateSummaryFromKeyPoints(
  title: string,
  keyPoints: string[],
): Promise<string> {
  const prompt = `基于以下关键信息,生成一个完整且结构化的摘要:

标题: ${title}
关键信息点:
${keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

要求:
- 整合所有关键点
- 突出信息之间的关联
- 200-300字`;

  // 调用 AI...
  return summary;
}
```

---

### **方案4: 针对不同内容类型定制**

```typescript
// 识别内容类型
function detectContentType(
  title: string,
  content?: string,
): "article" | "tutorial" | "video" | "product" {
  // 简单规则判断
  if (
    title.includes("教程") ||
    title.includes("如何") ||
    content?.includes("步骤")
  ) {
    return "tutorial";
  }
  if (title.includes("视频") || title.includes("B站")) {
    return "video";
  }
  // ...
  return "article";
}

// 根据类型使用不同的 prompt
const prompts = {
  tutorial: `这是一篇教程内容,摘要时请:
    1. 保留核心步骤和方法
    2. 说明适用场景和前置要求
    3. 提炼关键技术点`,

  video: `这是视频内容,摘要时请:
    1. 概括视频主题和核心观点
    2. 列出重点时间节点(如果有)
    3. 说明适合观看的人群`,

  article: `这是文章内容,摘要时请:
    1. 提炼核心论点
    2. 保留关键论据和数据
    3. 说明文章价值`,
};
```

---

### **方案5: 添加摘要质量验证**

```typescript
function validateSummaryQuality(
  summary: string,
  originalTitle: string,
  originalContent?: string
): { isValid: boolean; issues: string[] } {
  const issues: string[] = []

  // 1. 长度检查
  if (summary.length < 50) {
    issues.push('摘要过短,可能丢失关键信息')
  }

  // 2. 关键词覆盖
  const titleKeywords = extractKeywords(originalTitle)
  const summaryIncludesKeywords = titleKeywords.some(kw =>
    summary.includes(kw)
  )
  if (!summaryIncludesKeywords) {
    issues.push('摘要未包含标题核心关键词')
  }

  // 3. 通用性检查(避免"本文介绍了xxx"这种空洞表述)
  const genericPhrases = ['介绍了', '讲述了', '分享了', '探讨了']
  if (genericPhrases.some(phrase => summary.startsWith(phrase))) {
    issues.push('摘要过于笼统')
  }

  return {
    isValid: issues.length === 0,
    issues
  }
}

// 在生成后验证,如果不合格可以重试
const result = await generateAIContent(...)
const validation = validateSummaryQuality(result.summary, title, content)
if (!validation.isValid) {
  // 使用更详细的 prompt 重试
  result = await generateAIContentWithDetailedPrompt(...)
}
```

---

## 📋 实施优先级

### 1. **立即实施** (1-2小时)

- ✅ 优化 Prompt (方案1)
- ✅ 提高 max_tokens 到 1000 (方案2)
- ✅ 内容截断提高到 5000 字符

### 2. **短期优化** (1-2天)

- 🔄 添加摘要质量验证 (方案5)
- 🔄 统一前端和Edge Function的实现

### 3. **中期增强** (1周)

- 📅 实现两阶段处理 (方案3)
- 📅 内容类型识别和定制化 (方案4)

---

## 🎯 测试验证方案

### 测试用例

```typescript
// 测试用例
const testCases = [
  {
    title: "React 18 并发渲染原理深度解析",
    type: "长文章",
    expectedKeyPoints: ["并发渲染", "Suspense", "性能优化"],
  },
  {
    title: "10分钟学会 Docker 部署",
    type: "教程",
    expectedKeyPoints: ["步骤", "命令", "最佳实践"],
  },
  {
    title: "2024年前端技术趋势",
    type: "分析文章",
    expectedKeyPoints: ["技术趋势", "具体框架", "应用场景"],
  },
];

// 对比优化前后的摘要质量
```

### 质量评估标准

1. **完整性**: 是否保留了原文的核心信息和关键数据
2. **结构性**: 是否有清晰的逻辑结构(主旨-要点-价值)
3. **准确性**: 是否准确反映原文主题,没有误导性信息
4. **可读性**: 是否易于理解,避免空洞表述
5. **标签精准度**: 标签是否准确覆盖内容的领域/技术/场景

---

## 📊 预期改进效果

### 优化前

```
标题: "深入理解 React Hooks 原理与最佳实践"
摘要: "本文介绍了 React Hooks 的基本概念和使用方法,包括 useState、useEffect 等常用 Hooks。"
标签: ["React", "前端", "JavaScript"]
```

### 优化后

```
标题: "深入理解 React Hooks 原理与最佳实践"
摘要: "React Hooks 通过函数式组件实现状态管理和副作用处理。核心要点:
1. useState 基于闭包和 Fiber 架构实现状态持久化
2. useEffect 的依赖数组机制避免不必要的重渲染
3. 自定义 Hooks 实现逻辑复用,遵循单一职责原则
4. 避免在循环/条件中调用 Hooks,保证调用顺序一致
适用于需要深入理解 React 底层机制的中高级开发者。"
标签: ["React", "Hooks原理", "函数式组件", "性能优化", "前端架构"]
```

### 关键改进

- ✅ 从笼统描述 → 具体技术点
- ✅ 从简单列举 → 结构化呈现
- ✅ 标签从 3个通用 → 5个分层精准
- ✅ 增加适用场景说明

---

## 🔧 实施注意事项

1. **API 成本**: max_tokens 从 500 → 1000 会增加约 2倍成本,需要评估
2. **响应时间**: 内容增多可能导致 AI 响应变慢,需监控性能
3. **兼容性**: 确保新旧摘要格式兼容,已有数据不受影响
4. **AB 测试**: 建议先对部分用户启用新逻辑,对比效果
5. **降级方案**: 保留现有的 fallback 机制,AI 失败时依然可用

---

## 📝 变更记录

| 日期       | 版本  | 变更内容                 |
| ---------- | ----- | ------------------------ |
| 2025-11-27 | 1.0.0 | 初始版本,提出5个优化方案 |

---

## 🎯 下一步行动

1. [ ] 实施方案1: 优化 Prompt
2. [ ] 实施方案2: 提高 Token 限制
3. [ ] 测试优化效果
4. [ ] 根据测试结果调整参数
5. [ ] 规划方案3-5的实施时间表
