export interface LedgerItem {
  time: string; // Formatted time string (e.g. "2024-01-27 10:30")
  platform: string;
  title: string;
  url: string;
}

export interface LedgerReport {
  id: number;
  userId: string;
  reportType: "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  itemCount: number;
  content: LedgerItem[];
  createdAt: string;
}

export interface LedgerReportInput {
  userId: string;
  reportType: "weekly" | "monthly";
  periodStart: Date;
  periodEnd: Date;
  content: LedgerItem[];
}
