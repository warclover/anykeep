"use client";

import { useState, useCallback } from "react";

export function useExpandableSections() {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isClassificationExpanded, setIsClassificationExpanded] =
    useState(true);
  const [isCustomTagsExpanded, setIsCustomTagsExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  const resetExpanded = useCallback(() => {
    setIsDescriptionExpanded(false);
    setIsClassificationExpanded(true);
    setIsCustomTagsExpanded(false);
    setIsNotesExpanded(false);
  }, []);

  return {
    isDescriptionExpanded,
    setIsDescriptionExpanded,
    isClassificationExpanded,
    setIsClassificationExpanded,
    isCustomTagsExpanded,
    setIsCustomTagsExpanded,
    isNotesExpanded,
    setIsNotesExpanded,
    resetExpanded,
  };
}

export type UseExpandableSectionsReturn = ReturnType<
  typeof useExpandableSections
>;
