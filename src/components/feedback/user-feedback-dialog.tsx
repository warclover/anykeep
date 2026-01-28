"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserFeedbackForm } from "./user-feedback-form";
import type { OpenFeedbackOptions } from "@/types/user-feedback";

interface UserFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultOptions: OpenFeedbackOptions;
}

export function UserFeedbackDialog({
  open,
  onOpenChange,
  defaultOptions,
}: UserFeedbackDialogProps) {
  const handleSuccess = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {defaultOptions.title ? "补充反馈信息" : "提交反馈"}
          </DialogTitle>
          <DialogDescription>
            感谢您的反馈，我们会认真对待每一条意见
          </DialogDescription>
        </DialogHeader>
        <UserFeedbackForm
          defaultOptions={defaultOptions}
          onSuccess={handleSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
