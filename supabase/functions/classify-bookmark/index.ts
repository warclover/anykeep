/**
 * 智能分类 v5.0 - 书签分类 Edge Function
 *
 * 在 Supabase Edge Function 中运行，用于异步分类书签
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ClassifyRequest {
  bookmarkId: string;
  userId: string;
  title: string;
  description?: string;
  summary?: string;
  tags?: string[];
  url: string;
}

serve(async (req) => {
  try {
    // 1. 验证请求方法
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. 解析请求体
    const body: ClassifyRequest = await req.json();

    // 3. 验证必需字段
    if (!body.bookmarkId || !body.userId || !body.title || !body.url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. 创建 Supabase 客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 5. 验证用户和书签所有权
    const { data: bookmark, error: bookmarkError } = await supabase
      .from('bookmarks')
      .select('id, user_id')
      .eq('id', body.bookmarkId)
      .eq('user_id', body.userId)
      .single();

    if (bookmarkError || !bookmark) {
      return new Response(
        JSON.stringify({ error: 'Bookmark not found or access denied' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. 调用分类 API（内部调用）
    const classifyUrl = `${supabaseUrl}/functions/v1/classify-internal`;
    const classifyResponse = await fetch(classifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        userId: body.userId,
        bookmarkId: body.bookmarkId,
        title: body.title,
        description: body.description,
        summary: body.summary,
        tags: body.tags,
        url: body.url,
      }),
    });

    if (!classifyResponse.ok) {
      throw new Error('Classification failed');
    }

    const classifyResult = await classifyResponse.json();

    // 7. 更新书签的文件夹
    const { error: updateError } = await supabase
      .from('bookmarks')
      .update({
        folder_id: classifyResult.data.folderId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.bookmarkId)
      .eq('user_id', body.userId);

    if (updateError) {
      throw new Error('Failed to update bookmark folder');
    }

    // 8. 返回结果
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          bookmarkId: body.bookmarkId,
          folderId: classifyResult.data.folderId,
          confidence: classifyResult.data.confidence,
          usedT1: classifyResult.data.usedT1,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
