"use client";

import {
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { DisplayMessage } from "../types";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";
import { useUnifiedConfirmation } from "@/hooks/domain/ai/use-unified-confirmation";
import { clientLogger } from "@/lib/client-logger";

export function useAIConfirmationHandlers(
  setMessages: Dispatch<SetStateAction<DisplayMessage[]>>,
) {
  const [pendingConfirmations, setPendingConfirmations] = useState<
    PendingConfirmation[]
  >([]);
  const [isConfirming, setIsConfirming] = useState(false);

  const { normalizeConfirmation, confirm, cancel } = useUnifiedConfirmation();

  const handleConfirm = useCallback(
    async (confirmationId: string) => {
      const confirmation = pendingConfirmations.find(
        (c) => c.confirmationId === confirmationId,
      );
      if (!confirmation) return;

      setIsConfirming(true);

      try {
        const unifiedConfirmation = normalizeConfirmation(confirmation);
        const result = await confirm(unifiedConfirmation);

        if (
          result.success &&
          confirmation.toolName === "export_bookmarks" &&
          result.data &&
          typeof result.data === "object" &&
          "content" in result.data
        ) {
          const exportData = result.data as {
            content: string;
            filename: string;
            mimeType: string;
            isBase64?: boolean;
          };
          const { content, filename, mimeType, isBase64 } = exportData;
          let blob: Blob;

          if (isBase64) {
            const binaryString = atob(content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            blob = new Blob([bytes], { type: mimeType });
          } else {
            blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }

        const resultMessage: DisplayMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.success
            ? `✅ ${result.message}`
            : `❌ ${result.message}`,
          status: "completed",
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, resultMessage]);

        setPendingConfirmations((prev) =>
          prev.filter((c) => c.confirmationId !== confirmationId),
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.pendingConfirmations?.some(
              (c) => c.confirmationId === confirmationId,
            )
              ? {
                  ...m,
                  pendingConfirmations: m.pendingConfirmations?.filter(
                    (c) => c.confirmationId !== confirmationId,
                  ),
                }
              : m,
          ),
        );
      } catch (error) {
        clientLogger.error(
          { confirmationId, error },
          "AIPanelContentEnhanced: Confirmation failed",
        );
        const errorMessage: DisplayMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ 操作执行失败：${error instanceof Error ? error.message : "未知错误"}`,
          status: "error",
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsConfirming(false);
      }
    },
    [pendingConfirmations, normalizeConfirmation, confirm, setMessages],
  );

  const handleCancel = useCallback(
    async (confirmationId: string) => {
      const confirmation = pendingConfirmations.find(
        (c) => c.confirmationId === confirmationId,
      );
      if (!confirmation) return;

      try {
        const unifiedConfirmation = normalizeConfirmation(confirmation);
        await cancel(unifiedConfirmation);
      } catch {
        // cancel failure doesn't affect UI
      }

      setPendingConfirmations((prev) =>
        prev.filter((c) => c.confirmationId !== confirmationId),
      );

      const cancelMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "❌ 操作已取消",
        status: "completed",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, cancelMessage]);

      setMessages((prev) =>
        prev.map((m) =>
          m.pendingConfirmations?.some(
            (c) => c.confirmationId === confirmationId,
          )
            ? {
                ...m,
                pendingConfirmations: m.pendingConfirmations?.filter(
                  (c) => c.confirmationId !== confirmationId,
                ),
              }
            : m,
        ),
      );
    },
    [pendingConfirmations, normalizeConfirmation, cancel, setMessages],
  );

  return {
    pendingConfirmations,
    setPendingConfirmations,
    isConfirming,
    handleConfirm,
    handleCancel,
  };
}
