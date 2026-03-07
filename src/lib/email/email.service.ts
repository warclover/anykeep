import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { WeeklyDigestEmail } from "./templates/weekly-digest";
import { render } from "@react-email/components";
import type { LedgerResult } from "../ledger/types/ledger.types";

// 延迟初始化：避免模块加载时因缺少 API key 导致构建失败
let resendInstance: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

export class EmailService {
  /**
   * 发送周报
   */
  async sendWeeklyDigest(
    to: string,
    digest: NonNullable<LedgerResult>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const resend = getResend();
      if (!resend) {
        logger.warn("Resend API key not configured, skipping email send");
        return { success: false, error: "Missing API Key" };
      }

      const emailHtml = await render(
        WeeklyDigestEmail({
          digest,
          username: to.split("@")[0], // Simple fallback
        }),
      );

      const { error } = await resend.emails.send({
        from: "AnyKeep <digest@anykeep.app>",
        to,
        subject: `AnyKeep 周报：${this.getSubjectTitle(digest)}`,
        html: emailHtml,
      });

      if (error) {
        throw error;
      }

      logger.info(
        { to, digestId: digest.id },
        "Weekly digest sent successfully",
      );
      return { success: true };
    } catch (error) {
      logger.error({ error, to }, "Failed to send weekly digest");
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private getSubjectTitle(digest: NonNullable<LedgerResult>): string {
    const persona = (digest.metadata?.persona as string) || "default";
    const titles: Record<string, string> = {
      geek: "本周的代码能量补给",
      designer: "本周的灵感碎片",
      life_stylist: "本周的生活美学",
      default: "本周的知识回顾",
    };
    return titles[persona] || titles.default;
  }
}

export const emailService = new EmailService();
