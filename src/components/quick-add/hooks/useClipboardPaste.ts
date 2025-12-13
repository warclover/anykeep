/**
 * Clipboard Paste Hook
 *
 * Handles automatic clipboard reading when the input is focused.
 * Requires user permission for clipboard access.
 */

import { useCallback, useRef, useState } from "react";

// URL extraction regex - matches URLs in text
const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;

// Common share text patterns to extract URLs from
const SHARE_TEXT_PATTERNS = [
  // WeChat share format
  /「.*」.*\n?(https?:\/\/[^\s]+)/,
  // Generic "check this out" format
  /(?:看看|分享|推荐).*?(https?:\/\/[^\s]+)/,
];

export interface ClipboardPasteOptions {
  onUrlExtracted?: (url: string) => void;
  onTextPasted?: (text: string) => void;
  onError?: (error: Error) => void;
  onPermissionDenied?: () => void;
}

export interface ClipboardPasteResult {
  readClipboard: () => Promise<string | null>;
  extractUrlFromText: (text: string) => string | null;
  isSupported: boolean;
  permissionState: PermissionState | null;
  checkPermission: () => Promise<PermissionState>;
  markUrlAsProcessed: (url: string) => void;
  clearProcessedUrls: () => void;
}

type PermissionState = "granted" | "denied" | "prompt";

export function useClipboardPaste(
  options: ClipboardPasteOptions = {},
): ClipboardPasteResult {
  const { onUrlExtracted, onTextPasted, onError, onPermissionDenied } = options;

  const [permissionState, setPermissionState] =
    useState<PermissionState | null>(null);
  const lastReadRef = useRef<string | null>(null);
  const processedUrlsRef = useRef<Set<string>>(new Set());

  // Check if clipboard API is supported
  const isSupported =
    typeof navigator !== "undefined" && "clipboard" in navigator;

  /**
   * Extract URL from text (handles share text formats)
   */
  const extractUrlFromText = useCallback((text: string): string | null => {
    if (!text) return null;

    const trimmedText = text.trim();

    // Reset regex state before using (global flag side effect)
    URL_REGEX.lastIndex = 0;

    // Check if the entire text is a URL
    if (URL_REGEX.test(trimmedText)) {
      URL_REGEX.lastIndex = 0; // Reset again after test()
      const matches = trimmedText.match(URL_REGEX);
      if (matches && matches.length === 1 && matches[0] === trimmedText) {
        return trimmedText;
      }
    }

    // Try to extract URL from share text patterns
    for (const pattern of SHARE_TEXT_PATTERNS) {
      const match = trimmedText.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Fallback: find first URL in text
    URL_REGEX.lastIndex = 0; // Reset regex state
    const matches = trimmedText.match(URL_REGEX);
    if (matches && matches.length > 0) {
      return matches[0];
    }

    return null;
  }, []);

  /**
   * Check clipboard permission
   */
  const checkPermission = useCallback(async (): Promise<PermissionState> => {
    if (!isSupported) {
      return "denied";
    }

    try {
      // Query clipboard-read permission
      const result = await navigator.permissions.query({
        name: "clipboard-read" as PermissionName,
      });

      setPermissionState(result.state as PermissionState);

      // Listen for permission changes
      result.onchange = () => {
        setPermissionState(result.state as PermissionState);
      };

      return result.state as PermissionState;
    } catch {
      // Some browsers don't support permission query for clipboard
      // In this case, we'll try to read and handle the error
      return "prompt";
    }
  }, [isSupported]);

  /**
   * Read clipboard content
   */
  const readClipboard = useCallback(async (): Promise<string | null> => {
    if (!isSupported) {
      return null;
    }

    try {
      const text = await navigator.clipboard.readText();

      // Skip if same content was just read (debounce)
      if (text === lastReadRef.current) {
        return null;
      }

      lastReadRef.current = text;

      if (text) {
        onTextPasted?.(text);

        // Try to extract URL
        const url = extractUrlFromText(text);
        if (url) {
          // Skip if this URL was already successfully processed
          if (processedUrlsRef.current.has(url)) {
            return null;
          }
          onUrlExtracted?.(url);
          return url;
        }

        return text;
      }

      return null;
    } catch (error) {
      if (error instanceof Error) {
        // Check if permission was denied
        if (
          error.name === "NotAllowedError" ||
          error.message.includes("denied")
        ) {
          setPermissionState("denied");
          onPermissionDenied?.();
        } else {
          onError?.(error);
        }
      }
      return null;
    }
  }, [
    isSupported,
    extractUrlFromText,
    onUrlExtracted,
    onTextPasted,
    onError,
    onPermissionDenied,
  ]);

  /**
   * Mark a URL as processed (won't trigger auto-fill again)
   */
  const markUrlAsProcessed = useCallback((url: string) => {
    processedUrlsRef.current.add(url);
  }, []);

  /**
   * Clear all processed URLs (for cleanup)
   */
  const clearProcessedUrls = useCallback(() => {
    processedUrlsRef.current.clear();
  }, []);

  return {
    readClipboard,
    extractUrlFromText,
    isSupported,
    permissionState,
    checkPermission,
    markUrlAsProcessed,
    clearProcessedUrls,
  };
}

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize URL (add https if missing)
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();

  // Already has protocol
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Add https by default
  return `https://${trimmed}`;
}
