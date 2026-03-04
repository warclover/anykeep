import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; isPositive: boolean };
  colorClass?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  colorClass = "text-purple-600",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {title}
            </p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
          <div
            className={cn(
              "p-3 rounded-full bg-gray-100 dark:bg-gray-800",
              colorClass,
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
        {trend && (
          <div
            className={cn(
              "mt-2 text-xs",
              trend.isPositive ? "text-green-600" : "text-red-600",
            )}
          >
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% 较上周
          </div>
        )}
      </CardContent>
    </Card>
  );
}
