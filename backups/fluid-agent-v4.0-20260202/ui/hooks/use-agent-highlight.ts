import { create } from 'zustand';
import { useReduceMotion } from './use-reduce-motion';

type HighlightType = 'processing' | 'completed';

interface HighlightEntry {
  type: HighlightType;
  expiresAt: number;
}

interface HighlightState {
  highlights: Map<string, HighlightEntry>;
  highlight: (entityId: string, type: HighlightType) => void;
  highlightMany: (entityIds: string[], type: HighlightType) => void;
  clear: (entityId: string) => void;
  clearAll: () => void;
}

const HIGHLIGHT_DURATION = 1500;

export const useHighlightStore = create<HighlightState>((set, get) => ({
  highlights: new Map(),

  highlight: (entityId, type) => {
    const expiresAt = Date.now() + HIGHLIGHT_DURATION;

    set(state => {
      const newHighlights = new Map(state.highlights);
      newHighlights.set(entityId, { type, expiresAt });
      return { highlights: newHighlights };
    });

    // 自动清理
    setTimeout(() => {
      get().clear(entityId);
    }, HIGHLIGHT_DURATION);
  },

  highlightMany: (entityIds, type) => {
    const expiresAt = Date.now() + HIGHLIGHT_DURATION;

    set(state => {
      const newHighlights = new Map(state.highlights);
      entityIds.forEach(id => {
        newHighlights.set(id, { type, expiresAt });
      });
      return { highlights: newHighlights };
    });

    setTimeout(() => {
      entityIds.forEach(id => get().clear(id));
    }, HIGHLIGHT_DURATION);
  },

  clear: (entityId) => {
    set(state => {
      const newHighlights = new Map(state.highlights);
      newHighlights.delete(entityId);
      return { highlights: newHighlights };
    });
  },

  clearAll: () => {
    set({ highlights: new Map() });
  },
}));

// 便捷 Hook
export function useAgentHighlight(entityId: string) {
  const highlights = useHighlightStore(state => state.highlights);
  const reduceMotion = useReduceMotion();

  const entry = highlights.get(entityId);
  const isHighlighted = entry ? Date.now() < entry.expiresAt : false;
  const highlightType = isHighlighted ? entry?.type ?? null : null;

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
  reduceMotion: boolean
): string {
  if (!type) return '';

  const baseStyles: Record<HighlightType, string> = {
    processing: 'ring-2 ring-blue-400 ring-opacity-75',
    completed: 'ring-2 ring-green-400 ring-opacity-75',
  };

  const animation = reduceMotion || type === 'completed'
    ? ''
    : ' animate-pulse';

  return baseStyles[type] + animation;
}
