/**
 * AI 内容生成工具
 * 使用 DeepSeek API 生成摘要和标签
 */

import { logger } from '@/lib/logger'

export interface AIGenerateResult {
  summary: string
  tags: string[]
}

export interface FolderRecommendation {
  folderId: number | null  // null 表示建议新建文件夹
  folderName: string       // 推荐的文件夹名称（已有或建议新建）
  confidence: number       // 置信度 0-100
  reason: string           // 推荐理由
  suggestNew: boolean      // 是否建议新建文件夹
}

interface ExistingFolder {
  id: number
  name: string
}

interface AIGenerateRequest {
  title: string
  description?: string
  content?: string
}

/**
 * 调用 DeepSeek API 生成摘要和标签
 */
async function callDeepSeekAPI(
  title: string,
  description?: string,
  content?: string
): Promise<AIGenerateResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 环境变量未配置')
  }

  // 构建提示词
  const prompt = buildPrompt(title, description, content)

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个内容分析助手，擅长提取关键信息和生成简洁摘要。请严格按照 JSON 格式返回结果。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(15000), // 15秒超时
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`DeepSeek API 错误: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const aiContent = data.choices[0]?.message?.content

    if (!aiContent) {
      throw new Error('AI 未返回内容')
    }

    // 解析 JSON 响应
    const result = parseAIResponse(aiContent)
    return result
  } catch (error) {
    if (error instanceof Error) {
      logger.error(
        {
          error: error.message,
          action: 'deepseek_api_call',
        },
        'AI Generator: DeepSeek API error'
      )
      throw new Error(`AI 生成失败: ${error.message}`)
    }
    throw new Error('AI 生成失败')
  }
}

/**
 * 构建 AI 提示词
 */
function buildPrompt(title: string, description?: string, content?: string): string {
  let prompt = `请分析以下内容，生成一个简洁的摘要（50-100字）和3-5个相关标签。

标题：${title}`

  if (description) {
    prompt += `\n描述：${description}`
  }

  if (content) {
    // 限制内容长度避免超过 token 限制
    const truncatedContent = content.substring(0, 2000)
    prompt += `\n正文：${truncatedContent}`
  }

  prompt += `

请以 JSON 格式返回结果：
{
  "summary": "摘要内容",
  "tags": ["标签1", "标签2", "标签3"]
}

要求：
1. 摘要要突出核心观点，简洁明了
2. 标签要准确反映内容主题和领域
3. 标签使用中文，3-5个词
4. 只返回 JSON，不要额外说明`

  return prompt
}

/**
 * 解析 AI 返回的内容
 */
function parseAIResponse(content: string): AIGenerateResult {
  try {
    // 移除可能的 markdown 代码块标记
    const cleaned = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const result = JSON.parse(cleaned)

    // 验证结果格式
    if (!result.summary || typeof result.summary !== 'string') {
      throw new Error('Invalid summary format')
    }

    if (!Array.isArray(result.tags) || result.tags.length === 0) {
      throw new Error('Invalid tags format')
    }

    // 确保标签是字符串数组
    const tags = result.tags
      .filter((tag: any) => typeof tag === 'string')
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0)

    if (tags.length === 0) {
      throw new Error('No valid tags found')
    }

    return {
      summary: result.summary.trim(),
      tags: tags.slice(0, 5), // 最多5个标签
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        rawContent: content,
        action: 'parse_ai_response',
      },
      'AI Generator: Parse response error'
    )
    throw new Error('解析 AI 响应失败')
  }
}

/**
 * 生成基于规则的简单摘要和标签（回退方案）
 */
function generateFallbackContent(title: string, description?: string): AIGenerateResult {
  // 简单摘要：使用标题或描述的前100个字符
  let summary = title

  if (description && description.length > title.length) {
    summary = description.length > 100 ? description.substring(0, 100) + '...' : description
  }

  // 简单标签：从标题中提取关键词
  const tags: string[] = []
  const keywords = ['学习', '技术', '产品', '设计', '运营', '营销', '管理', '创业', '投资', '生活']

  keywords.forEach((keyword) => {
    if (title.includes(keyword) || description?.includes(keyword)) {
      tags.push(keyword)
    }
  })

  // 如果没有匹配的关键词，使用默认标签
  if (tags.length === 0) {
    tags.push('收藏', '阅读')
  }

  return {
    summary: summary.substring(0, 100),
    tags: tags.slice(0, 5),
  }
}

/**
 * 生成 AI 摘要和标签
 * @param request - 包含标题、描述和内容的请求对象
 * @returns AI 生成的摘要和标签
 */
export async function generateAIContent(request: AIGenerateRequest): Promise<AIGenerateResult> {
  const { title, description, content } = request

  // 验证输入
  if (!title || title.trim().length === 0) {
    throw new Error('标题不能为空')
  }

  try {
    logger.info(
      {
        title,
        action: 'generate_start',
      },
      'AI Generator: Generating content'
    )
    const result = await callDeepSeekAPI(title, description, content)
    logger.info(
      {
        summary: result.summary,
        tagCount: result.tags.length,
        action: 'generate_success',
      },
      'AI Generator: Success'
    )
    return result
  } catch (error) {
    // AI 生成失败时使用回退方案
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        title,
        action: 'generate_failed',
      },
      'AI Generator: Failed, using fallback'
    )
    const fallback = generateFallbackContent(title, description)
    logger.info(
      {
        summary: fallback.summary,
        tagCount: fallback.tags.length,
        action: 'fallback_used',
      },
      'AI Generator: Fallback'
    )
    return fallback
  }
}

/**
 * 推荐文件夹
 * 基于内容和现有文件夹列表，AI 推荐最合适的文件夹
 */
export async function recommendFolder(
  title: string,
  summary: string,
  tags: string[],
  existingFolders: ExistingFolder[]
): Promise<FolderRecommendation> {
  const apiKey = process.env.DEEPSEEK_API_KEY

  // 如果没有 API Key 或没有现有文件夹，使用智能回退
  if (!apiKey || existingFolders.length === 0) {
    return generateFallbackFolderRecommendation(title, tags, existingFolders)
  }

  try {
    const prompt = buildFolderRecommendationPrompt(title, summary, tags, existingFolders)

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个内容分类助手。你的任务是根据内容特征，推荐最合适的文件夹。请严格按照 JSON 格式返回结果。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // 较低的温度以获得更一致的结果
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(10000), // 10秒超时
    })

    if (!response.ok) {
      throw new Error(`DeepSeek API 错误: ${response.status}`)
    }

    const data = await response.json()
    const aiContent = data.choices[0]?.message?.content

    if (!aiContent) {
      throw new Error('AI 未返回内容')
    }

    return parseFolderRecommendation(aiContent, existingFolders)
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        title,
        action: 'folder_recommendation_failed',
      },
      'AI Generator: Folder recommendation failed'
    )
    return generateFallbackFolderRecommendation(title, tags, existingFolders)
  }
}

/**
 * 构建文件夹推荐提示词
 */
function buildFolderRecommendationPrompt(
  title: string,
  summary: string,
  tags: string[],
  existingFolders: ExistingFolder[]
): string {
  const folderList = existingFolders.map((f) => `- ${f.name} (ID: ${f.id})`).join('\n')

  return `请根据以下内容，从现有文件夹中选择最合适的一个，或建议创建新文件夹。

内容信息：
- 标题：${title}
- 摘要：${summary}
- 标签：${tags.join('、')}

现有文件夹：
${folderList || '（暂无文件夹）'}

请以 JSON 格式返回：
{
  "recommendedFolderId": 123,  // 推荐的文件夹 ID，如建议新建则为 null
  "folderName": "文件夹名称",  // 推荐的文件夹名（已有的或建议新建的）
  "confidence": 85,           // 置信度 0-100
  "reason": "推荐理由",       // 简短说明为什么推荐这个文件夹
  "suggestNew": false         // 是否建议新建文件夹
}

要求：
1. 如果现有文件夹中有匹配的，优先推荐现有文件夹
2. 只有内容主题与现有文件夹都不匹配时，才建议新建
3. 建议新建时，给出简洁有意义的文件夹名称
4. 只返回 JSON，不要额外说明`
}

/**
 * 解析文件夹推荐响应
 */
function parseFolderRecommendation(
  content: string,
  existingFolders: ExistingFolder[]
): FolderRecommendation {
  try {
    const cleaned = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const result = JSON.parse(cleaned)

    // 验证推荐的文件夹 ID 是否存在
    let folderId: number | null = null
    let folderName = result.folderName || '未分类'
    const suggestNew = result.suggestNew === true

    if (!suggestNew && result.recommendedFolderId) {
      const folder = existingFolders.find((f) => f.id === result.recommendedFolderId)
      if (folder) {
        folderId = folder.id
        folderName = folder.name
      }
    }

    return {
      folderId,
      folderName,
      confidence: Math.min(100, Math.max(0, result.confidence || 50)),
      reason: result.reason || '基于内容主题分析',
      suggestNew,
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        rawContent: content,
        action: 'parse_folder_recommendation',
      },
      'AI Generator: Parse folder recommendation error'
    )

    // 返回默认推荐
    return {
      folderId: existingFolders[0]?.id || null,
      folderName: existingFolders[0]?.name || '未分类',
      confidence: 30,
      reason: '基于默认规则',
      suggestNew: existingFolders.length === 0,
    }
  }
}

/**
 * 智能回退：基于关键词匹配推荐文件夹
 */
function generateFallbackFolderRecommendation(
  title: string,
  tags: string[],
  existingFolders: ExistingFolder[]
): FolderRecommendation {
  // 如果没有文件夹，建议新建
  if (existingFolders.length === 0) {
    // 从标签或标题推断文件夹名称
    const suggestedName = tags[0] || extractKeyword(title) || '我的收藏'
    return {
      folderId: null,
      folderName: suggestedName,
      confidence: 40,
      reason: '暂无文件夹，建议创建新文件夹',
      suggestNew: true,
    }
  }

  // 简单关键词匹配
  const titleLower = title.toLowerCase()
  const tagsLower = tags.map((t) => t.toLowerCase())

  let bestMatch: ExistingFolder | null = null
  let bestScore = 0

  for (const folder of existingFolders) {
    const folderNameLower = folder.name.toLowerCase()
    let score = 0

    // 标题包含文件夹名
    if (titleLower.includes(folderNameLower)) {
      score += 50
    }

    // 文件夹名包含在标题中
    if (folderNameLower.split(/\s+/).some((word) => titleLower.includes(word) && word.length > 1)) {
      score += 30
    }

    // 标签匹配
    for (const tag of tagsLower) {
      if (folderNameLower.includes(tag) || tag.includes(folderNameLower)) {
        score += 20
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = folder
    }
  }

  if (bestMatch && bestScore >= 20) {
    return {
      folderId: bestMatch.id,
      folderName: bestMatch.name,
      confidence: Math.min(80, bestScore),
      reason: '基于关键词匹配',
      suggestNew: false,
    }
  }

  // 无匹配，建议新建
  const suggestedName = tags[0] || extractKeyword(title) || '未分类'
  return {
    folderId: null,
    folderName: suggestedName,
    confidence: 30,
    reason: '没有找到匹配的文件夹，建议创建新文件夹',
    suggestNew: true,
  }
}

/**
 * 从标题提取关键词作为文件夹名建议
 */
function extractKeyword(title: string): string {
  // 常见分类关键词
  const keywords = [
    '前端', '后端', '编程', '技术', 'AI', '人工智能',
    '产品', '设计', 'UI', 'UX', '运营', '营销',
    '管理', '创业', '投资', '理财', '生活', '健康',
    '学习', '教程', '读书', '影视', '音乐', '游戏',
    '美食', '旅行', '时尚', '科技', '新闻'
  ]

  for (const keyword of keywords) {
    if (title.includes(keyword)) {
      return keyword
    }
  }

  return ''
}
