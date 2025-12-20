/**
 * Quick Add Bookmark - State Management Hook
 *
 * Manages the state machine for the quick add bookmark component.
 * States: idle -> focused -> loading -> preview -> success -> idle
 *                                    -> error -> idle
 */

import { useCallback, useMemo, useReducer } from "react";

// Types
export type QuickAddMode =
  | "idle"
  | "focused"
  | "loading"
  | "preview"
  | "success"
  | "error";

export type DetailDrawerState = "closed" | "opening" | "open" | "closing";

export interface BookmarkMetadata {
  title: string;
  description?: string;
  coverUrl?: string;
  sourceName?: string;
  author?: string;
  publishTime?: string;
  wordCount?: number;
  imageCount?: number;
  platform?: string;
  favicon?: string;
}

export interface QuickAddState {
  // Mode state
  mode: QuickAddMode;
  drawerState: DetailDrawerState;

  // Input data
  inputValue: string;
  extractedUrl: string | null;

  // Metadata
  metadata: BookmarkMetadata | null;
  metadataError: string | null;

  // Form data (for drawer)
  folderId: number | null;
  tags: string[];
  notes: string;

  // UI state
  isSubmitting: boolean;
  showKeyboardHints: boolean;
  successMessage: string | null;
}

// Action types
type QuickAddAction =
  | { type: "SET_MODE"; payload: QuickAddMode }
  | { type: "SET_DRAWER_STATE"; payload: DetailDrawerState }
  | { type: "SET_INPUT_VALUE"; payload: string }
  | { type: "SET_EXTRACTED_URL"; payload: string | null }
  | { type: "SET_METADATA"; payload: BookmarkMetadata | null }
  | { type: "SET_METADATA_ERROR"; payload: string | null }
  | { type: "SET_FOLDER_ID"; payload: number | null }
  | { type: "SET_TAGS"; payload: string[] }
  | { type: "SET_NOTES"; payload: string }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_KEYBOARD_HINTS"; payload: boolean }
  | { type: "SET_SUCCESS_MESSAGE"; payload: string | null }
  | { type: "RESET" }
  | { type: "START_LOADING" }
  | { type: "SHOW_PREVIEW"; payload: BookmarkMetadata }
  | { type: "SHOW_SUCCESS"; payload: string }
  | { type: "SHOW_ERROR"; payload: string };

// Initial state
const initialState: QuickAddState = {
  mode: "idle",
  drawerState: "closed",
  inputValue: "",
  extractedUrl: null,
  metadata: null,
  metadataError: null,
  folderId: null,
  tags: [],
  notes: "",
  isSubmitting: false,
  showKeyboardHints: false,
  successMessage: null,
};

// State machine transitions
const validTransitions: Record<QuickAddMode, QuickAddMode[]> = {
  idle: ["focused"],
  focused: ["idle", "loading"],
  loading: ["preview", "error", "idle"],
  preview: ["success", "idle", "loading"],
  success: ["idle"],
  error: ["idle", "focused"],
};

function canTransition(from: QuickAddMode, to: QuickAddMode): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}

// Reducer
function quickAddReducer(
  state: QuickAddState,
  action: QuickAddAction,
): QuickAddState {
  switch (action.type) {
    case "SET_MODE": {
      // Validate state transition - silently ignore invalid transitions
      if (!canTransition(state.mode, action.payload)) {
        return state;
      }
      return { ...state, mode: action.payload };
    }

    case "SET_DRAWER_STATE":
      return { ...state, drawerState: action.payload };

    case "SET_INPUT_VALUE":
      return { ...state, inputValue: action.payload };

    case "SET_EXTRACTED_URL":
      return { ...state, extractedUrl: action.payload };

    case "SET_METADATA":
      return { ...state, metadata: action.payload };

    case "SET_METADATA_ERROR":
      return { ...state, metadataError: action.payload };

    case "SET_FOLDER_ID":
      return { ...state, folderId: action.payload };

    case "SET_TAGS":
      return { ...state, tags: action.payload };

    case "SET_NOTES":
      return { ...state, notes: action.payload };

    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.payload };

    case "SET_KEYBOARD_HINTS":
      return { ...state, showKeyboardHints: action.payload };

    case "SET_SUCCESS_MESSAGE":
      return { ...state, successMessage: action.payload };

    case "RESET":
      return { ...initialState };

    case "START_LOADING": {
      // Allow transition from focused, preview, or idle (implicit focus)
      const allowedModes: QuickAddMode[] = ["focused", "preview", "idle"];
      if (!allowedModes.includes(state.mode)) {
        return state;
      }
      return {
        ...state,
        mode: "loading",
        metadataError: null,
      };
    }

    case "SHOW_PREVIEW": {
      // Only allow from loading mode
      if (state.mode !== "loading") {
        return state;
      }
      return {
        ...state,
        mode: "preview",
        metadata: action.payload,
        metadataError: null,
      };
    }

    case "SHOW_SUCCESS": {
      // Only allow from preview mode
      if (state.mode !== "preview") {
        return state;
      }
      return {
        ...state,
        mode: "success",
        successMessage: action.payload,
        isSubmitting: false,
      };
    }

    case "SHOW_ERROR": {
      // Only allow from loading mode
      if (state.mode !== "loading") {
        return state;
      }
      return {
        ...state,
        mode: "error",
        metadataError: action.payload,
      };
    }

    default:
      return state;
  }
}

// Hook
export function useQuickAddState() {
  const [state, dispatch] = useReducer(quickAddReducer, initialState);

  // Actions
  const setMode = useCallback((mode: QuickAddMode) => {
    dispatch({ type: "SET_MODE", payload: mode });
  }, []);

  const setDrawerState = useCallback((drawerState: DetailDrawerState) => {
    dispatch({ type: "SET_DRAWER_STATE", payload: drawerState });
  }, []);

  const setInputValue = useCallback((value: string) => {
    dispatch({ type: "SET_INPUT_VALUE", payload: value });
  }, []);

  const setExtractedUrl = useCallback((url: string | null) => {
    dispatch({ type: "SET_EXTRACTED_URL", payload: url });
  }, []);

  const setMetadata = useCallback((metadata: BookmarkMetadata | null) => {
    dispatch({ type: "SET_METADATA", payload: metadata });
  }, []);

  const setFolderId = useCallback((folderId: number | null) => {
    dispatch({ type: "SET_FOLDER_ID", payload: folderId });
  }, []);

  const setTags = useCallback((tags: string[]) => {
    dispatch({ type: "SET_TAGS", payload: tags });
  }, []);

  const setNotes = useCallback((notes: string) => {
    dispatch({ type: "SET_NOTES", payload: notes });
  }, []);

  const setSubmitting = useCallback((isSubmitting: boolean) => {
    dispatch({ type: "SET_SUBMITTING", payload: isSubmitting });
  }, []);

  const setShowKeyboardHints = useCallback((show: boolean) => {
    dispatch({ type: "SET_KEYBOARD_HINTS", payload: show });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // Composite actions
  const startLoading = useCallback(() => {
    dispatch({ type: "START_LOADING" });
  }, []);

  const showPreview = useCallback((metadata: BookmarkMetadata) => {
    dispatch({ type: "SHOW_PREVIEW", payload: metadata });
  }, []);

  const showSuccess = useCallback((message: string) => {
    dispatch({ type: "SHOW_SUCCESS", payload: message });
  }, []);

  const showError = useCallback((error: string) => {
    dispatch({ type: "SHOW_ERROR", payload: error });
  }, []);

  const openDrawer = useCallback(() => {
    dispatch({ type: "SET_DRAWER_STATE", payload: "opening" });
    // After animation completes
    setTimeout(() => {
      dispatch({ type: "SET_DRAWER_STATE", payload: "open" });
    }, 350);
  }, []);

  const closeDrawer = useCallback(() => {
    dispatch({ type: "SET_DRAWER_STATE", payload: "closing" });
    // After animation completes
    setTimeout(() => {
      dispatch({ type: "SET_DRAWER_STATE", payload: "closed" });
    }, 350);
  }, []);

  // Focus handler - transition from idle to focused
  const handleFocus = useCallback(() => {
    if (state.mode === "idle") {
      dispatch({ type: "SET_MODE", payload: "focused" });
    }
  }, [state.mode]);

  // Blur handler - transition back to idle if no content
  const handleBlur = useCallback(() => {
    if (state.mode === "focused" && !state.inputValue && !state.extractedUrl) {
      dispatch({ type: "SET_MODE", payload: "idle" });
    }
  }, [state.mode, state.inputValue, state.extractedUrl]);

  // Cancel handler - reset everything
  const handleCancel = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // V4.2.21: 使用 useMemo 稳定 actions 对象引用，避免依赖它的组件不必要重渲染
  // 修复：QuickAddSuccess 定时器被不断重置导致成功状态停留过长的问题
  const actions = useMemo(
    () => ({
      setMode,
      setDrawerState,
      setInputValue,
      setExtractedUrl,
      setMetadata,
      setFolderId,
      setTags,
      setNotes,
      setSubmitting,
      setShowKeyboardHints,
      reset,
      startLoading,
      showPreview,
      showSuccess,
      showError,
      openDrawer,
      closeDrawer,
      handleFocus,
      handleBlur,
      handleCancel,
    }),
    [
      setMode,
      setDrawerState,
      setInputValue,
      setExtractedUrl,
      setMetadata,
      setFolderId,
      setTags,
      setNotes,
      setSubmitting,
      setShowKeyboardHints,
      reset,
      startLoading,
      showPreview,
      showSuccess,
      showError,
      openDrawer,
      closeDrawer,
      handleFocus,
      handleBlur,
      handleCancel,
    ],
  );

  return {
    state,
    actions,
  };
}

export type QuickAddActions = ReturnType<typeof useQuickAddState>["actions"];
