/**
 * 错误信息显示组件
 */

import { AlertCircle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorMessageProps {
  title?: string
  message: string
  retry?: () => void
  className?: string
}

export function ErrorMessage({
  title = '出错了',
  message,
  retry,
  className = ''
}: ErrorMessageProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 ${className}`}>
      <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="size-8 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-gray-900 dark:text-white text-lg font-medium mb-2">
        {title}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-md mb-4">
        {message}
      </p>
      {retry && (
        <Button onClick={retry} variant="outline">
          <RefreshCcw className="size-4 mr-2" />
          重试
        </Button>
      )}
    </div>
  )
}
