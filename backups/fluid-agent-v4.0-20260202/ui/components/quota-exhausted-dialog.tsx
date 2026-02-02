'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useBattery } from '../hooks/use-battery';

interface QuotaExhaustedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade?: () => void;
}

export function QuotaExhaustedDialog({
  open,
  onOpenChange,
  onUpgrade,
}: QuotaExhaustedDialogProps) {
  const { resetAt } = useBattery();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span>⚡</span>
            今日智能推荐次数已用完
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              免费用户每日可使用 5 次智能推荐功能。
            </p>
            <p className="text-muted-foreground">
              {formatResetTime(resetAt)} 后将自动重置配额。
            </p>
            <div className="bg-muted/50 rounded-lg p-3 mt-4">
              <p className="font-medium text-foreground">升级 Pro 版</p>
              <p className="text-sm text-muted-foreground mt-1">
                无限次智能推荐、优先处理、更多高级功能
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>稍后再说</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={onUpgrade} className="bg-gradient-to-r from-purple-500 to-blue-500">
              升级 Pro
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function formatResetTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}
