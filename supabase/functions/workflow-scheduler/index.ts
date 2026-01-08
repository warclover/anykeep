/**
 * 工作流定时调度 Edge Function
 *
 * 由 pg_cron 或外部调度器定期调用，处理待执行的定时工作流
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScheduledTask {
  id: string;
  workflow_id: string;
  user_id: string;
}

interface ProcessResult {
  id: string;
  success: boolean;
  error?: string;
  executionId?: string;
}

serve(async (req) => {
  // CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 获取待执行的定时任务
    const { data: pendingTasks, error: fetchError } = await supabase
      .from("scheduled_workflow_executions")
      .select("id, workflow_id, user_id")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(20);

    if (fetchError) {
      throw fetchError;
    }

    const results: ProcessResult[] = [];

    for (const task of (pendingTasks || []) as ScheduledTask[]) {
      try {
        // 更新状态为 running
        await supabase
          .from("scheduled_workflow_executions")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", task.id)
          .eq("status", "pending"); // 防止并发重复执行

        // 调用工作流启动 API
        const workflowStartUrl = `${supabaseUrl}/functions/v1/workflow-start`;
        const response = await fetch(workflowStartUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            workflowId: task.workflow_id,
            userId: task.user_id,
            triggerType: "scheduled",
            triggerContext: {
              scheduledExecutionId: task.id,
            },
          }),
        });

        if (response.ok) {
          const result = await response.json();

          // 更新执行状态为完成
          await supabase
            .from("scheduled_workflow_executions")
            .update({
              status: "completed",
              execution_id: result.executionId,
              completed_at: new Date().toISOString(),
            })
            .eq("id", task.id);

          results.push({
            id: task.id,
            success: true,
            executionId: result.executionId,
          });
        } else {
          const errorText = await response.text();

          // 更新状态为失败
          await supabase
            .from("scheduled_workflow_executions")
            .update({
              status: "failed",
              error: errorText,
              completed_at: new Date().toISOString(),
            })
            .eq("id", task.id);

          results.push({
            id: task.id,
            success: false,
            error: errorText,
          });
        }
      } catch (taskError) {
        const errorMessage =
          taskError instanceof Error ? taskError.message : String(taskError);

        await supabase
          .from("scheduled_workflow_executions")
          .update({
            status: "failed",
            error: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq("id", task.id);

        results.push({
          id: task.id,
          success: false,
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
