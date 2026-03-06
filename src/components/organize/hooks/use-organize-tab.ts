"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DEFAULT_ORGANIZE_TAB,
  isValidOrganizeTabId,
  type OrganizeTabId,
} from "@/lib/constants/organize-tabs";

const TAB_TITLES: Record<
  OrganizeTabId,
  { title: string; description: string }
> = {
  pending: {
    title: "待处理书签",
    description: "这些书签尚未分类到任何文件夹，请查看左侧的智能建议或手动整理",
  },
  unread: {
    title: "未读内容",
    description: "您尚未阅读过的书签，点击书签即可标记为已读",
  },
  "high-value": {
    title: "高价值书签",
    description: "AI 评估的高质量内容，值得深度阅读和学习",
  },
  broken: {
    title: "已失效链接",
    description: "这些链接已无法访问，建议删除或更新 URL",
  },
  recent: {
    title: "最近添加",
    description: "最近 7 天内添加的书签",
  },
  health: {
    title: "健康诊断",
    description: "分析文件夹结构和内容健康度",
  },
};

interface UseOrganizeTabOptions {
  urlTab: string | null;
}

export function useOrganizeTab({ urlTab }: UseOrganizeTabOptions) {
  const defaultTab =
    urlTab && isValidOrganizeTabId(urlTab) ? urlTab : DEFAULT_ORGANIZE_TAB;

  const [activeTab, setActiveTab] = useState<OrganizeTabId>(defaultTab);

  const handleTabChange = useCallback(
    (tab: OrganizeTabId) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
      const newUrl =
        tab === DEFAULT_ORGANIZE_TAB ? "/organize" : `/organize?tab=${tab}`;
      window.history.replaceState(null, "", newUrl);
    },
    [activeTab],
  );

  const currentTabConfig = useMemo(() => TAB_TITLES[activeTab], [activeTab]);

  return { activeTab, handleTabChange, currentTabConfig };
}
