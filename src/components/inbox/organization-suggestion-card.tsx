'use client'

/**
 * 整理建议卡片组件
 * 展示单个整理建议，支持应用/拒绝操作
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Check, X, ChevronDown, FolderPlus, FolderInput, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrganizationSuggestion } from '@/lib/classification'

interface OrganizationSuggestionCardProps {
  /** 建议数据 */
  suggestion: OrganizationSuggestion
  /** 可选的目标文件夹列表（用于修改目标） */
  availableFolders?: Array<{ id: number; name: string }>
  /** 应用建议回调 */
  onApply: (suggestionId: number, targetFolderId?: number) => Promise<void>
  /** 拒绝建议回调 */
  onReject: (suggestionId: number) => Promise<void>
  /** 是否正在处理 */
  isProcessing?: boolean
}

export function OrganizationSuggestionCard({
  suggestion,
  availableFolders = [],
  onApply,
  onReject,
  isProcessing = false,
}: OrganizationSuggestionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<number | undefined>(
    suggestion.targetFolderId ?? undefined
  )

  const isCreateNew = suggestion.suggestionType === 'create_new'
  const isMoveToExisting = suggestion.suggestionType === 'move_to_existing'

  // 处理应用
  const handleApply = async () => {
    await onApply(suggestion.id, selectedFolderId)
  }

  // 处理拒绝
  const handleReject = async () => {
    await onReject(suggestion.id)
  }

  // 获取图标
  const getIcon = () => {
    if (isCreateNew) return <FolderPlus className="h-5 w-5 text-green-500" />
    if (isMoveToExisting) return <FolderInput className="h-5 w-5 text-blue-500" />
    return <Lightbulb className="h-5 w-5 text-yellow-500" />
  }

  // 获取标题
  const getTitle = () => {
    if (isCreateNew) return `创建新文件夹「${suggestion.suggestedFolderName}」`
    if (isMoveToExisting) {
      const folder = availableFolders.find(f => f.id === suggestion.targetFolderId)
      return `移动到「${folder?.name || '未知文件夹'}」`
    }
    return '整理建议'
  }

  // 获取描述
  const getDescription = () => {
    const count = suggestion.bookmarkIds.length
    if (isCreateNew) {
      return `${count} 个书签内容相似，建议创建新文件夹归类`
    }
    if (isMoveToExisting) {
      return `${count} 个书签内容与目标文件夹相似`
    }
    return suggestion.reason || ''
  }

  return (
    <Card className={cn(
      'transition-all',
      isProcessing && 'opacity-50 pointer-events-none'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {getIcon()}
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">
                {getTitle()}
              </CardTitle>
              <CardDescription className="text-sm">
                {getDescription()}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={suggestion.confidence >= 70 ? 'default' : 'secondary'}
            className="shrink-0"
          >
            置信度: {suggestion.confidence}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 示例书签 */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 -ml-2">
              <ChevronDown className={cn(
                'h-4 w-4 transition-transform',
                expanded && 'rotate-180'
              )} />
              查看 {suggestion.sampleTitles.length} 个书签示例
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <ul className="space-y-1 pl-2 border-l-2 border-muted">
              {suggestion.sampleTitles.map((title, index) => (
                <li key={index} className="text-sm text-muted-foreground truncate pl-2">
                  📄 {title}
                </li>
              ))}
              {suggestion.bookmarkIds.length > suggestion.sampleTitles.length && (
                <li className="text-sm text-muted-foreground pl-2">
                  ...还有 {suggestion.bookmarkIds.length - suggestion.sampleTitles.length} 个
                </li>
              )}
            </ul>
          </CollapsibleContent>
        </Collapsible>

        {/* 目标选择器（仅移动到现有文件夹时显示） */}
        {isMoveToExisting && availableFolders.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">修改目标：</span>
            <Select
              value={selectedFolderId?.toString()}
              onValueChange={v => setSelectedFolderId(Number(v))}
            >
              <SelectTrigger className="w-[200px] h-8">
                <SelectValue placeholder="选择文件夹" />
              </SelectTrigger>
              <SelectContent>
                {availableFolders.map(folder => (
                  <SelectItem key={folder.id} value={folder.id.toString()}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReject}
            disabled={isProcessing}
            className="gap-1"
          >
            <X className="h-4 w-4" />
            忽略
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={isProcessing}
            className="gap-1"
          >
            <Check className="h-4 w-4" />
            {isCreateNew ? '创建并移动' : '确认移动'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default OrganizationSuggestionCard
