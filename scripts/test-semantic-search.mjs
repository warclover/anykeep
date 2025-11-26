/**
 * 测试语义搜索功能
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// 读取环境变量
const envContent = readFileSync('.env.local', 'utf-8')

function getEnvVar(name) {
  // 只匹配非注释行的环境变量
  const lines = envContent.split('\n')
  for (const line of lines) {
    // 跳过注释行
    if (line.trim().startsWith('#')) continue
    const match = line.match(new RegExp(`^${name}=(.+)$`))
    if (match) return match[1].trim()
  }
  return null
}

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
const dashscopeApiKey = getEnvVar('DASHSCOPE_API_KEY')

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

// 生成查询向量
async function generateQueryEmbedding(text) {
  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dashscopeApiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-v3',
      input: text,
      dimensions: 1024,
    }),
  })

  const result = await response.json()
  if (result.error) {
    throw new Error(result.error.message)
  }
  return result.data[0].embedding
}

async function runTests() {
  console.log('=== 语义搜索功能测试 ===\n')

  // 1. 检查向量统计
  console.log('1. 向量统计:')
  const { data: stats } = await supabase.from('embedding_stats').select('*').single()
  console.log(`   总书签: ${stats?.total_bookmarks}`)
  console.log(`   已生成向量: ${stats?.with_embedding}`)
  console.log(`   覆盖率: ${stats?.embedding_coverage}%`)

  // 2. 获取测试用户
  const { data: bookmark } = await supabase
    .from('bookmarks')
    .select('user_id')
    .not('embedding', 'is', null)
    .limit(1)
    .single()

  if (!bookmark) {
    console.log('\n❌ 没有找到已生成向量的书签')
    return
  }

  const userId = bookmark.user_id
  console.log(`\n2. 测试用户 ID: ${userId}`)

  // 3. 测试语义搜索
  const testQueries = ['人工智能', 'AI编程', '机器学习']

  for (const query of testQueries) {
    console.log(`\n3. 测试查询: "${query}"`)

    try {
      // 生成查询向量
      const queryEmbedding = await generateQueryEmbedding(query)
      console.log(`   ✓ 查询向量已生成 (维度: ${queryEmbedding.length})`)

      // 调用语义搜索函数
      const { data, error } = await supabase.rpc('search_bookmarks_semantic', {
        query_embedding: queryEmbedding,
        p_user_id: userId,
        match_threshold: 0.3,  // 降低阈值以获取更多结果
        match_count: 5
      })

      if (error) {
        console.log(`   ❌ 搜索错误: ${error.message}`)
        continue
      }

      console.log(`   ✓ 搜索结果: ${data?.length || 0} 条`)
      if (data && data.length > 0) {
        data.forEach((item, i) => {
          console.log(`     ${i+1}. [相似度: ${(item.similarity * 100).toFixed(1)}%] ${item.title?.substring(0, 40)}...`)
        })
      }
    } catch (err) {
      console.log(`   ❌ 错误: ${err.message}`)
    }
  }

  console.log('\n=== 测试完成 ===')
}

runTests().catch(console.error)
