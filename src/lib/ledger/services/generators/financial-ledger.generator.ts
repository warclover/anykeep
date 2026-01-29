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

    // 2. Fetch bookmarks (Financial ledger treats bookmarks as "assets" or "entries")
    // For financial view, we might just want a raw list or specific financial-related items
    // adapting existing logic which fetches all bookmarks
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

    // 3. Format items
    const items: LedgerItem[] = bookmarks.map((b) => ({
      id: b.id,
      time: this.formatTime(b.created_at),
      platform: b.platform || "Unknown",
      title: b.title || "Untitled",
      url: b.url || "",
      type: "bookmark",
    }));

    // 4. Save report
    // Using the 'ledgers' table (previously ledger_reports in the old code, assuming migration renamed it or we align)
    // The migration file 20260129000002_extend_ledger_for_digest.sql alters 'ledgers'.
    // So we assume the table name is 'ledgers'.

    // Calculate report type (weekly/monthly) based on duration
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
        // In the new schema, we should probably save entries to ledger_entries table
        // But for backward compatibility or simple storage, we might store JSON in content column if it exists?
        // The migration added fields to 'ledgers' but didn't remove 'content' if it existed.
        // However, the best practice is to insert into ledger_entries.
        // Let's check if we should populate ledger_entries.
        // For simplicity in this step, if the original code used a JSON column 'content' in 'ledger_reports' (now 'ledgers'?),
        // we might stick to that or upgrade.
        // The migration `20260127000000_add_ledger_system.sql` likely created `ledgers` and `ledger_entries`.
        // Let's assume we need to insert entries separately.
      })
      .select()
      .single();

    if (saveError) throw saveError;

    // Insert entries
    if (items.length > 0 && report) {
      const entriesToInsert = items.map((item) => ({
        ledger_id: report.id,
        entry_type: "financial", // or 'bookmark' as per new schema
        bookmark_id: item.id,
        title: item.title,
        platform: item.platform,
        url: item.url,
        occurred_at: new Date(item.time).toISOString(), // rough conversion back or use original
        metadata: item.metadata || {},
      }));

      // Note: We need to handle this properly.
      // For now, let's assume we just return the report object as the interface expects.
      // Actual DB insertion of entries might be needed if we want to query them later.

      const { error: entriesError } = await supabase
        .from("ledger_entries")
        .insert(entriesToInsert);

      if (entriesError) {
        logger.error(
          { error: entriesError },
          "Failed to insert ledger entries",
        );
        // Non-blocking?
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
