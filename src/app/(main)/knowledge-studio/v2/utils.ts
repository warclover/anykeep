"use client";

import { useState, useCallback, useEffect } from "react";
import { useUiText, getNestedValue } from "@/lib/i18n";

export type WorkflowStep =
  | "blueprint"
  | "materials"
  | "outline"
  | "generating"
  | "result";

export interface GenerationProgress {
  step: string;
  percent: number;
  message?: string;
  generatedWords?: number;
}

export const WAITING_MESSAGE_KEYS = [
  "waitingMsg1",
  "waitingMsg2",
  "waitingMsg3",
  "waitingMsg4",
  "waitingMsg5",
] as const;

export type Ks2TextFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SseJsonValue = any;

const KS2_KEY = "knowledgeStudioV2";

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}

export function formatElapsedTime(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function createSseJsonLineParser(
  onJson: (value: SseJsonValue) => void,
  onParseError?: () => void,
) {
  let buffer = "";

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("data:")) return;

    const payload = trimmed.slice("data:".length).trimStart();
    if (!payload || payload === "[DONE]") return;

    try {
      onJson(JSON.parse(payload));
    } catch {
      onParseError?.();
    }
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
    },
    flush() {
      if (buffer) processLine(buffer);
      buffer = "";
    },
  };
}

export function useKs2Text(): Ks2TextFn {
  const t = useUiText();
  return useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const raw =
        getNestedValue<string>(
          t as unknown as Record<string, unknown>,
          `${KS2_KEY}.${key}`,
        ) ?? key;
      if (!params) return raw;
      return Object.entries(params).reduce(
        (s, [pk, v]) => s.replace(new RegExp(`\\{${pk}\\}`, "g"), String(v)),
        raw,
      );
    },
    [t],
  );
}
