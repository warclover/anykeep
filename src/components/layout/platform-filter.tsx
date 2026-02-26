/**
 * V4.2.31: 平台筛选组件
 *
 * Phase 3.2 - 迁移到 HomePageContext
 * 性能优化：外链平台使用 Link prefetch 预加载
 * V4.2.31: 选中状态使用糖果色风格（各平台品牌色）
 *
 * 用于首页顶部导航栏的平台切换
 * 优先使用 Context，Fallback 到 Window Event（兼容非首页场景）
 */

"use client";

import { useState, useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSafeNavigation } from "@/contexts/navigation-context";
import { useHomePageSafe } from "@/contexts/home-page-context";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";

/**
 * 平台糖果色配置
 * V4.2.31: 选中状态使用各平台品牌色的糖果色风格
 *
 * 糖果色特点：浅色背景 + 品牌色文字，视觉轻盈活泼
 */
const platformCandyColors: Record<string, { active: string; hover: string }> = {
  // 全部：中性灰色
  all: {
    active: "bg-gray-900 text-white dark:bg-white dark:text-gray-900",
    hover: "hover:bg-gray-200 dark:hover:bg-gray-700",
  },
  // 微信：绿色 #07C160
  wechat: {
    active: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
    hover: "hover:bg-green-100 dark:hover:bg-green-900",
  },
  // 小红书：红色 #FE2C55
  xiaohongshu: {
    active: "bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400",
    hover: "hover:bg-red-100 dark:hover:bg-red-900",
  },
  // B站：蓝色 #00AEEC（B站品牌蓝）
  bilibili: {
    active: "bg-sky-50 text-sky-500 dark:bg-sky-950 dark:text-sky-400",
    hover: "hover:bg-sky-100 dark:hover:bg-sky-900",
  },
  // 浏览器：紫色（区别于内容平台）
  browser: {
    active:
      "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    hover: "hover:bg-purple-100 dark:hover:bg-purple-900",
  },
  // 笔记：橙色
  md: {
    active:
      "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    hover: "hover:bg-orange-100 dark:hover:bg-orange-900",
  },
};

// 平台配置（内容平台 + 浏览器书签统一入口 + MD文档入口）
const platforms = [
  { id: "all", name: "全部", value: "", href: null },
  { id: "wechat", name: "微信", value: "WECHAT_OFFICIAL_ACCOUNT", href: null },
  { id: "xiaohongshu", name: "小红书", value: "XIAOHONGSHU", href: null },
  { id: "bilibili", name: "B站", value: "BILIBILI", href: null },
  { id: "browser", name: "浏览器", value: "browser", href: null },
  { id: "md", name: "笔记", value: "md", href: "/md-collections" },
];

// 本地存储 key（Fallback 使用）
const VIEW_MODE_STORAGE_KEY = "anykeep-view-mode";
const FLIP_CARD_STORAGE_KEY = "anykeep-flip-card";

export function PlatformFilter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Phase 3.2: 尝试获取 HomePageContext（安全版本，不抛错）
  const homeContext = useHomePageSafe();

  // 获取导航上下文（支持客户端导航模式）
  const navigationContext = useSafeNavigation();
  const { activePage, isClientNavEnabled } = navigationContext || {
    activePage: null,
    isClientNavEnabled: false,
  };

  // 从 URL 读取初始值（Fallback）
  const urlPlatform = searchParams?.get("platform") || "";
  const urlFolder = searchParams?.get("folder") || "";

  // Fallback 本地状态（仅在无 Context 时使用）
  const [localPlatform, setLocalPlatform] = useState(urlPlatform);
  const [localFolder, setLocalFolder] = useState(urlFolder);
  const [localViewMode] = useState<string>(() => {
    if (typeof window === "undefined") return "card";
    return localStorage.getItem(VIEW_MODE_STORAGE_KEY) || "card";
  });
  const [localEnableFlipCard, setLocalEnableFlipCard] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(FLIP_CARD_STORAGE_KEY) === "true";
  });

  // 当前使用的值：优先从 Context 读取，Fallback 到本地状态
  const currentPlatform = homeContext?.filter.platform ?? localPlatform;
  const currentFolder = homeContext?.filter.folder ?? localFolder;
  const viewMode = homeContext?.view.viewMode ?? localViewMode;
  const enableFlipCard =
    homeContext?.view.enableFlipCard ?? localEnableFlipCard;

  // 检测是否为浏览器书签平台
  const isBrowserPlatform = currentPlatform === "browser";

  // 判断是否在首页
  const isHomePage = isClientNavEnabled
    ? activePage === "home"
    : pathname === "/home";

  // Fallback: 监听来自其他组件的翻转状态变化事件（仅无 Context 时需要）
  useEffect(() => {
    // 如果有 Context，不需要事件监听（Context 已处理同步）
    if (homeContext) return;

    const unsubscribe = uiEventBus.on(UIEvents.FLIP_CARD_CHANGE, (payload) => {
      setLocalEnableFlipCard(payload.enabled);
    });

    return unsubscribe;
  }, [homeContext]);

  /**
   * 切换翻转卡片状态
   * 优先使用 Context，Fallback 到 UIEventBus
   */
  const handleFlipToggle = () => {
    const newValue = !enableFlipCard;

    if (homeContext) {
      // Phase 3.2: 使用 Context
      homeContext.view.setEnableFlipCard(newValue);
    } else {
      // Fallback: UIEventBus（内置 Legacy Bridge 保持兼容）
      setLocalEnableFlipCard(newValue);
      localStorage.setItem(FLIP_CARD_STORAGE_KEY, String(newValue));
      uiEventBus.emit(UIEvents.FLIP_CARD_CHANGE, { enabled: newValue });
    }
  };

  /**
   * 切换平台
   * 优先使用 Context，Fallback 到 UIEventBus
   */
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

    if (homeContext) {
      // Phase 3.2: 使用 Context
      homeContext.filter.setPlatform(platformValue);
      homeContext.filter.setFolder(""); // 切换平台时清除文件夹
    } else {
      // Fallback: UIEventBus（内置 Legacy Bridge 保持兼容）
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

      // 3. 触发事件通知 HomePageClient 平台已变化
      uiEventBus.emit(UIEvents.PLATFORM_CHANGE, {
        platform: platformValue,
        folder: "",
      });
    }
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

        // V4.2.31: 使用糖果色配置
        const candyColor =
          platformCandyColors[platform.id] || platformCandyColors.all;

        const buttonClassName = cn(
          "px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap flex-shrink-0",
          isActive
            ? candyColor.active
            : cn(
                "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                candyColor.hover,
              ),
        );

        // 外链平台使用 Link 组件实现预加载（进入视口时触发）
        if (platform.href) {
          return (
            <Link
              key={platform.id}
              href={platform.href}
              prefetch={true}
              className={buttonClassName}
            >
              {platform.name}
            </Link>
          );
        }

        // 普通平台切换使用 button
        return (
          <button
            key={platform.id}
            onClick={() => handlePlatformChange(platform.value, platform.href)}
            className={buttonClassName}
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
            "px-3 py-1.5 h-auto text-sm font-medium rounded-full whitespace-nowrap flex-shrink-0",
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
