'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { OperationContext } from '../../types';
import { operationExecutor } from '../../execution/operation-executor';

interface ExecutionStatusProps {
  operationId: string;
  onCancel?: () => void;
}

export function ExecutionStatus({ operationId, onCancel }: ExecutionStatusProps) {
  const [context, setContext] = useState<OperationContext | null>(null);

  useEffect(() => {
    // 获取初始状态
    setContext(operationExecutor.getStatus(operationId));

    // 订阅更新
    const unsubscribe = operationExecutor.subscribe(operationId, ctx => {
      setContext({ ...ctx });
    });

    return unsubscribe;
  }, [operationId]);

  if (!context) return null;

  const currentStep = context.steps.find(s => s.status === 'running');
  const completedCount = context.steps.filter(s => s.status === 'completed').length;
  const totalSteps = context.steps.length;
  const progress = currentStep?.progress;

  const handleCancel = () => {
    operationExecutor.cancel(operationId);
    onCancel?.();
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
      <Card className="flex items-center gap-4 px-4 py-3 shadow-lg bg-background/95 backdrop-blur">
        <span className="text-lg">✨</span>
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {currentStep?.name || '处理中'}...
            {progress !== undefined && ` ${progress}%`}
          </span>
          <span className="text-xs text-muted-foreground">
            步骤 {completedCount + 1}/{totalSteps}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={handleCancel}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">取消</span>
        </Button>
      </Card>
    </div>
  );
}
