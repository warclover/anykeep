"use client";

import { useState, useCallback } from "react";
import type { DisplayMessage } from "../types";
import type { FeedbackDetails } from "../phase4/types";
import type { IntentType } from "@/lib/ai-skills/router/types";
import { clientLogger } from "@/lib/client-logger";

type FeedbackMap = Record<string, "like" | "dislike">;

export interface IntentCorrectionState {
  open: boolean;
  messageId: string;
  originalInput: string;
  wrongIntent: IntentType;
}

const INITIAL_INTENT_CORRECTION: IntentCorrectionState = {
  open: false,
  messageId: "",
  originalInput: "",
  wrongIntent: "chitchat",
};

export function useAIFeedbackHandlers(
  messages: DisplayMessage[],
  conversationId: string | undefined,
  bookmarkIds?: number[],
) {
  const [feedbackMap, setFeedbackMap] = useState<FeedbackMap>({});
  const [showMemoryHint, setShowMemoryHint] = useState(false);
  const [intentCorrectionState, setIntentCorrectionState] =
    useState<IntentCorrectionState>(INITIAL_INTENT_CORRECTION);

  const handleFeedback = useCallback(
    async (
      messageId: string,
      type: "like" | "dislike",
      details?: FeedbackDetails,
    ) => {
      setFeedbackMap((prev) => ({ ...prev, [messageId]: type }));

      const message = messages.find((m) => m.id === messageId);
      if (!message) return;

      try {
        const response = await fetch("/api/ai/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId,
            conversationId: conversationId || "",
            type: type === "like" ? "positive" : "negative",
            negativeReason: details?.reasons[0],
            comment: details?.comment,
            context: {
              originalMessage: message.content,
              classifiedIntent: message.executionMode || "unknown",
              toolUsed: message.skillId || "chat",
              executionMode: message.executionMode,
              skillId: message.skillId,
            },
          }),
        });

        const result = await response.json();

        if (result.success) {
          clientLogger.info(
            { feedbackId: result.data.feedbackId },
            "Feedback submitted",
          );
        } else {
          clientLogger.error(
            { error: result.error },
            "Failed to submit feedback",
          );
        }
      } catch (error) {
        clientLogger.error({ messageId, error }, "Feedback submission error");
      }
    },
    [messages, conversationId],
  );

  const handleSaveToNote = useCallback(
    async (messageId: string, content: string) => {
      try {
        const message = messages.find((m) => m.id === messageId);

        const response = await fetch("/api/ai/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            sourceType: "ai_response",
            sourceConversationId: conversationId,
            sourceMessageId: messageId,
            sourceSkillId: message?.skillId,
            relatedBookmarkIds: bookmarkIds,
          }),
        });

        const result = await response.json();

        if (result.success) {
          clientLogger.info(
            { noteId: result.data.id },
            "Note saved successfully",
          );
        } else {
          clientLogger.error({ error: result.error }, "Failed to save note");
        }
      } catch (error) {
        clientLogger.error({ messageId, error }, "Save to note error");
      }
    },
    [messages, conversationId, bookmarkIds],
  );

  const handleExport = useCallback((messageId: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-response-${messageId.slice(0, 8)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleWrongIntent = useCallback(
    (messageId: string, currentIntent: IntentType) => {
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      let originalInput = "";

      if (messageIndex > 0) {
        const userMessage = messages[messageIndex - 1];
        if (userMessage.role === "user") {
          originalInput = userMessage.content;
        }
      }

      setIntentCorrectionState({
        open: true,
        messageId,
        originalInput,
        wrongIntent: currentIntent,
      });
    },
    [messages],
  );

  return {
    feedbackMap,
    showMemoryHint,
    setShowMemoryHint,
    intentCorrectionState,
    setIntentCorrectionState,
    handleFeedback,
    handleSaveToNote,
    handleExport,
    handleWrongIntent,
  };
}
