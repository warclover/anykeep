/**
 * 导入导出 Tab 切换组件
 * 管理导入/导出/分发/批量管理四个功能区域的切换
 *
 * @description 实现 Tab 懒加载，只有激活的 Tab 才会挂载和加载数据
 */

"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, createContext, useContext } from "react";
import {
  DATA_HUB_TABS,
  DEFAULT_TAB,
  type DataHubTabId,
} from "@/lib/constants/data-hub";

/**
 * Tab 上下文 - 用于子组件获取当前激活的 Tab
 */
const ActiveTabContext = createContext<DataHubTabId>(DEFAULT_TAB);

export function useActiveTab() {
  return useContext(ActiveTabContext);
}

interface DataHubTabsProps {
  children: React.ReactNode;
}

export function DataHubTabs({ children }: DataHubTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = (searchParams?.get("tab") as DataHubTabId) || DEFAULT_TAB;

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("tab", value);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <ActiveTabContext.Provider value={activeTab}>
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4 mb-6">
          {DATA_HUB_TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {children}
      </Tabs>
    </ActiveTabContext.Provider>
  );
}
