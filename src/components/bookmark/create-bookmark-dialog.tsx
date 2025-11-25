/**
 * 创建收藏对话框组件
 * 提供表单让用户手动输入 URL、标题、描述等信息
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAbortableFetch } from '@/hooks/use-abortable-fetch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImageUpload } from '@/components/ui/image-upload'
import { createBookmarkSchema } from '@/lib/validation'

interface BookmarkCreatedData {
  id: number
  title: string
  ai_summary?: string | null
  ai_tags?: string[] | null
}

interface CreateBookmarkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders?: Array<{ id: number; name: string }>
  onSuccess?: (bookmark: BookmarkCreatedData) => void
}

export function CreateBookmarkDialog({
  open,
  onOpenChange,
  folders = [],
  onSuccess,
}: CreateBookmarkDialogProps) {
  const router = useRouter()
  const { fetchWithAbort } = useAbortableFetch()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 表单状态
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [folderId, setFolderId] = useState<string>('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [coverUrl, setCoverUrl] = useState<string>('')

  // 表单错误
  const [errors, setErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setUrl('')
    setTitle('')
    setDescription('')
    setFolderId('')
    setTags('')
    setNotes('')
    setCoverUrl('')
    setErrors({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    try {
      // 解析标签字符串
      const userTags = tags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)

      // 验证输入
      const validation = createBookmarkSchema.safeParse({
        url,
        title,
        description: description || undefined,
        folderId: folderId ? parseInt(folderId) : undefined,
        userTags: userTags.length > 0 ? userTags : undefined,
        notes: notes || undefined,
        coverUrl: coverUrl || undefined,
      })

      if (!validation.success) {
        const fieldErrors: Record<string, string> = {}
        validation.error.errors.forEach((err) => {
          const field = err.path[0] as string
          fieldErrors[field] = err.message
        })
        setErrors(fieldErrors)
        return
      }

      // 调用创建 API
      const res = await fetchWithAbort('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validation.data),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || '创建收藏失败')
      }

      toast.success('收藏创建成功！')
      resetForm()
      onOpenChange(false)

      // 触发成功回调（用于 AI 文件夹推荐）
      if (onSuccess && data.data) {
        onSuccess({
          id: data.data.id,
          title: data.data.title,
          ai_summary: data.data.ai_summary,
          ai_tags: data.data.ai_tags,
        })
      }

      // 刷新页面数据
      router.refresh()
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      toast.error(error instanceof Error ? error.message : '创建收藏失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加收藏</DialogTitle>
          <DialogDescription>
            输入链接和基本信息，稍后可以继续完善内容
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL 输入 */}
          <div className="space-y-2">
            <Label htmlFor="url">
              链接 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://mp.weixin.qq.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className={errors.url ? 'border-red-500' : ''}
            />
            {errors.url && (
              <p className="text-xs text-red-500">{errors.url}</p>
            )}
            <p className="text-xs text-gray-500">
              支持微信公众号、B站、小红书等平台链接
            </p>
          </div>

          {/* 标题输入 */}
          <div className="space-y-2">
            <Label htmlFor="title">
              标题 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="输入收藏标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title}</p>
            )}
          </div>

          {/* 描述输入 */}
          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              placeholder="简单描述这篇内容..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description}</p>
            )}
          </div>

          {/* 文件夹选择 */}
          {folders.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="folder">文件夹</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择文件夹（可选）" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id.toString()}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 标签输入 */}
          <div className="space-y-2">
            <Label htmlFor="tags">标签</Label>
            <Input
              id="tags"
              placeholder="技术, 前端, React（逗号或空格分隔）"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className={errors.userTags ? 'border-red-500' : ''}
            />
            {errors.userTags && (
              <p className="text-xs text-red-500">{errors.userTags}</p>
            )}
            <p className="text-xs text-gray-500">
              最多 20 个标签，每个标签不超过 30 个字符
            </p>
          </div>

          {/* 备注输入 */}
          <div className="space-y-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              placeholder="记录一些个人想法..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={errors.notes ? 'border-red-500' : ''}
            />
            {errors.notes && (
              <p className="text-xs text-red-500">{errors.notes}</p>
            )}
          </div>

          {/* 自定义封面上传 */}
          <div className="space-y-2">
            <Label htmlFor="cover">自定义封面（可选）</Label>
            <ImageUpload
              bucket="covers"
              onUploadSuccess={(url) => setCoverUrl(url)}
              onUploadError={(error) => {
                toast.error(`封面上传失败: ${error}`)
              }}
              defaultImageUrl={coverUrl}
              className="w-full"
            />
            {errors.coverUrl && (
              <p className="text-xs text-red-500">{errors.coverUrl}</p>
            )}
            <p className="text-xs text-gray-500">
              上传自定义封面图片，将覆盖爬取的封面。支持 JPG、PNG、WebP、GIF，最大 5MB
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建收藏'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
