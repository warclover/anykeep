"use client";

import { useState } from "react";
import type { Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { X, Loader2, ImagePlus } from "lucide-react";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FeedbackService } from "@/lib/feedback/feedback.service";
import { toast } from "sonner";
import Image from "next/image";

interface FeedbackAttachmentUploaderProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  name?: string;
}

export function FeedbackAttachmentUploader({
  control,
  name = "attachments",
}: FeedbackAttachmentUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const attachments = (field.value || []) as string[];

        const handleFileChange = async (
          e: React.ChangeEvent<HTMLInputElement>,
        ) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;

          if (attachments.length + files.length > 3) {
            toast.error("最多上传 3 张图片");
            return;
          }

          setIsUploading(true);
          const newUrls: string[] = [];

          try {
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              if (file.size > 5 * 1024 * 1024) {
                toast.error(`文件 ${file.name} 超过 5MB 限制`);
                continue;
              }
              const url = await FeedbackService.uploadAttachment(file);
              newUrls.push(url);
            }

            field.onChange([...attachments, ...newUrls]);
          } catch (error) {
            toast.error("图片上传失败");
            console.error(error);
          } finally {
            setIsUploading(false);
            // 清空 input 以允许重复选择同一文件
            e.target.value = "";
          }
        };

        const removeAttachment = (indexToRemove: number) => {
          const newAttachments = attachments.filter(
            (_, index) => index !== indexToRemove,
          );
          field.onChange(newAttachments);
        };

        return (
          <FormItem>
            <FormLabel>截图/附件 (可选)</FormLabel>
            <FormControl>
              <div className="space-y-4">
                {/* 图片预览网格 */}
                {attachments.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {attachments.map((url, index) => (
                      <div
                        key={url}
                        className="relative aspect-video rounded-md border overflow-hidden group"
                      >
                        <Image
                          src={url}
                          alt={`附件 ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 上传按钮 */}
                {attachments.length < 3 && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="relative"
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="mr-2 h-4 w-4" />
                      )}
                      添加截图
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        onChange={handleFileChange}
                        disabled={isUploading}
                      />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      支持 JPG, PNG (最大 5MB)
                    </span>
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
