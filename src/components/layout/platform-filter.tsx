/**
 * 平台筛选组件
 * 用于首页顶部导航栏的平台切换
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 平台配置（内容平台 + 浏览器书签统一入口）
const platforms = [
  { id: "all", name: "全部", value: "" },
  { id: "wechat", name: "微信", value: "WECHAT_OFFICIAL_ACCOUNT" },
  { id: "xiaohongshu", name: "小红书", value: "XIAOHONGSHU" },
  { id: "bilibili", name: "B站", value: "BILIBILI" },
  { id: "browser", name: "浏览器书签", value: "browser" },
];

// 本地存储 key
const VIEW_MODE_STORAGE_KEY = "anykeep-view-mode";
const FLIP_CARD_STORAGE_KEY = "anykeep-flip-card";

export function PlatformFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPlatform = searchParams.get("platform") || "";
  const currentFolder = searchParams.get("folder") || "";

  // 检测是否为浏览器书签平台
  const isBrowserPlatform = currentPlatform === "browser";

  // 视图模式（仅用于判断是否显示翻转按钮）
  const [viewMode] = useState<string>(() => {
    if (typeof window === "undefined") return "card";
    return localStorage.getItem(VIEW_MODE_STORAGE_KEY) || "card";
  });
  const [enableFlipCard, setEnableFlipCard] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(FLIP_CARD_STORAGE_KEY) === "true";
  });

  // 仅在首页显示
  const isHomePage = pathname === "/home";

  // 监听来自其他组件的翻转状态变化事件
  useEffect(() => {
    const handleFlipCardChange = (event: CustomEvent<boolean>) => {
      setEnableFlipCard(event.detail);
    };

    window.addEventListener(
      "flipCardChange",
      handleFlipCardChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        "flipCardChange",
        handleFlipCardChange as EventListener,
      );
    };
  }, []);

  // 保存翻转状态到 localStorage
  const handleFlipToggle = () => {
    const newValue = !enableFlipCard;
    setEnableFlipCard(newValue);
    localStorage.setItem(FLIP_CARD_STORAGE_KEY, String(newValue));
    // 触发自定义事件通知其他组件
    window.dispatchEvent(
      new CustomEvent("flipCardChange", { detail: newValue }),
    );
  };

  const handlePlatformChange = (platformValue: string) => {
    const params = new URLSearchParams(searchParams.toString());
    // 切换平台时清除文件夹筛选
    params.delete("folder");
    if (platformValue) {
      params.set("platform", platformValue);
    } else {
      params.delete("platform");
    }
    router.push(`/home?${params.toString()}`);
  };

  // 非首页不显示
  if (!isHomePage) {
    return null;
  }

  // 在虚拟文件夹中不显示平台筛选
  if (currentFolder) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
      {/* 平台筛选标签 */}
      {platforms.map((platform) => {
        const isActive = currentPlatform === platform.value;
        return (
          <button
            key={platform.id}
            onClick={() => handlePlatformChange(platform.value)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap flex-shrink-0",
              isActive
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
            )}
          >
            {platform.name}
          </button>
        );
      })}

      {/* 翻转卡片按钮（仅非浏览器平台 + 卡片视图显示） */}
      {!isBrowserPlatform && viewMode === "card" && (
        <Button
          variant={enableFlipCard ? "default" : "outline"}
          size="sm"
          onClick={handleFlipToggle}
          title="翻转卡片 Demo"
          className={cn(
            "px-2.5 py-1 h-auto text-xs font-medium rounded-full whitespace-nowrap flex-shrink-0",
            enableFlipCard
              ? "bg-purple-500 hover:bg-purple-600 text-white dark:bg-purple-600 dark:hover:bg-purple-700"
              : "border-gray-200 dark:border-gray-700",
          )}
        >
          <RotateCcw className="size-3 mr-1" />
          翻转
        </Button>
      )}
    </div>
  );
}
