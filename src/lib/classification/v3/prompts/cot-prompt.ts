/**
 * V3.0 CoT (Chain of Thought) 思维链 Prompt
 *
 * 相比 V2 的简单选择题 Prompt，V3 采用：
 * 1. 思维链推理 - 逐步分析
 * 2. 多角度评估 - 语义/历史/结构
 * 3. 置信度校准 - 更准确的置信度评估
 * 4. 反思机制 - 检查潜在错误
 *
 * 预期效果：准确率 +10-15%
 */

import type { AIRecommendationContext } from "@/lib/classification/types";

/**
 * 系统提示词 - 定义 AI 角色和能力
 */
export const COT_SYSTEM_PROMPT = `你是一位专业的书签分类助手，具备以下能力：
- 精确理解内容语义和用户意图
- 分析用户历史分类偏好和习惯
- 评估分类置信度和潜在错误
- 在不确定时主动建议创建新文件夹

你的目标是帮助用户建立清晰、有逻辑的知识体系。`;

/**
 * 构建 CoT Prompt - 思维链推理
 */
export function buildCoTPrompt(context: AIRecommendationContext): string {
  const candidateSection = buildCandidateSection(context);
  const bookmarkInfo = buildBookmarkInfo(context);

  return `${bookmarkInfo}

${candidateSection}

请按以下步骤进行分析（思维链推理）：

## 第一步：内容理解
- 这个书签的核心主题是什么？
- 它属于哪个知识领域？
- 有哪些关键特征（技术栈/行业/场景）？

## 第二步：候选评估
对每个候选文件夹，从三个维度评分（0-100）：
1. **语义相关度**：内容主题是否匹配？
2. **历史一致性**：用户是否习惯这样分类？
3. **结构合理性**：放在这里是否符合知识体系？

## 第三步：决策与反思
- 选择综合得分最高的文件夹
- 检查：是否有更好的选择被忽略？
- 检查：置信度是否合理？（不确定时应降低）
- 检查：是否需要建议创建新文件夹？

## 输出格式
\`\`\`json
{
  "thinking": {
    "theme": "核心主题（简短）",
    "domain": "所属领域",
    "keyFeatures": ["特征1", "特征2"]
  },
  "evaluation": [
    {
      "folderId": 123,
      "folderName": "文件夹名",
      "semantic": 85,
      "history": 70,
      "structure": 80,
      "total": 78
    }
  ],
  "decision": {
    "folderId": 123,
    "folderName": "最终选择的文件夹",
    "confidence": 78,
    "reason": "选择理由（简短）"
  },
  "reflection": {
    "alternativeConsidered": "考虑过的其他选项",
    "potentialIssue": "潜在问题（如果有）",
    "suggestNew": false,
    "suggestNewName": null
  }
}
\`\`\`

只返回 JSON，不要其他内容。`;
}

/**
 * 构建书签信息部分
 */
function buildBookmarkInfo(context: AIRecommendationContext): string {
  return `## 待分类书签

**标题**：${context.title}
**摘要**：${context.summary || "（无摘要）"}
**标签**：${context.tags.length > 0 ? context.tags.join("、") : "（无标签）"}`;
}

/**
 * 构建候选文件夹部分
 */
function buildCandidateSection(context: AIRecommendationContext): string {
  let section = "## 候选文件夹\n\n";

  // 内容相似度最高的文件夹
  if (context.vectorMatches.length > 0) {
    section += "### 📊 内容相似度最高\n\n";
    for (const match of context.vectorMatches.slice(0, 3)) {
      section += `**「${match.folderName}」** (相似度: ${match.score}%)\n`;
      section += `- 已有 ${match.bookmarkCount} 个书签\n`;
      section += `- 高频标签：${match.topTags.slice(0, 5).join("、") || "无"}\n`;
      section += `- 示例内容：${match.sampleTitles.slice(0, 2).join("；") || "无"}\n\n`;
    }
  }

  // 用户历史偏好
  if (context.historyMatches.length > 0) {
    section += "### 📈 用户历史偏好\n\n";
    for (const match of context.historyMatches.slice(0, 3)) {
      section += `**「${match.folderName}」** (${match.similarBookmarkCount} 个相似书签)\n`;
      section += `- 相似书签：${match.similarTitles.slice(0, 2).join("；")}\n\n`;
    }
  }

  // 其他可用文件夹
  if (context.allFolders.length > 0) {
    const otherFolders = context.allFolders
      .filter((f) => {
        const inVector = context.vectorMatches.some((v) => v.folderId === f.id);
        const inHistory = context.historyMatches.some(
          (h) => h.folderId === f.id,
        );
        return !inVector && !inHistory;
      })
      .slice(0, 5);

    if (otherFolders.length > 0) {
      section += "### 📁 其他可用文件夹\n\n";
      section += otherFolders.map((f) => `- 「${f.name}」`).join("\n");
      section += "\n";
    }
  }

  return section;
}

/**
 * 解析 CoT 响应
 */
export interface CoTResponse {
  thinking: {
    theme: string;
    domain: string;
    keyFeatures: string[];
  };
  evaluation: Array<{
    folderId: number;
    folderName: string;
    semantic: number;
    history: number;
    structure: number;
    total: number;
  }>;
  decision: {
    folderId: number | null;
    folderName: string;
    confidence: number;
    reason: string;
  };
  reflection: {
    alternativeConsidered: string | null;
    potentialIssue: string | null;
    suggestNew: boolean;
    suggestNewName: string | null;
  };
}

/**
 * 解析 AI 返回的 CoT JSON
 */
export function parseCoTResponse(content: string): CoTResponse | null {
  try {
    // 提取 JSON 部分
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;

    // 尝试找到 JSON 对象
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      return null;
    }

    const parsed = JSON.parse(objectMatch[0]);

    // 验证必要字段
    if (!parsed.decision || typeof parsed.decision.confidence !== "number") {
      return null;
    }

    return {
      thinking: parsed.thinking || {
        theme: "",
        domain: "",
        keyFeatures: [],
      },
      evaluation: parsed.evaluation || [],
      decision: {
        folderId: parsed.decision.folderId ?? null,
        folderName: parsed.decision.folderName || "",
        confidence: parsed.decision.confidence,
        reason: parsed.decision.reason || "",
      },
      reflection: parsed.reflection || {
        alternativeConsidered: null,
        potentialIssue: null,
        suggestNew: false,
        suggestNewName: null,
      },
    };
  } catch {
    return null;
  }
}

/**
 * 从 CoT 响应提取最终推荐
 */
export function extractRecommendation(response: CoTResponse) {
  return {
    folderId: response.decision.folderId,
    folderName: response.decision.folderName,
    confidence: response.decision.confidence,
    reason: response.decision.reason,
    suggestNew: response.reflection.suggestNew,
    suggestNewName: response.reflection.suggestNewName,
    // 额外的 CoT 元数据
    metadata: {
      theme: response.thinking.theme,
      domain: response.thinking.domain,
      alternativeConsidered: response.reflection.alternativeConsidered,
      potentialIssue: response.reflection.potentialIssue,
    },
  };
}
