"use client";

import { type Ref } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIMessageEnhanced } from "./ai-message-enhanced";
import { ActionConfirmInline } from "./action-confirm-dialog";
import { AIWelcomeScreen } from "./phase4";
import type { DisplayMessage, SuggestionItem } from "./types";
import type { FeedbackDetails } from "./phase4/types";
import type { IntentType } from "@/lib/ai-skills/router/types";

interface AIMessageListProps {
  scrollRef: Ref<HTMLDivElement>;
  messages: DisplayMessage[];
  conversationId: string | undefined;
  isConfirming: boolean;
  feedbackMap: Record<string, "like" | "dislike">;
  onSetInput: (input: string) => void;
  onSuggestionClick: (suggestion: SuggestionItem) => void;
  onRegenerate: (messageId: string) => void;
  onSaveToNote: (messageId: string, content: string) => Promise<void>;
  onExport: (messageId: string, content: string) => void;
  onFeedback: (
    messageId: string,
    type: "like" | "dislike",
    details?: FeedbackDetails,
  ) => void;
  onWrongIntent: (messageId: string, currentIntent: IntentType) => void;
  onConfirm: (confirmationId: string) => void;
  onCancel: (confirmationId: string) => void;
  onRetry: () => void;
}

export function AIMessageList({
  scrollRef,
  messages,
  conversationId,
  isConfirming,
  feedbackMap,
  onSetInput,
  onSuggestionClick,
  onRegenerate,
  onSaveToNote,
  onExport,
  onFeedback,
  onWrongIntent,
  onConfirm,
  onCancel,
  onRetry,
}: AIMessageListProps) {
  return (
    <ScrollArea
      ref={scrollRef}
      className="flex-1 overflow-y-auto bg-gradient-to-b from-pink-50/50 to-white"
    >
      <div className="pr-3">
        {messages.length === 0 ? (
          <AIWelcomeScreen onSetInput={onSetInput} />
        ) : (
          <div className="py-2">
            {messages.map((message, index) => (
              <div key={message.id}>
                <AIMessageEnhanced
                  message={message}
                  isLast={index === messages.length - 1}
                  conversationId={conversationId}
                  onSuggestionClick={onSuggestionClick}
                  onRegenerate={onRegenerate}
                  onSaveToNote={onSaveToNote}
                  onExport={onExport}
                  onFeedback={onFeedback}
                  onWrongIntent={onWrongIntent}
                  feedbackGiven={feedbackMap[message.id] || null}
                />

                {message.pendingConfirmations &&
                  message.pendingConfirmations.length > 0 && (
                    <div className="px-4 py-2 space-y-2">
                      {message.pendingConfirmations.map((confirmation) => (
                        <ActionConfirmInline
                          key={confirmation.confirmationId}
                          confirmation={confirmation}
                          onConfirm={onConfirm}
                          onCancel={onCancel}
                          isLoading={isConfirming}
                        />
                      ))}
                    </div>
                  )}
              </div>
            ))}

            {messages[messages.length - 1]?.status === "error" && (
              <div className="flex justify-center py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="gap-1"
                >
                  <RotateCcw className="size-3" />
                  重试
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
