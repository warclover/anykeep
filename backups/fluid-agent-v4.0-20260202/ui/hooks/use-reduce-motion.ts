import { useState, useEffect } from 'react';

const STORAGE_KEY = 'fluid-agent-reduce-motion';

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // 1. 检查用户设置
    const userPref = localStorage.getItem(STORAGE_KEY);
    if (userPref !== null) {
      setReduceMotion(userPref === 'true');
      return;
    }

    // 2. 检查系统偏好
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mediaQuery.matches);

    // 3. 监听系统偏好变化
    const handler = (e: MediaQueryListEvent) => {
      const userPref = localStorage.getItem(STORAGE_KEY);
      if (userPref === null) {
        setReduceMotion(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return reduceMotion;
}

/**
 * 设置用户动效偏好
 */
export function setReduceMotionPreference(value: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(value));
  window.dispatchEvent(new Event('reduce-motion-change'));
}

/**
 * 清除用户偏好，跟随系统
 */
export function clearReduceMotionPreference(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('reduce-motion-change'));
}
