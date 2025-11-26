/**
 * 批量生成向量嵌入脚本
 *
 * 使用方法:
 * 1. 确保 .env.local 中配置了 DASHSCOPE_API_KEY
 * 2. 运行: node scripts/generate-embeddings.mjs
 *
 * 注意: 此脚本使用 Supabase Service Role Key，直接操作数据库
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// 手动加载 .env.local 环境变量
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim()
        let value = trimmed.substring(eqIndex + 1).trim()
        // 移除可能的引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        process.env[key] = value
      }
    }
  }
}

// 配置
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY
const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const BATCH_SIZE = 5
const DELAY_MS = 1000

// 验证配置
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 错误: 缺少 Supabase 配置')
  console.error('请确保 .env.local 中配置了:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!DASHSCOPE_API_KEY) {
  console.error('❌ 错误: 缺少 DASHSCOPE_API_KEY')
  console.error('请在 .env.local 中配置阿里云百炼 API Key')
  process.exit(1)
}

// 创建 Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * 构建向量文本
 */
function buildEmbeddingText(title, summary, tags) {
  const parts = []
  if (title) parts.push(title)
  if (summary) parts.push(summary)
  if (tags && tags.length > 0) parts.push(tags.join(' '))
  return parts.join(' ').trim()
}

/**
 * 生成向量嵌入
 */
async function generateEmbedding(text) {
  const response = await fetch(`${DASHSCOPE_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-v3',
      input: text.substring(0, 8000), // 截断过长文本
      dimensions: 1024, // text-embedding-v3 支持: 64, 128, 256, 512, 768, 1024
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API 错误: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始批量生成向量嵌入...\n')

  // 1. 查询所有无向量的书签
  const { data: bookmarks, error: queryError } = await supabase
    .from('bookmarks')
    .select('id, title, ai_summary, ai_tags')
    .is('deleted_at', null)
    .is('embedding', null)
    .order('created_at', { ascending: false })

  if (queryError) {
    console.error('❌ 查询书签失败:', queryError.message)
    process.exit(1)
  }

  if (!bookmarks || bookmarks.length === 0) {
    console.log('✅ 所有书签都已有向量嵌入，无需处理')
    return
  }

  console.log(`📚 找到 ${bookmarks.length} 条需要处理的书签\n`)

  // 2. 批量处理
  let success = 0
  let failed = 0

  for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
    const batch = bookmarks.slice(i, i + BATCH_SIZE)
    console.log(`处理批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(bookmarks.length / BATCH_SIZE)}...`)

    for (const bookmark of batch) {
      try {
        const text = buildEmbeddingText(
          bookmark.title,
          bookmark.ai_summary,
          bookmark.ai_tags
        )

        if (!text || text.trim().length < 5) {
          console.log(`  ⚠️ [${bookmark.id}] 文本过短，跳过`)
          continue
        }

        const embedding = await generateEmbedding(text)

        const { error: updateError } = await supabase
          .from('bookmarks')
          .update({ embedding })
          .eq('id', bookmark.id)

        if (updateError) {
          throw updateError
        }

        console.log(`  ✅ [${bookmark.id}] ${bookmark.title.substring(0, 30)}...`)
        success++
      } catch (error) {
        console.log(`  ❌ [${bookmark.id}] 失败: ${error.message}`)
        failed++
      }
    }

    // 批次间延迟
    if (i + BATCH_SIZE < bookmarks.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }

  // 3. 输出统计
  console.log('\n========================================')
  console.log('📊 处理完成统计:')
  console.log(`  ✅ 成功: ${success}`)
  console.log(`  ❌ 失败: ${failed}`)
  console.log(`  📚 总计: ${bookmarks.length}`)
  console.log('========================================\n')

  // 4. 验证结果
  const { data: stats } = await supabase
    .from('bookmarks')
    .select('id, embedding')
    .is('deleted_at', null)

  const total = stats?.length || 0
  const withEmbedding = stats?.filter(b => b.embedding !== null).length || 0
  const coverage = total > 0 ? ((withEmbedding / total) * 100).toFixed(2) : 0

  console.log('📈 当前向量覆盖率:')
  console.log(`  总书签: ${total}`)
  console.log(`  已有向量: ${withEmbedding}`)
  console.log(`  覆盖率: ${coverage}%`)
}

main().catch(console.error)
