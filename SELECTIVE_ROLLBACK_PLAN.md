# 选择性回撤方案

**目标**: 恢复 Next.js 16 + React 19，但保留测试基础设施和技术债清理成果

**生成时间**: 2025-12-01
**预计执行时间**: 15-20分钟

---

## 📋 回撤策略概览

| 操作类型 | 数量     | 说明                      |
| -------- | -------- | ------------------------- |
| **保留** | 15个文件 | 测试相关 + 技术债清理成果 |
| **回撤** | 14个文件 | 恢复原版本配置            |
| **修改** | 2个文件  | 合并保留和回撤内容        |
| **删除** | 3个文件  | 清理 Tailwind 3 产物      |

---

## ✅ 需要保留的内容

### 1️⃣ 测试基础设施（核心资产）

```bash
# 测试配置文件
jest.config.ts              # Jest 配置
jest.setup.ts               # Testing Library 初始化

# 测试文件（62个测试）
src/lib/__tests__/utils.test.ts
src/lib/browser-bookmark/__tests__/parser.test.ts
src/lib/browser-bookmark/__tests__/merge-utils.test.ts
```

**价值**:

- ✅ 62个高质量测试
- ✅ 98%+ 代码覆盖率
- ✅ 未来开发的质量保障

---

### 2️⃣ 技术债清理成果

```bash
# .gitignore 更新
/coverage
*.lcov
.jest-cache/
```

**成果**:

- ✅ tw-animate-css 依赖已移除（不再恢复）
- ✅ 测试产物正确忽略

---

### 3️⃣ 可选保留（建议保留）

```bash
# 自定义错误页面
src/app/not-found.tsx

# Provider 包装器（如果有用）
src/components/providers/root-providers.tsx

# 所有页面的 dynamic 配置（有助于避免 SSR 问题）
# - src/app/page.tsx
# - src/app/privacy/page.tsx
# - src/app/(main)/**/page.tsx
```

**建议**: 保留 `dynamic = 'force-dynamic'`，虽然 Next.js 16 仍有问题，但标记有助于未来升级

---

### 4️⃣ 文档（建议保留）

```bash
IMPLEMENTATION_PLAN.md           # 实施计划
TECH_DEBT_CLEANUP_IMPACT_REPORT.md  # 影响评估报告
SELECTIVE_ROLLBACK_PLAN.md       # 本文档
```

---

## 🔄 需要回撤的内容

### 1️⃣ 核心依赖（package.json）

**回撤到**:

```json
{
  "dependencies": {
    "next": "16.0.3",
    "react": "19.2.0",
    "react-dom": "19.2.0"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4"
  }
}
```

**保留新增**:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/user-event": "^14.6.1",
    "@types/jest": "^29.5.14",
    "jest-environment-jsdom": "^29.7.0",
    "ts-node": "^10.9.2"
  }
}
```

**移除（不恢复）**:

```json
{
  "devDependencies": {
    "tw-animate-css": "^1.4.0" // ❌ 技术债，永久移除
  }
}
```

---

### 2️⃣ Next.js 配置

**删除**:

```bash
next.config.mjs          # Next.js 14 配置
next.config.ts.bak       # 备份文件
tailwind.config.ts       # Tailwind 3 配置
```

**恢复**:

```typescript
// next.config.ts（恢复原版本）
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
  turbopack: {
    // Turbopack 支持
  },
};

export default nextConfig;
```

---

### 3️⃣ Tailwind CSS 配置

**恢复**:

```javascript
// postcss.config.mjs（Tailwind 4 版本）
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**删除**:

```bash
tailwind.config.ts      # Tailwind 3 配置文件
```

---

### 4️⃣ 样式文件（globals.css）

**完全恢复到 Tailwind 4 语法**:

```css
@import "tailwindcss";
/* ❌ 不恢复 tw-animate-css */
@import "../styles/masonry.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  /* ... 完整的 Tailwind 4 主题配置 */
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  /* ... 使用 oklch 颜色空间 */
}

.dark {
  --background: oklch(0.145 0 0);
  /* ... */
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* iOS 安全区 CSS 变量 */
:root {
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-left: env(safe-area-inset-left, 0px);
  --safe-area-inset-right: env(safe-area-inset-right, 0px);
}
```

**关键变化**:

- ✅ `@import "tailwindcss"` (Tailwind 4)
- ❌ ~~`@import "tw-animate-css"`~~ (永久移除)
- ✅ `@custom-variant`（Tailwind 4 特性）
- ✅ `@theme inline`（Tailwind 4 特性）
- ✅ `oklch()` 颜色（Tailwind 4）

---

### 5️⃣ 根 Layout（layout.tsx）

**恢复字体**:

```typescript
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

**恢复 viewport 配置**:

```typescript
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};
```

**恢复 body 结构（两种选择）**:

**选项 A: 完全恢复原版本**（推荐）

```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**选项 B: 保留 RootProviders**（更简洁）

```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
```

**关于 `dynamic = 'force-dynamic'`**:

- ⚠️ **建议保留**：虽然不能完全解决 Next.js 16 的 SSR 问题，但标记为动态路由是良好的实践
- ✅ 有助于未来升级到修复版本

---

## 📝 详细执行步骤

### 阶段 1: 准备与备份（5分钟）

```bash
# 1. 创建当前状态的完整备份
git stash push -m "backup: tech-debt-cleanup state with tests"

# 2. 创建备份分支（可选，但强烈推荐）
git checkout -b backup/tech-debt-cleanup
git stash pop
git add .
git commit -m "backup: complete state after tech debt cleanup"

# 3. 返回 master
git checkout master
```

**验证点**: 确认备份分支存在且包含所有更改

---

### 阶段 2: 选择性恢复文件（5分钟）

```bash
# 1. 恢复配置文件到原版本
git checkout HEAD -- next.config.ts
git checkout HEAD -- postcss.config.mjs
git checkout HEAD -- package.json
git checkout HEAD -- package-lock.json

# 2. 恢复样式和布局
git checkout HEAD -- src/app/globals.css
git checkout HEAD -- src/app/layout.tsx

# 3. 清理 Tailwind 3 产物
rm -f next.config.mjs next.config.ts.bak tailwind.config.ts

# 4. 可选：回撤所有页面的 dynamic 配置（不推荐）
# git checkout HEAD -- src/app/page.tsx
# git checkout HEAD -- src/app/privacy/page.tsx
# git checkout HEAD -- 'src/app/(main)/*/page.tsx'
```

**验证点**:

- ✅ next.config.ts 存在（TypeScript 格式）
- ❌ next.config.mjs 不存在
- ❌ tailwind.config.ts 不存在

---

### 阶段 3: 合并测试相关更改到 package.json（5分钟）

由于 package.json 已回撤，需要手动重新添加测试内容。

**方式 A: 使用 Git 部分恢复**（推荐）

```bash
# 从备份分支提取测试相关更改
git show backup/tech-debt-cleanup:package.json > /tmp/package.json.new

# 手动合并（使用编辑器）
# 需要保留：
# 1. 原 dependencies（Next 16, React 19, Tailwind 4）
# 2. 新增 test scripts
# 3. 新增测试 devDependencies
# 4. 移除 tw-animate-css
```

**方式 B: 直接编辑**（快速但容易出错）

打开 `package.json`，手动添加：

1. **添加测试脚本**（在 `"scripts"` 中）:

```json
"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage",
"test:ci": "jest --ci --coverage --maxWorkers=2",
```

2. **添加测试依赖**（在 `"devDependencies"` 中）:

```json
"@testing-library/jest-dom": "^6.9.1",
"@testing-library/react": "^16.3.0",
"@testing-library/user-event": "^14.6.1",
"@types/jest": "^29.5.14",
"jest": "^29.7.0",
"jest-environment-jsdom": "^29.7.0",
"ts-node": "^10.9.2",
```

3. **确认移除**:

```json
// ❌ 确保这行不存在
"tw-animate-css": "^1.4.0",
```

4. **验证核心依赖**:

```json
"next": "16.0.3",           // ✅ 确认是 16.0.3
"react": "19.2.0",          // ✅ 确认是 19.2.0
"react-dom": "19.2.0",      // ✅ 确认是 19.2.0
"@types/react": "^19",      // ✅ 确认是 ^19
"@types/react-dom": "^19",  // ✅ 确认是 ^19
"tailwindcss": "^4",        // ✅ 确认是 ^4
```

---

### 阶段 4: 重新安装依赖（3分钟）

```bash
# 1. 清理旧依赖
rm -rf node_modules package-lock.json .next

# 2. 重新安装（这会安装 Next.js 16 + React 19 + Tailwind 4）
npm install

# 3. 验证版本
npm list next react react-dom tailwindcss --depth=0
```

**预期输出**:

```
├── next@16.0.3
├── react@19.2.0
├── react-dom@19.2.0
└── tailwindcss@4.x.x
```

---

### 阶段 5: 验证测试（2分钟）

```bash
# 运行测试确保测试基础设施正常
npm test

# 预期：62 tests passed
```

**如果测试失败**:

- 检查 `jest.config.ts` 是否存在
- 检查 `jest.setup.ts` 是否存在
- 检查测试文件是否保留

---

### 阶段 6: 验证构建（5分钟）

```bash
# 清理并构建
rm -rf .next
npm run build
```

**预期结果**:

```
⚠️ SSR useContext 错误会复现
Error occurred prerendering page "/_global-error"
TypeError: Cannot read properties of null (reading 'useContext')
```

**这是正常的**，因为这是 Next.js 16 的已知问题。

---

### 阶段 7: 验证开发模式（1分钟）

```bash
npm run dev
```

**访问**: http://localhost:3000

**验证**:

- ✅ 页面正常加载
- ✅ 样式正确应用（Geist 字体）
- ✅ 主题切换正常
- ✅ 功能完整

---

## ⚠️ 回撤后预期存在的问题

### 🔴 问题 1: SSR useContext 错误（Next.js 16 原生 bug）

**错误信息**:

```
TypeError: Cannot read properties of null (reading 'useContext')
at /_global-error
```

**影响**:

- ❌ 生产构建失败
- ❌ 无法部署到生产环境
- ✅ 开发模式正常
- ✅ 所有功能正常

**严重级别**: 🔴 高（阻塞生产部署）

**已知原因**:

- Next.js 16.0.x 系列的框架级 bug
- 与 App Router + Server Components + Context 的交互问题
- 即使添加 `dynamic = 'force-dynamic'` 也无法完全解决

**解决时间线**:

- Next.js 16.1+ 可能修复
- 或等待官方稳定版本

**临时措施**:

1. **开发阶段**: 继续使用 `npm run dev`
2. **测试阶段**: 可以运行测试套件
3. **生产部署**: 暂时无法使用 `npm run build`

---

### 🟡 问题 2: Tailwind CSS 4 兼容性问题

**潜在问题**:

- Tailwind CSS 4 仍处于实验阶段
- 某些语法可能不稳定
- 与部分第三方库可能有兼容性问题

**严重级别**: 🟡 中（影响开发体验）

**已知限制**:

1. `@theme inline` 语法可能报警告
2. IDE IntelliSense 可能不完整
3. 某些 Tailwind 插件可能不兼容

**临时措施**:

- 查阅 Tailwind CSS 4 beta 文档
- 遇到问题降级到 Tailwind 3

---

### 🟡 问题 3: React 19 实验性特性警告

**可能遇到**:

```
Warning: React 19 is experimental. Some features may change.
```

**严重级别**: 🟢 低（仅警告）

**影响**:

- 控制台可能有警告
- 某些实验性 API 可能变化
- 整体稳定性略低于 React 18

**临时措施**:

- 忽略警告
- 避免使用实验性 API

---

### 🟢 问题 4: Geist 字体加载（非问题）

**说明**: 恢复 Geist 字体后，首次加载可能稍慢

**严重级别**: 🟢 低（体验问题）

**优化**:

- Next.js 自动优化字体加载
- 无需手动处理

---

## 📊 回撤前后对比

| 项目               | 回撤前（当前）      | 回撤后              | 变化    |
| ------------------ | ------------------- | ------------------- | ------- |
| **Next.js**        | 14.2.33             | 16.0.3              | ⬆️ 升级 |
| **React**          | 18.3.1              | 19.2.0              | ⬆️ 升级 |
| **Tailwind CSS**   | 3.4.18              | 4.x                 | ⬆️ 升级 |
| **字体**           | Inter               | Geist + Geist Mono  | 🔄 恢复 |
| **测试套件**       | ✅ 62 tests         | ✅ 62 tests         | ✅ 保留 |
| **tw-animate-css** | ❌ 已移除           | ❌ 已移除           | ✅ 保持 |
| **生产构建**       | ❌ 失败（错误页面） | ❌ 失败（SSR bug）  | 🔴 相同 |
| **开发模式**       | ✅ 正常             | ✅ 正常             | ✅ 相同 |
| **配置复杂度**     | 🟡 中（Tailwind 3） | 🟢 低（Tailwind 4） | ⬆️ 改善 |

---

## 🎯 回撤后的推荐行动

### 立即（本周）

1. ✅ **验证测试通过**

   ```bash
   npm test
   ```

2. ✅ **验证开发模式**

   ```bash
   npm run dev
   ```

3. ⚠️ **记录 SSR 错误**
   - 创建 GitHub Issue
   - 跟踪 Next.js 更新

### 短期（1-2周）

1. 📅 **监控 Next.js 16.1 发布**
   - 订阅 Next.js 发布通知
   - 测试新版本是否修复 SSR bug

2. 🧪 **扩展测试覆盖**
   - 添加 Hooks 测试
   - 添加组件测试
   - 提升整体覆盖率到 95%+

3. 📚 **熟悉 Tailwind CSS 4**
   - 阅读 beta 文档
   - 了解新特性
   - 测试兼容性

### 中期（1个月）

1. 🔄 **评估升级路径**
   - Next.js 16.1+ 稳定后升级
   - 或等待 Next.js 17
   - 保持测试覆盖

2. 🚀 **配置 CI/CD**（如果 SSR bug 解决）
   - GitHub Actions
   - 自动测试
   - 自动部署

---

## ⚡ 快速回撤命令摘要

如果您确认执行回撤，可以运行以下命令：

```bash
# 1. 备份当前状态
git stash push -m "backup: tech-debt-cleanup with tests"
git checkout -b backup/tech-debt-cleanup
git stash pop
git add . && git commit -m "backup: complete state"

# 2. 返回 master 并回撤文件
git checkout master
git checkout HEAD -- next.config.ts postcss.config.mjs package.json package-lock.json
git checkout HEAD -- src/app/globals.css src/app/layout.tsx

# 3. 清理 Tailwind 3 产物
rm -f next.config.mjs next.config.ts.bak tailwind.config.ts

# 4. 手动编辑 package.json（添加测试相关内容，见上文）

# 5. 重新安装依赖
rm -rf node_modules package-lock.json .next
npm install

# 6. 验证
npm test                    # 测试通过
npm list next react react-dom tailwindcss --depth=0  # 版本正确
npm run dev                 # 开发模式正常
npm run build               # 会有 SSR 错误（预期）
```

---

## ❓ 决策检查清单

在执行回撤前，请确认：

- [ ] 我理解回撤后 SSR useContext 错误会复现
- [ ] 我接受无法进行生产构建（`npm run build` 失败）
- [ ] 我确认开发模式仍可正常使用（`npm run dev`）
- [ ] 我确认 62 个测试会保留
- [ ] 我确认 tw-animate-css 不会恢复
- [ ] 我已创建备份分支（或确认可以重新执行清理）
- [ ] 我理解 Next.js 16 + Tailwind 4 仍是实验性组合
- [ ] 我愿意等待 Next.js 官方修复或手动研究解决方案

---

## 📞 需要帮助？

如果在回撤过程中遇到问题：

1. **查看备份分支**: `git checkout backup/tech-debt-cleanup`
2. **重新执行清理**: 从备份分支重新开始
3. **部分回撤**: 只恢复部分文件
4. **保持当前状态**: 不执行回撤，继续使用 Next.js 14

---

## ⏭️ 替代方案

如果不想回撤，可以考虑：

### 方案 A: 保持当前状态（推荐）

- ✅ 稳定的 Next.js 14 + React 18
- ✅ 成熟的 Tailwind 3
- ✅ 测试基础完整
- ⚠️ 仅错误页面有问题

### 方案 B: 等待修复后再升级

- ✅ 保持当前稳定状态
- ✅ 等待 Next.js 16.1+ 修复
- ✅ 一次性升级到修复版本

### 方案 C: 研究自定义错误页面

- ⚠️ 需要深入研究
- ⚠️ 可能需要覆盖 Next.js 内部逻辑
- ⚠️ 维护成本高

---

**准备好执行回撤了吗？请确认后再继续。**
