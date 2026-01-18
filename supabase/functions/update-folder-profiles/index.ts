/**
 * 智能分类 v5.0 - 批量更新文件夹画像 Edge Function
 *
 * 定期运行，批量更新需要更新的文件夹画像
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // 1. 验证请求方法
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. 创建 Supabase 客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. 获取需要更新的文件夹画像（needs_update = true）
    const { data: profiles, error: profilesError } = await supabase
      .from('classification_folder_profiles_v5')
      .select('user_id, folder_id')
      .eq('needs_update', true)
      .limit(50); // 每次最多处理 50 个

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No profiles need update',
          updated: 0,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${profiles.length} profiles to update`);

    // 4. 批量更新文件夹画像
    const results = [];
    const errors = [];

    for (const profile of profiles) {
      try {
        // 调用更新 API
        const updateUrl = `${supabaseUrl}/functions/v1/update-folder-profile-internal`;
        const updateResponse = await fetch(updateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            userId: profile.user_id,
            folderId: profile.folder_id,
          }),
        });

        if (updateResponse.ok) {
          results.push({
            userId: profile.user_id,
            folderId: profile.folder_id,
            success: true,
          });
        } else {
          const errorData = await updateResponse.json();
          errors.push({
            userId: profile.user_id,
            folderId: profile.folder_id,
            error: errorData.message || 'Update failed',
          });
        }
      } catch (error) {
        errors.push({
          userId: profile.user_id,
          folderId: profile.folder_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 5. 返回结果
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          total: profiles.length,
          updated: results.length,
          failed: errors.length,
          results,
          errors,
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
