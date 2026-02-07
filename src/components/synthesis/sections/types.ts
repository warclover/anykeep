/**
 * Synthesis Section Types
 *
 * 共享类型定义
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

import type {
  HighlightColor,
  SynthesisHighlight,
} from "@/lib/synthesis/types/highlight";

/**
 * 高亮回调类型
 */
export interface HighlightHandlers {
  highlights: SynthesisHighlight[];
  onCreateHighlight: (
    content: string,
    start: number,
    end: number,
    color: HighlightColor,
  ) => Promise<void>;
  onUpdateHighlight: (
    highlightId: string,
    updates: { note?: string; color?: HighlightColor },
  ) => Promise<void>;
  onDeleteHighlight: (highlightId: string) => Promise<void>;
}
