"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { clientLogger } from "@/lib/client-logger";
import { useUiText } from "@/lib/i18n";
import { API_USER } from "@/lib/constants/api-paths";

interface UseAccountActionsParams {
  userEmail: string | undefined;
}

export function useAccountActions({ userEmail }: UseAccountActionsParams) {
  const router = useRouter();
  const supabase = createClient();
  const t = useUiText();

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExportData = async () => {
    if (exporting) return;

    setExporting(true);
    try {
      const response = await fetch(API_USER.export, { method: "POST" });

      if (!response.ok) {
        throw new Error(t.settings.export.failed);
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || "anykeep-export.json";

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      clientLogger.info({}, "Data exported successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.settings.export.failed;
      toast.error(message);
      clientLogger.error({ error: message }, "Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm(t.settings.deleteAccount.confirm)) return;

    const confirmEmail = prompt(t.settings.deleteAccount.promptEmail);
    if (!confirmEmail) return;

    if (confirmEmail !== userEmail) {
      toast.error(t.settings.deleteAccount.emailMismatch);
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(API_USER.delete, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmDelete: true, confirmEmail }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.error?.message || t.settings.deleteAccount.failed,
        );
      }

      toast.success(t.settings.deleteAccount.deleted);
      router.push("/login");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t.settings.deleteAccount.failed;
      toast.error(message);
      clientLogger.error({ error: message }, "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return {
    exporting,
    deleting,
    handleExportData,
    handleDeleteAccount,
    handleLogout,
  };
}
