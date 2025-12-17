/**
 * 平台筛选组件
 * 用于首页顶部导航栏的平台切换
 *
 * 支持客户端导航（Keep-Alive）模式：
 * - 使用 NavigationContext 判断当前页面
 * - 同时兼容传统 SSR 导航模式
 */

"use client";

import { useState, useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSafeNavigation } from "@/contexts/navigation-context";

// 平台配置（内容平台 + 浏览器书签统一入口 + MD文档入口）
const platforms = [
  { id: "all", name: "全部", value: "", href: null },
  { id: "wechat", name: "微信", value: "WECHAT_OFFICIAL_ACCOUNT", href: null },
  { id: "xiaohongshu", name: "小红书", value: "XIAOHONGSHU", href: null },
  { id: "bilibili", name: "B站", value: "BILIBILI", href: null },
  { id: "browser", name: "浏览器书签", value: "browser", href: null },
  { id: "md", name: "MD文档", value: "md", href: "/md-collections" },
];

// 本地存储 key
const VIEW_MODE_STORAGE_KEY = "anykeep-view-mode";
const FLIP_CARD_STORAGE_KEY = "anykeep-flip-card";

export function PlatformFilter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // 获取导航上下文（支持客户端导航模式）
  const navigationContext = useSafeNavigation();
  const { activePage, isClientNavEnabled } = navigationContext || {
    activePage: null,
    isClientNavEnabled: false,
  };

  // 从 URL 读取初始值
  const urlPlatform = searchParams?.get("platform") || "";
  const urlFolder = searchParams?.get("folder") || "";

  // 本地状态管理当前平台（支持客户端即时切换）
  const [localPlatform, setLocalPlatform] = useState(urlPlatform);
  const [localFolder, setLocalFolder] = useState(urlFolder);

  // 当前使用的值（优先本地状态）
  const currentPlatform = localPlatform;
  const currentFolder = localFolder;

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

  // 判断是否在首页：
  // - 客户端导航模式：使用 NavigationContext.activePage
  // - 传统 SSR 模式：使用 pathname
  const isHomePage = isClientNavEnabled
    ? activePage === "home"
    : pathname === "/home";

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

  const handlePlatformChange = (platformValue: string, href: string | null) => {
    // 如果有独立页面跳转链接，直接导航
    if (href) {
      router.push(href);
      return;
    }

    // 如果平台未变化，不做任何操作
    if (platformValue === currentPlatform) {
      return;
    }

    // 1. 立即更新本地状态（UI 即时响应）
    setLocalPlatform(platformValue);
    setLocalFolder(""); // 切换平台时清除文件夹

    // 2. 更新 URL（用于书签和分享）
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("folder");
    if (platformValue) {
      params.set("platform", platformValue);
    } else {
      params.delete("platform");
    }
    const newUrl = `/home?${params.toString()}`;
    window.history.replaceState(
      { ...window.history.state, as: newUrl, url: newUrl },
      "",
      newUrl,
    );

    // 3. 触发自定义事件通知 HomePageClient 平台已变化
    window.dispatchEvent(
      new CustomEvent("platformChange", {
        detail: { platform: platformValue, folder: "" },
      }),
    );
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
        // 对于外链平台，永远不高亮
        const isActive = platform.href
          ? false
          : currentPlatform === platform.value;
        return (
          <button
            key={platform.id}
            onClick={() => handlePlatformChange(platform.value, platform.href)}
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
