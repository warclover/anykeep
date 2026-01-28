import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { LedgerItem, LedgerReport } from "../types/ledger.types";

export class LedgerService {
  private supabaseAdmin;

  constructor() {
    this.supabaseAdmin = createClient(
      supabaseEnv.url,
      supabaseEnv.serviceRoleKey,
    );
  }

  /**
   * Generate a weekly report for a user
   * Period: Last Monday 00:00:00 to Last Sunday 23:59:59
   */
  async generateWeeklyReport(userId: string): Promise<LedgerReport | null> {
    const now = new Date();
    // Calculate last week's Monday and Sunday
    // current day: 0 (Sun) - 6 (Sat)
    // If today is Monday (1), we want previous Monday (-7 days)
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Last Monday = Today - daysSinceMonday - 7
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysSinceMonday - 7);
    lastMonday.setHours(0, 0, 0, 0);

    // Last Sunday = Last Monday + 6
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    return this.generateReport(userId, "weekly", lastMonday, lastSunday);
  }

  /**
   * Generate a monthly report for a user
   * Period: 1st day of last month to last day of last month
   */
  async generateMonthlyReport(userId: string): Promise<LedgerReport | null> {
    const now = new Date();
    // 1st day of current month
    const currentMonthFirstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    // Last day of previous month = 0th day of current month
    const lastMonthEnd = new Date(currentMonthFirstDay);
    lastMonthEnd.setDate(0);
    lastMonthEnd.setHours(23, 59, 59, 999);

    // 1st day of previous month
    const lastMonthStart = new Date(
      lastMonthEnd.getFullYear(),
      lastMonthEnd.getMonth(),
      1,
    );
    lastMonthStart.setHours(0, 0, 0, 0);

    return this.generateReport(userId, "monthly", lastMonthStart, lastMonthEnd);
  }

  /**
   * Core logic to generate and save report
   */
  private async generateReport(
    userId: string,
    type: "weekly" | "monthly",
    startDate: Date,
    endDate: Date,
  ): Promise<LedgerReport | null> {
    try {
      // 1. Check if report already exists
      const { data: existing } = await this.supabaseAdmin
        .from("ledger_reports")
        .select("id")
        .eq("user_id", userId)
        .eq("report_type", type)
        .eq("period_start", startDate.toISOString())
        .single();

      if (existing) {
        logger.info(
          { userId, type, periodStart: startDate.toISOString() },
          "Ledger report already exists, skipping",
        );
        return null;
      }

      // 2. Fetch bookmarks
      const { data: bookmarks, error } = await this.supabaseAdmin
        .from("bookmarks")
        .select("created_at, title, url, platform")
        .eq("user_id", userId)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      if (!bookmarks || bookmarks.length === 0) {
        logger.info(
          { userId, type },
          "No bookmarks found for period, skipping ledger generation",
        );
        return null;
      }

      // 3. Format items
      const items: LedgerItem[] = bookmarks.map((b) => ({
        time: this.formatTime(b.created_at),
        platform: b.platform || "Unknown",
        title: b.title || "Untitled",
        url: b.url || "",
      }));

      // 4. Save report
      const { data: report, error: saveError } = await this.supabaseAdmin
        .from("ledger_reports")
        .insert({
          user_id: userId,
          report_type: type,
          period_start: startDate.toISOString(),
          period_end: endDate.toISOString(),
          item_count: items.length,
          content: items, // Supabase handles JSONB conversion
        })
        .select()
        .single();

      if (saveError) {
        throw saveError;
      }

      logger.info(
        { userId, type, count: items.length },
        "Ledger report generated successfully",
      );

      // 5. Send notification (Station Letter)
      try {
        await this.sendNotification(
          userId,
          report.id,
          type,
          startDate,
          items.length,
        );
      } catch (notifyError) {
        logger.error(
          { error: notifyError, userId },
          "Failed to send ledger notification",
        );
        // Don't fail the whole operation if notification fails
      }

      return {
        id: report.id,
        userId: report.user_id,
        reportType: report.report_type,
        periodStart: report.period_start,
        periodEnd: report.period_end,
        itemCount: report.item_count,
        content: report.content as unknown as LedgerItem[],
        createdAt: report.created_at,
      };
    } catch (err) {
      logger.error(
        { error: err, userId, type },
        "Failed to generate ledger report",
      );
      throw err;
    }
  }

  /**
   * Send a system message notification for the generated report
   */
  private async sendNotification(
    userId: string,
    reportId: number,
    type: "weekly" | "monthly",
    periodStart: Date,
    count: number,
  ) {
    const { MessageService } = await import("@/lib/messages/message-service");

    const periodStr =
      type === "weekly"
        ? `上周 (${this.formatDateSimple(periodStart)})`
        : `上月 (${periodStart.getFullYear()}年${periodStart.getMonth() + 1}月)`;

    const title = `${type === "weekly" ? "周度" : "月度"}收藏账单已生成`;
    const content = `您在${periodStr}共收藏了 ${count} 条内容，点击查看详情。`;

    // We'll use "system_announcement" or a custom type if we add one later.
    // Ideally we should add a new type like "ledger_report" to MessageType,
    // but for now reusing system_announcement or similar is safest without modifying global types extensively yet.
    // Let's use a generic system message style.

    await MessageService.create({
      userId,
      type: "system_announcement", // Using general type for now, or could define new one
      data: {
        title,
        content,
        url: `/settings/ledger/${reportId}`,
      },
    });
  }

  private formatDateSimple(date: Date): string {
    return `${date.getMonth() + 1}.${date.getDate()}`;
  }

  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    // Format: YYYY-MM-DD HH:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }
}

export const ledgerService = new LedgerService();
