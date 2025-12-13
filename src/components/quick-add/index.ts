/**
 * Quick Add Bookmark Components
 *
 * Export all quick-add related components and hooks.
 */

// Main component
export { QuickAddBookmark } from "./QuickAddBookmark";
export type { QuickAddBookmarkProps } from "./QuickAddBookmark";

// Inline components
export { QuickAddInput } from "./inline/QuickAddInput";
export type { QuickAddInputProps } from "./inline/QuickAddInput";

export { QuickAddPreview, QuickAddError } from "./inline/QuickAddPreview";
export type {
  QuickAddPreviewProps,
  QuickAddErrorProps,
} from "./inline/QuickAddPreview";

export { QuickAddSuccess } from "./inline/QuickAddSuccess";
export type { QuickAddSuccessProps } from "./inline/QuickAddSuccess";

// Drawer components
export { DetailDrawer } from "./drawer/DetailDrawer";
export type { DetailDrawerProps } from "./drawer/DetailDrawer";

// Hooks
export { useQuickAddState } from "./hooks/useQuickAddState";
export type {
  QuickAddState,
  QuickAddMode,
  DetailDrawerState,
  BookmarkMetadata,
  QuickAddActions,
} from "./hooks/useQuickAddState";

export {
  useClipboardPaste,
  isValidUrl,
  normalizeUrl,
} from "./hooks/useClipboardPaste";
export type {
  ClipboardPasteOptions,
  ClipboardPasteResult,
} from "./hooks/useClipboardPaste";

export {
  useKeyboardShortcuts,
  getShortcutDisplayText,
  KEYBOARD_SHORTCUTS,
} from "./hooks/useKeyboardShortcuts";
export type {
  KeyboardShortcutHandlers,
  UseKeyboardShortcutsOptions,
} from "./hooks/useKeyboardShortcuts";
