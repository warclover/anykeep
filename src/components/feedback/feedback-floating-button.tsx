"use client";

import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFeedback } from "./feedback-provider";

export function FeedbackFloatingButton() {
  const { open } = useFeedback();

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all"
              onClick={() => open()}
            >
              <MessageSquarePlus className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>反馈建议</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
