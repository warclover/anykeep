# AnyKeep 交互体验升级方案

> 版本：v1.0
> 日期：2024-12-19
> 基于：YouMind 交互分析报告 + 风险评估结论
> 状态：待审核

---

## 一、方案目标

### 1.1 核心目标

将 AnyKeep 的交互体验从「可用」提升到「丝滑」，缩小与 YouMind 的体验差距。

### 1.2 量化指标

| 指标         | 当前状态            | 目标状态            | 优先级 |
| ------------ | ------------------- | ------------------- | ------ |
| 统一缓动函数 | 混用 ease/ease-out  | 100% 使用 standard  | P0     |
| 按钮交互反馈 | 仅颜色变化          | 颜色 + 缓动优化     | P0     |
| 卡片悬停效果 | 部分有 `.card-lift` | 统一上浮 + 阴影     | P0     |
| 无障碍支持   | 无                  | 支持 reduced-motion | P0     |

### 1.3 设计原则

基于风险评估，本方案遵循以下原则：

1. **渐进式改动** - 小步快跑，每次改动可独立验证
2. **零破坏性** - 不影响现有功能和 Radix UI 组件
3. **可回滚** - 每个改动都有明确的回滚路径
4. **性能优先** - 避免全局 `*` 选择器，控制 transition 元素数量

---

## 二、实施阶段

### 阶段概览

```
Phase 1 (Day 1-2)     Phase 2 (Day 3-5)     Phase 3 (Week 2+)
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ 基础设施搭建     │ → │ 组件级优化       │ → │ 高级动画        │
│                 │   │                 │   │                 │
│ • CSS 变量定义   │   │ • Button 升级   │   │ • Framer Motion │
│ • 无障碍支持     │   │ • Card 升级     │   │ • 页面过渡      │
│ • 现有类升级     │   │ • Input 升级    │   │ • 列表动画      │
└─────────────────┘   └─────────────────┘   └─────────────────┘
     低风险 ✅              中低风险 ✅           需评估 ⚠️
```

---

## 三、Phase 1：基础设施（低风险）

### 3.1 添加 CSS 动画变量

**文件**: `src/app/globals.css`

**位置**: 在 `:root` 变量块中添加

```css
/* ============================================
 * 动画系统变量
 * V4.2.26 交互体验升级
 * ============================================ */
:root {
  /* 缓动函数 - Material Design 标准 */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
  --ease-accelerate: cubic-bezier(0.4, 0, 1, 1);

  /* 时长标准 */
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-slow: 200ms;
  --duration-slower: 300ms;
}
```

**风险等级**: 🟢 零风险（仅定义变量，不影响任何现有样式）

---

### 3.2 添加无障碍支持

**文件**: `src/app/globals.css`

**位置**: 在文件末尾添加

```css
/* ============================================
 * 无障碍：减少动画偏好
 * ============================================ */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**风险等级**: 🟢 零风险（仅在用户系统设置减少动画时生效）

---

### 3.3 升级现有微交互类

**文件**: `src/app/globals.css`

**改动**: 升级现有 `.card-lift`、`.btn-press` 等类的缓动函数

```css
/* 卡片悬停上浮 - 升级缓动函数 */
.card-lift {
  transition:
    transform var(--duration-slow) var(--ease-standard),
    box-shadow var(--duration-slow) var(--ease-standard);
}
.card-lift:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 25px -5px rgba(0, 0, 0, 0.1),
    0 4px 10px -6px rgba(0, 0, 0, 0.05);
}

.dark .card-lift:hover {
  box-shadow:
    0 8px 25px -5px rgba(0, 0, 0, 0.3),
    0 4px 10px -6px rgba(0, 0, 0, 0.2);
}

/* 按钮按压反馈 - 升级缓动函数 */
.btn-press {
  transition: transform var(--duration-fast) var(--ease-standard);
}
.btn-press:active {
  transform: scale(0.97);
}

/* 标签弹性选中 - 升级缓动函数 */
.tag-bounce {
  transition: all var(--duration-slow) var(--ease-standard);
}
.tag-bounce:hover {
  transform: scale(1.05);
}

/* 列表项悬停高亮 - 升级缓动函数 */
.list-item-hover {
  transition: background-color var(--duration-normal) var(--ease-standard);
}
.list-item-hover:hover {
  background-color: hsl(var(--accent));
}
```

**风险等级**: 🟢 低风险（仅升级缓动函数，不改变视觉效果）

---

### 3.4 Phase 1 验收清单

| 检查项       | 验收标准                                        |
| ------------ | ----------------------------------------------- |
| CSS 变量生效 | DevTools 中可查看 `--ease-standard` 等变量      |
| 无障碍支持   | 系统设置「减少动画」后，页面无过渡动画          |
| `.card-lift` | 悬停时平滑上浮，缓动感更自然                    |
| `.btn-press` | 按压时有轻微缩放反馈                            |
| 无回归       | 所有现有功能正常，Sheet/Drawer 关闭动画不受影响 |

---

## 四、Phase 2：组件级优化（中低风险）

### 4.1 升级 Button 组件

**文件**: `src/components/ui/button.tsx`

**改动**: 仅升级缓动函数，**不添加** `active:scale`（避免影响图标按钮和 Dialog）

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium " +
    "transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] " + // 升级缓动函数
    "disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 " +
    "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] " +
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      // ... 保持不变
    },
  },
);
```

**差异对比**:

```diff
- "transition-all disabled:pointer-events-none..."
+ "transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:pointer-events-none..."
```

**风险等级**: 🟢 低风险（仅改变缓动曲线，视觉效果更平滑）

---

### 4.2 升级 Card 组件

**文件**: `src/components/ui/card.tsx`

**改动**: 添加默认 transition 和悬停效果

```tsx
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        "transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:shadow-md hover:-translate-y-0.5",
        className,
      )}
      {...props}
    />
  );
}
```

**差异对比**:

```diff
  className={cn(
    "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
+   "transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
+   "hover:shadow-md hover:-translate-y-0.5",
    className
  )}
```

**风险等级**: 🟡 中低风险（新增悬停效果，需验证与 `.card-lift` 类的兼容性）

**兼容性说明**: 使用 `-translate-y-0.5`（2px）与现有 `.card-lift` 的 `-2px` 保持一致。

---

### 4.3 升级 Input 相关组件

**文件**: `src/components/ui/input.tsx`（如有）

**改动**: 添加 focus 状态的平滑过渡

```tsx
// 在 className 中添加
"transition-[border-color,box-shadow] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]";
```

**风险等级**: 🟢 低风险

---

### 4.4 Phase 2 验收清单

| 检查项               | 验收标准                       |
| -------------------- | ------------------------------ |
| Button hover         | 悬停时颜色过渡更平滑，无跳跃感 |
| Button click         | 点击后颜色变化流畅             |
| Card hover           | 悬停时轻微上浮 + 阴影加深      |
| Card 与 `.card-lift` | 两者效果一致，不冲突           |
| Dialog 按钮          | 弹窗内按钮正常工作             |
| 表单元素             | Input focus 边框过渡平滑       |

---

## 五、Phase 3：高级动画（需评估）

> ⚠️ 此阶段需要在 Phase 1-2 稳定运行 2 周后再考虑实施

### 5.1 Framer Motion 引入评估

**引入条件**:

- Phase 1-2 无回归问题
- 有明确的复杂动画需求（如列表入场、页面过渡）
- 团队已评估包大小影响（+45KB gzipped）

**预备代码**（暂不实施）:

```tsx
// src/components/motion/index.tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";

export const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
};

export { motion, AnimatePresence };
```

### 5.2 页面过渡动画评估

**引入条件**:

- 已解决与 `loading.tsx` 的协调问题
- 移动端性能测试通过（低端设备 > 50fps）

---

## 六、回滚方案

### 6.1 Phase 1 回滚

**影响范围**: globals.css

**回滚步骤**:

1. 删除 `--ease-*` 和 `--duration-*` CSS 变量
2. 删除 `@media (prefers-reduced-motion)` 块
3. 将 `.card-lift` 等类的 `var()` 改回原始值

### 6.2 Phase 2 回滚

**影响范围**: button.tsx, card.tsx

**回滚步骤**:

1. Button: 移除 `duration-150 ease-[...]`，保留原始 `transition-all`
2. Card: 移除 `transition-*` 和 `hover:*` 类

**Git 回滚命令**:

```bash
# 回滚特定文件
git checkout HEAD~1 -- src/components/ui/button.tsx
git checkout HEAD~1 -- src/components/ui/card.tsx
```

---

## 七、实施时间表

| 阶段         | 任务                | 预计时间 | 负责人 |
| ------------ | ------------------- | -------- | ------ |
| Phase 1.1    | 添加 CSS 变量       | 30min    | -      |
| Phase 1.2    | 添加无障碍支持      | 15min    | -      |
| Phase 1.3    | 升级现有微交互类    | 30min    | -      |
| Phase 1 验收 | 功能测试 + 回归测试 | 1h       | -      |
| Phase 2.1    | 升级 Button         | 30min    | -      |
| Phase 2.2    | 升级 Card           | 30min    | -      |
| Phase 2 验收 | 全面测试            | 2h       | -      |
| 观察期       | 线上监控            | 2 周     | -      |
| Phase 3      | 评估高级动画        | TBD      | -      |

---

## 八、风险控制

### 8.1 已规避的风险

| 原方案风险点           | 本方案处理方式                       |
| ---------------------- | ------------------------------------ |
| 全局 `*` transition    | ❌ 不采用，改为组件级精确控制        |
| Button `active:scale`  | ❌ 不采用，避免影响图标按钮和 Dialog |
| 立即引入 Framer Motion | ❌ 延后，待评估                      |
| 页面切换动画           | ❌ 延后，待与 loading 策略协调       |

### 8.2 保留的改进

| 改进项                | 风险等级    | 收益                 |
| --------------------- | ----------- | -------------------- |
| 统一缓动函数变量      | 🟢 零风险   | 建立动画设计系统基础 |
| 无障碍 reduced-motion | 🟢 零风险   | 提升无障碍体验       |
| 升级现有微交互类      | 🟢 低风险   | 现有动画更平滑       |
| Button 缓动升级       | 🟢 低风险   | 按钮交互更自然       |
| Card 悬停效果         | 🟡 中低风险 | 卡片层次感更强       |

---

## 九、审批确认

- [ ] Phase 1 方案确认
- [ ] Phase 2 方案确认
- [ ] 时间表确认
- [ ] 开始实施

---

## 附录：代码变更汇总

### A. globals.css 完整改动

```css
/* === 新增：动画系统变量 === */
:root {
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
  --ease-accelerate: cubic-bezier(0.4, 0, 1, 1);
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-slow: 200ms;
  --duration-slower: 300ms;
}

/* === 升级：微交互类 === */
.card-lift {
  transition:
    transform var(--duration-slow) var(--ease-standard),
    box-shadow var(--duration-slow) var(--ease-standard);
}

.btn-press {
  transition: transform var(--duration-fast) var(--ease-standard);
}

.tag-bounce {
  transition: all var(--duration-slow) var(--ease-standard);
}

.list-item-hover {
  transition: background-color var(--duration-normal) var(--ease-standard);
}

/* === 新增：无障碍支持 === */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### B. button.tsx 完整改动

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium " +
    "transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 " +
    "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] " +
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  // ... variants 保持不变
);
```

### C. card.tsx 完整改动

```tsx
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        "transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:shadow-md hover:-translate-y-0.5",
        className,
      )}
      {...props}
    />
  );
}
```
