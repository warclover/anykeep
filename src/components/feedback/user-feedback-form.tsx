"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { FeedbackService } from "@/lib/feedback/feedback.service";
import type { OpenFeedbackOptions } from "@/types/user-feedback";
import { FEEDBACK_TYPES } from "@/lib/constants/feedback";
import { FeedbackCategorySelector } from "./feedback-category-selector";
import { FeedbackAttachmentUploader } from "./feedback-attachment-uploader";

// 验证 Schema
const feedbackFormSchema = z.object({
  type: z.enum(["bug", "complaint", "suggestion"]),
  category: z.string().optional(),
  title: z.string().min(1, "请输入标题").max(100, "标题不超过100字"),
  description: z
    .string()
    .min(10, "描述至少10个��符")
    .max(2000, "描述不超过2000字"),
  reproduction_steps: z.string().max(1000).optional(),
  is_anonymous: z.boolean().optional().default(false),
  attachments: z.array(z.string()).optional(),
});

type FeedbackFormValues = z.input<typeof feedbackFormSchema>;

interface UserFeedbackFormProps {
  defaultOptions: OpenFeedbackOptions;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function UserFeedbackForm({
  defaultOptions,
  onSuccess,
  onCancel,
}: UserFeedbackFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      type: defaultOptions.type || "suggestion",
      category: undefined,
      title: defaultOptions.title || "",
      description: defaultOptions.description || "",
      reproduction_steps: "",
      is_anonymous: false,
      attachments: defaultOptions.screenshot ? [defaultOptions.screenshot] : [],
    },
  });

  const selectedType = form.watch("type");

  // 自动采集上下文
  const collectContext = () => ({
    page_path: typeof window !== "undefined" ? window.location.pathname : "",
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    screen_size:
      typeof window !== "undefined"
        ? `${window.screen.width}x${window.screen.height}`
        : "",
    app_version: process.env.NEXT_PUBLIC_APP_VERSION || "2.9.2",
    ...defaultOptions.context,
  });

  const onSubmit = async (values: FeedbackFormValues) => {
    setIsSubmitting(true);
    try {
      // 合并复现步骤到上下文
      const context = {
        ...collectContext(),
        ...(values.reproduction_steps
          ? { reproduction_steps: values.reproduction_steps }
          : {}),
      };

      // 从提交数据中移除 reproduction_steps，因为它不在 API schema 中

      const { reproduction_steps: _, ...submitData } = values;

      await FeedbackService.create({
        ...submitData,
        context,
      });

      toast.success("感谢您的反馈！", {
        description: "我们会尽快处理您的反馈",
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      toast.error("提交失败", {
        description: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 反馈类型选择 */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>反馈类型</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid grid-cols-3 gap-4"
                >
                  {FEEDBACK_TYPES.map((type) => (
                    <div key={type.value}>
                      <RadioGroupItem
                        value={type.value}
                        id={type.value}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={type.value}
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-full"
                      >
                        <type.icon className={`mb-2 h-6 w-6 ${type.color}`} />
                        <span className="text-sm font-medium">
                          {type.label}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 二级分类 */}
        <FeedbackCategorySelector type={selectedType} control={form.control} />

        {/* 标题 */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>标题</FormLabel>
              <FormControl>
                <Input placeholder="简要描述您的反馈" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 详细描述 */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>详细描述</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="请详细描述您遇到的问题或建议..."
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>{field.value?.length || 0}/2000</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Bug 专用：复现步骤 */}
        {selectedType === "bug" && (
          <FormField
            control={form.control}
            name="reproduction_steps"
            render={({ field }) => (
              <FormItem>
                <FormLabel>复现步骤（可选）</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="1. 打开某页面&#10;2. 点击某按钮&#10;3. 出现问题..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  提供复现步骤有助于我们更快定位问题
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* 附件上传 */}
        <FeedbackAttachmentUploader control={form.control} />

        {/* 匿名选项 */}
        <FormField
          control={form.control}
          name="is_anonymous"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>匿名提交</FormLabel>
                <FormDescription>管理员将无法看到您的身份信息</FormDescription>
              </div>
            </FormItem>
          )}
        />

        {/* 提交按钮 */}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            提交反馈
          </Button>
        </div>
      </form>
    </Form>
  );
}
