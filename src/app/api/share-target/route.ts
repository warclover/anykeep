/**
 * PWA Web Share Target API
 * 处理从其他应用分享到 AnyKeep 的内容
 *
 * 当用户从其他 App 选择 "分享到 AnyKeep" 时，
 * 系统会 POST 数据到这个端点
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // 解析分享的数据
    const formData = await request.formData()
    const title = formData.get('title') as string | null
    const text = formData.get('text') as string | null
    const url = formData.get('url') as string | null

    // 提取 URL（可能在 text 中）
    let targetUrl = url
    if (!targetUrl && text) {
      // 从文本中提取 URL
      const urlMatch = text.match(/https?:\/\/[^\s]+/)
      if (urlMatch) {
        targetUrl = urlMatch[0]
      }
    }

    if (!targetUrl) {
      // 没有 URL，重定向到首页并显示错误
      return NextResponse.redirect(
        new URL('/home?error=no_url', request.url)
      )
    }

    // 获取用户会话
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      // 未登录，保存到临时存储并重定向到登录
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirect', `/home?share_url=${encodeURIComponent(targetUrl)}&share_title=${encodeURIComponent(title || '')}`)
      return NextResponse.redirect(redirectUrl)
    }

    // 已登录，重定向到首页并打开创建对话框
    const redirectUrl = new URL('/home', request.url)
    redirectUrl.searchParams.set('action', 'create')
    redirectUrl.searchParams.set('url', targetUrl)
    if (title) {
      redirectUrl.searchParams.set('title', title)
    }

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('Share target error:', error)
    return NextResponse.redirect(
      new URL('/home?error=share_failed', request.url)
    )
  }
}

// 也支持 GET 请求（某些浏览器可能使用 GET）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  const title = searchParams.get('title')
  const text = searchParams.get('text')

  // 提取 URL
  let targetUrl = url
  if (!targetUrl && text) {
    const urlMatch = text.match(/https?:\/\/[^\s]+/)
    if (urlMatch) {
      targetUrl = urlMatch[0]
    }
  }

  if (!targetUrl) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  // 重定向到首页并打开创建对话框
  const redirectUrl = new URL('/home', request.url)
  redirectUrl.searchParams.set('action', 'create')
  redirectUrl.searchParams.set('url', targetUrl)
  if (title) {
    redirectUrl.searchParams.set('title', title)
  }

  return NextResponse.redirect(redirectUrl)
}
