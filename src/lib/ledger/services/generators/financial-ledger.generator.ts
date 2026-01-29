import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { LedgerGenerator } from "../ledger.interface";
import type {
  LedgerResult,
  LedgerItem,
  LedgerType,
} from "../../types/ledger.types";

export class FinancialLedgerGenerator implements LedgerGenerator {
  getType(): LedgerType {
    return "financial";
  }

  async generate(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<LedgerResult> {
    const supabase = await createClient();

    // 1. Check if report already exists
    const { data: existing } = await supabase
      .from("ledgers")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "financial")
      .eq("period_start", startDate.toISOString())
      .maybeSingle();

    if (existing) {
      logger.info(
        { userId, type: "financial", periodStart: startDate.toISOString() },
        "Financial ledger already exists, skipping",
      );
      return null;
    }

    // 2. Fetch bookmarks
    const { data: bookmarks, error } = await supabase
      .from("bookmarks")
      .select("id, created_at, title, url, platform")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!bookmarks || bookmarks.length === 0) {
      return null;
    }

    // 3. Format items (Optimized: Keep original timestamp for data integrity)
    const items: LedgerItem[] = bookmarks.map((b) => ({
      id: b.id,
      // Store formatted time for display only, or rely on client formatting
      time: this.formatTime(b.created_at),
      // Keep original timestamp for accurate recording
      originalTime: b.created_at,
      platform: b.platform || "Unknown",
      title: b.title || "Untitled",
      url: b.url || "",
      type: "bookmark",
    }));

    // 4. Save report
    const durationDays =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const reportType = durationDays > 8 ? "monthly" : "weekly";

    const { data: report, error: saveError } = await supabase
      .from("ledgers")
      .insert({
        user_id: userId,
        type: "financial",
        report_type: reportType,
        period_start: startDate.toISOString(),
        period_end: endDate.toISOString(),
        item_count: items.length,
      })
      .select()
      .single();

    if (saveError) throw saveError;

    // 5. Insert entries with rollback mechanism
    if (items.length > 0 && report) {
      try {
        const entriesToInsert = items.map((item) => ({
          ledger_id: report.id,
          entry_type: "financial",
          bookmark_id: item.id,
          title: item.title,
          platform: item.platform,
          url: item.url,
          // Use original ISO string directly, avoiding round-trip conversion errors
          occurred_at: item.originalTime || new Date().toISOString(),
          metadata: item.metadata || {},
        }));

        const { error: entriesError } = await supabase
          .from("ledger_entries")
          .insert(entriesToInsert);

        if (entriesError) {
          throw entriesError;
        }
      } catch (error) {
        // Rollback: Delete the report if entries failed to save
        logger.error(
          { error, reportId: report.id },
          "Failed to insert ledger entries, rolling back ledger creation",
        );

        await supabase.from("ledgers").delete().eq("id", report.id);

        throw error; // Re-throw to inform caller
      }
    }

    return {
      id: report.id,
      userId: report.user_id,
      reportType: report.report_type,
      type: "financial",
      periodStart: report.period_start,
      periodEnd: report.period_end,
      itemCount: report.item_count,
      content: items,
      createdAt: report.created_at,
      emailStatus: report.email_status,
    };
  }

  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }
}
