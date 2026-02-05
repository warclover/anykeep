# AnyKeep 性能优化方案

> **版本**: v1.0
> **日期**: 2026-02-05
> **目标**: 提升页面加载速度、减少页面切换延迟、改善整体交互体验

---

## 📋 目录

1. [优化总览](#优化总览)
2. [Phase 1: 服务端认证优化](#phase-1-服务端认证优化)
3. [Phase 2: Context 优化](#phase-2-context-优化)
4. [Phase 3: 首页组件重构](#phase-3-首页组件重构)
5. [Phase 4: 其他细节优化](#phase-4-其他细节优化)
6. [测试与验证](#测试与验证)
7. [回滚方案](#回滚方案)

---

## 优化总览

### 问题优先级矩阵

| 问题           | 影响面 | 风险 | 收益 | 优先级 |
| -------------- | ------ | ---- | ---- | ------ |
| 服务端重复认证 | 全局   | 低   | 高   | **P0** |
| Context 重渲染 | 首页   | 中   | 高   | **P1** |
| 首页组件庞大   | 首页   | 高   | 高   | **P2** |
| Provider 嵌套  | 全局   | 低   | 中   | P3     |
| 动态导入       | 首页   | 低   | 中   | P3     |

### 预期收益

| 指标         | 当前   | 目标   | 改善 |
| ------------ | ------ | ------ | ---- |
| 首页 FCP     | ~2.5s  | ~1.5s  | 40%  |
| 页面切换延迟 | ~800ms | ~200ms | 75%  |
| 筛选响应时间 | ~500ms | ~100ms | 80%  |

---

## Phase 1: 服务端认证优化

> **风险等级**: 🟢 低
> **影响页面**: folders, tags, search, analytics 等 50+ 服务端组件页面
> **预期收益**: 节省 500-1000ms/页面

### 问题分析

当前 `folders`、`tags`、`search` 等页面组件都在服务端重复调用 `supabase.auth.getUser()` 进行认证：

```typescript
// 当前代码 (folders/page.tsx:16-27)
const supabase = await createClient();
const {
  data: { user },
  error: userError,
} = await supabase.auth.getUser(); // ⚠️ 重复网络请求

if (userError || !user) {
  redirect("/login");
}
```

而 `home` 页面已经优化为使用 Middleware 预验证的 header：

```typescript
// 优化后代码 (home/page.tsx:50-61)
const headersList = await headers();
const userId = headersList.get("x-user-id");
const isVerified = headersList.get("x-user-verified") === "true";

if (!isVerified || !userId || !UUID_REGEX.test(userId)) {
  return { bookmarks: [], error: "请先登录" };
}
```

### 优化方案

#### 步骤 1: 创建统一的认证辅助函数

**新建文件**: `src/lib/server/auth.ts`

```typescript
/**
 * 服务端认证辅助函数
 * 从 Middleware 预验证的 header 获取用户信息
 * 避免重复调用 supabase.auth.getUser()
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

/** UUID 正则表达式 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 获取当前用户 ID（从 Middleware 预验证 header）
 * @returns 用户 ID，如果未认证则抛出重定向
 */
export async function getAuthenticatedUserId(): Promise<string> {
  const headersList = await headers();
  const userId = headersList.get("x-user-id");
  const isVerified = headersList.get("x-user-verified") === "true";

  // 验证 userId 是否为有效的 UUID 格式（防止 header 注入攻击）
  if (!isVerified || !userId || !UUID_REGEX.test(userId)) {
    redirect("/login");
  }

  return userId;
}

/**
 * 可选地获取用户 ID（不强制登录）
 * @returns 用户 ID 或 null
 */
export async function getOptionalUserId(): Promise<string | null> {
  const headersList = await headers();
  const userId = headersList.get("x-user-id");
  const isVerified = headersList.get("x-user-verified") === "true";

  if (!isVerified || !userId || !UUID_REGEX.test(userId)) {
    return null;
  }

  return userId;
}

/**
 * 类型守卫：检查是否为认证错误
 */
export function isAuthError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("auth") || error.message.includes("登录"))
  );
}
```

#### 步骤 2: 分批次迁移页面组件

**第一批**（低风险）:

- `src/app/(main)/folders/page.tsx`
- `src/app/(main)/tags/page.tsx`
- `src/app/(main)/inbox/page.tsx`

**第二批**（中风险）:

- `src/app/(main)/search/page.tsx`
- `src/app/(main)/analytics/page.tsx`
- `src/app/(main)/batch/page.tsx`

**第三批**（其他所有服务端页面）

#### 步骤 3: 迁移代码示例

**修改前** (`folders/page.tsx`):

```typescript
export default async function FoldersPage() {
  const supabase = await createClient();

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // 获取用户的所有文件夹
  const { data: folders } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", user.id); // ⚠️ 使用 user.id
  // ...
}
```

**修改后**:

```typescript
import { getAuthenticatedUserId } from "@/lib/server/auth";

export default async function FoldersPage() {
  // ✅ 从 header 获取预验证的 userId（无网络请求）
  const userId = await getAuthenticatedUserId();
  const supabase = await createClient();

  // 获取用户的所有文件夹
  const { data: folders } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", userId); // ✅ 直接使用 userId
  // ...
}
```

### 验证清单

- [ ] 页面正常加载
- [ ] 未登录用户重定向到登录页
- [ ] 已登录用户可以正常访问
- [ ] 控制台无认证相关错误

### 回滚方案

如果出现认证问题，恢复原 `getUser()` 调用即可。不影响其他功能。

---

## Phase 2: Context 优化

> **风险等级**: 🟡 中
> **影响组件**: 首页相关 20+ 组件
> **预期收益**: 减少 80% 不必要的组件渲染

### 问题分析

`HomePageContext` 包含 5 个子域、35 个依赖项，任何状态变化都会导致所有使用该 Context 的组件重渲染。

```typescript
// 当前结构 (home-page-context.tsx)
interface HomePageContextType {
  view: ViewModeContextState & ViewModeContextActions; // 7 个依赖
  filter: FilterContextState & FilterContextActions; // 10 个依赖
  dialog: DialogContextState & DialogContextActions; // 3 个依赖
  selection: SelectionContextState & SelectionContextActions; // 3 个依赖
  aiPanel: AIPanelContextState & AIPanelContextActions; // 10 个依赖
}

// 35 个依赖项的 useMemo
const value = useMemo(
  () => ({
    /* ... */
  }),
  [
    viewMode,
    layoutMode,
    enableFlipCard,
    effectiveViewMode,
    setViewMode,
    setLayoutMode,
    setEnableFlipCard,
    platform,
    folder,
    usageTags,
    isBrowserPlatform,
    isTrashFolder,
    setPlatform,
    setFolder,
    setUsageTags,
    openDialogState,
    openDialogAction,
    closeDialog,
    isSelectionMode,
    setSelectionMode,
    toggleSelectionMode,
    isAIPanelOpen,
    isFilterPanelOpen,
    isCreatePanelOpen,
    // ... 还有 15+ 个
  ],
);
```

### 优化方案

#### 方案选择：状态提升 + 选择器模式

**不拆分 Context**（避免大量代码修改），而是：

1. **保持单一 Context**（向后兼容）
2. **添加选择器 Hooks**（按需订阅）
3. **优化 Context value**（减少依赖）

#### 步骤 1: 优化 Context value 依赖

**修改文件**: `src/contexts/home-page-context.tsx`

```typescript
// ========== 核心优化：使用 ref 存储回调函数 ==========

// 1. 使用 ref 存稳定的回调函数（不会因为依赖变化而重新创建）
const viewModeRef = useRef({ viewMode, layoutMode, enableFlipCard });
const filterRef = useRef({ platform, folder, usageTags });

// 2. 在值变化时同步 ref
useEffect(() => {
  viewModeRef.current = { viewMode, layoutMode, enableFlipCard };
}, [viewMode, layoutMode, enableFlipCard]);

useEffect(() => {
  filterRef.current = { platform, folder, usageTags };
}, [platform, folder, usageTags]);

// 3. 回调函数使用 ref 中的值（不再依赖状态）
const setViewMode = useCallback((mode: ViewMode) => {
  setViewModeState(mode);
  localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  uiEventBus.emit(UIEvents.VIEW_MODE_CHANGE, {
    mode,
    // 从 ref 读取当前值，避免依赖
    prevMode: viewModeRef.current.viewMode,
  });
}, []); // ✅ 空依赖数组！

const setPlatform = useCallback((newPlatform: string) => {
  setPlatformState(newPlatform);
  uiEventBus.emit(UIEvents.PLATFORM_CHANGE, {
    platform: newPlatform,
    folder: filterRef.current.folder, // 从 ref 读取
  });
}, []); // ✅ 空依赖数组！

// 4. Context value 只依赖最小状态
const value = useMemo<HomePageContextType>(
  () => ({
    view: {
      viewMode,
      layoutMode,
      enableFlipCard,
      effectiveViewMode,
      setViewMode, // 现在是稳定的引用
      setLayoutMode, // 需要类似优化
      setEnableFlipCard, // 需要类似优化
    },
    filter: {
      platform,
      folder,
      usageTags,
      isBrowserPlatform,
      isTrashFolder,
      setPlatform, // 稳定引用
      setFolder,
      setUsageTags,
    },
    // ... 其他子域
  }),
  [
    // ✅ 只依赖原始状态值，不再依赖回调函数
    viewMode,
    layoutMode,
    enableFlipCard,
    platform,
    folder,
    usageTags,
    // ... 其他原始状态
  ],
);
```

#### 步骤 2: 添加选择器 Hooks（可选）

**新建文件**: `src/contexts/home-page-selectors.ts`

```typescript
/**
 * HomePageContext 选择器 Hooks
 * 允许组件只订阅 Context 中需要的部分，减少不必要的重渲染
 */

import { useContext, useEffect, useState } from "react";
import { HomePageContext } from "./home-page-context";

/**
 * 只订阅视图模式（不响应筛选、对话框等变化）
 */
export function useViewMode() {
  const context = useContext(HomePageContext);
  if (!context) throw new Error("...");

  // 使用 useState + 选择器模式，只追踪需要的值
  const [viewMode, setViewMode] = useState(context.view.viewMode);

  useEffect(() => {
    // 只在视图模式变化时更新
    if (context.view.viewMode !== viewMode) {
      setViewMode(context.view.viewMode);
    }
  }, [context.view.viewMode]);

  return {
    viewMode,
    setViewMode: context.view.setViewMode,
  };
}

/**
 * 只订阅筛选状态
 */
export function useFilter() {
  const context = useContext(HomePageContext);
  if (!context) throw new Error("...");

  const [filter, setFilter] = useState({
    platform: context.filter.platform,
    folder: context.filter.folder,
  });

  useEffect(() => {
    if (
      context.filter.platform !== filter.platform ||
      context.filter.folder !== filter.folder
    ) {
      setFilter({
        platform: context.filter.platform,
        folder: context.filter.folder,
      });
    }
  }, [context.filter.platform, context.filter.folder]);

  return filter;
}
```

#### 步骤 3: 渐进式迁移组件

1. **保持现有组件不变**（使用 `useHomePageContext`）
2. **新组件使用选择器 Hooks**（如 `useViewMode`）
3. **逐步迁移高频重渲染组件**

### 验证清单

- [ ] 首页筛选功能正常
- [ ] 视图模式切换正常
- [ ] 对话框功能正常
- [ ] 选择模式功能正常
- [ ] React DevTools 显示组件重渲染减少

### 回滚方案

删除 `home-page-selectors.ts`，恢复原 `home-page-context.tsx` 即可。

---

## Phase 3: 首页组件重构

> **风险等级**: 🔴 高
> **影响组件**: 首页及其子组件
> **预期收益**: 提升交互响应速度，代码可维护性

### 问题分析

`HomePageClient` 组件包含：

- 1037 行代码
- 25+ useState
- 15+ useEffect
- 10+ useCallback

这违反了单一职责原则，任何状态变化都可能导致整棵组件树重渲染。

### 优化方案：分层架构

#### 目标结构

```
HomePageClient (容器 - 薄包装)
├── HomeDataProvider (数据层)
│   └── SWR hooks + queries
├── HomeStateProvider (状态层)
│   └── 视图模式、对话框、选择模式
├── HomeView (视图层)
│   ├── HomeToolbar (工具栏)
│   ├── HomeContent (内容区)
│   │   ├── VirtualBookmarkGrid
│   │   ├── VirtualBookmarkList
│   │   └── EmptyState
│   └── HomeDialogs (对话框层)
│       ├── CreateDialog
│       ├── ImportDialog
│       └── MoveDialog
```

#### 步骤 1: 提取数据层

**新建文件**: `src/components/home/home-data-provider.tsx`

```typescript
/**
 * 首页数据 Provider
 * 负责所有数据获取和缓存管理
 */

"use client";

import { createContext, useContext, ReactNode } from "react";
import { useBookmarksSWR, useInitData } from "@/lib/cache";
import type { Bookmark } from "@/types/supabase";

interface HomeDataContextValue {
  bookmarks: Bookmark[];
  hasMore: boolean;
  isLoading: boolean;
  error?: string;
  refetch: () => Promise<void>;
  updateCacheItem: (id: number, updates: Partial<Bookmark>) => void;
  removeCacheItem: (id: number) => void;
  appendToCache: (items: Bookmark[], hasMore: boolean) => void;
}

const HomeDataContext = createContext<HomeDataContextValue | null>(null);

export function HomeDataProvider({
  children,
  initialPlatform = "",
  initialFolder = "",
  initialData = [],
}: {
  children: ReactNode;
  initialPlatform?: string;
  initialFolder?: string;
  initialData?: Bookmark[];
}) {
  const {
    data: bookmarks,
    hasMore,
    isLoading,
    error,
    refetch,
    updateCacheItem,
    removeCacheItem,
    appendToCache,
  } = useBookmarksSWR({
    platform: initialPlatform,
    folder: initialFolder,
    initialData,
  });

  return (
    <HomeDataContext.Provider
      value={{
        bookmarks: bookmarks || [],
        hasMore,
        isLoading,
        error,
        refetch,
        updateCacheItem,
        removeCacheItem,
        appendToCache,
      }}
    >
      {children}
    </HomeDataContext.Provider>
  );
}

export function useHomeData() {
  const context = useContext(HomeDataContext);
  if (!context) {
    throw new Error("useHomeData must be used within HomeDataProvider");
  }
  return context;
}
```

#### 步骤 2: 提取状态层

**新建文件**: `src/components/home/home-state-provider.tsx`

```typescript
/**
 * 首页 UI 状态 Provider
 * 负责对话框、选择模式、视图模式等 UI 状态
 */

"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import type { ViewMode, LayoutMode, DialogType } from "@/components/home/types";

interface HomeStateContextValue {
  // 视图模式
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  enableFlipCard: boolean;
  setViewMode: (mode: ViewMode) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setEnableFlipCard: (enabled: boolean) => void;

  // 对话框
  showDialog: (type: DialogType) => void;
  closeDialog: () => void;
  activeDialog: DialogType | null;

  // 选择模式
  isSelectionMode: boolean;
  toggleSelectionMode: () => void;
}

const HomeStateContext = createContext<HomeStateContextValue | null>(null);

export function HomeStateProvider({ children }: { children: ReactNode }) {
  // 视图模式状态
  const [viewMode, setViewModeState] = useState<ViewMode>("card");
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>("auto");
  const [enableFlipCard, setEnableFlipCardState] = useState(false);

  // 对话框状态
  const [activeDialog, setActiveDialog] = useState<DialogType | null>(null);

  // 选择模式状态
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // 状态更新函数（带 localStorage 持久化）
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem("home-view-mode", mode);
  }, []);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
    localStorage.setItem("home-layout-mode", mode);
  }, []);

  const setEnableFlipCard = useCallback((enabled: boolean) => {
    setEnableFlipCardState(enabled);
    localStorage.setItem("home-flip-card", String(enabled));
  }, []);

  const showDialog = useCallback((type: DialogType) => {
    setActiveDialog(type);
  }, []);

  const closeDialog = useCallback(() => {
    setActiveDialog(null);
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => !prev);
  }, []);

  return (
    <HomeStateContext.Provider
      value={{
        viewMode,
        layoutMode,
        enableFlipCard,
        setViewMode,
        setLayoutMode,
        setEnableFlipCard,
        showDialog,
        closeDialog,
        activeDialog,
        isSelectionMode,
        toggleSelectionMode,
      }}
    >
      {children}
    </HomeStateContext.Provider>
  );
}

export function useHomeState() {
  const context = useContext(HomeStateContext);
  if (!context) {
    throw new Error("useHomeState must be used within HomeStateProvider");
  }
  return context;
}
```

#### 步骤 3: 重构容器组件

**修改文件**: `src/components/home/home-page-client.tsx`

```typescript
/**
 * 首页客户端组件（重构版）
 * 职责：组合数据层和状态层，渲染视图
 */

"use client";

import { HomePageClientProps } from "./types";
import { HomeDataProvider } from "./home-data-provider";
import { HomeStateProvider } from "./home-state-provider";
import { HomeView } from "./home-view";

export function HomePageClient(props: HomePageClientProps) {
  const { initialBookmarks, error, urlFolder, urlPlatform } = props;

  return (
    <HomeDataProvider
      initialPlatform={urlPlatform || ""}
      initialFolder={urlFolder || ""}
      initialData={initialBookmarks}
    >
      <HomeStateProvider>
        <HomeView initialError={error} />
      </HomeStateProvider>
    </HomeDataProvider>
  );
}
```

### 实施策略

**阶段 1**（低风险）:

1. 创建 `home-data-provider.tsx`
2. 创建 `home-state-provider.tsx`
3. 创建 `home-view.tsx`

**阶段 2**（验证）:

1. 在测试环境验证
2. 功能回归测试
3. 性能对比测试

**阶段 3**（上线）:

1. 灰度发布
2. 监控错误率
3. 全量发布

### 验证清单

- [ ] 所有首页功能正常
- [ ] 对话框功能正常
- [ ] 筛选功能正常
- [ ] 批量操作功能正常
- [ ] 虚拟滚动正常

### 回滚方案

保留原 `home-page-client.tsx` 为 `home-page-client.legacy.tsx`，上线时通过 Feature Flag 切换。

---

## Phase 4: 其他细节优化

### 4.1 动态导入优化

**问题**: `{ ssr: false }` 的动态导入组件在客户端导航时重新加载

**修改**: `src/app/(main)/layout.tsx`

```typescript
// 当前代码
const LayoutAIPanel = dynamic(
  () =>
    import("@/components/layout/layout-ai-panel").then((m) => m.LayoutAIPanel),
  { ssr: false },
);

// 优化后：移除 ssr: false，让 Next.js 自动处理
const LayoutAIPanel = dynamic(
  () =>
    import("@/components/layout/layout-ai-panel").then((m) => m.LayoutAIPanel),
  // 不设置 ssr: false，默认为 true
);
```

### 4.2 侧边栏子组件 memo

**修改**: `src/components/layout/app-sidebar.tsx`

```typescript
// 提取 NavItem 为独立组件并使用 memo
const NavItem = memo(function NavItem({
  item,
  groupColor,
  isNested,
  isActive,
  isVisuallyExpanded,
  onClick,
}: NavItemProps) {
  // ...
});

// 在渲染时使用
{contentCenterItems.map(item => (
  <NavItem
    key={item.name}
    item={item}
    groupColor={groupCandyColors.content}
    isNested={false}
    isActive={isLinkActive(item.href, item.pageId)}
    isVisuallyExpanded={isVisuallyExpanded}
    onClick={(e) => handleNavClick(item.pageId, e)}
  />
))}
```

### 4.3 国际化 Hook 缓存

**新建文件**: `src/lib/i18n/cache.tsx`

```typescript
/**
 * 国际化缓存优化
 * 避免每次调用都重新计算翻译结果
 */

import { useMemo, useRef } from "react";

const translationCache = new Map<string, Record<string, unknown>>();

export function useUiTextMemo() {
  const t = useUiText();

  // 缓存翻译结果
  const getCachedTranslation = useMemo(() => {
    return (key: string): string => {
      if (translationCache.has(key)) {
        return translationCache.get(key)![key] as string;
      }

      const parts = key.split(".");
      let value: unknown = t;
      for (const part of parts) {
        value = (value as Record<string, unknown>)?.[part];
      }

      const result = (value as string) || key;
      translationCache.set(key, { [key]: result });
      return result;
    };
  }, [t]);

  return { t: getCachedTranslation };
}
```

---

## 测试与验证

### 功能测试清单

| 功能模块 | 测试项         | 状态 |
| -------- | -------------- | ---- |
| 认证     | 未登录重定向   | [ ]  |
| 认证     | 已登录正常访问 | [ ]  |
| 首页     | 数据加载       | [ ]  |
| 首页     | 平台筛选       | [ ]  |
| 首页     | 文件夹筛选     | [ ]  |
| 首页     | 视图模式切换   | [ ]  |
| 首页     | 卡片翻转       | [ ]  |
| 首页     | 批量操作       | [ ]  |
| 首页     | 对话框         | [ ]  |
| 导航     | 页面切换       | [ ]  |
| 导航     | 浏览器前进后退 | [ ]  |

### 性能测试清单

| 指标       | 测试方法                   | 目标     | 实际 |
| ---------- | -------------------------- | -------- | ---- |
| 首页 FCP   | Chrome DevTools Lighthouse | <1.5s    | -    |
| 首页 LCP   | Chrome DevTools Lighthouse | <2.5s    | -    |
| 页面切换   | 手动测试 + console.time    | <200ms   | -    |
| 筛选响应   | 手动测试 + console.time    | <100ms   | -    |
| 组件重渲染 | React DevTools Profiler    | 减少 50% | -    |

### 回归测试命令

```bash
# 类型检查
npm run type-check

# 代码检查
npm run lint

# 单元测试
npm run test

# E2E 测试（如果有）
npm run test:e2e
```

---

## 回滚方案

### Feature Flag 控制

在 `src/lib/feature-flags.ts` 中添加开关：

```typescript
export const PERF_FLAGS = {
  // Phase 1: 服务端认证优化
  useHeaderAuth: true,

  // Phase 2: Context 优化
  useRefCallbacks: true,

  // Phase 3: 首页组件重构
  useLayeredHome: false, // 默认关闭，验证后开启
} as const;
```

### 回滚步骤

1. **Phase 3 回滚**: 设置 `useLayeredHome: false`
2. **Phase 2 回滚**: 设置 `useRefCallbacks: false`
3. **Phase 1 回滚**: 设置 `useHeaderAuth: false`（通常不需要）

---

## 实施时间表

| 阶段       | 工作量 | 预计时间  | 风险 |
| ---------- | ------ | --------- | ---- |
| Phase 1    | 2-3 天 | 第 1 周   | 低   |
| Phase 2    | 3-5 天 | 第 2 周   | 中   |
| Phase 3    | 5-7 天 | 第 3-4 周 | 高   |
| Phase 4    | 2-3 天 | 第 4 周   | 低   |
| 测试与验证 | 3-5 天 | 第 5 周   | -    |
| **总计**   | -      | **5 周**  | -    |

---

## 附录

### A. 相关文件清单

**Phase 1**:

- 新建: `src/lib/server/auth.ts`
- 修改: `src/app/(main)/folders/page.tsx`
- 修改: `src/app/(main)/tags/page.tsx`
- 修改: 其他 50+ 服务端页面组件

**Phase 2**:

- 新建: `src/contexts/home-page-selectors.ts`（可选）
- 修改: `src/contexts/home-page-context.tsx`

**Phase 3**:

- 新建: `src/components/home/home-data-provider.tsx`
- 新建: `src/components/home/home-state-provider.tsx`
- 新建: `src/components/home/home-view.tsx`
- 修改: `src/components/home/home-page-client.tsx`

**Phase 4**:

- 修改: `src/app/(main)/layout.tsx`
- 修改: `src/components/layout/app-sidebar.tsx`

### B. 性能监控代码

```typescript
// 添加到首页组件
useEffect(() => {
  performance.mark("home-page-start");

  return () => {
    performance.mark("home-page-end");
    performance.measure("home-page-render", "home-page-start", "home-page-end");

    const measure = performance.getEntriesByName("home-page-render")[0];
    console.log(`[Perf] 首页渲染时间: ${measure.duration.toFixed(2)}ms`);
  };
}, []);
```

---

**文档版本**: v1.0
**最后更新**: 2026-02-05
