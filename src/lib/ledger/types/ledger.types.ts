export type LedgerType = "financial" | "knowledge";

export interface LedgerItem {
  time: string;
  platform: string;
  title: string;
  url: string;
  // Extended fields for knowledge ledger
  id?: string;
  type?: "bookmark" | "rediscover";
  metadata?: Record<string, unknown>;
  /** 原始时间戳（用于数据完整性） */
  originalTime?: string;
}

export interface LedgerReport {
  id: number;
  userId: string;
  reportType: "weekly" | "monthly";
  type?: LedgerType; // New field
  periodStart: string;
  periodEnd: string;
  itemCount: number;
  content: LedgerItem[];
  aiSummary?: string; // New field
  metadata?: Record<string, unknown>; // New field
  createdAt: string;
  emailStatus?: "none" | "pending" | "sent" | "failed"; // New field
}

export type LedgerResult = LedgerReport | null;

export interface LedgerReportInput {
  userId: string;
  reportType: "weekly" | "monthly";
  type: LedgerType;
  periodStart: Date;
  periodEnd: Date;
  content: LedgerItem[];
  aiSummary?: string;
  metadata?: Record<string, unknown>;
}
