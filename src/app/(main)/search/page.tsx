/**
 * 搜索页面 - 服务端组件
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SearchPageClient } from '@/components/search/search-page-client'
import { searchQuerySchema } from '@/lib/validation'
import { QUERY_LIMITS, ANALYTICS } from '@/lib/constants/app'
import { searchBookmarksFulltext, searchBookmarksIlike } from '@/lib/utils/fulltext-search'

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    ai?: string
  }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const supabase = await createClient()

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // 如果有搜索关键词，验证并执行搜索
  let searchResults: any[] = []
  let searchError: string | undefined

  if (params.q) {
    // 验证搜索参数
    const validationResult = searchQuerySchema.safeParse(params)

    if (!validationResult.success) {
      searchError = validationResult.error.issues[0].message
    } else {
      const validatedQuery = validationResult.data.q
      const isAISearch = params.ai === 'true'

      try {
        if (isAISearch) {
          // TODO: AI 语义搜索（向量搜索 - 后续实现）
          // 暂时使用全文搜索
          const { data, error } = await searchBookmarksFulltext(
            supabase,
            user.id,
            validatedQuery,
            QUERY_LIMITS.SEARCH_RESULTS_PER_PAGE
          )

          if (error) throw error
          searchResults = data || []
        } else {
          // PostgreSQL 全文搜索（使用 ts_vector + GIN 索引）
          const { data, error } = await searchBookmarksFulltext(
            supabase,
            user.id,
            validatedQuery,
            QUERY_LIMITS.SEARCH_RESULTS_PER_PAGE
          )

          if (error) throw error
          searchResults = data || []
        }
      } catch (_error) {
        searchError = '搜索时出错，请稍后重试'
      }
    }
  }

  // 获取热门标签（从所有收藏的 AI 标签中统计）
  const { data: allBookmarks } = await supabase
    .from('bookmarks')
    .select('ai_tags')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .not('ai_tags', 'is', null)

  // 统计标签频率
  const tagCounts: Record<string, number> = {}
  allBookmarks?.forEach((bookmark) => {
    bookmark.ai_tags?.forEach((tag: string) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
  })

  // 获取热门标签
  const hotTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, ANALYTICS.TOP_TAGS_COUNT)
    .map(([tag]) => tag)

  return (
    <SearchPageClient
      initialQuery={params.q || ''}
      initialAIMode={params.ai === 'true'}
      searchResults={searchResults}
      hotTags={hotTags}
      error={searchError}
    />
  )
}
