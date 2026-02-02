import type { PredictionRule } from "../../types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const timeRules: PredictionRule[] = [
  {
    id: "time_unread_7d",
    name: "生成摘要",
    icon: "📝",
    priority: 65,
    category: "time",
    enabled: true,
    condition: (selection) => {
      const now = Date.now();
      return selection.every((b) => {
        const created = new Date(b.created_at).getTime();
        return !b.is_read && now - created > SEVEN_DAYS_MS;
      });
    },
    action: "generate_summary",
  },
  {
    id: "time_this_week",
    name: "生成周报",
    icon: "📊",
    priority: 68,
    category: "time",
    enabled: true,
    condition: (selection) => {
      const weekStart = getWeekStart();
      return selection.every((b) => {
        const created = new Date(b.created_at);
        return created >= weekStart;
      });
    },
    action: "generate_weekly_report",
  },
  {
    id: "time_today",
    name: "今日回顾",
    icon: "📅",
    priority: 60,
    category: "time",
    enabled: true,
    condition: (selection) => {
      const todayStart = getTodayStart();
      return selection.every((b) => {
        const created = new Date(b.created_at);
        return created >= todayStart;
      });
    },
    action: "generate_daily_review",
  },
];

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getTodayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
