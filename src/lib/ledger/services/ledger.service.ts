import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { FinancialLedgerGenerator } from "./generators/financial-ledger.generator";
import type { LedgerGenerator } from "./ledger.interface";
import type { LedgerResult, LedgerType } from "../types/ledger.types";

export class LedgerService {
  private generators: Map<LedgerType, LedgerGenerator>;

  constructor() {
    this.generators = new Map();
    this.registerGenerator(new FinancialLedgerGenerator());
  }

  private registerGenerator(generator: LedgerGenerator) {
    this.generators.set(generator.getType(), generator);
  }

  /**
   * Generate a ledger of a specific type
   */
  async generate(
    userId: string,
    type: LedgerType,
    startDate: Date,
    endDate: Date,
  ): Promise<LedgerResult> {
    const generator = this.generators.get(type);
    if (!generator) {
      logger.error({ type }, "No generator found for ledger type");
      throw new Error(`No generator found for ledger type: ${type}`);
    }

    try {
      return await generator.generate(userId, startDate, endDate);
    } catch (error) {
      logger.error({ error, userId, type }, "Failed to generate ledger");
      throw error;
    }
  }

  /**
   * Generate a weekly report for a user (wrapper for backward compatibility)
   * Period: Last Monday 00:00:00 to Last Sunday 23:59:59
   * Defaults to 'financial' type if not specified, matching old behavior
   */
  async generateWeeklyReport(
    userId: string,
    type: LedgerType = "financial",
  ): Promise<LedgerResult> {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysSinceMonday - 7);
    lastMonday.setHours(0, 0, 0, 0);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    return this.generate(userId, type, lastMonday, lastSunday);
  }

  /**
   * Generate a monthly report for a user (wrapper for backward compatibility)
   * Period: 1st day of last month to last day of last month
   */
  async generateMonthlyReport(
    userId: string,
    type: LedgerType = "financial",
  ): Promise<LedgerResult> {
    const now = new Date();
    const currentMonthFirstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    const lastMonthEnd = new Date(currentMonthFirstDay);
    lastMonthEnd.setDate(0);
    lastMonthEnd.setHours(23, 59, 59, 999);

    const lastMonthStart = new Date(
      lastMonthEnd.getFullYear(),
      lastMonthEnd.getMonth(),
      1,
    );
    lastMonthStart.setHours(0, 0, 0, 0);

    return this.generate(userId, type, lastMonthStart, lastMonthEnd);
  }

  /**
   * Mark email as sent
   */
  async markEmailSent(ledgerId: number): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from("ledgers")
      .update({
        email_status: "sent",
        email_sent_at: new Date().toISOString(),
      })
      .eq("id", ledgerId);

    if (error) {
      logger.error({ error, ledgerId }, "Failed to mark email as sent");
      throw error;
    }
  }
}

export const ledgerService = new LedgerService();
