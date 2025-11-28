# 浏览器书签导入功能设计文档

**版本**: V1.3 (平台分组筛选更新)
**日期**: 2025-11-28
**状态**: 待审核
**作者**: AI Assistant

---

## 📝 版本历史

| 版本 | 日期       | 变更内容                                   |
| ---- | ---------- | ------------------------------------------ |
| V1.0 | 2025-11-28 | 初版设计，基础导入功能                     |
| V1.1 | 2025-11-28 | 增加自动分批、IndexedDB 缓存、层级检测     |
| V1.2 | 2025-11-28 | Chrome/Edge 作为独立平台，平台化设计       |
| V1.3 | 2025-11-28 | **新增平台分组筛选 UI 设计，支持未来扩展** |

---

## 目录

1. [功能概述](#1-功能概述)
2. [竞品分析](#2-竞品分析)
3. [技术调研](#3-技术调研)
4. [功能清单](#4-功能清单)
5. [数据模型设计](#5-数据模型设计)
6. [架构设计](#6-架构设计)
7. [UI/UX 设计](#7-uiux-设计)
8. [实现计划](#8-实现计划)
9. [风险与注意事项](#9-风险与注意事项)

---

## 📋 关键决策（已确认）

| 决策项             | 决策内容                                                      |
| ------------------ | ------------------------------------------------------------- |
| **平台类型扩展**   | ✅ 新增 `BROWSER_CHROME`、`BROWSER_EDGE` 作为**独立平台**管理 |
| **文件夹层级限制** | ✅ 最大 5 层，超过时提示用户先行整理                          |
| **单次导入上限**   | ✅ 保持 100 条/批次限制，超过时自动分批缓存导入               |
| **分批间隔时间**   | ✅ 500ms                                                      |
| **缓存策略**       | ✅ IndexedDB（支持大数据量，结构化存储）                      |
| **入口位置**       | ✅ 首页集成，采用下拉菜单方案 A                               |
| **UI 步骤数**      | ✅ 4 步（上传→预览→配置→导入）                                |
| **MVP 范围**       | ✅ P0-P2 全部纳入开发计划                                     |
| **平台筛选 UI**    | ✅ 采用分组设计（内容平台 / 浏览器），支持未来扩展            |

---

## 🔄 V1.2 重大更新：平台化设计

### 设计理念变更

**核心变化**：Chrome 和 Edge 不仅仅是"导入来源"，而是与微信、B站、小红书**平级的独立平台**。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AnyKeep 平台架构                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│   │   微信公众号  │ │    B站      │ │   小红书     │ │   其他       │       │
│   │ 💬 WECHAT   │ │ 📺 BILIBILI │ │ 📕 XHS      │ │ 📌 UNKNOWN  │       │
│   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                                          │
│   ┌─────────────┐ ┌─────────────┐                                       │
│   │   Chrome    │ │    Edge     │  ← V1.2 新增：浏览器平台               │
│   │ 🌐 CHROME   │ │ 🔷 EDGE     │                                       │
│   └─────────────┘ └─────────────┘                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 平台化带来的影响

| 影响范围         | 变更内容                            |
| ---------------- | ----------------------------------- |
| **首页平台筛选** | 新增 Chrome、Edge 筛选标签          |
| **统计分析**     | 平台分布图表包含 Chrome、Edge       |
| **内容类型统计** | Chrome/Edge 书签默认归类为"网页"    |
| **书签卡片**     | 显示 Chrome/Edge 平台标识           |
| **平台配置**     | 完整配置（名称、图标、颜色）        |
| **平台识别**     | 导入时根据文件来源确定，非 URL 检测 |

---

## 1. 功能概述

### 1.1 背景

用户希望能够一键导入已有的浏览器收藏夹，减少手动添加书签的工作量。Chrome 和 Edge 是市场份额最高的两款浏览器，优先支持这两个平台。

### 1.2 功能定位

- **独立平台**：Chrome 和 Edge 作为与微信/B站/小红书平级的内容来源平台
- **批量操作**：支持大量书签的批量导入，自动分批处理
- **智能处理**：支持文件夹结构映射、去重、合并
- **统一管理**：导入后的书签与其他平台收藏统一展示、筛选、搜索

### 1.3 目标用户

- 从 Chrome/Edge 迁移到 AnyKeep 的新用户
- 希望统一管理多浏览器书签的用户
- 定期备份浏览器书签的用户

---

## 2. 竞品分析

### 2.1 竞品列表

| 产品名称             | 类型         | 核心功能                    | 亮点                    | 不足             |
| -------------------- | ------------ | --------------------------- | ----------------------- | ---------------- |
| **TidyMark**         | 浏览器扩展   | 书签整理、AI 分类、失效检测 | AI 辅助分类、云备份     | 仅限浏览器内使用 |
| **EverSync**         | 跨浏览器同步 | 多浏览器书签同步            | 实时同步、跨平台        | 付费功能多       |
| **Raindrop.io**      | 书签管理工具 | 浏览器书签导入、标签管理    | UI 美观、支持多格式导入 | 免费版限制多     |
| **Pinboard**         | 在线书签服务 | 书签存档、全文搜索          | 纯文本、永久存储        | UI 过于简洁      |
| **Edge/Chrome 内置** | 浏览器功能   | 书签导入/导出               | 原生支持                | 仅支持单向导入   |

### 2.2 竞品功能对比

| 功能点          | TidyMark | EverSync | Raindrop.io | AnyKeep (规划) |
| --------------- | -------- | -------- | ----------- | -------------- |
| Chrome 书签导入 | ✅       | ✅       | ✅          | ✅             |
| Edge 书签导入   | ✅       | ✅       | ✅          | ✅             |
| 文件夹结构保持  | ✅       | ✅       | ✅          | ✅             |
| 书签去重        | ✅       | ⚠️       | ✅          | ✅             |
| 多源合并        | ❌       | ⚠️       | ✅          | ✅             |
| 失效链接检测    | ✅       | ❌       | ✅          | ✅             |
| AI 智能分类     | ✅       | ❌       | ❌          | ✅             |
| 预览选择        | ❌       | ❌       | ✅          | ✅             |
| 自动分批导入    | ❌       | ❌       | ⚠️          | ✅             |
| **平台化管理**  | ❌       | ❌       | ⚠️          | ✅             |

### 2.3 差异化优势

AnyKeep 浏览器书签导入功能的差异化亮点：

1. **平台化管理**：Chrome/Edge 作为独立平台，可按平台筛选和统计
2. **多源合并去重**：支持同时导入 Chrome + Edge，智能合并去重
3. **AI 智能分类**：结合现有 AI 能力自动分类到文件夹
4. **统一管理**：与微信/B站/小红书收藏统一管理
5. **语义搜索**：导入后支持向量搜索
6. **自动分批**：大量书签自动分批导入，无需手动分割

---

## 3. 技术调研

### 3.1 浏览器书签导出格式

Chrome 和 Edge 都使用 **Netscape Bookmark HTML 格式**，这是一个事实标准。

#### 3.1.1 文件结构示例

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1640995200" LAST_MODIFIED="1640995200">书签栏</H3>
    <DL><p>
        <DT><H3 ADD_DATE="1640995200">开发工具</H3>
        <DL><p>
            <DT><A HREF="https://github.com" ADD_DATE="1640995200" ICON="data:image/...">GitHub</A>
            <DT><A HREF="https://stackoverflow.com" ADD_DATE="1640995200">Stack Overflow</A>
        </DL><p>
        <DT><A HREF="https://google.com" ADD_DATE="1640995200">Google</A>
    </DL><p>
    <DT><H3>其他书签</H3>
    <DL><p>
        <DT><A HREF="https://example.com">Example</A>
    </DL><p>
</DL><p>
```

#### 3.1.2 关键元素说明

| 元素   | 含义                          | 属性                        |
| ------ | ----------------------------- | --------------------------- |
| `<DL>` | Definition List，书签列表容器 | -                           |
| `<DT>` | Definition Term，书签项       | -                           |
| `<H3>` | 文件夹名称                    | `ADD_DATE`, `LAST_MODIFIED` |
| `<A>`  | 书签链接                      | `HREF`, `ADD_DATE`, `ICON`  |
| `<DD>` | 书签描述（可选）              | -                           |

#### 3.1.3 时间戳格式

- `ADD_DATE`: Unix 时间戳（秒，自 1970-01-01）
- `LAST_MODIFIED`: Unix 时间戳（秒）
- `ICON`: Base64 编码的 favicon 或 URL

### 3.2 Chrome vs Edge 差异

| 差异点       | Chrome               | Edge                     |
| ------------ | -------------------- | ------------------------ |
| 默认根文件夹 | "书签栏"、"其他书签" | "收藏夹栏"、"其他收藏夹" |
| 文件编码     | UTF-8                | UTF-8                    |
| 特殊属性     | `ICON_URI`           | `ICON_URI`               |
| 移动端书签   | "移动设备书签"       | "移动收藏夹"             |

### 3.3 浏览器来源识别策略

**重要**：浏览器书签的平台识别**不能通过 URL 检测**（因为书签可以是任何网站），而是在导入时根据以下方式确定：

```typescript
/**
 * 浏览器来源识别策略
 */
function detectBrowserSource(
  fileName: string,
  htmlContent: string,
): "chrome" | "edge" | "unknown" {
  // 策略 1: 根据文件名
  const lowerFileName = fileName.toLowerCase();
  if (lowerFileName.includes("chrome") || lowerFileName.includes("bookmark")) {
    return "chrome";
  }
  if (lowerFileName.includes("edge") || lowerFileName.includes("favorite")) {
    return "edge";
  }

  // 策略 2: 根据根文件夹名称
  if (htmlContent.includes("书签栏") || htmlContent.includes("Bookmarks Bar")) {
    return "chrome";
  }
  if (
    htmlContent.includes("收藏夹栏") ||
    htmlContent.includes("Favorites Bar")
  ) {
    return "edge";
  }

  // 策略 3: 用户手动选择（UI 提供选项）
  return "unknown";
}
```

### 3.4 缓存策略：IndexedDB

选择 IndexedDB 而非 localStorage 的原因：

| 特性     | localStorage | IndexedDB  |
| -------- | ------------ | ---------- |
| 存储上限 | ~5MB         | ~50MB+     |
| 数据类型 | 仅字符串     | 任意类型   |
| 查询能力 | 无           | 索引查询   |
| 事务支持 | 无           | 支持       |
| 异步操作 | 同步阻塞     | 异步非阻塞 |

**使用场景**：

- 缓存待导入的书签队列
- 存储分批导入进度
- 支持中断后恢复

---

## 4. 功能清单

### 4.1 核心功能 (P0 - MVP)

| 功能编号 | 功能名称           | 描述                                       | 优先级 |
| -------- | ------------------ | ------------------------------------------ | ------ |
| F-BI-001 | HTML 文件上传      | 支持上传 `.html` 格式的书签文件            | P0     |
| F-BI-002 | 书签解析           | 解析 Netscape Bookmark HTML 格式           | P0     |
| F-BI-003 | **浏览器来源识别** | 自动/手动识别 Chrome 或 Edge               | P0     |
| F-BI-004 | 预览展示           | 树形结构展示解析后的书签                   | P0     |
| F-BI-005 | 选择性导入         | 用户可勾选需要导入的书签/文件夹            | P0     |
| F-BI-006 | 文件夹映射         | 浏览器文件夹 → AnyKeep 文件夹              | P0     |
| F-BI-007 | URL 去重           | 跳过已存在的 URL                           | P0     |
| F-BI-008 | **平台标记**       | 导入时设置 platform 为 BROWSER_CHROME/EDGE | P0     |
| F-BI-009 | 批量导入           | 调用现有 batch-import API                  | P0     |
| F-BI-010 | 导入结果           | 显示成功/失败数量及详情                    | P0     |

### 4.2 增强功能 (P1)

| 功能编号 | 功能名称         | 描述                             | 优先级 |
| -------- | ---------------- | -------------------------------- | ------ |
| F-BI-101 | 多文件合并       | 支持同时上传多个书签文件         | P1     |
| F-BI-102 | 合并去重         | 多文件合并时自动去重             | P1     |
| F-BI-103 | **平台筛选集成** | 首页新增 Chrome/Edge 筛选标签    | P1     |
| F-BI-104 | 自动创建文件夹   | 根据浏览器结构自动创建对应文件夹 | P1     |
| F-BI-105 | 导入时间保留     | 保留原始书签添加时间             | P1     |
| F-BI-106 | AI 智能分类      | 导入后可选启用 AI 自动分类       | P1     |
| F-BI-107 | 自动分批导入     | 超过100条时自动分批缓存导入      | P1     |
| F-BI-108 | 层级深度检测     | 检测超过5层的文件夹并提示用户    | P1     |
| F-BI-109 | **统计分析集成** | 平台分布图表包含 Chrome/Edge     | P1     |

### 4.3 高级功能 (P2)

| 功能编号 | 功能名称       | 描述                          | 优先级 |
| -------- | -------------- | ----------------------------- | ------ |
| F-BI-201 | 链接有效性检测 | 导入前检测失效链接            | P2     |
| F-BI-202 | 书签元数据抓取 | 自动获取标题/描述/封面        | P2     |
| F-BI-203 | 定期同步       | 浏览器扩展实现自动同步        | P2     |
| F-BI-204 | 导出为 HTML    | 导出为 Netscape Bookmark 格式 | P2     |
| F-BI-205 | 导入历史记录   | 记录每次导入的统计信息        | P2     |

### 4.4 用户故事

#### US-001: 单文件导入

> 作为一个新用户，我想要导入我 Chrome 浏览器的书签，以便快速开始使用 AnyKeep。

**验收标准**:

- [ ] 可以上传 `.html` 书签文件
- [ ] 自动识别为 Chrome 来源
- [ ] 解析后展示书签树形结构
- [ ] 可以勾选需要导入的内容
- [ ] 导入完成后显示结果统计
- [ ] 重复的 URL 自动跳过
- [ ] 导入的书签 platform 为 BROWSER_CHROME

#### US-002: 多源合并

> 作为一个使用多个浏览器的用户，我想要合并 Chrome 和 Edge 的书签到 AnyKeep，并自动去除重复项。

**验收标准**:

- [ ] 可以同时上传多个书签文件
- [ ] 自动识别各自的来源（Chrome/Edge）
- [ ] 相同 URL 只保留一份（可选择保留哪个来源）
- [ ] 不同来源的书签分别标记为 BROWSER_CHROME 和 BROWSER_EDGE

#### US-003: 按平台筛选浏览器书签

> 作为一个用户，我想要在首页按 Chrome 或 Edge 筛选查看我导入的书签。

**验收标准**:

- [ ] 首页平台筛选栏显示 Chrome 和 Edge 选项
- [ ] 点击 Chrome 只显示来自 Chrome 的书签
- [ ] 点击 Edge 只显示来自 Edge 的书签
- [ ] 统计分析页面显示 Chrome/Edge 的收藏数量

#### US-004: 大量书签导入（新增）

> 作为一个长期使用浏览器的用户，我有超过 500 条书签，希望能一次性导入而不需要手动分割文件。

**验收标准**:

- [ ] 自动检测书签数量
- [ ] 超过 100 条时自动分批
- [ ] 显示分批进度（如 1/6、2/6...）
- [ ] 支持中断后继续（IndexedDB 缓存）
- [ ] 完成后汇总显示总体结果

---

## 5. 数据模型设计

### 5.1 平台类型扩展

在 `Platform` 枚举中新增浏览器来源类型：

```typescript
// types/supabase.ts 补充
type Platform =
  | "WECHAT_OFFICIAL_ACCOUNT"
  | "BILIBILI"
  | "XIAOHONGSHU"
  | "BROWSER_CHROME" // 新增：Chrome 书签
  | "BROWSER_EDGE" // 新增：Edge 书签
  | "BROWSER_FIREFOX" // 预留：Firefox 书签
  | "BROWSER_SAFARI" // 预留：Safari 书签
  | "UNKNOWN";
```

### 5.2 平台配置扩展（完整配置）

```typescript
// lib/constants/platforms.ts 扩展
export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  WECHAT_OFFICIAL_ACCOUNT: {
    name: "微信公众号",
    key: "wechat",
    hexColor: "#07c160",
    bgColor: "bg-green-600",
    icon: "💬",
  },
  BILIBILI: {
    name: "B站",
    key: "bilibili",
    hexColor: "#00a1d6",
    bgColor: "bg-blue-500",
    icon: "📺",
  },
  XIAOHONGSHU: {
    name: "小红书",
    key: "xiaohongshu",
    hexColor: "#ff2442",
    bgColor: "bg-red-500",
    icon: "📕",
  },
  // ========== V1.2 新增：浏览器平台 ==========
  BROWSER_CHROME: {
    name: "Chrome",
    key: "chrome",
    hexColor: "#4285f4", // Google 蓝
    bgColor: "bg-blue-500",
    icon: "🌐", // 或使用 Chrome logo SVG
  },
  BROWSER_EDGE: {
    name: "Edge",
    key: "edge",
    hexColor: "#0078d4", // Microsoft 蓝
    bgColor: "bg-cyan-600",
    icon: "🔷", // 或使用 Edge logo SVG
  },
  BROWSER_FIREFOX: {
    name: "Firefox",
    key: "firefox",
    hexColor: "#ff7139",
    bgColor: "bg-orange-500",
    icon: "🦊",
  },
  BROWSER_SAFARI: {
    name: "Safari",
    key: "safari",
    hexColor: "#006cff",
    bgColor: "bg-sky-500",
    icon: "🧭",
  },
  UNKNOWN: {
    name: "其他",
    key: "unknown",
    hexColor: "#9ca3af",
    bgColor: "bg-gray-500",
    icon: "📌",
  },
};

/**
 * 所有支持的平台列表（用于首页筛选）
 * V1.2 更新：新增浏览器平台
 */
export const ALL_PLATFORMS: PlatformConfig[] = [
  PLATFORM_CONFIGS.WECHAT_OFFICIAL_ACCOUNT,
  PLATFORM_CONFIGS.BILIBILI,
  PLATFORM_CONFIGS.XIAOHONGSHU,
  PLATFORM_CONFIGS.BROWSER_CHROME, // 新增
  PLATFORM_CONFIGS.BROWSER_EDGE, // 新增
];

/**
 * 浏览器平台列表
 */
export const BROWSER_PLATFORMS: Platform[] = [
  "BROWSER_CHROME",
  "BROWSER_EDGE",
  "BROWSER_FIREFOX",
  "BROWSER_SAFARI",
];

/**
 * 检测 URL 所属平台
 * 注意：浏览器书签不使用此函数，平台在导入时确定
 */
export function detectPlatformFromUrl(url: string): Platform {
  if (url.includes("mp.weixin.qq.com")) return "WECHAT_OFFICIAL_ACCOUNT";
  if (url.includes("bilibili.com")) return "BILIBILI";
  if (url.includes("xiaohongshu.com") || url.includes("xhslink.com"))
    return "XIAOHONGSHU";
  return "UNKNOWN";
}

/**
 * 判断是否为浏览器平台
 */
export function isBrowserPlatform(platform: Platform): boolean {
  return BROWSER_PLATFORMS.includes(platform);
}
```

### 5.3 首页平台筛选配置更新（分组设计）

**设计理念**：当支持更多浏览器时，平面列表会变得拥挤。采用分组设计，将平台按类型分为"内容平台"和"浏览器"两类，支持未来扩展。

```typescript
// lib/constants/platform-groups.ts - 新增文件

/**
 * 平台分组类型
 */
export type PlatformGroupType = "content" | "browser";

/**
 * 平台分组配置
 */
export interface PlatformGroup {
  id: PlatformGroupType;
  name: string;
  platforms: PlatformFilterOption[];
}

/**
 * 平台筛选选项
 */
export interface PlatformFilterOption {
  id: string;
  name: string;
  value: Platform | "";
  icon?: string;
}

/**
 * 内容平台组
 */
export const CONTENT_PLATFORMS: PlatformFilterOption[] = [
  { id: "wechat", name: "微信", value: "WECHAT_OFFICIAL_ACCOUNT", icon: "💬" },
  { id: "xiaohongshu", name: "小红书", value: "XIAOHONGSHU", icon: "📕" },
  { id: "bilibili", name: "B站", value: "BILIBILI", icon: "📺" },
];

/**
 * 浏览器平台组
 */
export const BROWSER_PLATFORMS_FILTER: PlatformFilterOption[] = [
  { id: "chrome", name: "Chrome", value: "BROWSER_CHROME", icon: "🌐" },
  { id: "edge", name: "Edge", value: "BROWSER_EDGE", icon: "🔷" },
  // 预留扩展
  // { id: 'firefox', name: 'Firefox', value: 'BROWSER_FIREFOX', icon: '🦊' },
  // { id: 'safari', name: 'Safari', value: 'BROWSER_SAFARI', icon: '🧭' },
  // { id: '360', name: '360浏览器', value: 'BROWSER_360', icon: '🛡️' },
];

/**
 * 平台分组列表
 */
export const PLATFORM_GROUPS: PlatformGroup[] = [
  {
    id: "content",
    name: "内容平台",
    platforms: CONTENT_PLATFORMS,
  },
  {
    id: "browser",
    name: "浏览器",
    platforms: BROWSER_PLATFORMS_FILTER,
  },
];

/**
 * 组合筛选模式
 */
export type FilterMode = "all" | "content" | "browser";

/**
 * 获取当前筛选模式下的平台列表
 */
export function getPlatformsByMode(mode: FilterMode): PlatformFilterOption[] {
  switch (mode) {
    case "content":
      return CONTENT_PLATFORMS;
    case "browser":
      return BROWSER_PLATFORMS_FILTER;
    case "all":
    default:
      return [...CONTENT_PLATFORMS, ...BROWSER_PLATFORMS_FILTER];
  }
}
```

```typescript
// components/home/platform-filter.tsx - 分组筛选组件

interface PlatformFilterProps {
  currentPlatform: string;
  onPlatformChange: (platform: string) => void;
  filterMode: FilterMode;
  onFilterModeChange: (mode: FilterMode) => void;
}

/**
 * 分组平台筛选组件
 *
 * UI 布局:
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  平台筛选:                                                                │
 * │                                                                           │
 * │  内容平台: [ 全部 ] [ 💬 微信 ] [ 📕 小红书 ] [ 📺 B站 ]                  │
 * │                                                                           │
 * │  浏览器:   [ 全部 ] [ 🌐 Chrome ] [ 🔷 Edge ] [ 更多 ▼ ]                  │
 * │                                                                           │
 * │  组合筛选: [ 全平台 ▼ ]                                                   │
 * │            ├─ 全平台                                                      │
 * │            ├─ 仅内容平台                                                  │
 * │            └─ 仅浏览器                                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export function PlatformFilter({
  currentPlatform,
  onPlatformChange,
  filterMode,
  onFilterModeChange,
}: PlatformFilterProps) {
  // 组件实现...
}
```

### 5.4 内容类型统计更新

```typescript
// app/(main)/analytics/page.tsx 中的内容类型统计逻辑更新
bookmarks.forEach((bookmark) => {
  if (bookmark.platform === "BILIBILI") {
    typeMap["视频"]++;
  } else if (bookmark.platform === "XIAOHONGSHU") {
    typeMap["图文"]++;
  } else if (
    bookmark.platform === "BROWSER_CHROME" ||
    bookmark.platform === "BROWSER_EDGE"
  ) {
    typeMap["网页"]++; // 新增：浏览器书签归类为"网页"
  } else {
    typeMap["文章"]++;
  }
});
```

### 5.5 书签导入临时数据结构

```typescript
// lib/browser-bookmark/types.ts

/**
 * 解析后的书签节点
 */
export interface ParsedBookmarkNode {
  /** 节点类型 */
  type: "folder" | "bookmark";
  /** 标题 */
  title: string;
  /** URL（仅 bookmark 类型） */
  url?: string;
  /** 添加时间戳（Unix秒） */
  addDate?: number;
  /** 最后修改时间戳 */
  lastModified?: number;
  /** 图标（Base64 或 URL） */
  icon?: string;
  /** 描述 */
  description?: string;
  /** 子节点（仅 folder 类型） */
  children?: ParsedBookmarkNode[];
  /** 节点路径（用于 UI 展示） */
  path: string[];
  /** 唯一标识（用于勾选） */
  id: string;
  /** 层级深度（从1开始） */
  depth: number;
}

/**
 * 浏览器来源类型
 */
export type BrowserSource =
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "unknown";

/**
 * 解析后的书签文件
 */
export interface ParsedBookmarkFile {
  /** 文件名 */
  fileName: string;
  /** 来源浏览器（自动检测或用户选择） */
  source: BrowserSource;
  /** 对应的平台类型 */
  platform: Platform;
  /** 根节点列表 */
  roots: ParsedBookmarkNode[];
  /** 书签总数 */
  totalBookmarks: number;
  /** 文件夹总数 */
  totalFolders: number;
  /** 最大层级深度 */
  maxDepth: number;
  /** 解析时间 */
  parsedAt: Date;
}

/**
 * 浏览器来源到平台类型的映射
 */
export const BROWSER_SOURCE_TO_PLATFORM: Record<BrowserSource, Platform> = {
  chrome: "BROWSER_CHROME",
  edge: "BROWSER_EDGE",
  firefox: "BROWSER_FIREFOX",
  safari: "BROWSER_SAFARI",
  unknown: "UNKNOWN",
};

/**
 * 导入配置
 */
export interface BrowserBookmarkImportOptions {
  /** 选中的节点 ID 列表 */
  selectedIds: string[];
  /** 目标文件夹 ID（null 表示根目录） */
  targetFolderId: number | null;
  /** 是否保持原文件夹结构 */
  keepFolderStructure: boolean;
  /** 是否自动创建文件夹 */
  autoCreateFolders: boolean;
  /** 是否启用 AI 分类 */
  enableAiClassify: boolean;
  /** 是否覆盖已存在的 URL */
  overwriteExisting: boolean;
  /** 是否保留原始添加时间 */
  preserveAddDate: boolean;
}

/**
 * 分批导入队列项
 */
export interface ImportBatch {
  /** 批次编号（从1开始） */
  batchNumber: number;
  /** 总批次数 */
  totalBatches: number;
  /** 当前批次书签列表 */
  bookmarks: ParsedBookmarkNode[];
  /** 来源平台 */
  platform: Platform;
  /** 批次状态 */
  status: "pending" | "processing" | "completed" | "failed";
  /** 批次结果 */
  result?: {
    success: number;
    failed: number;
    skipped: number;
  };
}

/**
 * 导入进度（支持分批）
 */
export interface ImportProgress {
  /** 总书签数 */
  totalBookmarks: number;
  /** 总批次数 */
  totalBatches: number;
  /** 当前批次 */
  currentBatch: number;
  /** 当前批次内进度 */
  batchProgress: {
    total: number;
    processed: number;
  };
  /** 累计成功数 */
  totalSuccess: number;
  /** 累计失败数 */
  totalFailed: number;
  /** 累计跳过数（重复） */
  totalSkipped: number;
  /** 当前处理的书签标题 */
  currentItem?: string;
  /** 状态 */
  status: "idle" | "parsing" | "importing" | "paused" | "completed" | "error";
  /** 错误信息 */
  errorMessage?: string;
}

/**
 * 层级深度警告
 */
export interface DepthWarning {
  /** 超过限制的文件夹列表 */
  folders: Array<{
    path: string[];
    depth: number;
  }>;
  /** 是否允许继续（用户确认后） */
  confirmed: boolean;
}
```

### 5.6 数据库扩展

#### 5.6.1 bookmarks 表扩展字段

```sql
-- 新增字段记录原始浏览器书签信息
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS browser_add_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS browser_icon TEXT,
ADD COLUMN IF NOT EXISTS import_source VARCHAR(50); -- 'BROWSER_CHROME', 'BROWSER_EDGE' 等

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_import_source
ON public.bookmarks(import_source) WHERE import_source IS NOT NULL;

-- 更新平台类型约束（如有 CHECK 约束）
-- 确保支持新的平台类型：BROWSER_CHROME, BROWSER_EDGE
```

#### 5.6.2 导入历史表

```sql
-- 记录导入历史，方便追溯和恢复
CREATE TABLE IF NOT EXISTS public.import_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    import_type VARCHAR(50) NOT NULL, -- 'BROWSER_BOOKMARK', 'JSON', etc.
    source VARCHAR(50), -- 'CHROME', 'EDGE', etc.
    platform VARCHAR(50), -- 'BROWSER_CHROME', 'BROWSER_EDGE'
    file_name VARCHAR(255),
    total_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    skipped_count INT DEFAULT 0,
    batch_count INT DEFAULT 1, -- 分批数量
    options JSONB, -- 导入配置
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import history" ON public.import_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own import history" ON public.import_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

## 6. 架构设计

### 6.1 模块划分

```
src/
├── lib/
│   ├── constants/
│   │   └── platform-groups.ts      # 平台分组配置（V1.2 新增）
│   │
│   └── browser-bookmark/           # 浏览器书签模块（独立）
│       ├── index.ts                # 模块导出
│       ├── types.ts                # 类型定义
│       ├── parser.ts               # HTML 解析器
│       ├── detector.ts             # 浏览器来源检测
│       ├── validator.ts            # 深度验证、格式检查
│       ├── merger.ts               # 多源合并逻辑
│       ├── batcher.ts              # 分批处理逻辑
│       ├── cache.ts                # IndexedDB 缓存管理
│       ├── importer.ts             # 导入逻辑
│       └── constants.ts            # 常量配置
│
├── components/
│   ├── home/
│   │   └── platform-filter.tsx     # 分组平台筛选组件（V1.2 新增）
│   │
│   └── browser-bookmark/           # UI 组件
│       ├── index.ts                # 组件导出
│       ├── import-dialog.tsx       # 导入对话框（主入口）
│       ├── file-uploader.tsx       # 文件上传组件
│       ├── source-selector.tsx     # 浏览器来源选择（Chrome/Edge）
│       ├── bookmark-tree.tsx       # 书签树形展示
│       ├── depth-warning.tsx       # 层级深度警告
│       ├── import-options.tsx      # 导入选项配置
│       ├── batch-progress.tsx      # 分批进度显示
│       └── import-result.tsx       # 导入结果展示
│
├── app/api/
│   └── browser-bookmark/           # API 路由
│       ├── parse/route.ts          # 解析书签文件
│       ├── import/route.ts         # 执行导入（支持分批）
│       ├── validate/route.ts       # 验证链接有效性
│       └── history/route.ts        # 导入历史
│
└── hooks/
    └── use-browser-bookmark-import.ts  # 导入逻辑 Hook（含分批状态管理）
```

### 6.2 平台化集成点

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      平台化集成架构                                      │
└─────────────────────────────────────────────────────────────────────────┘

1. 首页集成（分组筛选设计）
   ┌────────────────────────────────────────────────────────────────────┐
   │  平台筛选（分组设计）                                               │
   │                                                                     │
   │  内容平台: [ 全部 ] [ 💬 微信 ] [ 📕 小红书 ] [ 📺 B站 ]            │
   │                                                                     │
   │  浏览器:   [ 全部 ] [ 🌐 Chrome ] [ 🔷 Edge ] [ 更多 ▼ ]            │
   │                                    ▲           ▲                    │
   │                                    └─────┬─────┘                    │
   │                                          │                          │
   │                                     V1.2 新增                       │
   │                                                                     │
   │  组合筛选: [ 全平台 ▼ ] ← 快速切换"仅内容平台"或"仅浏览器"          │
   └────────────────────────────────────────────────────────────────────┘

   设计优势：
   - 视觉分离：内容平台与浏览器分行显示，层次清晰
   - 易于扩展：未来增加 Firefox/Safari/360 等浏览器时无需重构
   - 组合筛选：用户可快速聚焦到某一类平台

2. 统计分析集成
   ┌────────────────────────────────────────────────────────────────────┐
   │  平台分布饼图                                                       │
   │                                                                     │
   │        微信 35%  ┌──────┐                                          │
   │        B站 25%   │      │  Chrome 15%                              │
   │        小红书 15% │      │  Edge 10%   ← V1.2 自动包含              │
   │                  └──────┘                                          │
   │                                                                     │
   │  内容类型统计                                                       │
   │  [ 文章: 120 ] [ 视频: 80 ] [ 图文: 60 ] [ 网页: 50 ]              │
   │                                            ▲                       │
   │                                            └── V1.2 新增类型       │
   └────────────────────────────────────────────────────────────────────┘

3. 书签卡片集成
   ┌────────────────────────────────────────────────────────────────────┐
   │  ┌─────────────────────────────────────────┐                       │
   │  │  🌐 Chrome  GitHub                       │                       │
   │  │  ────────────────────                   │                       │
   │  │  Where the world builds software        │                       │
   │  │  ────────────────────                   │                       │
   │  │  🏷️ 开发 · 代码托管                      │                       │
   │  └─────────────────────────────────────────┘                       │
   │              ▲                                                      │
   │              └── 平台标识与其他平台一致                              │
   └────────────────────────────────────────────────────────────────────┘
```

### 6.3 分批导入流程设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      自动分批导入流程                                    │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│   用户上传文件    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   解析 HTML      │
│   检测浏览器来源  │ ← 自动检测或用户选择 Chrome/Edge
│   统计书签数量    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│                 书签数量 > 100 ?                      │
└────────┬─────────────────────────────────┬───────────┘
         │ Yes                             │ No
         ▼                                 ▼
┌──────────────────┐              ┌──────────────────┐
│   计算批次数      │              │   直接导入       │
│   Math.ceil(n/100)│              │   单次 API 调用  │
└────────┬─────────┘              │   platform: BROWSER_CHROME/EDGE
         │                        └──────────────────┘
         ▼
┌──────────────────┐
│ 缓存到 IndexedDB  │ ← 支持大数据量
│ 记录 platform     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│   开始批次 1     │────▶│  调用 API       │
│                  │     │  POST /import    │
│                  │     │  platform: ...   │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         │◀───────────────────────┘
         ▼
    [继续下一批...]
```

### 6.4 首页集成方案

将现有"批量导入"按钮改为下拉菜单：

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             我的收藏                                      │
│                             共 156 条收藏                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   [ 批量导入 ▼ ]  [ 导出 ]  [ 批量选择 ]      排序 ▼   布局 ▼   视图 ▼   │
│       │                                                                   │
│       ▼                                                                   │
│   ┌─────────────────────────┐                                            │
│   │ 📄 从 JSON 文件导入     │  ← 现有功能                                │
│   ├─────────────────────────┤                                            │
│   │ 🌐 从浏览器书签导入     │  ← V1.2 新增                               │
│   │    支持 Chrome / Edge   │                                            │
│   └─────────────────────────┘                                            │
│                                                                           │
│  平台筛选:                                                                │
│  [ 全部 ] [ 微信 ] [ 小红书 ] [ B站 ] [ Chrome ] [ Edge ]                │
│                                          ▲         ▲                     │
│                                          └────┬────┘                     │
│                                          V1.2 新增                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. UI/UX 设计

### 7.1 入口设计

**位置**：首页 → 工具栏 → "批量导入" 下拉菜单

### 7.2 导入对话框设计（步骤式）

#### Step 1: 上传文件（含来源选择）

```
┌─────────────────────────────────────────────────────────────────┐
│ ✕                    导入浏览器书签                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  步骤指示: ● 上传文件  ○ 预览选择  ○ 配置选项  ○ 开始导入       │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │     📁 拖放 HTML 文件到此处，或点击选择                     │  │
│  │                                                            │  │
│  │     支持 Chrome、Edge 导出的书签文件                        │  │
│  │     如何导出书签？查看教程                                  │  │
│  │                                                            │  │
│  │     [ 选择文件 ]    [ + 添加更多 ]                          │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  已选择文件:                                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🌐 Chrome_bookmarks.html                                   │  │
│  │    来源: [ Chrome ▼ ]  |  245 个书签  |  12 个文件夹 [ × ] │  │
│  │           ↑ 自动检测，可手动修改                           │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ 🔷 Edge_favorites.html                                     │  │
│  │    来源: [ Edge ▼ ]    |  189 个书签  |  8 个文件夹  [ × ] │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  📊 合计: 434 个书签 (去重后约 380 个)                           │
│  📌 来源: Chrome 245 条 | Edge 189 条                           │
│                                                                  │
│                                      [ 取消 ]  [ 下一步 → ]     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 2-5: 与 V1.1 相同

（预览选择、配置选项、导入进度、导入结果，设计不变）

### 7.3 导入结果展示（平台化）

```
┌─────────────────────────────────────────────────────────────────┐
│                       🎉 导入完成                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │                    ✅ 成功导入 145 条书签                  │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │  🌐 Chrome: 89 条     🔷 Edge: 56 条                 │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │         新建文件夹: 12 个                                  │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  📊 详细统计                                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ✅ 成功导入: 145 条                                        │  │
│  │    • Chrome: 89 条                                         │  │
│  │    • Edge: 56 条                                           │  │
│  │ ⏭️ 跳过 (重复): 8 条                                       │  │
│  │ ❌ 导入失败: 3 条   [ 查看详情 ▼ ]                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  💡 下一步建议                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • 使用平台筛选查看 Chrome 或 Edge 书签                     │  │
│  │ • 运行 AI 智能分类，自动整理书签                           │  │
│  │ • 检查"待整理"文件夹中的新书签                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [ 查看 Chrome 书签 ]  [ 查看 Edge 书签 ]  [ 关闭 ]            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. 实现计划

### 8.1 总体时间估算（更新）

| 阶段     | 功能范围                         | 预估工时     | 优先级 |
| -------- | -------------------------------- | ------------ | ------ |
| Phase 1  | MVP 核心功能 + 平台化基础        | 5-6 天       | P0     |
| Phase 2  | 增强功能（含分批）+ 平台分组集成 | 4-5 天       | P1     |
| Phase 3  | 高级功能                         | 3-4 天       | P2     |
| **总计** | **全部功能**                     | **12-15 天** | -      |

### 8.2 Phase 1: MVP 核心功能 (P0)

**目标**: 实现单文件导入的完整流程 + 平台化基础

#### 任务列表

| 序号 | 任务               | 描述                                         | 工时 | 依赖     |
| ---- | ------------------ | -------------------------------------------- | ---- | -------- |
| 1.1  | 创建模块结构       | 创建 `lib/browser-bookmark` 目录和基础文件   | 0.5h | -        |
| 1.2  | 类型定义           | 定义所有 TypeScript 接口（含 BrowserSource） | 1h   | 1.1      |
| 1.3  | **平台常量扩展**   | 新增 BROWSER_CHROME/EDGE 完整配置            | 1h   | -        |
| 1.4  | **浏览器来源检测** | 实现 detector.ts 自动识别逻辑                | 2h   | 1.2      |
| 1.5  | HTML 解析器        | 使用 DOMParser 解析 Netscape Bookmark HTML   | 4h   | 1.2      |
| 1.6  | 解析器测试         | 为解析器编写测试用例                         | 2h   | 1.5      |
| 1.7  | **来源选择组件**   | 支持自动检测 + 手动选择                      | 1.5h | 1.4      |
| 1.8  | 文件上传组件       | 支持拖放和点击上传                           | 2h   | 1.2      |
| 1.9  | 书签树组件         | 树形展示 + 勾选功能                          | 4h   | 1.5      |
| 1.10 | 导入选项组件       | 配置表单                                     | 2h   | 1.2      |
| 1.11 | 导入对话框         | 整合各步骤组件（步骤式）                     | 4h   | 1.7-1.10 |
| 1.12 | 导入 API           | 扩展 batch-import，支持 platform 参数        | 3h   | 1.3      |
| 1.13 | 进度与结果展示     | 导入过程可视化（含平台分布）                 | 2h   | 1.11     |
| 1.14 | 首页集成           | 下拉菜单入口                                 | 2h   | 1.11     |
| 1.15 | 集成测试           | 端到端流程测试                               | 2h   | 全部     |

**Phase 1 验收标准**:

- [ ] 可上传 Chrome/Edge 导出的 HTML 书签文件
- [ ] 自动检测浏览器来源，支持手动修改
- [ ] 正确解析文件夹结构和书签
- [ ] 支持预览和勾选
- [ ] 成功导入到数据库，platform 正确设置
- [ ] 显示导入结果（含平台分布）
- [ ] 首页可访问入口

### 8.3 Phase 2: 增强功能 (P1)

**目标**: 支持多文件合并、分批导入、平台分组筛选集成

#### 任务列表

| 序号 | 任务               | 描述                             | 工时 | 依赖    |
| ---- | ------------------ | -------------------------------- | ---- | ------- |
| 2.1  | 多文件上传         | 支持同时上传多个文件             | 2h   | P1 完成 |
| 2.2  | 合并去重逻辑       | 基于 URL 的智能去重              | 3h   | 2.1     |
| 2.3  | **平台分组常量**   | 新增 platform-groups.ts 配置文件 | 1h   | 1.3     |
| 2.4  | **分组筛选组件**   | 实现 PlatformFilter 分组筛选组件 | 3h   | 2.3     |
| 2.5  | **首页筛选重构**   | 首页集成分组筛选，替换原平面列表 | 2h   | 2.4     |
| 2.6  | **统计分析扩展**   | 内容类型新增"网页"类型           | 1h   | 1.3     |
| 2.7  | 文件夹自动创建     | 根据原结构创建 AnyKeep 文件夹    | 3h   | P1 完成 |
| 2.8  | 原始时间保留       | 保留并显示原书签添加时间         | 1h   | P1 完成 |
| 2.9  | 分批处理器         | 实现 batcher.ts 分批逻辑         | 3h   | P1 完成 |
| 2.10 | **IndexedDB 缓存** | 实现 cache.ts 缓存管理           | 2.5h | 2.9     |
| 2.11 | 分批进度 UI        | 显示批次进度和累计统计           | 2h   | 2.9     |
| 2.12 | 暂停/恢复功能      | 支持中断后继续                   | 2h   | 2.10    |
| 2.13 | 层级深度检测       | 检测超过 5 层的文件夹并提示      | 1.5h | P1 完成 |
| 2.14 | AI 分类集成        | 导入后可选启用 AI 自动分类       | 2h   | P1 完成 |
| 2.15 | 数据库扩展         | 新增 browser_add_date 等字段     | 1h   | P1 完成 |

**Phase 2 验收标准**:

- [ ] 支持同时上传 Chrome + Edge 书签
- [ ] 多文件自动合并去重
- [ ] **首页平台筛选采用分组设计（内容平台 / 浏览器）**
- [ ] **分组筛选支持"全平台/仅内容/仅浏览器"快速切换**
- [ ] **统计分析包含 Chrome/Edge 数据**
- [ ] 超过 100 条自动分批
- [ ] 分批进度实时显示（IndexedDB 缓存）
- [ ] 支持暂停/继续
- [ ] 超过 5 层文件夹时显示警告

### 8.4 Phase 3: 高级功能 (P2)

**目标**: 提升用户体验和数据质量

#### 任务列表

| 序号 | 任务           | 描述                                        | 工时 | 依赖    |
| ---- | -------------- | ------------------------------------------- | ---- | ------- |
| 3.1  | 链接有效性检测 | 导入前检测失效链接                          | 4h   | P2 完成 |
| 3.2  | 元数据自动抓取 | 获取网页标题/描述/封面                      | 4h   | P2 完成 |
| 3.3  | 导出为 HTML    | 支持导出为 Netscape Bookmark 格式（按平台） | 3h   | P1 完成 |
| 3.4  | 导入历史记录   | 记录每次导入的统计信息（含平台）            | 2h   | 2.13    |
| 3.5  | 历史记录 UI    | 显示导入历史列表                            | 2h   | 3.4     |

**Phase 3 验收标准**:

- [ ] 导入前可选检测失效链接
- [ ] 可自动获取书签元数据
- [ ] 可导出为 HTML 格式（支持按平台筛选）
- [ ] 可查看导入历史

### 8.5 里程碑计划

```
Week 1-2: Phase 1 (MVP + 平台化基础)
├── Day 1-2: 基础架构 + 平台常量 (1.1-1.4)
├── Day 3-4: 解析器 + UI 组件 (1.5-1.10)
├── Day 5-6: 对话框 + API + 首页集成 (1.11-1.14)
└── Day 7: 测试和修复 (1.15)

Week 3-4: Phase 2 (增强 + 平台分组集成)
├── Day 1: 多文件上传 + 合并去重 (2.1-2.2)
├── Day 2: 平台分组常量 + 分组筛选组件 (2.3-2.4)
├── Day 3: 首页筛选重构 + 统计分析扩展 (2.5-2.6)
├── Day 4: 分批处理 + IndexedDB 缓存 (2.9-2.12)
└── Day 5: 文件夹 + AI + 数据库 + 深度检测 (2.7-2.8, 2.13-2.15)

Week 4-5: Phase 3 (高级)
├── Day 1-2: 链接检测和元数据 (3.1-3.2)
├── Day 3: 导出功能 (3.3)
└── Day 4: 历史记录 (3.4-3.5)
```

---

## 9. 风险与注意事项

### 9.1 技术风险

| 风险               | 影响         | 缓解措施                  |
| ------------------ | ------------ | ------------------------- |
| 大文件解析性能     | 浏览器卡顿   | 使用 Web Worker 异步解析  |
| 书签数量过多       | 配额不足     | 导入前检查并提示          |
| HTML 格式差异      | 解析失败     | 增强解析器容错性          |
| 中文乱码           | 标题显示异常 | 正确处理 UTF-8 编码       |
| 分批导入中断       | 数据不完整   | IndexedDB 缓存 + 恢复功能 |
| API 限流           | 批次失败     | 批次间增加 500ms 延迟     |
| **浏览器来源误判** | 平台标记错误 | 自动检测 + 手动选择       |

### 9.2 业务风险

| 风险                 | 影响         | 缓解措施                            | 状态          |
| -------------------- | ------------ | ----------------------------------- | ------------- |
| 用户导入大量无效链接 | 数据质量下降 | P2 阶段增加链接检测                 | 计划中        |
| 文件夹层级过深       | 管理困难     | 限制最大 5 层 + 警告提示            | ✅ 已规划     |
| 重复导入             | 数据冗余     | 默认启用去重                        | ✅ 已规划     |
| 存储配额超限         | 导入失败     | 导入前检查配额                      | 计划中        |
| **平台筛选过多**     | 界面拥挤     | **采用分组设计（内容平台/浏览器）** | ✅ **已解决** |

### 9.3 注意事项

1. **隐私安全**: 书签文件在客户端解析，不上传原始文件到服务器
2. **用户体验**: 大量书签时显示进度条，支持暂停/取消操作
3. **数据完整性**: 每批独立事务，失败不影响已成功批次
4. **向后兼容**: 预留 Firefox/Safari 支持字段
5. **层级限制**: 超过 5 层时提示用户先整理，可选择忽略继续
6. **平台一致性**: Chrome/Edge 作为平台，与微信/B站/小红书享有同等的筛选、统计、展示能力

---

## 附录

### A. 浏览器书签导出教程

#### Chrome 导出步骤

1. 打开 Chrome，按 `Ctrl+Shift+O` 打开书签管理器
2. 点击右上角 `⋮` → `导出书签`
3. 选择保存位置，保存为 `.html` 文件

#### Edge 导出步骤

1. 打开 Edge，按 `Ctrl+Shift+O` 打开收藏夹
2. 点击 `⋯` → `导出收藏夹`
3. 选择保存位置，保存为 `.html` 文件

### B. 平台配置完整参考

```typescript
// 完整的平台配置（V1.2）
export const PLATFORM_CONFIGS = {
  WECHAT_OFFICIAL_ACCOUNT: {
    name: "微信公众号",
    icon: "💬",
    hexColor: "#07c160",
  },
  BILIBILI: { name: "B站", icon: "📺", hexColor: "#00a1d6" },
  XIAOHONGSHU: { name: "小红书", icon: "📕", hexColor: "#ff2442" },
  BROWSER_CHROME: { name: "Chrome", icon: "🌐", hexColor: "#4285f4" },
  BROWSER_EDGE: { name: "Edge", icon: "🔷", hexColor: "#0078d4" },
  BROWSER_FIREFOX: { name: "Firefox", icon: "🦊", hexColor: "#ff7139" },
  BROWSER_SAFARI: { name: "Safari", icon: "🧭", hexColor: "#006cff" },
  UNKNOWN: { name: "其他", icon: "📌", hexColor: "#9ca3af" },
};
```

### C. 参考资料

1. [Netscape Bookmark File Format](https://pinefore.com/docs/filetypes/netscape-html)
2. [Chrome Bookmarks - File Format](http://fileformats.archiveteam.org/wiki/Chrome_bookmarks)
3. [netscape-bookmark-parser (npm)](https://www.npmjs.com/package/netscape-bookmark-parser)
4. [TidyMark - Chrome/Edge 书签管理扩展](https://github.com/PanHywel/TidyMark)

---

**文档状态**: 待审核（V1.3 平台分组筛选更新）
**下一步**: 用户确认后进入开发阶段

**V1.3 更新摘要**:

- ✅ 新增平台分组筛选 UI 设计（内容平台 / 浏览器分组）
- ✅ 新增 `platform-groups.ts` 配置文件设计
- ✅ 新增 `PlatformFilter` 分组筛选组件设计
- ✅ 更新 Phase 2 任务列表（2.3-2.5 分组筛选相关）
- ✅ 更新工时估算（12-15 天）
- ✅ 解决"平台筛选过多导致界面拥挤"风险
