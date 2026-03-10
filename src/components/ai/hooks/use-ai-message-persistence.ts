"use client";

import { useEffect } from "react";
import type { DisplayMessage } from "../types";
import { clientLogger } from "@/lib/client-logger";
import { API_CONVERSATIONS } from "@/lib/constants/api-paths";
import { conversationStorage } from "@/lib/storage/conversation-storage";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";

export function useAIMessagePersistence(
  messages: DisplayMessage[],
  conversationId: string | undefined,
) {
  // P0: localStorage 持久化
  useEffect(() => {
    if (!FeatureFlags.ENABLE_CONVERSATION_PERSISTENCE) return;
    if (messages.length === 0) return;
    if (!conversationId) return;

    const chatMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        createdAt: m.createdAt,
      }));

    if (chatMessages.length === 0) return;

    const timer = setTimeout(() => {
      conversationStorage.save(conversationId, chatMessages);
      clientLogger.debug(
        { conversationId, messageCount: chatMessages.length },
        "Messages saved to localStorage",
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [messages, conversationId]);

  // P1: 数据库持久化
  useEffect(() => {
    if (!FeatureFlags.ENABLE_CONVERSATION_PERSISTENCE) return;
    if (messages.length === 0) return;
    if (!conversationId) return;

    const completedMessages = messages.filter(
      (m) => m.status === "completed" || m.status === "sent",
    );
    if (completedMessages.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        await fetch(API_CONVERSATIONS.messages(conversationId), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: completedMessages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt.toISOString(),
            })),
          }),
        });
        clientLogger.debug(
          { conversationId, messageCount: completedMessages.length },
          "Messages saved to database",
        );
      } catch (error) {
        clientLogger.error(
          { conversationId, error },
          "Failed to save messages to database",
        );
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [messages, conversationId]);
}
