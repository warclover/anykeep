import { create } from "zustand";
import { useReduceMotion } from "./use-reduce-motion";

type HighlightType = "processing" | "completed";

interface HighlightEntry {
  type: HighlightType;
  expiresAt: number;
}

interface HighlightState {
  highlights: Record<string, HighlightEntry>;
  highlight: (entityId: string, type: HighlightType) => void;
  highlightMany: (entityIds: string[], type: HighlightType) => void;
  clear: (entityId: string) => void;
  clearAll: () => void;
}

const HIGHLIGHT_DURATION = 1500;

export const useHighlightStore = create<HighlightState>((set, get) => ({
  highlights: {},

  highlight: (entityId, type) => {
    const expiresAt = Date.now() + HIGHLIGHT_DURATION;

    set((state) => ({
      highlights: {
        ...state.highlights,
        [entityId]: { type, expiresAt },
      },
    }));

    // 自动清理
    setTimeout(() => {
      get().clear(entityId);
    }, HIGHLIGHT_DURATION);
  },

  highlightMany: (entityIds, type) => {
    const expiresAt = Date.now() + HIGHLIGHT_DURATION;

    set((state) => {
      const newEntries: Record<string, HighlightEntry> = {};
      entityIds.forEach((id) => {
        newEntries[id] = { type, expiresAt };
      });
      return {
        highlights: {
          ...state.highlights,
          ...newEntries,
        },
      };
    });

    setTimeout(() => {
      entityIds.forEach((id) => get().clear(id));
    }, HIGHLIGHT_DURATION);
  },

  clear: (entityId) => {
    set((state) => {
      const { [entityId]: _, ...rest } = state.highlights;
      return { highlights: rest };
    });
  },

  clearAll: () => {
    set({ highlights: {} });
  },
}));

// 便捷 Hook
export function useAgentHighlight(entityId: string) {
  const entry = useHighlightStore((state) => state.highlights[entityId]);
  const reduceMotion = useReduceMotion();

  // 由于 zustand 的 setTimeout 清理机制，过期的 entry 会被自动删除
  const isHighlighted = !!entry;
  const highlightType = isHighlighted ? (entry?.type ?? null) : null;

  // 生成高亮样式类名
  const highlightClassName = getHighlightClassName(highlightType, reduceMotion);

  return {
    isHighlighted,
    highlightType,
    highlightClassName,
  };
}

function getHighlightClassName(
  type: HighlightType | null,
  reduceMotion: boolean,
): string {
  if (!type) return "";

  const baseStyles: Record<HighlightType, string> = {
    processing: "ring-2 ring-blue-400 ring-opacity-75",
    completed: "ring-2 ring-green-400 ring-opacity-75",
  };

  const animation =
    reduceMotion || type === "completed" ? "" : " animate-pulse";

  return baseStyles[type] + animation;
}
