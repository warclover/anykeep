"use client";

import { useRef, useEffect, useCallback } from "react";
import { extractUrlFromShareText } from "@/lib/utils/url-extractor";

interface UseUrlClipboardParams {
  open: boolean;
  url: string;
  readClipboard: () => Promise<string | null>;
  extractUrlFromText: (text: string) => string | null;
  setUrl: (url: string) => void;
  /** 跳过剪贴板自动读取（外部已预填 URL 时使用） */
  skipAutoRead?: boolean;
}

export function useUrlClipboard({
  open,
  url,
  readClipboard,
  extractUrlFromText,
  setUrl,
  skipAutoRead,
}: UseUrlClipboardParams) {
  const urlInputRef = useRef<HTMLInputElement>(null);
  const hasAutoReadRef = useRef(false);

  const handleUrlInputFocus = useCallback(async () => {
    if (!hasAutoReadRef.current && !url && !skipAutoRead) {
      hasAutoReadRef.current = true;
      await readClipboard();
    }
  }, [url, readClipboard, skipAutoRead]);

  const handleUrlPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData("text");
      const extractedUrl = extractUrlFromText(pastedText);
      if (extractedUrl) {
        e.preventDefault();
        setUrl(extractUrlFromShareText(extractedUrl));
      }
    },
    [extractUrlFromText, setUrl],
  );

  useEffect(() => {
    if (open) {
      hasAutoReadRef.current = false;
    }
  }, [open]);

  return { urlInputRef, handleUrlInputFocus, handleUrlPaste };
}
