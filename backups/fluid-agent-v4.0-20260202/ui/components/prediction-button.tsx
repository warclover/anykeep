'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { PredictionResult } from '../../types';

interface PredictionButtonProps {
  prediction: PredictionResult;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function PredictionButton({
  prediction,
  onClick,
  loading = false,
  disabled = false,
}: PredictionButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="gap-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border border-purple-200/50"
      onClick={onClick}
      disabled={loading || disabled}
    >
      <span className="text-base">{prediction.icon}</span>
      <span className="flex items-center gap-1">
        <span className="text-purple-600">✨</span>
        {prediction.label}
      </span>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    </Button>
  );
}
