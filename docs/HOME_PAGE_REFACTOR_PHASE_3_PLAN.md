# 首页架构重构实施计划 - Phase 3

**基于**: [HOME_PAGE_REFACTOR_PHASE_2_PLAN.md](./HOME_PAGE_REFACTOR_PHASE_2_PLAN.md)
**制定日期**: 2025-12-18
**状态**: 待审核
**关联分支**: `refactor/home-page-performance`

---

## 📊 当前进度回顾

### 已完成阶段

| 阶段      | 名称         | 状态    | 交付物                                                 |
| --------- | ------------ | ------- | ------------------------------------------------------ |
| Phase 0   | 类型契约准备 | ✅ 完成 | `types.ts`, `constants.ts`                             |
| Phase 1   | 安全清理     | ✅ 完成 | 删除 217 行死代码                                      |
| Phase 2.1 | 适配层构建   | ✅ 完成 | `HomePageContext`, `useHomeBookmarks`                  |
| Phase 2.2 | Hook 集成    | ✅ 完成 | `useHomeViewMode` 集成                                 |
| Phase 2.3 | 主组件拆分   | ✅ 完成 | `useHomeMutations`, `useHomeBatch`, `HomeBatchToolbar` |
| Phase 2.4 | Context 启用 | ✅ 完成 | Feature Flag 开启, Hydration 修复                      |
| Phase 2.5 | 组件提取     | ✅ 完成 | `HomeToolbar`, `HomeDialogs`                           |

### 当前主组件状态

| 指标         | Phase 1 后 | Phase 2 后 | 变化 |
| ------------ | ---------- | ---------- | ---- |
| 行数         | 1,570      | 853        | -46% |
| Event 监听器 | 10+        | 4          | -60% |
| 组件职责     | 6+         | 3          | -50% |

---

## 🎯 Phase 3 目标

**核心目标**: 将外围组件迁移到 HomePageContext，完全移除 Window Event 通信

### 需要迁移的组件

| 组件                | 路径                                               | 行数 | 事件依赖                                                                  |
| ------------------- | -------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| HeaderMenu          | `src/components/layout/header-menu.tsx`            | 254  | `viewModeChange`, `layoutModeChange`, `openDialog`, `toggleSelectionMode` |
| PlatformFilter      | `src/components/layout/platform-filter.tsx`        | 201  | `flipCardChange`, `platformChange`                                        |
| UsageTagFilterSheet | `src/components/layout/usage-tag-filter-sheet.tsx` | 365  | `usageTagFilterChange`                                                    |

### 预期收益

1. **消除全局事件耦合** - 组件通过 Context 直接通信
2. **类型安全** - 所有状态变更经过 TypeScript 检查
3. **可测试性提升** - Context 可 mock，组件可单元测试
4. **调试友好** - React DevTools 可追踪状态变化

---

## 📋 Phase 3.1: HeaderMenu 迁移

### 目标

HeaderMenu 从使用 Window Event 改为使用 HomePageContext

### 预估工时: 1.5 小时

### 3.1.1 分析现状

**当前实现**:

```typescript
// header-menu.tsx - 当前使用 Window Event
const handleViewModeChange = (mode: ViewMode) => {
  setViewMode(mode);
  localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent("viewModeChange", { detail: mode }));
};

const triggerDialog = (dialogType: string) => {
  window.dispatchEvent(new CustomEvent("openDialog", { detail: dialogType }));
};
```

**目标实现**:

```typescript
// header-menu.tsx - 使用 Context
import { useHomePageSafe } from "@/contexts/home-page-context";

const context = useHomePageSafe();

const handleViewModeChange = (mode: ViewMode) => {
  if (context) {
    context.view.setViewMode(mode);
  } else {
    // Fallback: 旧的 Window Event 方式（向后兼容）
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent("viewModeChange", { detail: mode }));
  }
};

const triggerDialog = (dialogType: DialogType) => {
  if (context) {
    context.dialog.openDialogAction(dialogType);
  } else {
    window.dispatchEvent(new CustomEvent("openDialog", { detail: dialogType }));
  }
};
```

### 3.1.2 修改清单

**修改文件**: `src/components/layout/header-menu.tsx`

1. 添加 Context Hook 导入
2. 使用 `useHomePageSafe()` 获取 Context（安全版本，不在 Provider 外抛错）
3. 修改所有 handler 函数优先使用 Context
4. 移除本地 viewMode/layoutMode 状态（改从 Context 读取）
5. 保留 Fallback 逻辑（兼容非首页场景）

### 3.1.3 验收标准

- [ ] 首页 HeaderMenu 视图切换正常
- [ ] 首页 HeaderMenu 布局切换正常
- [ ] 首页 HeaderMenu 对话框触发正常
- [ ] 首页 HeaderMenu 批量选择模式正常
- [ ] 非首页 HeaderMenu 正常工作（Fallback）
- [ ] `npm run type-check` 零错误

---

## 📋 Phase 3.2: PlatformFilter 迁移

### 目标

PlatformFilter 从使用 Window Event 改为使用 HomePageContext

### 预估工时: 1.5 小时

### 3.2.1 分析现状

**当前实现**:

```typescript
// platform-filter.tsx - 当前使用 Window Event
const handlePlatformChange = (platformValue: string, href: string | null) => {
  setLocalPlatform(platformValue);
  setLocalFolder("");
  // 更新 URL...
  window.dispatchEvent(
    new CustomEvent("platformChange", {
      detail: { platform: platformValue, folder: "" },
    }),
  );
};

const handleFlipToggle = () => {
  const newValue = !enableFlipCard;
  setEnableFlipCard(newValue);
  localStorage.setItem(FLIP_CARD_STORAGE_KEY, String(newValue));
  window.dispatchEvent(new CustomEvent("flipCardChange", { detail: newValue }));
};
```

**目标实现**:

```typescript
// platform-filter.tsx - 使用 Context
import { useHomePageSafe } from "@/contexts/home-page-context";

const context = useHomePageSafe();

// 从 Context 读取状态
const currentPlatform = context?.filter.platform ?? localPlatform;
const enableFlipCard = context?.view.enableFlipCard ?? localEnableFlipCard;

const handlePlatformChange = (platformValue: string, href: string | null) => {
  if (context) {
    context.filter.setPlatform(platformValue);
  } else {
    // Fallback...
  }
};

const handleFlipToggle = () => {
  if (context) {
    context.view.setEnableFlipCard(!enableFlipCard);
  } else {
    // Fallback...
  }
};
```

### 3.2.2 修改清单

**修改文件**: `src/components/layout/platform-filter.tsx`

1. 添加 Context Hook 导入
2. 使用 `useHomePageSafe()` 获取 Context
3. 从 Context 读取 platform、folder、enableFlipCard 状态
4. 修改 handler 函数优先使用 Context
5. 保留 Fallback 逻辑和本地状态（兼容非首页场景）

### 3.2.3 验收标准

- [ ] 首页平台筛选切换正常
- [ ] 首页翻转卡片切换正常
- [ ] 平台切换后列表数据正确刷新
- [ ] URL 参数正确更新
- [ ] `npm run type-check` 零错误

---

## 📋 Phase 3.3: UsageTagFilterSheet 迁移

### 目标

UsageTagFilterSheet 从使用 Window Event 改为使用 HomePageContext

### 预估工时: 1 小时

### 3.3.1 分析现状

**当前实现**:

```typescript
// usage-tag-filter-sheet.tsx - 当前使用 Window Event
const applyFilterDebounced = useCallback((tags: string[]) => {
  // ...
  window.dispatchEvent(
    new CustomEvent("usageTagFilterChange", {
      detail: { usageTags: tags },
    }),
  );
}, []);
```

**目标实现**:

```typescript
// usage-tag-filter-sheet.tsx - 使用 Context
import { useHomePageSafe } from "@/contexts/home-page-context";

const context = useHomePageSafe();

const applyFilterDebounced = useCallback(
  (tags: string[]) => {
    // ...
    if (context) {
      context.filter.setUsageTags(tags);
    } else {
      window.dispatchEvent(
        new CustomEvent("usageTagFilterChange", {
          detail: { usageTags: tags },
        }),
      );
    }
  },
  [context],
);
```

### 3.3.2 修改清单

**修改文件**: `src/components/layout/usage-tag-filter-sheet.tsx`

1. 添加 Context Hook 导入
2. 使用 `useHomePageSafe()` 获取 Context
3. 修改 `applyFilterDebounced` 优先使用 Context
4. 修改 `handleSaved` 优先使用 Context
5. 保留 Fallback 逻辑

### 3.3.3 验收标准

- [ ] 首页用途标签筛选正常
- [ ] 筛选后列表数据正确刷新
- [ ] 智能列表保存功能正常
- [ ] `npm run type-check` 零错误

---

## 📋 Phase 3.4: 主组件 Event 监听器清理

### 目标

移除 home-page-client.tsx 中的直接 Event 监听，改为从 Context 读取状态

### 预估工时: 2 小时

### 3.4.1 分析现状

**当前 home-page-client.tsx 中的 Event 监听**:

```typescript
useEffect(() => {
  const handleOpenDialog = (event: CustomEvent<string>) => { ... };
  const handleToggleSelectionMode = () => { ... };
  const handlePlatformChange = (event: CustomEvent<...>) => { ... };
  const handleUsageTagFilterChange = (event: CustomEvent<...>) => { ... };

  window.addEventListener("platformChange", handlePlatformChange);
  window.addEventListener("openDialog", handleOpenDialog);
  window.addEventListener("toggleSelectionMode", handleToggleSelectionMode);
  window.addEventListener("usageTagFilterChange", handleUsageTagFilterChange);
  // ...
}, []);
```

**目标实现**:

```typescript
import { useHomePageContext } from "@/contexts/home-page-context";

const { filter, dialog, selection } = useHomePageContext();

// 直接使用 Context 状态
const currentPlatform = filter.platform;
const currentFolder = filter.folder;
const localUsageTags = filter.usageTags;

// 对话框状态
useEffect(() => {
  if (dialog.openDialog === "create") {
    openCreateDialog();
    dialog.closeDialog();
  }
  // ...
}, [dialog.openDialog]);
```

### 3.4.2 修改清单

**修改文件**: `src/components/home/home-page-client.tsx`

1. 导入 `useHomePageContext`
2. 移除本地 platform/folder/usageTags 状态
3. 从 Context 读取筛选状态
4. 移除 4 个 Event 监听器
5. 添加 Context 状态同步 useEffect
6. 保留 `bookmarkCreated` 事件监听（与 Context 无关）

### 3.4.3 验收标准

- [ ] 平台切换正常（通过 Context）
- [ ] 对话框触发正常（通过 Context）
- [ ] 选择模式切换正常（通过 Context）
- [ ] 用途标签筛选正常（通过 Context）
- [ ] 新建书签事件正常（保留 Event）
- [ ] `npm run type-check` 零错误
- [ ] 主组件行数减少 ~50 行

---

## 📅 执行时间线

```
Day 1 (4h)
├── [09:00-10:30] Phase 3.1: HeaderMenu 迁移
├── [10:30-11:00] 验证 + 功能测试
├── [11:00-12:30] Phase 3.2: PlatformFilter 迁移
└── [12:30-13:00] 验证 + 功能测试

Day 2 (3h)
├── [09:00-10:00] Phase 3.3: UsageTagFilterSheet 迁移
├── [10:00-10:30] 验证 + 功能测试
├── [10:30-12:30] Phase 3.4: 主组件 Event 监听器清理
└── [12:30-13:00] 全量功能测试
```

**总计**: 7 小时 (约 1 个工作日)

---

## 🔄 迁移策略

### Strangler Fig 模式

每个组件迁移都采用渐进式方式：

1. **添加 Context 支持** - 保留旧代码
2. **Context 优先** - 有 Context 用 Context，无 Context 用 Fallback
3. **验证稳定** - 确保功能正常
4. **清理 Fallback** - 最终移除旧代码（可选，保持兼容性）

```typescript
// 渐进迁移模式示例
const context = useHomePageSafe();

const handleAction = () => {
  if (context) {
    // 新方式：使用 Context
    context.action();
  } else {
    // Fallback：旧的 Window Event 方式
    window.dispatchEvent(new CustomEvent("action"));
  }
};
```

### 为什么保留 Fallback？

1. **非首页场景** - HeaderMenu 在其他页面也使用
2. **错误边界** - Context Provider 外的异常情况
3. **渐进迁移** - 允许分步骤验证

---

## 🧪 测试检查清单

### Phase 3 完成后需验证

**HeaderMenu**:

- [ ] 首页：视图模式切换
- [ ] 首页：布局模式切换
- [ ] 首页：对话框触发（新建/导入/导出）
- [ ] 首页：批量选择模式
- [ ] 设置页：菜单正常显示

**PlatformFilter**:

- [ ] 平台切换（全部/微信/小红书/B站/浏览器）
- [ ] 翻转卡片切换
- [ ] URL 参数更新
- [ ] 列表数据刷新

**UsageTagFilterSheet**:

- [ ] 标签选择/取消
- [ ] 筛选生效
- [ ] 智能列表保存

**主组件**:

- [ ] 所有功能正常
- [ ] 无 Console 错误
- [ ] 性能无回退

---

## ✅ 审核清单

### 技术确认

- [ ] 同意 Strangler Fig 渐进迁移策略
- [ ] 同意保留 Fallback 逻辑
- [ ] 同意 7 小时工作量估算

### 风险接受

- [ ] 理解迁移期间可能有状态不一致风险
- [ ] 理解需要完整功能测试

---

**制定人**: Claude (AI Assistant)
**制定日期**: 2025-12-18
**审核人**: ******\_******
**审核日期**: ******\_******
