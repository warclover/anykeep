/**
 * 智能分类 v5.0 - 命名建议列表
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckIcon, XIcon } from 'lucide-react';
import type { NamingSuggestion } from '@/lib/classification/v5/gardener/types';

interface NamingSuggestionListProps {
  /** 命名建议列表 */
  suggestions: NamingSuggestion[];
  /** 应用建议回调 */
  onApply?: (folderId: string, newName: string) => void;
  /** 忽略建议回调 */
  onIgnore?: (folderId: string) => void;
}

export function NamingSuggestionList({
  suggestions,
  onApply,
  onIgnore,
}: NamingSuggestionListProps) {
  if (suggestions.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="py-8 text-center text-muted-foreground">
          <CheckIcon className="h-12 w-12 mx-auto mb-2 text-green-600" />
          <p>所有文件夹命名规范</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>命名建议</span>
          <Badge variant="secondary">{suggestions.length} 个建议</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.folderId}
            className="p-3 border rounded-lg space-y-3"
          >
            {/* 名称对比 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">当前名称:</span>
                <span className="text-sm line-through">
                  {suggestion.currentName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">建议名称:</span>
                <span className="font-medium text-green-600">
                  {suggestion.suggestedName}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {Math.round(suggestion.confidence * 100)}%
                </Badge>
              </div>
            </div>

            {/* 原因说明 */}
            <div className="p-2 bg-muted rounded text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium">原因: </span>
                {suggestion.reason}
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              {onApply && (
                <Button
                  onClick={() =>
                    onApply(suggestion.folderId, suggestion.suggestedName)
                  }
                  size="sm"
                  className="flex-1"
                >
                  <CheckIcon className="h-4 w-4 mr-2" />
                  应用建议
                </Button>
              )}
              {onIgnore && (
                <Button
                  onClick={() => onIgnore(suggestion.folderId)}
                  size="sm"
                  variant="ghost"
                >
                  <XIcon className="h-4 w-4 mr-2" />
                  忽略
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
