"use client";

import { useState, useCallback } from "react";

export function useSettingsNavigation() {
  const [activeGroupId, setActiveGroupId] = useState<string>("account");
  const [mobileSelectedGroup, setMobileSelectedGroup] = useState<string | null>(
    null,
  );

  const handleGroupClick = useCallback((groupId: string) => {
    setActiveGroupId(groupId);
  }, []);

  const handleMobileGroupSelect = useCallback((groupId: string) => {
    setMobileSelectedGroup(groupId);
    setActiveGroupId(groupId);
  }, []);

  const handleMobileBack = useCallback(() => {
    setMobileSelectedGroup(null);
  }, []);

  return {
    activeGroupId,
    mobileSelectedGroup,
    handleGroupClick,
    handleMobileGroupSelect,
    handleMobileBack,
  };
}
