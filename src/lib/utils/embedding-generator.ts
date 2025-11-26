/**
 * 向量嵌入生成工具
 * 使用阿里云百炼 DashScope API (OpenAI 兼容模式)
 * 用于语义搜索功能
 */

import { logger } from '@/lib/logger'

// 阿里云百炼 API 配置 (OpenAI 兼容模式)
const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_MODEL = 'text-embedding-v3'
// text-embedding-v3 支持的维度: 64, 128, 256, 512, 768, 1024
const DEFAULT_DIMENSIONS = 1024
const API_TIMEOUT = 15000 // 15秒超时

/**
 * 向量嵌入配置
 */
export interface EmbeddingConfig {
  model: 'text-embedding-v3' | 'text-embedding-v4'
  dimensions: number
}

/**
 * API 响应类型
 */
interface EmbeddingResponse {
  object: string
  data: Array<{
    object: string
    index: number
    embedding: number[]
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

/**
 * 生成单个文本的向量嵌入
 * @param text - 要生成向量的文本
 * @param config - 可选配置
 * @returns 1024维浮点数向量数组
 */
export async function generateEmbedding(
  text: string,
  config?: Partial<EmbeddingConfig>
): Promise<number[]> {
  const apiKey = process.env.DASHSCOPE_API_KEY

  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY 环境变量未配置')
  }

  // 文本预处理：截断过长文本，避免超过 token 限制
  const truncatedText = truncateText(text, 8000)

  if (!truncatedText || truncatedText.trim().length === 0) {
    throw new Error('输入文本不能为空')
  }

  try {
    const response = await fetch(`${DASHSCOPE_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config?.model || DEFAULT_MODEL,
        input: truncatedText,
        dimensions: config?.dimensions || DEFAULT_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(API_TIMEOUT),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(
        {
          status: response.status,
          error: errorText,
          action: 'embedding_api_error',
        },
        'Embedding: API error'
      )
      throw new Error(`DashScope API 错误: ${response.status} - ${errorText}`)
    }

    const data: EmbeddingResponse = await response.json()

    if (!data.data?.[0]?.embedding) {
      throw new Error('API 未返回有效的向量数据')
    }

    logger.info(
      {
        model: data.model,
        dimensions: data.data[0].embedding.length,
        tokens: data.usage?.total_tokens,
        action: 'embedding_generated',
      },
      'Embedding: Success'
    )

    return data.data[0].embedding
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        logger.error({ action: 'embedding_timeout' }, 'Embedding: Timeout')
        throw new Error('向量生成超时，请稍后重试')
      }
      logger.error(
        {
          error: error.message,
          action: 'embedding_failed',
        },
        'Embedding: Failed'
      )
      throw error
    }
    throw new Error('向量生成失败')
  }
}

/**
 * 批量生成多个文本的向量嵌入
 * @param texts - 文本数组
 * @param config - 可选配置
 * @returns 向量数组的数组
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  config?: Partial<EmbeddingConfig>
): Promise<number[][]> {
  const apiKey = process.env.DASHSCOPE_API_KEY

  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY 环境变量未配置')
  }

  if (!texts || texts.length === 0) {
    return []
  }

  // 预处理：截断过长文本
  const truncatedTexts = texts.map(text => truncateText(text, 8000))
  const validTexts = truncatedTexts.filter(t => t && t.trim().length > 0)

  if (validTexts.length === 0) {
    return []
  }

  try {
    const response = await fetch(`${DASHSCOPE_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config?.model || DEFAULT_MODEL,
        input: validTexts,
        dimensions: config?.dimensions || DEFAULT_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(API_TIMEOUT * 2), // 批量请求给更长时间
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(
        {
          status: response.status,
          error: errorText,
          count: validTexts.length,
          action: 'embedding_batch_api_error',
        },
        'Embedding Batch: API error'
      )
      throw new Error(`DashScope API 错误: ${response.status} - ${errorText}`)
    }

    const data: EmbeddingResponse = await response.json()

    if (!data.data || data.data.length === 0) {
      throw new Error('API 未返回有效的向量数据')
    }

    // 按 index 排序，确保顺序正确
    const sortedData = [...data.data].sort((a, b) => a.index - b.index)
    const embeddings = sortedData.map(item => item.embedding)

    logger.info(
      {
        model: data.model,
        count: embeddings.length,
        tokens: data.usage?.total_tokens,
        action: 'embedding_batch_generated',
      },
      'Embedding Batch: Success'
    )

    return embeddings
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        logger.error(
          { count: validTexts.length, action: 'embedding_batch_timeout' },
          'Embedding Batch: Timeout'
        )
        throw new Error('批量向量生成超时，请减少数量后重试')
      }
      logger.error(
        {
          error: error.message,
          count: validTexts.length,
          action: 'embedding_batch_failed',
        },
        'Embedding Batch: Failed'
      )
      throw error
    }
    throw new Error('批量向量生成失败')
  }
}

/**
 * 为书签内容生成向量文本
 * 合并标题、摘要、标签为一个搜索友好的文本
 */
export function buildEmbeddingText(
  title: string,
  summary?: string | null,
  tags?: string[] | null
): string {
  const parts: string[] = []

  if (title) {
    parts.push(title)
  }

  if (summary) {
    parts.push(summary)
  }

  if (tags && tags.length > 0) {
    parts.push(tags.join(' '))
  }

  return parts.join(' ').trim()
}

/**
 * 截断文本到指定字符数
 * 避免超过 API 的 token 限制
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength)
}

/**
 * 检查向量是否有效
 */
export function isValidEmbedding(embedding: unknown): embedding is number[] {
  return (
    Array.isArray(embedding) &&
    embedding.length === DEFAULT_DIMENSIONS &&
    embedding.every(val => typeof val === 'number' && !isNaN(val))
  )
}
