/**
 * Supabase Edge Function: process-t1-corrections
 *
 * 功能：后台处理 T1 纠正队列
 * - 查询 pending 状态的 T1 任务
 * - 调用 LLM 进行智能纠正
 * - 更新 T1 队列状态
 * - 记录分类指标
 *
 * 触发方式：
 * - Supabase Cron 定时任务（每 5 分钟）
 * - 手动 HTTP 调用
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * T1 队列记录类型
 */
interface T1QueueRecord {
  id: string;
  user_id: string;
  bookmark_id: number;
  t0_folder_id: number;
  t0_confidence: number;
  trigger_reason: string;
  status: string;
  retry_count: number;
}

/**
 * LLM 纠正结果类型
 */
interface LLMCorrectionResult {
  folderId: number;
  confidence: number;
  reasoning: string;
}

/**
 * 调用 LLM 进行 T1 纠正
 */
async function callLLMForCorrection(
  supabase: any,
  bookmarkId: number,
  userId: string,
  t0FolderId: number
): Promise<LLMCorrectionResult> {
  // 1. 获取书签信息
  const { data: bookmark, error: bookmarkError } = await supabase
    .from('bookmarks')
    .select('id, title, description, url, summary')
    .eq('id', bookmarkId)
    .eq('user_id', userId)
    .single();

  if (bookmarkError || !bookmark) {
    throw new Error(`Failed to fetch bookmark: ${bookmarkError?.message}`);
  }

  // 2. 获取候选文件夹（Top 5）
  const { data: folders, error: foldersError } = await supabase
    .from('folders')
    .select('id, name, description')
    .eq('user_id', userId)
    .limit(5);

  if (foldersError || !folders || folders.length === 0) {
    throw new Error(`Failed to fetch folders: ${foldersError?.message}`);
  }

  // 3. 构建 LLM Prompt
  const prompt = buildLLMPrompt(bookmark, folders, t0FolderId);

  // 4. 调用 DeepSeek LLM
  const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!deepseekApiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Empty LLM response');
  }

  // 5. 解析 LLM 响应（期望 JSON 格式）
  try {
    const parsed = JSON.parse(content);
    return {
      folderId: parseInt(parsed.folderId),
      confidence: parseFloat(parsed.confidence),
      reasoning: parsed.reasoning || '',
    };
  } catch (err) {
    throw new Error(`Failed to parse LLM response: ${err.message}`);
  }
}

/**
 * 构建 LLM Prompt
 */
function buildLLMPrompt(
  bookmark: any,
  folders: any[],
  t0FolderId: number
): string {
  return `你是一个智能书签分类助手。请分析以下书签，并从候选文件夹中选择最合适的一个。

**书签信息**:
- 标题: ${bookmark.title}
- 描述: ${bookmark.description || '无'}
- URL: ${bookmark.url}
- 摘要: ${bookmark.summary || '无'}

**候选文件夹** (按推荐度排序):
${folders.map((f, i) => `${i + 1}. [ID: ${f.id}] ${f.name} - ${f.description || '无描述'}`).join('\n')}

**初始分类结果**: 文件夹 ID ${t0FolderId}

**要求**:
1. 选择最合适的文件夹 ID
2. 给出置信度分数 (0.0-1.0)
3. 简要说明选择理由（50字以内）

**输出 JSON 格式**:
{
  "folderId": "选择的文件夹 ID（数字）",
  "confidence": 0.95,
  "reasoning": "选择理由"
}`;
}

/**
 * 主处理函数
 */
serve(async (req) => {
  try {
    // 1. 创建 Supabase 客户端（使用 Service Role Key）
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting T1 corrections processing...');

    // 2. 查询 pending 状态的 T1 任务（批量处理 10 个）
    const { data: tasks, error: queryError } = await supabase
      .from('classification_t1_queue_v5')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (queryError) {
      throw new Error(`Failed to query T1 queue: ${queryError.message}`);
    }

    if (!tasks || tasks.length === 0) {
      console.log('No pending T1 tasks found');
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending tasks' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${tasks.length} pending T1 tasks`);

    // 3. 处理每个任务
    let successCount = 0;
    let failureCount = 0;

    for (const task of tasks as T1QueueRecord[]) {
      try {
        console.log(`Processing task ${task.id} for bookmark ${task.bookmark_id}`);

        // 更新状态为 processing
        await supabase
          .from('classification_t1_queue_v5')
          .update({ status: 'processing' })
          .eq('id', task.id);

        // 调用 LLM 进行纠正
        const startTime = Date.now();
        const result = await callLLMForCorrection(
          supabase,
          task.bookmark_id,
          task.user_id,
          task.t0_folder_id
        );
        const latency = Date.now() - startTime;

        // 更新为 completed
        await supabase
          .from('classification_t1_queue_v5')
          .update({
            status: 'completed',
            t1_folder_id: result.folderId,
            t1_confidence: result.confidence,
            t1_reasoning: result.reasoning,
            t1_timestamp: new Date().toISOString(),
          })
          .eq('id', task.id);

        // 记录分类指标
        await supabase.from('classification_metrics_v5').insert({
          user_id: task.user_id,
          bookmark_id: task.bookmark_id,
          folder_id: result.folderId,
          stage: 'T1',
          latency_ms: latency,
          confidence: result.confidence,
          llm_tokens: 500, // 估算值
          degradation_level: 0,
        });

        successCount++;
        console.log(`Task ${task.id} completed successfully`);
      } catch (err) {
        failureCount++;
        console.error(`Task ${task.id} failed:`, err);

        // 更新为 failed
        await supabase
          .from('classification_t1_queue_v5')
          .update({
            status: 'failed',
            error_message: err.message,
            retry_count: task.retry_count + 1,
          })
          .eq('id', task.id);
      }
    }

    // 4. 返回处理结果
    const result = {
      processed: tasks.length,
      success: successCount,
      failed: failureCount,
      timestamp: new Date().toISOString(),
    };

    console.log('T1 corrections processing completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('T1 corrections processing error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
