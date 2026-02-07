# AnyKeep 页面性能优化方案

> 创建日期：2026-02-07
> 状态：待审核

## 一、问题诊断总结

### 核心性能瓶颈

| 优先级 | 问题                          | 影响范围     | 预估提升   |
| ------ | ----------------------------- | ------------ | ---------- |
| **P0** | Provider 13 层嵌套            | 全局         | ⭐⭐⭐⭐⭐ |
| **P0** | HomePageContext 13 个状态集中 | 首页所有组件 | ⭐⭐⭐⭐⭐ |
| **P1** | force-dynamic 禁用缓存        | 首页 SSR     | ⭐⭐⭐     |
| **P2** | 持续轮询无可见性检测          | 首页         | ⭐⭐⭐     |
| **P3** | 懒加载覆盖不足                | 各页面       | ⭐⭐       |

---

## 二、优化方案详细设计

### Phase 1: Provider 分层延迟加载（P0）

#### 1.1 现状分析

当前 `root-providers.tsx` 结构：

```
GlobalErrorBoundary
└─ FeedbackProvider
   └─ CoreProviders (5层)
      └─ FeatureProviders (8层)
```

**问题**：

- 13 个 Provider 在应用启动时全部初始化
- 部分 Provider（如 TTSPlayerProvider、NotificationProvider）仅特定功能需要
- 每个 Provider 都会创建 Context，增加组件树深度

#### 1.2 优化方案

**策略**：按需加载 + 分层初始化

```typescript
// 新的分层结构
const EssentialProviders = composeProviders(
  QueryProvider, // 数据请求基础
  ThemeProvider, // 主题（首屏必需）
  UserProvider, // 用户状态（首屏必需）
);

const NavigationProviders = composeProviders(
  SidebarProvider, // 侧边栏状态
  HomePageProvider, // 首页状态
  withSuspense(NavigationProvider, null),
  KeepAliveProvider, // 页面缓存
);

// 延迟加载的 Provider（首屏完成后加载）
const DeferredProviders = composeProviders(
  SessionHeartbeatProvider, // 会话心跳（可延迟）
  OnboardingProvider, // 新手引导（可延迟）
  MessageNotificationProvider, // 消息通知（可延迟）
  NotificationProvider, // AI 通知（可延迟）
  TTSPlayerProvider, // TTS 播放（可延迟）
);
```

#### 1.3 影响评估

| 组件/功能    | 依赖的 Provider             | 影响      | 应对措施                   |
| ------------ | --------------------------- | --------- | -------------------------- |
| 首页加载     | Essential + Navigation      | ✅ 无影响 | 正常工作                   |
| TTS 播放按钮 | TTSPlayerProvider           | ⚠️ 需处理 | 使用 Optional Context Hook |
| 新手引导     | OnboardingProvider          | ⚠️ 需处理 | 延迟到用户交互后           |
| 会话续期     | SessionHeartbeatProvider    | ✅ 可延迟 | 首屏后启动                 |
| 消息通知     | MessageNotificationProvider | ✅ 可延迟 | 首屏后启动                 |

#### 1.4 实现步骤

```typescript
// src/components/providers/root-providers.tsx
export function RootProviders({ children }: RootProvidersProps) {
  const [deferredReady, setDeferredReady] = useState(false);

  // 首屏渲染完成后加载延迟 Provider
  useEffect(() => {
    const timer = requestIdleCallback(() => {
      setDeferredReady(true);
    }, { timeout: 2000 });
    return () => cancelIdleCallback(timer);
  }, []);

  return (
    <GlobalErrorBoundary feature="global">
      <FeedbackProvider>
        <EssentialProviders>
          <NavigationProviders>
            {/* 延迟 Provider 包装 */}
            {deferredReady ? (
              <DeferredProviders>{children}</DeferredProviders>
            ) : (
              <DeferredProvidersPlaceholder>
                {children}
              </DeferredProvidersPlaceholder>
            )}
          </NavigationProviders>
          <Toaster position="top-center" offset={16} />
          <ServiceWorkerRegister />
          <WebVitalsReporter debug={process.env.NODE_ENV === "development"} />
        </EssentialProviders>
      </FeedbackProvider>
    </GlobalErrorBoundary>
  );
}

// 占位 Provider（提供空的 Context 值，避免子组件报错）
function DeferredProvidersPlaceholder({ children }: { children: ReactNode }) {
  return (
    <TTSPlayerContext.Provider value={null}>
      <NotificationContext.Provider value={null}>
        {children}
      </NotificationContext.Provider>
    </TTSPlayerContext.Provider>
  );
}
```

#### 1.5 配套修改

需要修改使用延迟 Provider 的组件，使用 Optional Hook：

```typescript
// src/hooks/domain/ai/use-tts-player.ts
export function useTTSPlayer() {
  const context = useContext(TTSPlayerContext);
  // 延迟加载期间返回禁用状态
  if (!context) {
    return {
      isPlaying: false,
      play: () => console.warn("TTS not ready"),
      pause: () => {},
      isReady: false, // 新增：标识 Provider 是否就绪
    };
  }
  return { ...context, isReady: true };
}
```

---

### Phase 2: HomePageContext 拆分（P0）

#### 2.1 现状分析

当前 `home-page-context.tsx` (591 行) 包含 5 个功能域：

- `view`: 视图模式（4 状态 + 3 操作）
- `filter`: 筛选（5 状态 + 3 操作）
- `dialog`: 对话框（1 状态 + 2 操作）
- `selection`: 选择模式（1 状态 + 2 操作）
- `aiPanel`: AI 面板（3 状态 + 9 操作）

**问题**：任何一个状态变化都会导致 Context value 重新创建，触发所有消费者重渲染。

#### 2.2 消��者分析

| Hook                 | 使用组件数 | 订阅的功能域 |
| -------------------- | ---------- | ------------ |
| `useHomeViewMode`    | 3          | view         |
| `useHomeFilter`      | 5          | filter       |
| `useHomeDialogs`     | 2          | dialog       |
| `useHomeSelection`   | 2          | selection    |
| `useHomeAIPanel`     | 4          | aiPanel      |
| `useHomePageContext` | 6          | 全部         |

#### 2.3 优化方案

**策略**：拆分为 5 个独立 Context + 1 个组合 Provider

```typescript
// src/contexts/home-page/view-mode-context.tsx
export const ViewModeContext = createContext<ViewModeContextType | null>(null);

// src/contexts/home-page/filter-context.tsx
export const FilterContext = createContext<FilterContextType | null>(null);

// src/contexts/home-page/dialog-context.tsx
export const DialogContext = createContext<DialogContextType | null>(null);

// src/contexts/home-page/selection-context.tsx
export const SelectionContext = createContext<SelectionContextType | null>(null);

// src/contexts/home-page/ai-panel-context.tsx
export const AIPanelContext = createContext<AIPanelContextType | null>(null);

// src/contexts/home-page/index.tsx - 组合 Provider
export function HomePageProvider({ children }: HomePageProviderProps) {
  return (
    <ViewModeProvider>
      <FilterProvider>
        <DialogProvider>
          <SelectionProvider>
            <AIPanelProvider>
              {children}
            </AIPanelProvider>
          </SelectionProvider>
        </DialogProvider>
      </FilterProvider>
    </ViewModeProvider>
  );
}
```

#### 2.4 向后兼容

保留 `useHomePageContext` 作为兼容层：

```typescript
// src/contexts/home-page/compat.tsx
export function useHomePageContext(): HomePageContextType {
  const view = useViewMode();
  const filter = useFilter();
  const dialog = useDialog();
  const selection = useSelection();
  const aiPanel = useAIPanel();

  return useMemo(
    () => ({
      view,
      filter,
      dialog,
      selection,
      aiPanel,
    }),
    [view, filter, dialog, selection, aiPanel],
  );
}
```

#### 2.5 迁移步骤

1. 创建 `src/contexts/home-page/` 目录
2. 拆分 5 个独立 Context 文件
3. 创建组合 Provider
4. 保留兼容层 Hook
5. 逐步迁移消费者到细粒度 Hook
6. 删除旧的 `home-page-context.tsx`

#### 2.6 影响评估

| 文件                   | 当前用法               | 迁移后                          | 风险 |
| ---------------------- | ---------------------- | ------------------------------- | ---- |
| `home-view.tsx`        | `useHomePageContext()` | `useViewMode()` + `useFilter()` | 低   |
| `home-content.tsx`     | `useHomeViewMode()`    | `useViewMode()`                 | 低   |
| `home-page-client.tsx` | `useHomePageContext()` | 分别使用 5 个 Hook              | 中   |
| `home-toolbar.tsx`     | Props 传递             | 无变化                          | 无   |

---

### Phase 3: SSR 缓存策略优化（P1）

#### 3.1 现状分析

```typescript
// src/app/(main)/home/page.tsx
export const dynamic = "force-dynamic";
```

**问题**：完全禁用缓存，每次请求都执行完整 SSR。

#### 3.2 优化方案

**策略**：改用按需重新验证 + 用户特定缓存

```typescript
// 方案 A：使用 revalidate（适用于低频更新场景）
export const revalidate = 60; // 60 秒缓存

// 方案 B：保持动态但启用部分缓存（推荐）
export const dynamic = "force-dynamic";

// 优化数据获取函数，使用 unstable_cache
import { unstable_cache } from "next/cache";

const getCachedUserSettings = unstable_cache(
  async (userId: string) => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();
    return mergeWithDefaults(data?.settings);
  },
  ["user-settings"],
  { revalidate: 300, tags: ["user-settings"] }, // 5 分钟缓存
);
```

#### 3.3 影响评估

| 场景       | force-dynamic | revalidate=60   | unstable_cache |
| ---------- | ------------- | --------------- | -------------- |
| 实时性     | ✅ 完全实时   | ⚠️ 最多延迟 60s | ⚠️ 部分延迟    |
| 首屏速度   | ❌ 慢         | ✅ 有缓存时快   | ✅ 有缓存时快  |
| 服务器负载 | ❌ 高         | ✅ 低           | ✅ 低          |
| 用户隔离   | ✅ 天然隔离   | ���️ 需要处理   | ✅ 按用户缓存  |

#### 3.4 推荐方案

保持 `force-dynamic`，但使用 `unstable_cache` 缓存用户设置：

```typescript
// 用户设置变化不频繁，可以缓存 5 分钟
const getUserSettings = cache(async (): Promise<UserSettings> => {
  const cookieStore = await cookies();
  const userId = cookieStore.get("x-user-id")?.value;

  if (!userId) return mergeWithDefaults(null);

  // 使用 unstable_cache 缓存用户设置
  return getCachedUserSettings(userId);
});

// 书签数据实时获取（保持现状）
const getInitialBookmarks = cache(async (...) => {
  // 保持现有逻辑
});
```

---

### Phase 4: 轮询优化（P2）

#### 4.1 现状分析

```typescript
// src/components/home/providers/home-data-provider.tsx
useProcessingPoller({
  bookmarks,
  onUpdate: handleProcessingUpdate,
  enabled: !isLoading,
});
```

**问题**：即使页面不可见也持续轮询。

#### 4.2 优化方案

```typescript
// src/hooks/ui/use-processing-poller.ts
export function useProcessingPoller(options: ProcessingPollerOptions) {
  const [isVisible, setIsVisible] = useState(true);

  // 页面可见性检测
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // 只在页面可见时轮询
  const shouldPoll = options.enabled && isVisible;

  useEffect(() => {
    if (!shouldPoll) return;

    const interval = setInterval(() => {
      // 轮询逻辑
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [shouldPoll]);
}
```

#### 4.3 影响评估

- ✅ 减少后台网络请求
- ✅ 降低服务器负载
- ✅ 节省用户电量/流量
- ⚠️ 用户切回时可能需要等待下一次轮询

---

### Phase 5: 懒加载扩展（P3）

#### 5.1 现有懒加载组件

```
src/components/home/home-page-client.tsx:
- ReclassifyBanner ✅
- InboxOrganizationBanner ✅
- PendingConfirmationsSection ✅
- ProactiveBriefingCard ✅
- VirtualBookmarkGrid ✅
- VirtualBookmarkList ✅
- SynthesisConfirmDialog ✅
```

#### 5.2 建议新增懒加载

| 组件                       | 当前状态 | 建议   | 优先级 |
| -------------------------- | -------- | ------ | ------ |
| `BatchTagDialog`           | 直接导入 | 懒加载 | 中     |
| `HomeDialogs`              | 直接导入 | 懒加载 | 中     |
| `SynthesisRecommendBubble` | 直接导入 | 懒加载 | 低     |
| `SmartListView`            | 直接导入 | 懒加载 | 中     |

---

## 三、实施计划

### 阶段一：低风险优化（1-2 天）

- [ ] Phase 4: 轮询可见性检测
- [ ] Phase 5: 新增懒加载组件
- [ ] 验证无回归

### 阶段二：Provider 优化（2-3 天）

- [ ] Phase 1.4: 创建 DeferredProvidersPlaceholder
- [ ] Phase 1.5: 修改 TTS/Notification Hook 支持 Optional Context
- [ ] Phase 1: 实现 Provider 分层延迟加载
- [ ] 验证所有功能正常

### 阶段三：Context 拆分（3-5 天）

- [ ] Phase 2.5 步骤 1-2: 创建独立 Context 文件
- [ ] Phase 2.5 步骤 3-4: 创建组合 Provider 和兼容层
- [ ] Phase 2.5 步骤 5: 逐步迁移消费者
- [ ] Phase 2.5 步骤 6: 删除旧文件
- [ ] 回归测试

### 阶段四：SSR 优化（1 天）

- [ ] Phase 3.4: 实现 unstable_cache 用户设置缓存
- [ ] 验证首屏性能提升

---

## 四、风险评估

### 高风险

| 风险                        | 概率 | 影响 | 缓解措施                     |
| --------------------------- | ---- | ---- | ---------------------------- |
| Context 拆分后消费者报错    | 中   | 高   | 保留兼容层，渐进式迁移       |
| Provider 延迟导致功能不可用 | 中   | 中   | Optional Hook + isReady 状态 |

### 中风险

| 风险                   | 概率 | 影响 | 缓解措施               |
| ---------------------- | ---- | ---- | ---------------------- |
| SSR 缓存导致数据不一致 | 低   | 中   | 保持书签实时获取       |
| 轮询暂停导致状态滞后   | 低   | 低   | 页面可见时立即轮询一次 |

---

## 五、预期效果

| 指标               | 当前           | 优化后        | 提升 |
| ------------------ | -------------- | ------------- | ---- |
| 首页首次渲染       | ~800ms         | ~400ms        | 50%  |
| 页面切换           | ~300ms         | ~100ms        | 67%  |
| Context 重渲染次数 | 13 次/状态变化 | 1 次/状态变化 | 92%  |
| 后台轮询请求       | 持续           | 仅可见时      | 80%↓ |

---

## 六、回滚方案

每个 Phase 独立实施，可单独回滚：

1. **Phase 1 回滚**：恢复原 `root-providers.tsx`
2. **Phase 2 回滚**：恢复原 `home-page-context.tsx`
3. **Phase 3 回滚**：移除 `unstable_cache` 调用
4. **Phase 4 回滚**：移除可见性检测逻辑
5. **Phase 5 回滚**：移除新增的 `lazy()` 包装

---

## 七、验证清单

### 功能验证

- [ ] 首页正常加载
- [ ] 平台筛选正常
- [ ] 视图模式切换正常
- [ ] 批量选择功能正常
- [ ] TTS 播放正常
- [ ] 新手引导正常
- [ ] 消息通知正常
- [ ] AI 面板正常

### 性能验证

- [ ] Lighthouse 性能评分 ≥ 90
- [ ] FCP < 1.5s
- [ ] TTI < 3s
- [ ] 页面切换 < 200ms
