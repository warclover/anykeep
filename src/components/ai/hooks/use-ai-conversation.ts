"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { DisplayMessage } from "../types";

interface UseAIConversationOptions {
  initialConversationId?: string;
  initialMessage?: string;
  initialMessages?: DisplayMessage[];
}

export function useAIConversation({
  initialConversationId,
  initialMessage,
  initialMessages,
}: UseAIConversationOptions) {
  const [messages, setMessages] = useState<DisplayMessage[]>(
    initialMessages ?? [],
  );
  const [input, setInput] = useState(initialMessage ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId,
  );

  const initialMessageProcessedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    setIsLoading,
    conversationId,
    setConversationId,
    initialMessageProcessedRef,
    scrollRef,
    abortControllerRef,
    scrollToBottom,
  };
}
