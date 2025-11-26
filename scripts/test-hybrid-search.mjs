/**
 * 测试混合搜索功能
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// 读取环境变量
const envContent = readFileSync('.env.local', 'utf-8')

function getEnvVar(name) {
  const lines = envContent.split('\n')
  for (const line of lines) {
    if (line.trim().startsWith('#')) continue
    const match = line.match(new RegExp(`^${name}=(.+)$`))
    if (match) return match[1].trim()
  }
  return null
}

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
const dashscopeApiKey = getEnvVar('DASHSCOPE_API_KEY')

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

// 获取用户ID
async function getUserId() {
  const { data } = await supabase
    .from('bookmarks')
    .select('user_id')
    .not('embedding', 'is', null)
    .limit(1)
    .single()
  return data?.user_id
}

// 1. 关键词搜索 (ILIKE)
async function testKeywordSearch(userId, query) {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('id, title, ai_summary')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .or(`title.ilike.%${query}%,ai_summary.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(5)

  return { data, error, type: 'keyword' }
}

// 2. 语义搜索
async function testSemanticSearch(userId, query) {
  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dashscopeApiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-v3',
      input: query,
      dimensions: 1024,
    }),
  })

  const result = await response.json()
  if (result.error) throw new Error(result.error.message)

  const queryEmbedding = result.data[0].embedding

  const { data, error } = await supabase.rpc('search_bookmarks_semantic', {
    query_embedding: queryEmbedding,
    p_user_id: userId,
    match_threshold: 0.3,
    match_count: 5
  })

  return { data, error, type: 'semantic' }
}

async function runTests() {
  console.log('=== 混合搜索功能测试 ===\n')

  const userId = await getUserId()
  console.log(`用户 ID: ${userId}\n`)

  const testQueries = [
    'Cursor',        // 精确关键词
    '程序员效率',     // 语义概念
    'AI 代码'        // 混合查询
  ]

  for (const query of testQueries) {
    console.log(`\n🔍 查询: "${query}"`)
    console.log('─'.repeat(50))

    // 关键词搜索
    const keywordResult = await testKeywordSearch(userId, query)
    console.log(`\n📝 关键词搜索结果: ${keywordResult.data?.length || 0} 条`)
    keywordResult.data?.slice(0, 3).forEach((item, i) => {
      console.log(`   ${i+1}. ${item.title?.substring(0, 45)}...`)
    })

    // 语义搜索
    try {
      const semanticResult = await testSemanticSearch(userId, query)
      console.log(`\n🧠 语义搜索结果: ${semanticResult.data?.length || 0} 条`)
      semanticResult.data?.slice(0, 3).forEach((item, i) => {
        console.log(`   ${i+1}. [${(item.similarity * 100).toFixed(1)}%] ${item.title?.substring(0, 40)}...`)
      })
    } catch (err) {
      console.log(`\n🧠 语义搜索错误: ${err.message}`)
    }
  }

  console.log('\n\n=== 测试完成 ===')
}

runTests().catch(console.error)
