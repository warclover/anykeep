import { useSyncExternalStore } from "react";

const STORAGE_KEY = "fluid-agent-reduce-motion";

// 外部存储订阅模式
function subscribeToReduceMotion(callback: () => void) {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", callback);
  window.addEventListener("reduce-motion-change", callback);
  window.addEventListener("storage", callback);

  return () => {
    mediaQuery.removeEventListener("change", callback);
    window.removeEventListener("reduce-motion-change", callback);
    window.removeEventListener("storage", callback);
  };
}

function getReduceMotionSnapshot(): boolean {
  if (typeof window === "undefined") return false;

  const userPref = localStorage.getItem(STORAGE_KEY);
  if (userPref !== null) {
    return userPref === "true";
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useReduceMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReduceMotion,
    getReduceMotionSnapshot,
    getServerSnapshot,
  );
}

/**
 * 设置用户动效偏好
 */
export function setReduceMotionPreference(value: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(value));
  window.dispatchEvent(new Event("reduce-motion-change"));
}

/**
 * 清除用户偏好，跟随系统
 */
export function clearReduceMotionPreference(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("reduce-motion-change"));
}
