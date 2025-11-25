/**
 * 图片上传组件
 * 支持拖拽上传、预览、压缩
 */

'use client'

import type { ChangeEvent, DragEvent } from 'react';
import { useState, useRef } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadFile, compressImage, validateImageFile } from '@/lib/utils/file-upload'
import type { UploadOptions } from '@/lib/utils/file-upload'

interface ImageUploadProps {
  bucket: 'covers' | 'avatars'
  onUploadSuccess: (url: string) => void
  onUploadError?: (error: string) => void
  defaultImageUrl?: string
  maxWidth?: number
  maxHeight?: number
  compress?: boolean
  className?: string
}

export function ImageUpload({
  bucket,
  onUploadSuccess,
  onUploadError,
  defaultImageUrl,
  maxWidth = 1200,
  maxHeight = 1200,
  compress = true,
  className = '',
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(defaultImageUrl || null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * 处理文件选择
   */
  const handleFileSelect = async (file: File) => {
    // 验证文件
    const validation = validateImageFile(file)
    if (!validation.valid) {
      onUploadError?.(validation.error || '文件验证失败')
      return
    }

    // 创建预览
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)

    try {
      setUploading(true)
      setProgress(0)

      // 压缩图片（可选）
      let fileToUpload = file
      if (compress) {
        try {
          fileToUpload = await compressImage(file, maxWidth, maxHeight, 0.8)
          // 前端日志保持简化，仅开发环境输出
          if (process.env.NODE_ENV === 'development') {
            console.log('[Image Upload] Compressed:', {
              original: file.size,
              compressed: fileToUpload.size,
              ratio: ((1 - fileToUpload.size / file.size) * 100).toFixed(2) + '%',
            })
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[Image Upload] Compression failed, using original:', error)
          }
        }
      }

      // 上传文件
      const options: UploadOptions = {
        bucket,
        onProgress: setProgress,
      }

      const result = await uploadFile(fileToUpload, options)

      // 释放预览 URL
      URL.revokeObjectURL(previewUrl)

      // 设置上传后的 URL
      setPreview(result.url)
      onUploadSuccess(result.url)

      if (process.env.NODE_ENV === 'development') {
        console.log('[Image Upload] Success:', result)
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Image Upload] Failed:', error)
      }

      // 恢复默认图片
      URL.revokeObjectURL(previewUrl)
      setPreview(defaultImageUrl || null)

      const errorMessage = error instanceof Error ? error.message : '上传失败'
      onUploadError?.(errorMessage)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  /**
   * 处理输入框文件选择
   */
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  /**
   * 处理拖拽开始
   */
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  /**
   * 处理拖拽离开
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  /**
   * 处理拖拽悬停
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  /**
   * 处理文件拖放
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  /**
   * 移除图片
   */
  const handleRemove = () => {
    if (preview) {
      URL.revokeObjectURL(preview)
    }
    setPreview(null)
    onUploadSuccess('')

    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * 打开文件选择器
   */
  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={className}>
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleInputChange}
        className="hidden"
        disabled={uploading}
      />

      {preview ? (
        // 预览模式
        <div className="relative group">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <img
              src={preview}
              alt="预览"
              className="w-full h-full object-cover"
            />

            {/* 上传进度遮罩 */}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                <Loader2 className="size-8 text-white animate-spin mb-2" />
                <div className="text-white text-sm font-medium">
                  上传中 {progress}%
                </div>
              </div>
            )}

            {/* 删除按钮 */}
            {!uploading && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleRemove}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        // 上传区域
        <div
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`
            relative aspect-video w-full rounded-lg border-2 border-dashed
            flex flex-col items-center justify-center
            cursor-pointer transition-colors
            ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {uploading ? (
            <>
              <Loader2 className="size-12 text-gray-400 animate-spin mb-3" />
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                上传中 {progress}%
              </p>
            </>
          ) : (
            <>
              <Upload className="size-12 text-gray-400 mb-3" />
              <p className="text-gray-600 dark:text-gray-300 text-sm font-medium mb-1">
                点击或拖拽图片到此处上传
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                支持 JPG、PNG、WebP、GIF，最大 5MB
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
