"use client";

import { useSyncExternalStore } from "react";

function getServerSnapshot() {
  return false;
}

function subscribe(query: string, callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function useMediaQuery(query: string): boolean {
  const getSnapshot = () => window.matchMedia(query).matches;

  const matches = useSyncExternalStore(
    (callback) => subscribe(query, callback),
    getSnapshot,
    getServerSnapshot,
  );

  return matches;
}

// 便捷 Hooks
export function useIsMobile() {
  return useMediaQuery("(max-width: 767px)");
}

export function useIsTablet() {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

export function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}
