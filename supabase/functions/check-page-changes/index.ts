/**
 * Edge Function: check-page-changes
 *
 * 定期检查监控的页面是否有内容变更
 *
 * 触发方式：
 * 1. pg_cron 定时任务（每小时执行）
 * 2. 手动触发（POST /functions/v1/check-page-changes）
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import * as Diff from "npm:diff@5.2.0";

// ========== CORS 配置 ==========

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ========== 类型定义 ==========

interface PendingMonitor {
  id: number;
  userId: string;
  bookmarkId: number;
  bookmarkUrl: string;
  bookmarkTitle: string;
  checkInterval: string;
  customIntervalHours: number | null;
  baselineSnapshotId: number | null;
  baselineContentHash: string | null;
  consecutiveFailures: number;
  notificationEnabled: boolean;
}

interface CheckResult {
  monitorId: number;
  result: "no_change" | "changed" | "error" | "timeout";
  similarityScore: number | null;
  changeSummary: string | null;
  newSnapshotId: number | null;
  newContentHash: string | null;
  errorMessage: string | null;
  responseTimeMs: number;
}

interface CheckStats {
  totalChecked: number;
  noChangeCount: number;
  changedCount: number;
  errorCount: number;
  timeoutCount: number;
  durationMs: number;
  usersAffected: number;
}

// ========== 常量配置 ==========

const CONFIG = {
  MAX_CONCURRENCY: 10,
  TIMEOUT_MS: 30000,
  RETRY_DELAY_HOURS: 1,
  MAX_CONSECUTIVE_FAILURES: 3,
  CHECK_INTERVAL_HOURS: {
    every_6h: 6,
    twice_daily: 12,
    daily: 24,
    weekly: 168,
    custom: 24,
  } as Record<string, number>,
};

// ========== 工具函数 ==========

/**
 * 计算 SHA-256 哈希
 */
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 统计字数
 */
function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  const chineseChars = cleaned.match(/[\u4e00-\u9fff]/g) || [];
  const englishWords =
    cleaned
      .replace(/[\u4e00-\u9fff]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 0) || [];
  return chineseChars.length + englishWords.length;
}

/**
 * 提取可读文本
 */
function extractReadableText(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/**
 * 抓取页面内容
 */
async function fetchPageContent(url: string): Promise<{
  success: boolean;
  content: string | null;
  contentHash: string | null;
  wordCount: number | null;
  errorMessage: string | null;
  responseTimeMs: number;
}> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AnyKeep/1.0; +https://anykeep.app)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        content: null,
        contentHash: null,
        wordCount: null,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        responseTimeMs,
      };
    }

    const html = await response.text();
    const readableText = extractReadableText(html);
    const contentHash = await hashContent(readableText);
    const wordCount = countWords(readableText);

    return {
      success: true,
      content: readableText,
      contentHash,
      wordCount,
      errorMessage: null,
      responseTimeMs,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        content: null,
        contentHash: null,
        wordCount: null,
        errorMessage: "请求超时",
        responseTimeMs,
      };
    }
    return {
      success: false,
      content: null,
      contentHash: null,
      wordCount: null,
      errorMessage: error instanceof Error ? error.message : "网络错误",
      responseTimeMs,
    };
  }
}

/**
 * 对比内容
 */
function compareContent(
  oldContent: string,
  newContent: string,
): {
  hasChanged: boolean;
  similarityScore: number;
  changeSummary: string;
} {
  const diffResult = Diff.diffLines(oldContent || "", newContent || "");

  let addedLines = 0;
  let removedLines = 0;
  let unchangedLines = 0;

  for (const part of diffResult) {
    const lines = part.value
      .split("\n")
      .filter((line: string) => line.length > 0);
    const lineCount = lines.length;

    if (part.added) {
      addedLines += lineCount;
    } else if (part.removed) {
      removedLines += lineCount;
    } else {
      unchangedLines += lineCount;
    }
  }

  const totalLines = addedLines + removedLines + unchangedLines;
  const similarityScore =
    totalLines === 0 ? 100 : Math.round((unchangedLines / totalLines) * 100);

  const hasChanged = addedLines > 0 || removedLines > 0;

  let changeSummary = "内容无变化";
  if (hasChanged) {
    const parts = [];
    if (addedLines > 0) parts.push(`新增 ${addedLines} 行`);
    if (removedLines > 0) parts.push(`删除 ${removedLines} 行`);
    const level =
      similarityScore >= 95
        ? "微小变更"
        : similarityScore >= 80
          ? "轻微变更"
          : similarityScore >= 50
            ? "显著变更"
            : "重大变更";
    changeSummary = `${level}：${parts.join("，")}，相似度 ${similarityScore}%`;
  }

  return { hasChanged, similarityScore, changeSummary };
}

// ========== 主函数 ==========

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // 1. 创建 Supabase 客户端
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    console.log("[check-page-changes] Starting check task...");

    // 2. 获取待检查的监控
    const now = new Date().toISOString();
    const { data: monitors, error: fetchError } = await supabaseClient
      .from("page_monitors")
      .select(
        `
        id,
        user_id,
        bookmark_id,
        check_interval,
        custom_interval_hours,
        baseline_snapshot_id,
        baseline_content_hash,
        consecutive_failures,
        notification_enabled,
        bookmarks!inner (
          id,
          url,
          title
        )
      `,
      )
      .eq("status", "active")
      .or(`next_check_at.is.null,next_check_at.lte.${now}`)
      .order("next_check_at", { ascending: true, nullsFirst: true })
      .limit(100);

    if (fetchError) {
      throw new Error(`获取待检查监控失败: ${fetchError.message}`);
    }

    if (!monitors || monitors.length === 0) {
      console.log("[check-page-changes] No monitors to check");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No monitors to check",
          stats: {
            totalChecked: 0,
            noChangeCount: 0,
            changedCount: 0,
            errorCount: 0,
            timeoutCount: 0,
            durationMs: Date.now() - startTime,
            usersAffected: 0,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    console.log(`[check-page-changes] Found ${monitors.length} monitors`);

    // 3. 转换数据格式
    const pendingMonitors: PendingMonitor[] = monitors.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      bookmarkId: row.bookmark_id,
      bookmarkUrl: row.bookmarks.url,
      bookmarkTitle: row.bookmarks.title,
      checkInterval: row.check_interval,
      customIntervalHours: row.custom_interval_hours,
      baselineSnapshotId: row.baseline_snapshot_id,
      baselineContentHash: row.baseline_content_hash,
      consecutiveFailures: row.consecutive_failures,
      notificationEnabled: row.notification_enabled,
    }));

    // 4. 执行检查
    const stats: CheckStats = {
      totalChecked: 0,
      noChangeCount: 0,
      changedCount: 0,
      errorCount: 0,
      timeoutCount: 0,
      durationMs: 0,
      usersAffected: 0,
    };

    const affectedUsers = new Set<string>();

    // 分批并发执行
    for (let i = 0; i < pendingMonitors.length; i += CONFIG.MAX_CONCURRENCY) {
      const batch = pendingMonitors.slice(i, i + CONFIG.MAX_CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async (monitor) => {
          // 抓取页面
          const fetchResult = await fetchPageContent(monitor.bookmarkUrl);

          let result: CheckResult;

          if (!fetchResult.success) {
            result = {
              monitorId: monitor.id,
              result: fetchResult.errorMessage?.includes("超时")
                ? "timeout"
                : "error",
              similarityScore: null,
              changeSummary: null,
              newSnapshotId: null,
              newContentHash: null,
              errorMessage: fetchResult.errorMessage,
              responseTimeMs: fetchResult.responseTimeMs,
            };
          } else {
            // 检查是否有变化
            const hashChanged =
              !monitor.baselineContentHash ||
              monitor.baselineContentHash !== fetchResult.contentHash;

            if (hashChanged && fetchResult.content) {
              // 获取基线内容
              let baselineContent: string | null = null;
              if (monitor.baselineSnapshotId) {
                const { data: baseline } = await supabaseClient
                  .from("bookmark_snapshots")
                  .select("readable_text_content")
                  .eq("id", monitor.baselineSnapshotId)
                  .single();
                baselineContent = baseline?.readable_text_content || null;
              }

              const comparison = baselineContent
                ? compareContent(baselineContent, fetchResult.content)
                : {
                    hasChanged: true,
                    similarityScore: 0,
                    changeSummary: "首次检查，已建立基线",
                  };

              // 创建新快照
              let newSnapshotId: number | null = null;
              if (comparison.hasChanged) {
                const { data: snapshot } = await supabaseClient
                  .from("bookmark_snapshots")
                  .insert({
                    bookmark_id: monitor.bookmarkId,
                    readable_text_content: fetchResult.content,
                    content_hash: fetchResult.contentHash,
                    word_count: fetchResult.wordCount,
                    captured_at: new Date().toISOString(),
                  })
                  .select("id")
                  .single();
                newSnapshotId = snapshot?.id || null;
              }

              result = {
                monitorId: monitor.id,
                result: comparison.hasChanged ? "changed" : "no_change",
                similarityScore: comparison.similarityScore,
                changeSummary: comparison.changeSummary,
                newSnapshotId,
                newContentHash: fetchResult.contentHash,
                errorMessage: null,
                responseTimeMs: fetchResult.responseTimeMs,
              };
            } else {
              result = {
                monitorId: monitor.id,
                result: "no_change",
                similarityScore: 100,
                changeSummary: "内容无变化",
                newSnapshotId: null,
                newContentHash: fetchResult.contentHash,
                errorMessage: null,
                responseTimeMs: fetchResult.responseTimeMs,
              };
            }
          }

          // 更新监控状态
          const nowTime = new Date();
          const isError =
            result.result === "error" || result.result === "timeout";
          const intervalHours =
            monitor.customIntervalHours ||
            CONFIG.CHECK_INTERVAL_HOURS[monitor.checkInterval] ||
            24;

          let nextCheckAt: Date;
          let newConsecutiveFailures: number;
          let newStatus = "active";

          if (isError) {
            newConsecutiveFailures = monitor.consecutiveFailures + 1;
            if (newConsecutiveFailures >= CONFIG.MAX_CONSECUTIVE_FAILURES) {
              newStatus = "failed";
              nextCheckAt = new Date(
                nowTime.getTime() + 365 * 24 * 60 * 60 * 1000,
              );
            } else {
              nextCheckAt = new Date(
                nowTime.getTime() + CONFIG.RETRY_DELAY_HOURS * 60 * 60 * 1000,
              );
            }
          } else {
            newConsecutiveFailures = 0;
            nextCheckAt = new Date(
              nowTime.getTime() + intervalHours * 60 * 60 * 1000,
            );
          }

          const updateData: any = {
            last_checked_at: nowTime.toISOString(),
            next_check_at: nextCheckAt.toISOString(),
            consecutive_failures: newConsecutiveFailures,
            last_error_message: result.errorMessage,
            status: newStatus,
            updated_at: nowTime.toISOString(),
          };

          if (result.result === "changed" && result.newSnapshotId) {
            updateData.baseline_snapshot_id = result.newSnapshotId;
            updateData.baseline_content_hash = result.newContentHash;
          }

          await supabaseClient
            .from("page_monitors")
            .update(updateData)
            .eq("id", monitor.id);

          // 递增变更计数
          if (result.result === "changed") {
            await supabaseClient.rpc("increment_monitor_change_count", {
              monitor_id: monitor.id,
            });
          }

          // 记录检查日志
          // 将 error/timeout 映射到数据库支持的 failed 类型
          const dbCheckResult =
            result.result === "error" || result.result === "timeout"
              ? "failed"
              : result.result;

          await supabaseClient.from("monitor_check_logs").insert({
            monitor_id: monitor.id,
            user_id: monitor.userId,
            check_result: dbCheckResult,
            checked_at: new Date().toISOString(),
            similarity_score: result.similarityScore,
            change_summary: result.changeSummary,
            new_snapshot_id: result.newSnapshotId,
            error_message: result.errorMessage,
            duration_ms: result.responseTimeMs,
          });

          // 发送通知
          if (
            result.result === "changed" &&
            monitor.notificationEnabled &&
            result.similarityScore !== null &&
            result.similarityScore < 80
          ) {
            await supabaseClient.from("messages").insert({
              user_id: monitor.userId,
              type: "page_change",
              title: `📄 ${monitor.bookmarkTitle} 内容已更新`,
              content: result.changeSummary,
              metadata: {
                monitorId: monitor.id,
                bookmarkId: monitor.bookmarkId,
                bookmarkUrl: monitor.bookmarkUrl,
                similarityScore: result.similarityScore,
              },
              is_read: false,
              created_at: new Date().toISOString(),
            });
          }

          return { monitor, result };
        }),
      );

      // 统计结果
      for (const promiseResult of results) {
        if (promiseResult.status === "fulfilled") {
          const { monitor, result } = promiseResult.value;
          stats.totalChecked++;
          affectedUsers.add(monitor.userId);

          switch (result.result) {
            case "no_change":
              stats.noChangeCount++;
              break;
            case "changed":
              stats.changedCount++;
              break;
            case "error":
              stats.errorCount++;
              break;
            case "timeout":
              stats.timeoutCount++;
              break;
          }
        } else {
          stats.errorCount++;
          console.error(
            "[check-page-changes] Check failed:",
            promiseResult.reason,
          );
        }
      }
    }

    stats.usersAffected = affectedUsers.size;
    stats.durationMs = Date.now() - startTime;

    console.log("[check-page-changes] Completed:", stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked ${stats.totalChecked} monitors`,
        stats,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("[check-page-changes] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs: Date.now() - startTime,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
