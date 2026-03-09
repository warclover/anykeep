# 首页性能优化 - 可落地方案 Phase 1

> **版本**: 1.0.0
> **创建日期**: 2026-03-05
> **基于文档**: `前端性能优化方案-主页面响应与卡顿.md`
> **预计工期**: 3-5 个工作日

---

## 一、方案概览

### 1.1 问题优先级矩阵

| 优先级   | 问题                         | 影响范围      | 实施难度 | ROI        |
| -------- | ---------------------------- | ------------- | -------- | ---------- |
| **P0-1** | RSC 并行请求 + force-dynamic | 首屏 TTFB/LCP | 低       | ⭐⭐⭐⭐⭐ |
| **P0-2** | HomeView Context 订阅过多    | 筛选/排序卡顿 | 中       | ⭐⭐⭐⭐⭐ |
| **P0-3** | Virtuoso 回调引用不稳定      | 滚动/选择卡顿 | 低       | ⭐⭐⭐⭐   |
| **P1-1** | 轮询触发整列表 mutate        | 后台持续开销  | 中       | ⭐⭐⭐     |
| **P1-2** | refetchInterval 角标更新     | Header 重渲染 | 低       | ⭐⭐⭐     |

### 1.2 本次优化目标

- **首屏 LCP**: 降低 30%+（目标 < 2.5s）
- **筛选/排序响应**: 消除明显卡顿（目标 < 100ms）
- **滚动帧率**: 稳定 60fps
- **后台 CPU 占用**: 降低 50%

---

## 二、P0-1：RSC 并行请求优化

### 2.1 现状分析

**文件**: [src/app/(main)/home/page.tsx](<src/app/(main)/home/page.tsx>)

```tsx
// 当前：串行执行
async function HomePageWithData({ platform, sort, folder }) {
  const { bookmarks, error } = await getInitialBookmarks(...);  // 等待
  const userSettings = await getUserSettings();                 // 再等待
  // ...
}
```

**问题**：

- `getInitialBookmarks` 平均耗时 200-500ms
- `getUserSettings` 平均耗时 50-100ms
- 串行执行总耗时 = 两者之和

### 2.2 优��方案

#### 方案 A：并行请求（推荐，改动最小）

```tsx
// 优化后：并行执行
async function HomePageWithData({ platform, sort, folder }) {
  const [bookmarksResult, userSettings] = await Promise.all([
    getInitialBookmarks(platform, sort, folder),
    getUserSettings(),
  ]);

  return (
    <HomePageClientLayered
      initialBookmarks={bookmarksResult.bookmarks}
      error={bookmarksResult.error}
      userSettings={userSettings}
    />
  );
}
```

**预期收益**：TTFB 降低 50-150ms

#### 方案 B：放宽 dynamic 配置（可选，后续迭代）

```tsx
// 当前
export const dynamic = "force-dynamic";

// 优化后：按用户短时缓存
export const revalidate = 30; // 30 秒缓存
// 或按需验证
export const dynamic = "force-dynamic";
export const revalidate = false;
```

⚠️ **注意**：需确保用户级数据不被 CDN 缓存，仅在内存中按 session 隔离。

### 2.3 实施步骤

| 步骤 | 内容                                       | 预计时间 |
| ---- | ------------------------------------------ | -------- |
| 1    | 修改 `HomePageWithData` 使用 `Promise.all` | 10min    |
| 2    | 本地测试验证数据正确性                     | 15min    |
| 3    | 使用 React DevTools Profiler 验证渲染时间  | 15min    |

### 2.4 验收标准

- [ ] 首屏 TTFB 降低 50ms+
- [ ] React DevTools Profiler 显示 RSC 执行时间减少
- [ ] 现有功能无回归

---

## 三、P0-2：HomeView Context 订阅拆分

### 3.1 现状分析

**文件**: [src/components/home/home-view.tsx](src/components/home/home-view.tsx)

```tsx
// 当前：一次性消费整个 Context
const homeContext = useHomePageContext(); // 包含 filter, dialog, selection 等
```

**问题**：

- `homeContext` 包含 5 个子 Context 的聚合
- 任一子状态变化 → `homeContext` 引用变化 → `HomeView` 重渲染
- `HomeView` 重渲染 → 传递给子组件的 props 重新计算 → 子树重渲染

### 3.2 优化方案

#### 方案 A：细粒度订阅（推荐）

**原则**：每个组件只订阅它需要的状态

```tsx
// 优化前
import { useHomePageContext } from "@/contexts/home-page-context";
const homeContext = useHomePageContext();
const platform = homeContext.filter.platform;

// 优化后
import { useFilter, useDialog } from "@/contexts/home-page";
const { platform, folder, isBrowserPlatform } = useFilter();
const { openDialog } = useDialog();
```

**具体改造**：

1. **HomeView 组件改造**

```tsx
// home-view.tsx
import { useFilter, useSelection, useDialog } from "@/contexts/home-page";

export function HomeView({ initialError, userSettings }: HomeViewProps) {
  // 只订阅需要的细粒度状态
  const { platform, folder, isBrowserPlatform, isTrashFolder } = useFilter();
  const { isSelectionMode, selectedIds } = useSelection();
  const { openDialog } = useDialog();

  // 不再订阅整个 homeContext
  // const homeContext = useHomePageContext(); // 删除
}
```

2. **子组件进一步拆分**

```tsx
// home-toolbar.tsx - 只订阅工具栏需要的状态
import { useViewMode, useFilter, useSelection } from "@/contexts/home-page";

export function HomeToolbar() {
  const { viewMode, setViewMode } = useViewMode();
  const { platform } = useFilter();
  // 不订阅 selection，因为工具栏不需要
}
```

3. **列表组件独立化**

```tsx
// 创建 home-bookmark-list-container.tsx
// 此组件只订阅 bookmarks 数据，不订阅 Context

const HomeBookmarkListContainer = memo(function HomeBookmarkListContainer({
  bookmarks,
  hasMore,
  onLoadMore,
  // 其他稳定 props
}: ListProps) {
  // 不使用任何 Context，纯 props 驱动
  return <VirtualBookmarkGrid bookmarks={bookmarks} ... />;
});
```

### 3.3 实施步骤

| 步骤 | 内容                                           | 预计时间 |
| ---- | ---------------------------------------------- | -------- |
| 1    | 创建 `home-bookmark-list-container.tsx` 纯组件 | 30min    |
| 2    | 改造 `HomeView` 使用细粒度订阅                 | 45min    |
| 3    | 改造 `HomeToolbar` 使用细粒度订阅              | 30min    |
| 4    | 改造 `HomeContent` 移除不必要的 Context 订阅   | 30min    |
| 5    | 测试验证所有功能正常                           | 30min    |
| 6    | 使用 React Profiler 验证重渲染减少             | 30min    |

### 3.4 验收标准

- [ ] 切换 platform/folder 时，仅 Filter 相关组件重渲染
- [ ] 切换视图模式时，仅 ViewMode 相关组件重渲染
- [ ] React DevTools 显示 HomeView 重渲染次数减少 50%+

---

## 四、P0-3：Virtuoso 回调稳定性优化

### 4.1 现状分析

**文件**: [src/components/bookmark/virtual-bookmark-grid.tsx](src/components/bookmark/virtual-bookmark-grid.tsx)

```tsx
// 当前：renderItem 依赖项过多
const renderItem = useCallback(
  (_index: number, bookmark: BookmarkWithFolder) => (
    <GridBookmarkItem
      enableFlipCard={enableFlipCard}
      onEdit={onEdit}
      onDelete={onDelete}
      // ... 8 个依赖项
    />
  ),
  [
    enableFlipCard,
    onEdit,
    onDelete,
    onToggleRead,
    onToggleStarred,
    isSelectionMode,
    onToggleSelect,
    customUsageTags,
  ],
);
```

**问题**：

- 任一回调变化 → `renderItem` 引用变化 → Virtuoso 认为 props 变化
- `selectedIds` 使用 ref 访问（已优化），但回调仍需进一步稳定

### 4.2 优化方案

#### 方案 A：进一步减少 renderItem 依赖（推荐）

```tsx
// 使用 ref 存储所有回调，renderItem 不依赖任何回调
const callbacksRef = useRef({
  onEdit,
  onDelete,
  onToggleRead,
  onToggleStarred,
  onToggleSelect,
});

// 每次 render 更新 ref
callbacksRef.current = {
  onEdit,
  onDelete,
  onToggleRead,
  onToggleStarred,
  onToggleSelect,
};

// renderItem 只依赖 enableFlipCard 和 isSelectionMode
// 这些是"配置项"而非"回调"，变化频率更低
const renderItem = useCallback(
  (_index: number, bookmark: BookmarkWithFolder) => (
    <GridBookmarkItem
      bookmark={bookmark}
      enableFlipCard={enableFlipCard}
      isSelectionMode={isSelectionMode}
      isSelected={selectedIdsRef.current.has(bookmark.id)}
      customUsageTags={customUsageTags}
      // 回调通过 ref 访问，不作为依赖
      onEdit={(id) => callbacksRef.current.onEdit?.(id)}
      onDelete={(id) => callbacksRef.current.onDelete?.(id)}
      onToggleRead={(id, isRead) =>
        callbacksRef.current.onToggleRead?.(id, isRead)
      }
      onToggleStarred={(id, isStarred) =>
        callbacksRef.current.onToggleStarred?.(id, isStarred)
      }
      onToggleSelect={(id) => callbacksRef.current.onToggleSelect?.(id)}
    />
  ),
  [enableFlipCard, isSelectionMode, customUsageTags], // 从 8 个减少到 3 个
);
```

#### 方案 B：itemContent 拆分为独立组件（备选）

```tsx
// 将 itemContent 逻辑移到独立组件，使用 memo + props 比较
const VirtuosoItemWrapper = memo(
  function VirtuosoItemWrapper({
    bookmark,
    enableFlipCard,
    isSelectionMode,
    isSelected,
    callbacks, // 稳定引用
  }: ItemWrapperProps) {
    return (
      <GridBookmarkItem
        bookmark={bookmark}
        enableFlipCard={enableFlipCard}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        {...callbacks}
      />
    );
  },
  (prev, next) => {
    // 自定义比较：只有 bookmark 变化或选中状态变化才重渲染
    return (
      prev.bookmark.id === next.bookmark.id &&
      prev.isSelected === next.isSelected &&
      prev.enableFlipCard === next.enableFlipCard &&
      prev.isSelectionMode === next.isSelectionMode
    );
  },
);
```

### 4.3 实施步骤

| 步骤 | 内容                                       | 预计时间 |
| ---- | ------------------------------------------ | -------- |
| 1    | 在 `virtual-bookmark-grid.tsx` 实现方案 A  | 30min    |
| 2    | 同步修改 `virtual-bookmark-list.tsx`       | 20min    |
| 3    | 同步修改 `virtual-trash-bookmark-grid.tsx` | 20min    |
| 4    | 测试滚动、选择、删除等操作                 | 20min    |

### 4.4 验收标��

- [ ] 滚动时帧率稳定 60fps
- [ ] 单选/多选时仅受影响卡片重渲染
- [ ] React Profiler 显示 Virtuoso 内部重渲染减少

---

## 五、P1-1：轮询优化

### 5.1 现状分析

**文件**:

- [src/hooks/ui/use-processing-poller.ts](src/hooks/ui/use-processing-poller.ts)
- [src/components/home/providers/home-data-provider.tsx](src/components/home/providers/home-data-provider.tsx)

```tsx
// 当前：轮询更新触发整个列表 mutate
const handleProcessingUpdate = useCallback(
  (updatedBookmark: Bookmark) => {
    mutate((prev = []) =>
      prev.map((b) => (b.id === updatedBookmark.id ? updatedBookmark : b)),
    );
  },
  [mutate],
);
```

**问题**：

- 每 3 秒轮询一次 PROCESSING 状态的书签
- 每次更新调用 `mutate` → 整个 bookmarks 数组引用变化
- 虽然已使用 `prev.map` 保持旧引用，但顶层数组仍是新引用

### 5.2 优化方案

#### 方案 A：单条更新而非数组替换（推荐）

```tsx
// home-data-provider.tsx
const handleProcessingUpdate = useCallback(
  (updatedBookmark: Bookmark) => {
    // 使用 updateCacheItem 而非 mutate
    // updateCacheItem 内部已做 immutable 更新，仅更新单条
    updateCacheItem(updatedBookmark.id, () => updatedBookmark);
  },
  [updateCacheItem],
);
```

**前提**：确认 `updateCacheItem` 实现正确（不触发整数组引用变化）

#### 方案 B：延长轮询间隔（辅助）

```tsx
// use-processing-poller.ts
const POLL_INTERVAL = 5000; // 从 3s 增加到 5s
```

**权衡**：处理完成的通知延迟增加 2 秒，但降低后台 CPU 占用

#### 方案 C：使用 SWR 的 mutate 单条更新（进阶）

```tsx
// 如果使用 SWR，可以利用其细粒度更新能力
import { mutate } from "swr";

// 单条更新，不影响其他数据
mutate(`/api/bookmarks/${id}`, updatedBookmark, false);
```

### 5.3 实施步骤

| 步骤 | 内容                                                 | 预计时间 |
| ---- | ---------------------------------------------------- | -------- |
| 1    | 验证 `updateCacheItem` 实现是否正确                  | 15min    |
| 2    | 修改 `handleProcessingUpdate` 使用 `updateCacheItem` | 15min    |
| 3    | 将轮询间隔从 3s 调整为 5s（可选）                    | 5min     |
| 4    | 测试新建收藏后的自动更新流程                         | 20min    |

### 5.4 验收标准

- [ ] 新建收藏后，卡片状态正常更新
- [ ] 轮询更新时，其他卡片不重渲染（React Profiler 验证）
- [ ] 页面后台时 CPU 占用降低

---

## 六、P1-2：refetchInterval 角标优化

### 6.1 现状分析

**相关文件**:

- [src/hooks/data/use-inbox-counts.ts](src/hooks/data/use-inbox-counts.ts) - 30s 轮询
- [src/hooks/data/use-organize-counts.ts](src/hooks/data/use-organize-counts.ts)
- [src/hooks/domain/notification/use-notification-count.ts](src/hooks/domain/notification/use-notification-count.ts)

**问题**：

- 多个 hooks 使用 `refetchInterval`
- 角标更新可能触发 Header 重渲染
- Header 重渲染可能传递新 props 到子组件

### 6.2 优化方案

#### 方案 A：角标数据独立化（推荐）

```tsx
// 确保角标 hooks 不与首页数据共享 Context
// 使用独立的 Query Key 和缓存

// use-inbox-counts.ts - 已独立，无需改动
const { data } = useQuery({
  queryKey: inboxKeys.counts(), // 独立 key
  // ...
});
```

#### 方案 B：延长刷新间隔

```tsx
// 从 30s 增加到 60s
const REFETCH_INTERVAL = 60 * 1000;
```

#### 方案 C：合并多个计数请求（进阶）

```tsx
// 创建统一的计数查询，减少请求次数
const { data: allCounts } = useQuery({
  queryKey: ["all-counts"],
  queryFn: fetchAllCounts, // 一次请求返回所有计数
  refetchInterval: 60 * 1000,
});
```

### 6.3 实施步骤

| 步骤 | 内容                             | 预计时间 |
| ---- | -------------------------------- | -------- |
| 1    | 检查 Header 组件订阅的 Context   | 15min    |
| 2    | 确保角标数据不触发 Header 重渲染 | 30min    |
| 3    | 调整 refetchInterval 间隔        | 10min    |
| 4    | 测试角标更新流程                 | 15min    |

### 6.4 验收标准

- [ ] 角标更新时，Header 不重渲染（React Profiler 验证）
- [ ] 角标功能正常

---

## 七、实施计划

### 7.1 分阶段执行

```
┌────────────────────────────────────────────────────────────────┐
│  Phase 1 (Day 1-2): P0-1 + P0-3                                │
│  ├── RSC 并行请求                                               │
│  └── Virtuoso 回调稳定性                                        │
│  预期收益：首屏 LCP 降低 30%                                     │
├────────────────────────────────────────────────────────────────┤
│  Phase 2 (Day 2-3): P0-2                                        │
│  └── HomeView Context 订阅拆分                                  │
│  预期收益：筛选/排序响应提升 50%                                  │
├────────────────────────────────────────────────────────────────┤
│  Phase 3 (Day 3-4): P1-1 + P1-2                                │
│  ├── 轮询单条更新                                               │
│  └── 角标刷新间隔调整                                            │
│  预期收益：后台 CPU 占用降低 50%                                  │
├────────────────────────────────────────────────────────────────┤
│  Phase 4 (Day 4-5): 验收与文档                                  │
│  ├── 性能指标收集                                               │
│  ├── 回归测试                                                   │
│  └── 文档更新                                                   │
└────────────────────────────────────────────────────────────────┘
```

### 7.2 风险控制

| 风险                          | 影响 | 缓解措施                         |
| ----------------------------- | ---- | -------------------------------- |
| Context 拆分后功能异常        | 高   | 分批改造，每步验证               |
| Virtuoso 回调改造导致选择失败 | 中   | 保留原有逻辑作为 fallback        |
| 轮询间隔延长影响体验          | 低   | 保留首次立即轮询，仅延长后续间隔 |

### 7.3 回滚方案

每个优化点独立提交，如有问题可单独回滚：

```bash
# 回滚单个 commit
git revert <commit-hash>

# 回滚到优化前
git checkout <优化前的-tag或commit>
```

---

## 八、监控与验收

### 8.1 性能指标

| 指标      | 优化前 | 目标   | 测量方式           |
| --------- | ------ | ------ | ------------------ |
| 首屏 LCP  | ~3s    | <2.5s  | Web Vitals         |
| 首屏 TTFB | ~800ms | <500ms | Chrome DevTools    |
| 筛选响应  | ~200ms | <100ms | React Profiler     |
| 滚动 FPS  | ~45fps | 60fps  | Chrome Performance |
| 后台 CPU  | ~15%   | <8%    | Task Manager       |

### 8.2 测试场景

1. **首屏加载**：刷新首页，测量 TTFB/LCP
2. **筛选操作**：切换 platform/folder，测量响应时间
3. **滚动测试**：大列表滚动，测量 FPS
4. **选择测试**：批量选择，验证仅受影响项重渲染
5. **新建收藏**：创建新书签，验证自动更新
6. **后台测试**：切换 Tab 后返回，验证 CPU 占用

### 8.3 验收清单

- [ ] 首屏 LCP < 2.5s
- [ ] 首屏 TTFB < 500ms
- [ ] 筛选响应 < 100ms
- [ ] 滚动 FPS 稳定 60
- [ ] 后台 CPU < 8%
- [ ] 所有功能无回归
- [ ] React Profiler 显示重渲染减少

---

## 九、附录

### A. 相关文件清单

```
src/app/(main)/home/page.tsx                    # RSC 入口
src/components/home/home-view.tsx               # 主视图组件
src/components/home/home-content.tsx            # 内容区组件
src/components/home/home-toolbar.tsx            # 工具栏组件
src/components/home/providers/home-data-provider.tsx  # 数据层
src/components/bookmark/virtual-bookmark-grid.tsx     # 虚拟网格
src/components/bookmark/virtual-bookmark-list.tsx     # 虚拟列表
src/contexts/home-page-context.tsx              # Context 兼容层
src/contexts/home-page/                         # Context 拆分实现
src/hooks/ui/use-processing-poller.ts           # 轮询 Hook
```

### B. 参考文档

- [前端性能优化方案-主页面响应与卡顿.md](./前端性能优化方案-主页面响应与卡顿.md)
- [React Context 最佳实践](https://react.dev/learn/passing-data-deeply-with-context)
- [react-virtuoso 性能优化](https://virtuoso.dev/)

---

**审核状态**: ⏳ 待审核
**最后更新**: 2026-03-05
