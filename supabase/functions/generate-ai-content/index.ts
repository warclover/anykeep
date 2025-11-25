/**
 * Supabase Edge Function: generate-ai-content
 * 使用 AI 生成收藏内容的摘要和标签
 *
 * 请求格式: POST
 * Body: {
 *   "title": "文章标题",
 *   "description": "文章描述（可选）",
 *   "content": "文章内容（可选）"
 * }
 *
 * 响应格式:
 * {
 *   "success": true,
 *   "data": {
 *     "summary": "AI 生成的摘要",
 *     "tags": ["标签1", "标签2", "标签3"]
 *   }
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

interface GenerateRequest {
  title: string
  description?: string
  content?: string
}

interface GenerateResult {
  summary: string
  tags: string[]
}

/**
 * 调用 DeepSeek API 生成摘要和标签
 */
async function generateAIContent(
  title: string,
  description?: string,
  content?: string
): Promise<GenerateResult> {
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured')
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
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content returned from AI')
    }

    // 解析 JSON 响应
    const result = parseAIResponse(content)
    return result
  } catch (error) {
    console.error('AI generation error:', error)
    throw new Error('生成 AI 内容失败')
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
function parseAIResponse(content: string): GenerateResult {
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
    console.error('Parse AI response error:', error)
    console.error('Raw content:', content)

    // 回退方案：基于标题生成简单摘要和标签
    throw new Error('解析 AI 响应失败')
  }
}

/**
 * Edge Function 入口
 */
serve(async (req) => {
  // CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    // 解析请求体
    const { title, description, content }: GenerateRequest = await req.json()

    if (!title || title.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Title is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // 生成 AI 内容
    const data = await generateAIContent(title, description, content)

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('Edge function error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '生成 AI 内容失败',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
