# AnyKeep 移动端适配方案

## 一、现状分析

### 1.1 已实现的移动端功能

| 功能模块      | 实现状态    | 说明                                            |
| ------------- | ----------- | ----------------------------------------------- |
| Viewport 配置 | ✅ 完成     | device-width, initialScale=1, userScalable=true |
| 底部导航栏    | ✅ 完成     | `mobile-bottom-nav.tsx`, lg:hidden              |
| 侧边汉堡菜单  | ✅ 完成     | `mobile-menu.tsx`, Sheet 抽屉                   |
| 瀑布流响应式  | ✅ 完成     | 1/2/3/4 列自适应                                |
| 深色模式      | ✅ 完成     | 全组件 dark: 前缀支持                           |
| 顶部导航适配  | ✅ 基本完成 | Logo、用户名响应式隐藏                          |

### 1.2 存在的问题

| 优先级 | 问题                   | 影响范围     | 严重程度 |
| ------ | ---------------------- | ------------ | -------- |
| **P0** | 首页操作栏按钮溢出     | 首页核心功能 | 🔴 严重  |
| **P1** | 底部导航间距断点不一致 | 全局布局     | 🟠 中等  |
| **P1** | 安全区适配不完整       | iOS 设备     | 🟠 中等  |
| **P2** | 搜索框移动端过小       | 搜索体验     | 🟡 轻微  |
| **P2** | 列表视图缺少 sm 过渡   | 卡片显示     | 🟡 轻微  |
| **P2** | Dialog 移动端宽度      | 弹窗显示     | 🟡 轻微  |

---

## 二、适配方案

### 2.1 P0: 首页操作栏按钮溢出

**问题描述：**
首页操作栏包含 5 个按钮（批量导入、导出、批量选择、排序、视图切换），在移动端水平溢出。

**解决方案：响应式按钮分组 + 更多菜单**

```tsx
// 修改前：所有按钮平铺
<div className="flex items-center gap-3">
  <Button>批量导入</Button>
  <Button>导出</Button>
  <Button>批量选择</Button>
  <Select>排序</Select>
  <div>视图切换</div>
</div>

// 修改后：移动端折叠到菜单
<div className="flex items-center gap-2">
  {/* 移动端：图标按钮 + 更多菜单 */}
  <div className="flex md:hidden items-center gap-1">
    <Button variant="ghost" size="icon">
      <CheckSquare className="size-4" />
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>批量导入</DropdownMenuItem>
        <DropdownMenuItem>导出</DropdownMenuItem>
        <DropdownMenuItem>排序</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  {/* 桌面端：完整按钮 */}
  <div className="hidden md:flex items-center gap-3">
    <Button>批量导入</Button>
    <Button>导出</Button>
    <Button>批量选择</Button>
    <Select>排序</Select>
  </div>

  {/* 视图切换：始终显示 */}
  <ViewModeToggle />
</div>
```

**预计工作量：** 2-3 小时

---

### 2.2 P1: 底部导航间距断点修复

**问题描述：**
底部导航用 `lg:hidden`，但内容区 padding 用 `lg:pb-6`，断点不一致。

**解决方案：统一断点逻辑**

```tsx
// src/app/(main)/layout.tsx
// 修改前
<main className="flex-1 overflow-auto pb-20 lg:pb-6">

// 修改后 - 统一使用 lg 断点
<main className="flex-1 overflow-auto pb-20 lg:pb-6">
  {/* pb-20 为底部导航留白 (80px = h-16 + safe-area) */}
  {/* lg 以上隐藏底部导航，恢复正常 padding */}
```

**验证：**

- 底部导航 `lg:hidden` ✓
- 内容 padding `pb-20 lg:pb-6` ✓ (一致)

**预计工作量：** 30 分钟

---

### 2.3 P1: iOS 安全区适配

**问题描述：**
iPhone X 及以上设备有刘海和 Home Indicator，需要安全区适配。

**解决方案：viewport-fit + safe-area CSS**

```tsx
// src/app/layout.tsx - 添加 viewport-fit
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover', // 新增：启用安全区支持
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2937' },
  ],
}

// src/app/globals.css - 确保安全区变量
:root {
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-left: env(safe-area-inset-left, 0px);
  --safe-area-inset-right: env(safe-area-inset-right, 0px);
}

// mobile-bottom-nav.tsx - 使用安全区
<nav className="fixed bottom-0 inset-x-0 h-16
  pb-[env(safe-area-inset-bottom)]
  bg-white dark:bg-gray-800
  border-t border-gray-200 dark:border-gray-700
  lg:hidden z-50">
```

**预计工作量：** 1 小时

---

### 2.4 P2: 搜索框响应式优化

**问题描述：**
搜索框在移动端宽度较小，影响输入体验。

**解决方案：移动端扩展宽度**

```tsx
// src/components/layout/app-header.tsx
// 修改前
<div className="flex-1 max-w-md mx-4">

// 修改后
<div className="flex-1 max-w-md sm:max-w-lg md:max-w-md lg:max-w-lg mx-2 sm:mx-4">
  {/* 移动端：扩展宽度，减少边距 */}
```

**预计工作量：** 30 分钟

---

### 2.5 P2: 列表视图 sm 断点补充

**问题描述：**
缩略图从 `w-40` 直接跳到 `md:w-48`，缺少 sm 过渡。

**解决方案：添加 sm 断点**

```tsx
// src/components/bookmark/bookmark-card.tsx
// 修改前
<div className="relative w-40 md:w-48 flex-shrink-0">

// 修改后
<div className="relative w-32 sm:w-40 md:w-48 flex-shrink-0">
  {/* 超小屏幕：w-32 (128px) */}
  {/* sm (640px+)：w-40 (160px) */}
  {/* md (768px+)：w-48 (192px) */}
```

**预计工作量：** 30 分钟

---

### 2.6 P2: Dialog 移动端宽度规范

**问题描述：**
部分 Dialog 在移动端可能超出屏幕宽度。

**解决方案：统一 Dialog 宽度规范**

```tsx
// 新建 src/components/ui/responsive-dialog.tsx
// 或在各 Dialog 中添加响应式宽度

<DialogContent className="w-[95vw] max-w-lg sm:w-full">
  {/* 移动端：95vw 防止超出 */}
  {/* 桌面端：max-w-lg (512px) */}
</DialogContent>
```

**预计工作量：** 1 小时

---

## 三、实施计划

### 第一阶段：紧急修复 (Day 1)

| 任务               | 优先级 | 预计时间 | 负责文件               |
| ------------------ | ------ | -------- | ---------------------- |
| 首页操作栏按钮折叠 | P0     | 2-3h     | `home-page-client.tsx` |
| 底部导航间距修复   | P1     | 30min    | `(main)/layout.tsx`    |

### 第二阶段：安全区适配 (Day 2)

| 任务              | 优先级 | 预计时间 | 负责文件                    |
| ----------------- | ------ | -------- | --------------------------- |
| viewport-fit 配置 | P1     | 30min    | `layout.tsx`, `globals.css` |
| 底部导航安全区    | P1     | 30min    | `mobile-bottom-nav.tsx`     |
| 顶部导航安全区    | P1     | 30min    | `app-header.tsx`            |

### 第三阶段：细节优化 (Day 3)

| 任务             | 优先级 | 预计时间 | 负责文件            |
| ---------------- | ------ | -------- | ------------------- |
| 搜索框响应式     | P2     | 30min    | `app-header.tsx`    |
| 列表视图 sm 断点 | P2     | 30min    | `bookmark-card.tsx` |
| Dialog 宽度规范  | P2     | 1h       | 各 Dialog 组件      |

### 第四阶段：测试验证 (Day 4)

| 测试项目     | 设备            | 检查点           |
| ------------ | --------------- | ---------------- |
| iPhone 测试  | iPhone 12/14/15 | 安全区、刘海显示 |
| Android 测试 | Pixel 6/7       | 导航栏、状态栏   |
| 平板测试     | iPad            | 布局断点、侧边栏 |
| 横屏测试     | 各设备          | 布局不破裂       |

---

## 四、响应式断点规范

### 4.1 Tailwind 断点定义

```
sm:  640px   // 大手机、小平板竖屏
md:  768px   // 平板竖屏
lg:  1024px  // 平板横屏、小笔记本
xl:  1280px  // 笔记本
2xl: 1536px  // 大屏幕
```

### 4.2 组件断点使用规范

| 组件类型    | 移动端 (< 768px) | 平板 (768-1024px) | 桌面 (> 1024px) |
| ----------- | ---------------- | ----------------- | --------------- |
| 侧边栏      | hidden           | hidden            | lg:block        |
| 底部导航    | block            | block             | lg:hidden       |
| 汉堡菜单    | block            | block             | lg:hidden       |
| 操作按钮    | icon-only        | text              | text            |
| 网格列数    | 1 col            | 2 cols            | 3-4 cols        |
| Dialog 宽度 | 95vw             | 80vw              | max-w-lg        |

---

## 五、验收标准

### 5.1 功能验收

- [ ] 首页操作栏在 iPhone SE (375px) 上无溢出
- [ ] 底部导航在 iPhone X+ 上有正确的安全区间距
- [ ] 搜索框在移动端可正常输入和提交
- [ ] 所有 Dialog 在移动端可完整显示
- [ ] 列表视图缩略图在各断点平滑过渡

### 5.2 性能验收

- [ ] 首屏加载时间 < 3s (3G 网络)
- [ ] 无布局抖动 (CLS < 0.1)
- [ ] 触摸响应延迟 < 100ms

### 5.3 兼容性验收

- [ ] iOS Safari 15+
- [ ] Chrome Mobile 90+
- [ ] 微信内置浏览器
- [ ] 支付宝内置浏览器

---

## 六、后续优化建议

### 6.1 移动端专有功能

1. **手势操作**
   - 左滑删除书签
   - 下拉刷新
   - 长按多选

2. **底部 Sheet**
   - 编辑书签使用 Sheet 替代 Dialog
   - 更符合移动端操作习惯

3. **PWA 支持**
   - 添加 manifest.json
   - 实现离线访问
   - 添加到主屏幕

### 6.2 性能优化

1. **图片懒加载**
   - 使用 Intersection Observer
   - 占位符骨架屏

2. **虚拟滚动**
   - 大列表使用 react-window
   - 减少 DOM 节点

3. **代码分割**
   - 按路由分割
   - 延迟加载非核心组件

---

## 七、相关文件清单

| 文件路径                                      | 修改类型 | 说明           |
| --------------------------------------------- | -------- | -------------- |
| `src/app/layout.tsx`                          | 修改     | viewport-fit   |
| `src/app/globals.css`                         | 修改     | safe-area 变量 |
| `src/app/(main)/layout.tsx`                   | 修改     | padding 断点   |
| `src/components/home/home-page-client.tsx`    | 修改     | 操作栏响应式   |
| `src/components/bookmark/bookmark-card.tsx`   | 修改     | sm 断点        |
| `src/components/layout/app-header.tsx`        | 修改     | 搜索框宽度     |
| `src/components/layout/mobile-bottom-nav.tsx` | 修改     | 安全区         |

---

_文档版本: v1.0.0_
_创建日期: 2025-11-25_
_最后更新: 2025-11-25_
