import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { LedgerGenerator } from "../ledger.interface";
import type {
  LedgerResult,
  LedgerItem,
  LedgerType,
} from "../../types/ledger.types";

interface BookmarkItem {
  id: string;
  created_at: string;
  title: string | null;
  url: string | null;
  platform: string | null;
  description: string | null;
  tags: string[] | null;
}

export class KnowledgeLedgerGenerator implements LedgerGenerator {
  getType(): LedgerType {
    return "knowledge";
  }

  async generate(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<LedgerResult> {
    const supabase = await createClient();

    // 1. Check existence
    const { data: existing } = await supabase
      .from("ledgers")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "knowledge")
      .eq("period_start", startDate.toISOString())
      .maybeSingle();

    if (existing) {
      logger.info(
        { userId, type: "knowledge", periodStart: startDate.toISOString() },
        "Knowledge ledger already exists, skipping",
      );
      return null;
    }

    // 2. Collect: Fetch bookmarks (Filter out bulk imports)
    // Assuming 'import_batch_id' exists on bookmarks
    const { data: bookmarksData, error } = await supabase
      .from("bookmarks")
      .select("id, created_at, title, url, platform, description, tags") // tags is array of strings usually
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .is("deleted_at", null)
      .is("import_batch_id", null) // Filter out bulk imports
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Type casting for better safety
    const bookmarks = (bookmarksData || []) as unknown as BookmarkItem[];

    if (!bookmarks || bookmarks.length === 0) {
      // If no new bookmarks, check if we should do a pure "Rediscover" issue
      // For now, let's return null to keep it simple, or implement Rediscover logic here
      return null;
    }

    // 3. Profile & Persona (Simple logic for now)
    // Count tags
    const tagCounts: Record<string, number> = {};
    bookmarks.forEach((b) => {
      const tags = Array.isArray(b.tags) ? b.tags : [];
      tags.forEach((t: string) => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });
    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    const topTags = sortedTags.slice(0, 3).map((t) => t[0]);

    // Determine Persona
    // This could be more sophisticated with LLM, but heuristic is fine for v1
    let persona = "knowledge_curator"; // default
    if (
      topTags.some((t) =>
        ["code", "dev", "programming", "linux"].includes(t.toLowerCase()),
      )
    ) {
      persona = "geek";
    } else if (
      topTags.some((t) =>
        ["design", "art", "ui", "ux"].includes(t.toLowerCase()),
      )
    ) {
      persona = "designer";
    } else if (
      topTags.some((t) => ["life", "food", "travel"].includes(t.toLowerCase()))
    ) {
      persona = "life_stylist";
    }

    // 4. Rediscover (Serendipity) - Find related old content
    let rediscoverItem: BookmarkItem | null = null;
    if (bookmarks.length > 0) {
      // Pick top 1 bookmark
      const heroBookmark = bookmarks[0];
      // Search for related old content (> 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Use RPC for vector search if available, or just simple random for MVP
      // Assuming 'find_related_bookmarks' RPC exists from migration `20251209200002_add_find_related_bookmarks_rpc.sql`
      const { data: related } = await supabase.rpc("find_related_bookmarks", {
        p_bookmark_id: parseInt(heroBookmark.id, 10),
        p_user_id: userId,
        p_min_similarity: 0.7,
        p_limit: 1,
      });

      if (related && related.length > 0) {
        // Check if it's old enough
        const relatedItem = related[0] as unknown as BookmarkItem; // Cast RPC result
        if (new Date(relatedItem.created_at) < ninetyDaysAgo) {
          rediscoverItem = relatedItem;
        }
      }
    }

    // 5. Generate AI Summary (Librarian Comment)
    // We'll skip actual LLM call implementation here to avoid complexity in this file
    // and just use a placeholder or assume a separate service call.
    // In production, we'd call `unifiedEngine.execute(...)` or similar.
    const aiSummary = await this.generateLibrarianComment(bookmarks, persona);

    // 6. Format Items
    const items: LedgerItem[] = bookmarks.map((b) => ({
      id: b.id,
      time: this.formatTime(b.created_at),
      platform: b.platform || "Unknown",
      title: b.title || "Untitled",
      url: b.url || "",
      type: "bookmark",
      metadata: {
        tags: b.tags,
      },
    }));

    if (rediscoverItem) {
      items.push({
        id: rediscoverItem.id,
        time: this.formatTime(rediscoverItem.created_at),
        platform: rediscoverItem.platform || "Unknown",
        title: rediscoverItem.title || "Untitled",
        url: rediscoverItem.url || "",
        type: "rediscover",
        metadata: {
          related_to: bookmarks[0].id,
          reason: "Similar topic from the past",
        },
      });
    }

    // 7. Save Report
    const durationDays =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const reportType = durationDays > 8 ? "monthly" : "weekly";

    const { data: report, error: saveError } = await supabase
      .from("ledgers")
      .insert({
        user_id: userId,
        type: "knowledge",
        report_type: reportType,
        period_start: startDate.toISOString(),
        period_end: endDate.toISOString(),
        item_count: items.length,
        ai_summary: aiSummary,
        email_status: "pending", // Important: ready to send
        metadata: {
          persona,
          top_tags: topTags,
          rediscover_id: rediscoverItem?.id,
        },
      })
      .select()
      .single();

    if (saveError) throw saveError;

    // Insert Entries
    const entriesToInsert = items.map((item) => ({
      ledger_id: report.id,
      entry_type: item.type === "rediscover" ? "rediscover" : "bookmark",
      bookmark_id: item.id ? parseInt(item.id, 10) : null,
      title: item.title,
      platform: item.platform,
      url: item.url,
      occurred_at: new Date(item.time).toISOString(), // approximation
      metadata: item.metadata || {},
    }));

    const { error: entriesError } = await supabase
      .from("ledger_entries")
      .insert(
        entriesToInsert as Parameters<
          typeof supabase.from<"ledger_entries">
        >["0"] extends infer T
          ? T[]
          : never,
      );

    if (entriesError) {
      logger.error(
        { error: entriesError },
        "Failed to insert knowledge ledger entries",
      );
    }

    return {
      id: report.id,
      userId: report.user_id,
      reportType: report.report_type as "weekly" | "monthly",
      type: "knowledge",
      periodStart: report.period_start ?? "",
      periodEnd: report.period_end ?? "",
      itemCount: report.item_count ?? 0,
      content: items,
      aiSummary: report.ai_summary ?? undefined,
      metadata: report.metadata as Record<string, unknown>,
      createdAt: report.created_at ?? "",
      emailStatus:
        (report.email_status as "none" | "pending" | "sent" | "failed") ??
        undefined,
    };
  }

  private async generateLibrarianComment(
    bookmarks: BookmarkItem[],
    persona: string,
  ): Promise<string> {
    // Mock implementation for MVP
    // In real implementation, this would call LLM with prompt
    const count = bookmarks.length;
    const titles = bookmarks
      .slice(0, 3)
      .map((b) => b.title)
      .join("、");

    const greetings: Record<string, string> = {
      geek: "嘿，代码猎人！",
      designer: "你好，视觉捕手！",
      life_stylist: "Hey，生活家！",
      knowledge_curator: "���好，知识探索者！",
    };

    return `${greetings[persona] || "你好！"} 本周你收藏了 ${count} 篇内容，重点关注了 ${titles} 等话题。继续保持好奇心！`;
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
