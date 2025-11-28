# 浏览器书签导入功能 - 开发计划

**版本**: V1.0
**日期**: 2025-11-28
**基于设计文档**: browser-bookmark-import.md V1.3
**状态**: 待审核

---

## 目录

1. [开发计划总览](#1-开发计划总览)
2. [现有代码分析](#2-现有代码分析)
3. [Phase 1 详细任务拆解](#3-phase-1-详细任务拆解)
4. [Phase 2 详细任务拆解](#4-phase-2-详细任务拆解)
5. [Phase 3 详细任务拆解](#5-phase-3-详细任务拆解)
6. [文件结构预览](#6-文件结构预览)
7. [关键技术决策](#7-关键技术决策)
8. [风险点和注意事项](#8-风险点和注意事项)
9. [测试策略](#9-测试策略)

---

## 1. 开发计划总览

### 1.1 总体时间估算

| 阶段        | 功能范围                           | 预估工时     | 状态   |
| ----------- | ---------------------------------- | ------------ | ------ |
| **Phase 1** | MVP 核心功能 + 平台化基础          | 5-6 天       | 待开发 |
| **Phase 2** | 增强功能 + 平台分组筛选 + 分批导入 | 4-5 天       | 待开发 |
| **Phase 3** | 高级功能（链接检测、导出等）       | 3-4 天       | 待开发 |
| **总计**    | 全部功能                           | **12-15 天** | -      |

### 1.2 里程碑计划

```
Week 1-2: Phase 1 (MVP + 平台化基础)
├── Day 1-2: 基础架构 + 平台常量扩展 + 浏览器来源检测
├── Day 3-4: HTML 解析器 + 核心 UI 组件
├── Day 5-6: 导入对话框 + API 扩展 + 首页集成
└── Day 7: 测试和修复

Week 3-4: Phase 2 (增强 + 平台分组集成)
├── Day 1: 多文件上传 + 合并去重
├── Day 2: 平台分组常量 + 分组筛选组件
├── Day 3: 首页筛选重构 + 统计分析扩展
├── Day 4: 分批处理 + IndexedDB 缓存
└── Day 5: 文件夹自动创建 + AI 分类 + 深度检测

Week 4-5: Phase 3 (高级)
├── Day 1-2: 链接有效性检测和元数据抓取
├── Day 3: 导出功能
└── Day 4: 导入历史记录
```

### 1.3 任务总览表

| Phase | 任务编号 | 任务名称       | 工时 | 依赖     |
| ----- | -------- | -------------- | ---- | -------- |
| **1** | 1.1      | 创建模块结构   | 0.5h | -        |
| **1** | 1.2      | 类型定义       | 1h   | 1.1      |
| **1** | 1.3      | 平台常量扩展   | 1h   | -        |
| **1** | 1.4      | 浏览器来源检测 | 2h   | 1.2      |
| **1** | 1.5      | HTML 解析器    | 4h   | 1.2      |
| **1** | 1.6      | 解析器测试     | 2h   | 1.5      |
| **1** | 1.7      | 来源选择组件   | 1.5h | 1.4      |
| **1** | 1.8      | 文件上传组件   | 2h   | 1.2      |
| **1** | 1.9      | 书签树组件     | 4h   | 1.5      |
| **1** | 1.10     | 导入选项组件   | 2h   | 1.2      |
| **1** | 1.11     | 导入对话框     | 4h   | 1.7-1.10 |
| **1** | 1.12     | 导入 API 扩展  | 3h   | 1.3      |
| **1** | 1.13     | 进度与结果展示 | 2h   | 1.11     |
| **1** | 1.14     | 首页集成       | 2h   | 1.11     |
| **1** | 1.15     | 集成测试       | 2h   | 全部     |
| **2** | 2.1      | 多文件上传     | 2h   | P1       |
| **2** | 2.2      | 合并去重逻辑   | 3h   | 2.1      |
| **2** | 2.3      | 平台分组常量   | 1h   | 1.3      |
| **2** | 2.4      | 分组筛选组件   | 3h   | 2.3      |
| **2** | 2.5      | 首页筛选重构   | 2h   | 2.4      |
| **2** | 2.6      | 统计分析扩展   | 1h   | 1.3      |
| **2** | 2.7      | 文件夹自动创建 | 3h   | P1       |
| **2** | 2.8      | 原始时间保留   | 1h   | P1       |
| **2** | 2.9      | 分批处理器     | 3h   | P1       |
| **2** | 2.10     | IndexedDB 缓存 | 2.5h | 2.9      |
| **2** | 2.11     | 分批进度 UI    | 2h   | 2.9      |
| **2** | 2.12     | 暂停/恢复功能  | 2h   | 2.10     |
| **2** | 2.13     | 层级深度检测   | 1.5h | P1       |
| **2** | 2.14     | AI 分类集成    | 2h   | P1       |
| **2** | 2.15     | 数据库扩展     | 1h   | P1       |
| **3** | 3.1      | 链接有效性检测 | 4h   | P2       |
| **3** | 3.2      | 元数据自动抓取 | 4h   | P2       |
| **3** | 3.3      | 导出为 HTML    | 3h   | P1       |
| **3** | 3.4      | 导入历史记录   | 2h   | 2.15     |
| **3** | 3.5      | 历史记录 UI    | 2h   | 3.4      |

---

## 2. 现有代码分析

### 2.1 平台配置现状 (`src/lib/constants/platforms.ts`)

**现有平台类型**:

- `WECHAT_OFFICIAL_ACCOUNT` - 微信公众号
- `BILIBILI` - B站
- `XIAOHONGSHU` - 小红书
- `UNKNOWN` - 其他

**需要新增**:

- `BROWSER_CHROME` - Chrome 书签
- `BROWSER_EDGE` - Edge 书签
- `BROWSER_FIREFOX` - Firefox 书签（预留）
- `BROWSER_SAFARI` - Safari 书签（预留）

**现有函数**:

- `getPlatformConfig()` - 获取平台配置
- `getPlatformName()` - 获取平台名称
- `getPlatformHexColor()` - 获取平台颜色
- `getPlatformBgColor()` - 获取背景色类名
- `getPlatformIcon()` - 获取平台图标
- `detectPlatformFromUrl()` - 从 URL 检测平台（浏览器书签不使用此函数）

### 2.2 首页筛选现状 (`src/components/home/home-page-client.tsx`)

**现有实现**:

```typescript
const platforms = [
  { id: "all", name: "全部", value: "" },
  { id: "wechat", name: "微信", value: "WECHAT_OFFICIAL_ACCOUNT" },
  { id: "xiaohongshu", name: "小红书", value: "XIAOHONGSHU" },
  { id: "bilibili", name: "B站", value: "BILIBILI" },
];
```

**改造方向**:

- 将平面列表改为分组设计（内容平台 / 浏览器）
- 支持"全平台/仅内容/仅浏览器"快速切换
- 新增 Chrome/Edge 筛选选项

### 2.3 批量导入 API 现状 (`src/app/api/bookmarks/batch-import/route.ts`)

**现有功能**:

- 支持最多 100 条/批次
- URL 去重检查
- 存储配额检查
- 自动检测 platform（通过 URL）

**需要扩展**:

- 支持直接指定 platform 参数（浏览器书签不通过 URL 检测）
- 支持 `browser_add_date` 字段（保留原始添加时间）
- 支持 `import_source` 字段（记录导入来源）

### 2.4 类型定义现状 (`src/types/supabase.ts`)

**现有 Platform 类型**:

```typescript
export type Platform =
  | "WECHAT_OFFICIAL_ACCOUNT"
  | "BILIBILI"
  | "XIAOHONGSHU"
  | "UNKNOWN";
```

**需要扩展**:

```typescript
export type Platform =
  | "WECHAT_OFFICIAL_ACCOUNT"
  | "BILIBILI"
  | "XIAOHONGSHU"
  | "BROWSER_CHROME" // 新增
  | "BROWSER_EDGE" // 新增
  | "BROWSER_FIREFOX" // 预留
  | "BROWSER_SAFARI" // 预留
  | "UNKNOWN";
```

---

## 3. Phase 1 详细任务拆解

### 3.1 任务 1.1: 创建模块结构

**目标**: 建立浏览器书签模块的基础目录和文件结构

**执行步骤**:

1. 创建 `src/lib/browser-bookmark/` 目录
2. 创建 `src/components/browser-bookmark/` 目录
3. 创建各模块入口文件

**需要创建的文件**:

```
src/lib/browser-bookmark/
├── index.ts                # 模块导出入口
├── types.ts                # 类型定义（任务 1.2）
├── parser.ts               # HTML 解析器（任务 1.5）
├── detector.ts             # 浏览器来源检测（任务 1.4）
├── validator.ts            # 验证器（层级深度等）
├── constants.ts            # 模块常量

src/components/browser-bookmark/
├── index.ts                # 组件导出入口
├── import-dialog.tsx       # 导入对话框（任务 1.11）
├── file-uploader.tsx       # 文件上传组件（任务 1.8）
├── source-selector.tsx     # 来源选择组件（任务 1.7）
├── bookmark-tree.tsx       # 书签树组件（任务 1.9）
├── import-options.tsx      # 导入选项组件（任务 1.10）
├── import-progress.tsx     # 进度展示（任务 1.13）
└── import-result.tsx       # 结果展示（任务 1.13）
```

**验收标准**:

- [ ] 所有目录已创建
- [ ] 入口文件导出结构清晰
- [ ] 无 TypeScript 错误

**工时**: 0.5h

---

### 3.2 任务 1.2: 类型定义

**目标**: 定义浏览器书签模块所需的所有 TypeScript 接口

**执行步骤**:

1. 定义 `ParsedBookmarkNode` 接口（解析后的书签节点）
2. 定义 `BrowserSource` 类型（浏览器来源）
3. 定义 `ParsedBookmarkFile` 接口（解析后的文件）
4. 定义 `BrowserBookmarkImportOptions` 接口（导入配置）
5. 定义 `ImportProgress` 接口（导入进度）
6. 定义 `BROWSER_SOURCE_TO_PLATFORM` 映射

**需要创建/修改的文件**:

- 创建: `src/lib/browser-bookmark/types.ts`

**代码结构**:

```typescript
// types.ts 核心类型
export interface ParsedBookmarkNode {
  type: "folder" | "bookmark";
  title: string;
  url?: string;
  addDate?: number;
  lastModified?: number;
  icon?: string;
  description?: string;
  children?: ParsedBookmarkNode[];
  path: string[];
  id: string;
  depth: number;
}

export type BrowserSource =
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "unknown";

export interface ParsedBookmarkFile {
  fileName: string;
  source: BrowserSource;
  platform: Platform;
  roots: ParsedBookmarkNode[];
  totalBookmarks: number;
  totalFolders: number;
  maxDepth: number;
  parsedAt: Date;
}

export interface BrowserBookmarkImportOptions {
  selectedIds: string[];
  targetFolderId: number | null;
  keepFolderStructure: boolean;
  autoCreateFolders: boolean;
  enableAiClassify: boolean;
  overwriteExisting: boolean;
  preserveAddDate: boolean;
}

export interface ImportProgress {
  totalBookmarks: number;
  totalBatches: number;
  currentBatch: number;
  batchProgress: { total: number; processed: number };
  totalSuccess: number;
  totalFailed: number;
  totalSkipped: number;
  currentItem?: string;
  status: "idle" | "parsing" | "importing" | "paused" | "completed" | "error";
  errorMessage?: string;
}
```

**验收标准**:

- [ ] 所有类型定义完整
- [ ] 类型与设计文档一致
- [ ] 无 TypeScript 错误

**工时**: 1h

---

### 3.3 任务 1.3: 平台常量扩展

**目标**: 在现有平台配置中新增 Chrome/Edge 等浏览器平台

**执行步骤**:

1. 修改 `src/types/supabase.ts` 扩展 `Platform` 类型
2. 修改 `src/lib/constants/platforms.ts` 添加浏览器平台配置
3. 新增 `isBrowserPlatform()` 工具函数
4. 新增 `BROWSER_PLATFORMS` 常量数组

**需要修改的文件**:

- 修改: `src/types/supabase.ts`
- 修改: `src/lib/constants/platforms.ts`

**修改内容 (platforms.ts)**:

```typescript
// 新增浏览器平台配置
BROWSER_CHROME: {
  name: 'Chrome',
  key: 'chrome',
  hexColor: '#4285f4',
  bgColor: 'bg-blue-500',
  icon: '🌐',
},
BROWSER_EDGE: {
  name: 'Edge',
  key: 'edge',
  hexColor: '#0078d4',
  bgColor: 'bg-cyan-600',
  icon: '🔷',
},
BROWSER_FIREFOX: {
  name: 'Firefox',
  key: 'firefox',
  hexColor: '#ff7139',
  bgColor: 'bg-orange-500',
  icon: '🦊',
},
BROWSER_SAFARI: {
  name: 'Safari',
  key: 'safari',
  hexColor: '#006cff',
  bgColor: 'bg-sky-500',
  icon: '🧭',
},

// 新增工具函数
export const BROWSER_PLATFORMS: Platform[] = [
  'BROWSER_CHROME',
  'BROWSER_EDGE',
  'BROWSER_FIREFOX',
  'BROWSER_SAFARI',
]

export function isBrowserPlatform(platform: Platform): boolean {
  return BROWSER_PLATFORMS.includes(platform)
}
```

**验收标准**:

- [ ] Platform 类型已扩展
- [ ] 平台配置已添加
- [ ] `isBrowserPlatform()` 函数正常工作
- [ ] 现有代码不受影响

**工时**: 1h

---

### 3.4 任务 1.4: 浏览器来源检测

**目标**: 实现自动检测书签文件来源（Chrome/Edge）的功能

**执行步骤**:

1. 创建 `src/lib/browser-bookmark/detector.ts`
2. 实现文件名检测策略
3. 实现 HTML 内容检测策略
4. 实现综合检测函数

**需要创建的文件**:

- 创建: `src/lib/browser-bookmark/detector.ts`

**代码结构**:

```typescript
// detector.ts
import type { BrowserSource } from "./types";

/**
 * 检测浏览器来源
 * 策略优先级: 1. 文件名 → 2. HTML 内容特征 → 3. unknown
 */
export function detectBrowserSource(
  fileName: string,
  htmlContent: string,
): BrowserSource {
  // 策略 1: 文件名检测
  const sourceFromFileName = detectFromFileName(fileName);
  if (sourceFromFileName !== "unknown") {
    return sourceFromFileName;
  }

  // 策略 2: HTML 内容特征检测
  return detectFromContent(htmlContent);
}

function detectFromFileName(fileName: string): BrowserSource {
  const lowerName = fileName.toLowerCase();
  if (lowerName.includes("chrome") || lowerName.includes("bookmark")) {
    return "chrome";
  }
  if (lowerName.includes("edge") || lowerName.includes("favorite")) {
    return "edge";
  }
  if (lowerName.includes("firefox")) {
    return "firefox";
  }
  if (lowerName.includes("safari")) {
    return "safari";
  }
  return "unknown";
}

function detectFromContent(htmlContent: string): BrowserSource {
  // Chrome 特征
  if (htmlContent.includes("书签栏") || htmlContent.includes("Bookmarks Bar")) {
    return "chrome";
  }
  // Edge 特征
  if (
    htmlContent.includes("收藏夹栏") ||
    htmlContent.includes("Favorites Bar")
  ) {
    return "edge";
  }
  return "unknown";
}
```

**验收标准**:

- [ ] Chrome 书签文件能正确识别
- [ ] Edge 书签文件能正确识别
- [ ] 无法识别时返回 'unknown'
- [ ] 单元测试覆盖主要场景

**工时**: 2h

---

### 3.5 任务 1.5: HTML 解析器

**目标**: 实现 Netscape Bookmark HTML 格式的解析器

**执行步骤**:

1. 创建 `src/lib/browser-bookmark/parser.ts`
2. 使用 DOMParser 解析 HTML
3. 递归遍历 `<DL>` 列表构建树形结构
4. 提取书签属性（URL、标题、时间、图标等）
5. 计算层级深度和路径

**需要创建的文件**:

- 创建: `src/lib/browser-bookmark/parser.ts`

**代码结构**:

```typescript
// parser.ts
import { v4 as uuidv4 } from "uuid";
import type {
  ParsedBookmarkNode,
  ParsedBookmarkFile,
  BrowserSource,
} from "./types";
import { detectBrowserSource } from "./detector";
import { BROWSER_SOURCE_TO_PLATFORM } from "./types";

/**
 * 解析书签 HTML 文件
 */
export function parseBookmarkHtml(
  fileName: string,
  htmlContent: string,
): ParsedBookmarkFile {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");

  // 检测浏览器来源
  const source = detectBrowserSource(fileName, htmlContent);
  const platform = BROWSER_SOURCE_TO_PLATFORM[source];

  // 查找根 DL 元素
  const rootDl = doc.querySelector("dl");
  if (!rootDl) {
    throw new Error("无效的书签文件格式：未找到书签列表");
  }

  // 统计变量
  let totalBookmarks = 0;
  let totalFolders = 0;
  let maxDepth = 0;

  // 递归解析
  const roots = parseBookmarkList(rootDl, [], 1);

  function parseBookmarkList(
    dl: Element,
    parentPath: string[],
    depth: number,
  ): ParsedBookmarkNode[] {
    const nodes: ParsedBookmarkNode[] = [];
    maxDepth = Math.max(maxDepth, depth);

    const children = dl.children;
    for (let i = 0; i < children.length; i++) {
      const dt = children[i];
      if (dt.tagName !== "DT") continue;

      // 检查是文件夹还是书签
      const h3 = dt.querySelector(":scope > h3");
      const a = dt.querySelector(":scope > a");
      const nestedDl = dt.querySelector(":scope > dl");

      if (h3) {
        // 文件夹
        const folderName = h3.textContent?.trim() || "未命名文件夹";
        const path = [...parentPath, folderName];
        totalFolders++;

        nodes.push({
          type: "folder",
          title: folderName,
          addDate: parseAddDate(h3.getAttribute("ADD_DATE")),
          lastModified: parseAddDate(h3.getAttribute("LAST_MODIFIED")),
          children: nestedDl
            ? parseBookmarkList(nestedDl, path, depth + 1)
            : [],
          path,
          id: uuidv4(),
          depth,
        });
      } else if (a) {
        // 书签
        const title = a.textContent?.trim() || "未命名书签";
        const path = [...parentPath, title];
        totalBookmarks++;

        // 获取描述（下一个 DD 元素）
        const nextSibling = dt.nextElementSibling;
        const description =
          nextSibling?.tagName === "DD"
            ? nextSibling.textContent?.trim()
            : undefined;

        nodes.push({
          type: "bookmark",
          title,
          url: a.getAttribute("HREF") || "",
          addDate: parseAddDate(a.getAttribute("ADD_DATE")),
          icon: a.getAttribute("ICON") || a.getAttribute("ICON_URI"),
          description,
          path,
          id: uuidv4(),
          depth,
        });
      }
    }

    return nodes;
  }

  return {
    fileName,
    source,
    platform,
    roots,
    totalBookmarks,
    totalFolders,
    maxDepth,
    parsedAt: new Date(),
  };
}

function parseAddDate(value: string | null): number | undefined {
  if (!value) return undefined;
  const timestamp = parseInt(value, 10);
  return isNaN(timestamp) ? undefined : timestamp;
}
```

**验收标准**:

- [ ] 能正确解析标准 Netscape Bookmark HTML
- [ ] 文件夹和书签都能正确识别
- [ ] 层级深度计算正确
- [ ] 路径信息正确
- [ ] 时间戳正确解析

**工时**: 4h

---

### 3.6 任务 1.6: 解析器测试

**目标**: 为 HTML 解析器编写单元测试

**执行步骤**:

1. 创建测试文件
2. 准备测试用的 HTML 样本
3. 测试基础解析功能
4. 测试边界情况

**需要创建的文件**:

- 创建: `src/lib/browser-bookmark/__tests__/parser.test.ts`
- 创建: `src/lib/browser-bookmark/__tests__/fixtures/` (测试数据)

**测试用例**:

```typescript
// parser.test.ts
describe("parseBookmarkHtml", () => {
  it("should parse Chrome bookmark file correctly", () => {});
  it("should parse Edge bookmark file correctly", () => {});
  it("should handle nested folders", () => {});
  it("should calculate depth correctly", () => {});
  it("should extract bookmark attributes", () => {});
  it("should handle empty folders", () => {});
  it("should throw error for invalid HTML", () => {});
});
```

**验收标准**:

- [ ] 测试覆盖率 > 80%
- [ ] 所有测试通过
- [ ] 包含边界情况测试

**工时**: 2h

---

### 3.7 任务 1.7: 来源选择组件

**目标**: 创建浏览器来源选择 UI 组件

**执行步骤**:

1. 创建 `source-selector.tsx` 组件
2. 显示自动检测结果
3. 支持手动修改来源
4. 集成到上传流程

**需要创建的文件**:

- 创建: `src/components/browser-bookmark/source-selector.tsx`

**组件接口**:

```typescript
interface SourceSelectorProps {
  detectedSource: BrowserSource;
  selectedSource: BrowserSource;
  onSourceChange: (source: BrowserSource) => void;
}
```

**验收标准**:

- [ ] 显示自动检测结果
- [ ] 可手动修改来源
- [ ] UI 美观，符合设计稿

**工时**: 1.5h

---

### 3.8 任务 1.8: 文件上传组件

**目标**: 创建支持拖放和点击上传的组件

**执行步骤**:

1. 创建 `file-uploader.tsx` 组件
2. 实现拖放功能
3. 实现点击选择功能
4. 验证文件类型（仅 .html）
5. 读取文件内容

**需要创建的文件**:

- 创建: `src/components/browser-bookmark/file-uploader.tsx`

**组件接口**:

```typescript
interface FileUploaderProps {
  onFileSelect: (file: File, content: string) => void;
  onError: (message: string) => void;
  accept?: string; // 默认 ".html"
}
```

**验收标准**:

- [ ] 拖放功能正常
- [ ] 点击选择功能正常
- [ ] 非 HTML 文件显示错误
- [ ] 大文件有加载提示

**工时**: 2h

---

### 3.9 任务 1.9: 书签树组件

**目标**: 创建可勾选的书签树形展示组件

**执行步骤**:

1. 创建 `bookmark-tree.tsx` 组件
2. 实现树形结构递归渲染
3. 实现单选/全选功能
4. 实现展开/折叠功能
5. 显示书签数量统计

**需要创建的文件**:

- 创建: `src/components/browser-bookmark/bookmark-tree.tsx`

**组件接口**:

```typescript
interface BookmarkTreeProps {
  nodes: ParsedBookmarkNode[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  expandedIds?: Set<string>;
  onExpandChange?: (ids: Set<string>) => void;
}
```

**验收标准**:

- [ ] 树形结构正确渲染
- [ ] 勾选/取消勾选功能正常
- [ ] 父节点勾选时子节点联动
- [ ] 展开/折叠功能正常
- [ ] 性能良好（支持 1000+ 节点）

**工时**: 4h

---

### 3.10 任务 1.10: 导入选项组件

**目标**: 创建导入配置表单组件

**执行步骤**:

1. 创建 `import-options.tsx` 组件
2. 实现目标文件夹选择
3. 实现各配置项开关
4. 表单验证

**需要创建的文件**:

- 创建: `src/components/browser-bookmark/import-options.tsx`

**配置项**:

- 目标文件夹（下拉选择）
- 保持原文件夹结构（开关）
- 自动创建文件夹（开关）
- 启用 AI 分类（开关，Phase 2）
- 覆盖已存在 URL（开关）
- 保留原始添加时间（开关）

**验收标准**:

- [ ] 所有配置项可用
- [ ] 文件夹选择器正常工作
- [ ] 配置状态正确传递

**工时**: 2h

---

### 3.11 任务 1.11: 导入对话框

**目标**: 创建步骤式导入对话框，整合各子组件

**执行步骤**:

1. 创建 `import-dialog.tsx` 组件
2. 实现 4 步流程（上传→预览→配置→导入）
3. 步骤指示器
4. 上一步/下一步导航
5. 状态管理

**需要创建的文件**:

- 创建: `src/components/browser-bookmark/import-dialog.tsx`

**组件接口**:

```typescript
interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
```

**步骤流程**:

1. **上传文件**: FileUploader + SourceSelector
2. **预览选择**: BookmarkTree
3. **配置选项**: ImportOptions
4. **开始导入**: ImportProgress + ImportResult

**验收标准**:

- [ ] 4 步流程完整
- [ ] 步骤间切换流畅
- [ ] 状态正确保持
- [ ] 取消/关闭行为正确

**工时**: 4h

---

### 3.12 任务 1.12: 导入 API 扩展

**目标**: 扩展现有批量导入 API 以支持浏览器书签

**执行步骤**:

1. 修改 `batch-import/route.ts` 支持 platform 参数
2. 新增 `browser_add_date` 字段支持
3. 新增 `import_source` 字段支持
4. 更新类型定义

**需要修改的文件**:

- 修改: `src/app/api/bookmarks/batch-import/route.ts`

**API 变更**:

```typescript
interface ImportBookmark {
  url: string;
  title: string;
  description?: string;
  folderId?: number;
  userTags?: string[];
  notes?: string;
  // 新增字段
  platform?: Platform; // 直接指定平台（浏览器书签用）
  browserAddDate?: string; // 原始添加时间
  importSource?: string; // 导入来源标记
}
```

**验收标准**:

- [ ] platform 参数生效
- [ ] browserAddDate 正确保存
- [ ] importSource 正确保存
- [ ] 向后兼容（不传参数时行为不变）

**工时**: 3h

---

### 3.13 任务 1.13: 进度与结果展示

**目标**: 创建导入进度和结果展示组件

**执行步骤**:

1. 创建 `import-progress.tsx` 组件
2. 创建 `import-result.tsx` 组件
3. 实现进度条动画
4. 实现结果统计展示

**需要创建的文件**:

- 创建: `src/components/browser-bookmark/import-progress.tsx`
- 创建: `src/components/browser-bookmark/import-result.tsx`

**ImportProgress 组件**:

- 进度条（当前批次/总批次）
- 当前处理项名称
- 已成功/失败/跳过数量

**ImportResult 组件**:

- 成功图标和消息
- 按平台分类的导入数量
- 失败项详情（可展开）
- 下一步建议

**验收标准**:

- [ ] 进度实时更新
- [ ] 结果统计准确
- [ ] UI 与设计稿一致

**工时**: 2h

---

### 3.14 任务 1.14: 首页集成

**目标**: 在首页添加浏览器书签导入入口

**执行步骤**:

1. 修改"批量导入"按钮为下拉菜单
2. 添加"从浏览器书签导入"选项
3. 集成 ImportDialog 组件

**需要修改的文件**:

- 修改: `src/components/home/home-page-client.tsx`

**UI 变更**:

```
现有: [ 批量导入 ]
改为: [ 批量导入 ▼ ]
       ├─ 📄 从 JSON 文件导入
       └─ 🌐 从浏览器书签导入
```

**验收标准**:

- [ ] 下拉菜单正常工作
- [ ] 两个导入入口都能打开对应对话框
- [ ] 移动端菜单也包含新选项

**工时**: 2h

---

### 3.15 任务 1.15: 集成测试

**目标**: 端到端测试整个导入流程

**执行步骤**:

1. 准备测试数据（Chrome/Edge 书签文件）
2. 测试完整导入流程
3. 验证数据库中数据正确性
4. 测试错误处理

**测试用例**:

- 导入 Chrome 书签文件
- 导入 Edge 书签文件
- URL 去重测试
- 取消导入测试
- 错误处理测试

**验收标准**:

- [ ] 完整流程可走通
- [ ] 数据正确保存
- [ ] 错误提示友好
- [ ] 无控制台错误

**工时**: 2h

---

### Phase 1 验收标准汇总

- [ ] 可上传 Chrome/Edge 导出的 HTML 书签文件
- [ ] 自动检测浏览器来源，支持手动修改
- [ ] 正确解析文件夹结构和书签
- [ ] 支持预览和勾选
- [ ] 成功导入到数据库，platform 正确设置为 `BROWSER_CHROME` 或 `BROWSER_EDGE`
- [ ] 显示导入结果（含平台分布）
- [ ] 首页可访问入口（下拉菜单）
- [ ] 重复 URL 自动跳过

---

## 4. Phase 2 详细任务拆解

### 4.1 任务 2.1: 多文件上传

**目标**: 支持同时上传多个书签文件

**执行步骤**:

1. 修改 `FileUploader` 支持多文件
2. 文件列表展示和管理
3. 单独删除已上传文件

**需要修改的文件**:

- 修改: `src/components/browser-bookmark/file-uploader.tsx`
- 修改: `src/components/browser-bookmark/import-dialog.tsx`

**验收标准**:

- [ ] 可同时上传多个文件
- [ ] 每个文件单独显示来源
- [ ] 可删除单个文件

**工时**: 2h

---

### 4.2 任务 2.2: 合并去重逻辑

**目标**: 实现多文件书签合并和去重

**执行步骤**:

1. 创建 `src/lib/browser-bookmark/merger.ts`
2. 基于 URL 的去重算法
3. 冲突解决策略（保留哪个来源）
4. 合并后统计信息

**需要创建的文件**:

- 创建: `src/lib/browser-bookmark/merger.ts`

**代码结构**:

```typescript
interface MergeResult {
  mergedBookmarks: ParsedBookmarkNode[];
  duplicatesRemoved: number;
  conflictResolutions: Array<{
    url: string;
    keptSource: BrowserSource;
    removedSource: BrowserSource;
  }>;
}

export function mergeBookmarkFiles(
  files: ParsedBookmarkFile[],
  strategy: "keep-first" | "keep-last" = "keep-first",
): MergeResult;
```

**验收标准**:

- [ ] 相同 URL 只保留一份
- [ ] 可选择保留策略
- [ ] 显示去重统计

**工时**: 3h

---

### 4.3 任务 2.3: 平台分组常量

**目标**: 创建平台分组配置文件

**执行步骤**:

1. 创建 `src/lib/constants/platform-groups.ts`
2. 定义分组类型和配置
3. 定义筛选选项结构

**需要创建的文件**:

- 创建: `src/lib/constants/platform-groups.ts`

**代码结构**:

```typescript
// platform-groups.ts
export type PlatformGroupType = "content" | "browser";

export interface PlatformGroup {
  id: PlatformGroupType;
  name: string;
  platforms: PlatformFilterOption[];
}

export interface PlatformFilterOption {
  id: string;
  name: string;
  value: Platform | "";
  icon?: string;
}

export const CONTENT_PLATFORMS: PlatformFilterOption[] = [
  { id: "wechat", name: "微信", value: "WECHAT_OFFICIAL_ACCOUNT", icon: "💬" },
  { id: "xiaohongshu", name: "小红书", value: "XIAOHONGSHU", icon: "📕" },
  { id: "bilibili", name: "B站", value: "BILIBILI", icon: "📺" },
];

export const BROWSER_PLATFORMS_FILTER: PlatformFilterOption[] = [
  { id: "chrome", name: "Chrome", value: "BROWSER_CHROME", icon: "🌐" },
  { id: "edge", name: "Edge", value: "BROWSER_EDGE", icon: "🔷" },
];

export const PLATFORM_GROUPS: PlatformGroup[] = [
  { id: "content", name: "内容平台", platforms: CONTENT_PLATFORMS },
  { id: "browser", name: "浏览器", platforms: BROWSER_PLATFORMS_FILTER },
];

export type FilterMode = "all" | "content" | "browser";

export function getPlatformsByMode(mode: FilterMode): PlatformFilterOption[];
```

**验收标准**:

- [ ] 分组配置完整
- [ ] 类型定义正确
- [ ] 支持未来扩展

**工时**: 1h

---

### 4.4 任务 2.4: 分组筛选组件

**目标**: 创建分组平台筛选 UI 组件

**执行步骤**:

1. 创建 `src/components/home/platform-filter.tsx`
2. 实现分行显示（内容平台 / 浏览器）
3. 实现组合筛选下拉菜单
4. 响应式设计

**需要创建的文件**:

- 创建: `src/components/home/platform-filter.tsx`

**组件接口**:

```typescript
interface PlatformFilterProps {
  currentPlatform: string;
  onPlatformChange: (platform: string) => void;
  filterMode: FilterMode;
  onFilterModeChange: (mode: FilterMode) => void;
}
```

**UI 设计**:

```
内容平台: [ 全部 ] [ 💬 微信 ] [ 📕 小红书 ] [ 📺 B站 ]
浏览器:   [ 全部 ] [ 🌐 Chrome ] [ 🔷 Edge ]
组合筛选: [ 全平台 ▼ ]
```

**验收标准**:

- [ ] 分组显示清晰
- [ ] 筛选功能正常
- [ ] 响应式布局良好

**工时**: 3h

---

### 4.5 任务 2.5: 首页筛选重构

**目标**: 将首页平台筛选改为分组设计

**执行步骤**:

1. 集成 `PlatformFilter` 组件
2. 移除旧的平面筛选列表
3. 更新 URL 参数处理
4. 测试筛选功能

**需要修改的文件**:

- 修改: `src/components/home/home-page-client.tsx`

**验收标准**:

- [ ] 新组件正常工作
- [ ] 筛选逻辑不变
- [ ] URL 参数正确处理

**工时**: 2h

---

### 4.6 任务 2.6: 统计分析扩展

**目标**: 在统计页面支持 Chrome/Edge 数据

**执行步骤**:

1. 修改平台分布图表逻辑
2. 新增"网页"内容类型
3. 更新统计计算逻辑

**需要修改的文件**:

- 修改: `src/app/(main)/analytics/page.tsx` (如存在)
- 修改相关统计组件

**内容类型映射**:

```typescript
// Chrome/Edge 书签 → "网页" 类型
if (platform === "BROWSER_CHROME" || platform === "BROWSER_EDGE") {
  typeMap["网页"]++;
}
```

**验收标准**:

- [ ] 平台分布包含 Chrome/Edge
- [ ] 内容类型新增"网页"
- [ ] 统计数据准确

**工时**: 1h

---

### 4.7 任务 2.7: 文件夹自动创建

**目标**: 根据浏览器书签结构自动创建 AnyKeep 文件夹

**执行步骤**:

1. 实现文件夹映射逻辑
2. 批量创建文件夹 API
3. 处理重名文件夹
4. 建立映射关系

**需要创建/修改的文件**:

- 创建: `src/lib/browser-bookmark/folder-mapper.ts`
- 可能需要新增: `src/app/api/folders/batch-create/route.ts`

**验收标准**:

- [ ] 正确创建文件夹层级
- [ ] 重名文件夹正确处理
- [ ] 书签正确归类到文件夹

**工时**: 3h

---

### 4.8 任务 2.8: 原始时间保留

**目标**: 保留并显示浏览器书签的原始添加时间

**执行步骤**:

1. 导入时保存 `browser_add_date`
2. 卡片组件显示原始时间
3. 支持按原始时间排序（可选）

**需要修改的文件**:

- 修改: API 和组件

**验收标准**:

- [ ] 原始时间正确保存
- [ ] 卡片上可查看原始时间

**工时**: 1h

---

### 4.9 任务 2.9: 分批处理器

**目标**: 实现超过 100 条时的自动分批逻辑

**执行步骤**:

1. 创建 `src/lib/browser-bookmark/batcher.ts`
2. 实现分批算法
3. 批次间延迟控制（500ms）
4. 进度回调

**需要创建的文件**:

- 创建: `src/lib/browser-bookmark/batcher.ts`

**代码结构**:

```typescript
interface BatcherOptions {
  batchSize: number; // 默认 100
  delayMs: number; // 默认 500
  onBatchStart?: (batch: number, total: number) => void;
  onBatchComplete?: (batch: number, result: BatchResult) => void;
  onProgress?: (progress: ImportProgress) => void;
}

export async function processBatches(
  bookmarks: ParsedBookmarkNode[],
  options: BatcherOptions,
): Promise<ImportResult>;
```

**验收标准**:

- [ ] 自动分批正确
- [ ] 批次间有延迟
- [ ] 进度实时回调

**工时**: 3h

---

### 4.10 任务 2.10: IndexedDB 缓存

**目标**: 实现 IndexedDB 缓存支持中断恢复

**执行步骤**:

1. 创建 `src/lib/browser-bookmark/cache.ts`
2. 使用 `idb` 库或原生 IndexedDB
3. 存储待导入队列
4. 存储进度状态
5. 恢复逻辑

**需要创建的文件**:

- 创建: `src/lib/browser-bookmark/cache.ts`

**数据结构**:

```typescript
interface CachedImportSession {
  id: string;
  createdAt: Date;
  batches: ImportBatch[];
  currentBatch: number;
  options: BrowserBookmarkImportOptions;
  progress: ImportProgress;
}

export class ImportCache {
  async saveSession(session: CachedImportSession): Promise<void>;
  async getSession(id: string): Promise<CachedImportSession | null>;
  async clearSession(id: string): Promise<void>;
  async hasPendingSession(): Promise<boolean>;
}
```

**验收标准**:

- [ ] 数据正确存储
- [ ] 页面刷新后可恢复
- [ ] 完成后自动清理

**工时**: 2.5h

---

### 4.11 任务 2.11: 分批进度 UI

**目标**: 更新进度组件支持分批显示

**执行步骤**:

1. 修改 `import-progress.tsx`
2. 显示批次进度（如 2/6）
3. 显示总体进度
4. 显示累计统计

**验收标准**:

- [ ] 批次进度清晰
- [ ] 总体进度准确
- [ ] UI 流畅不卡顿

**工时**: 2h

---

### 4.12 任务 2.12: 暂停/恢复功能

**目标**: 支持暂停导入并在稍后恢复

**执行步骤**:

1. 添加暂停按钮
2. 暂停时保存状态到 IndexedDB
3. 恢复时从 IndexedDB 读取
4. 首页提示有未完成的导入

**验收标准**:

- [ ] 可暂停当前导入
- [ ] 可恢复未完成的导入
- [ ] 有待恢复任务时显示提示

**工时**: 2h

---

### 4.13 任务 2.13: 层级深度检测

**目标**: 检测超过 5 层的文件夹并提示用户

**执行步骤**:

1. 创建 `src/lib/browser-bookmark/validator.ts`
2. 实现深度检测逻辑
3. 创建 `depth-warning.tsx` 警告组件
4. 用户确认后可继续

**需要创建的文件**:

- 创建: `src/lib/browser-bookmark/validator.ts`
- 创建: `src/components/browser-bookmark/depth-warning.tsx`

**验收标准**:

- [ ] 正确检测超深层级
- [ ] 警告信息清晰
- [ ] 用户可选择继续或取消

**工时**: 1.5h

---

### 4.14 任务 2.14: AI 分类集成

**目标**: 导入后可选启用 AI 自动分类

**执行步骤**:

1. 在导入选项中添加开关
2. 导入完成后调用现有 AI 分类 API
3. 显示分类进度

**验收标准**:

- [ ] 选项开关可用
- [ ] 导入后自动触发分类
- [ ] 分类结果正确

**工时**: 2h

---

### 4.15 任务 2.15: 数据库扩展

**目标**: 为书签表添加浏览器相关字段

**执行步骤**:

1. 创建数据库迁移文件
2. 添加 `browser_add_date` 字段
3. 添加 `browser_icon` 字段
4. 添加 `import_source` 字段
5. 创建 `import_history` 表

**需要创建的文件**:

- 创建: `supabase/migrations/xxx_browser_bookmark_fields.sql`

**SQL 迁移**:

```sql
-- 书签表扩展
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS browser_add_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS browser_icon TEXT,
ADD COLUMN IF NOT EXISTS import_source VARCHAR(50);

-- 导入历史表
CREATE TABLE IF NOT EXISTS public.import_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    import_type VARCHAR(50) NOT NULL,
    source VARCHAR(50),
    platform VARCHAR(50),
    file_name VARCHAR(255),
    total_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    skipped_count INT DEFAULT 0,
    batch_count INT DEFAULT 1,
    options JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import history" ON public.import_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own import history" ON public.import_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**验收标准**:

- [ ] 迁移执行成功
- [ ] 新字段可用
- [ ] RLS 策略正确

**工时**: 1h

---

### Phase 2 验收标准汇总

- [ ] 支持同时上传 Chrome + Edge 书签
- [ ] 多文件自动合并去重
- [ ] **首页平台筛选采用分组设计（内容平台 / 浏览器）**
- [ ] **分组筛选支持"全平台/仅内容/仅浏览器"快速切换**
- [ ] **统计分析包含 Chrome/Edge 数据，新增"网页"内容类型**
- [ ] 超过 100 条自动分批
- [ ] 分批进度实时显示（IndexedDB 缓存）
- [ ] 支持暂停/继续
- [ ] 超过 5 层文件夹时显示警告
- [ ] 导入后可选 AI 分类

---

## 5. Phase 3 详细任务拆解

### 5.1 任务 3.1: 链接有效性检测

**目标**: 导入前检测书签链接是否有效

**执行步骤**:

1. 创建检测 API `src/app/api/browser-bookmark/validate/route.ts`
2. 批量 HEAD 请求检测
3. 记录失效链接
4. UI 显示检测结果

**技术方案**:

- 使用 `HEAD` 请求减少流量
- 并发控制（最多 10 个并发）
- 超时设置（5 秒）
- 重试机制（1 次）

**验收标准**:

- [ ] 能检测失效链接
- [ ] 检测进度显示
- [ ] 用户可选择跳过失效链接

**工时**: 4h

---

### 5.2 任务 3.2: 元数据自动抓取

**目标**: 自动获取书签网页的标题/描述/封面

**执行步骤**:

1. 扩展现有爬虫功能
2. 批量抓取逻辑
3. 更新书签信息
4. 抓取进度显示

**验收标准**:

- [ ] 能抓取网页元数据
- [ ] 用户可选择启用
- [ ] 失败不影响导入

**工时**: 4h

---

### 5.3 任务 3.3: 导出为 HTML

**目标**: 支持将 AnyKeep 收藏导出为 Netscape Bookmark HTML 格式

**执行步骤**:

1. 创建导出 API `src/app/api/browser-bookmark/export/route.ts`
2. 生成标准 HTML 格式
3. 支持按平台筛选导出
4. 下载功能

**需要创建的文件**:

- 创建: `src/lib/browser-bookmark/exporter.ts`
- 创建: `src/app/api/browser-bookmark/export/route.ts`

**验收标准**:

- [ ] 导出格式正确
- [ ] Chrome/Edge 可导入
- [ ] 支持按平台筛选

**工时**: 3h

---

### 5.4 任务 3.4: 导入历史记录

**目标**: 记录每次导入的统计信息

**执行步骤**:

1. 导入完成时写入 `import_history` 表
2. 创建历史查询 API
3. 数据清理策略

**验收标准**:

- [ ] 每次导入有记录
- [ ] 记录信息完整
- [ ] 可查询历史

**工时**: 2h

---

### 5.5 任务 3.5: 历史记录 UI

**目标**: 显示导入历史列表

**执行步骤**:

1. 创建历史记录页面或组件
2. 列表展示
3. 详情查看

**验收标准**:

- [ ] 历史列表显示
- [ ] 可查看详情
- [ ] UI 美观

**工时**: 2h

---

### Phase 3 验收标准汇总

- [ ] 导入前可选检测失效链接
- [ ] 可自动获取书签元数据
- [ ] 可导出为 HTML 格式（支持按平台筛选）
- [ ] 可查看导入历史

---

## 6. 文件结构预览

```
src/
├── lib/
│   ├── constants/
│   │   ├── platforms.ts              # [修改] 新增浏览器平台配置
│   │   └── platform-groups.ts        # [新增] 平台分组配置
│   │
│   └── browser-bookmark/             # [新增] 浏览器书签模块
│       ├── index.ts                  # 模块导出
│       ├── types.ts                  # 类型定义
│       ├── parser.ts                 # HTML 解析器
│       ├── detector.ts               # 浏览器来源检测
│       ├── validator.ts              # 验证器（深度检测等）
│       ├── merger.ts                 # 多文件合并
│       ├── batcher.ts                # 分批处理
│       ├── cache.ts                  # IndexedDB 缓存
│       ├── folder-mapper.ts          # 文件夹映射
│       ├── exporter.ts               # 导出功能
│       ├── constants.ts              # 模块常量
│       └── __tests__/                # 测试文件
│           ├── parser.test.ts
│           ├── detector.test.ts
│           └── fixtures/             # 测试数据
│
├── components/
│   ├── home/
│   │   ├── home-page-client.tsx      # [修改] 集成下拉菜单和分组筛选
│   │   └── platform-filter.tsx       # [新增] 分组平台筛选组件
│   │
│   └── browser-bookmark/             # [新增] UI 组件
│       ├── index.ts                  # 组件导出
│       ├── import-dialog.tsx         # 导入对话框
│       ├── file-uploader.tsx         # 文件上传
│       ├── source-selector.tsx       # 来源选择
│       ├── bookmark-tree.tsx         # 书签树
│       ├── import-options.tsx        # 导入选项
│       ├── import-progress.tsx       # 进度展示
│       ├── import-result.tsx         # 结果展示
│       └── depth-warning.tsx         # 深度警告
│
├── app/
│   └── api/
│       ├── bookmarks/
│       │   └── batch-import/
│       │       └── route.ts          # [修改] 支持 platform 参数
│       │
│       └── browser-bookmark/         # [新增] 浏览器书签 API
│           ├── parse/route.ts        # 解析接口（可选）
│           ├── import/route.ts       # 导入接口（可选）
│           ├── validate/route.ts     # 验证接口（P2）
│           ├── export/route.ts       # 导出接口（P2）
│           └── history/route.ts      # 历史接口（P2）
│
├── hooks/
│   └── use-browser-bookmark-import.ts  # [新增] 导入逻辑 Hook
│
├── types/
│   └── supabase.ts                   # [修改] 扩展 Platform 类型
│
└── supabase/
    └── migrations/
        └── xxx_browser_bookmark_fields.sql  # [新增] 数据库迁移
```

---

## 7. 关键技术决策

### 7.1 解析方案

| 方案                    | 优点           | 缺点         | 决策     |
| ----------------------- | -------------- | ------------ | -------- |
| DOMParser（浏览器原生） | 无依赖、性能好 | 仅客户端可用 | **采用** |
| cheerio（服务端）       | 服务端可用     | 增加依赖     | 备选     |
| 正则表达式              | 简单           | 不够健壮     | 不采用   |

**决策**: 使用浏览器原生 DOMParser，解析在客户端完成，减少服务器负担。

### 7.2 缓存方案

| 方案           | 优点                   | 缺点               | 决策     |
| -------------- | ---------------------- | ------------------ | -------- |
| localStorage   | 简单                   | 5MB 限制、同步阻塞 | 不采用   |
| IndexedDB      | 容量大、异步、支持事务 | API 复杂           | **采用** |
| SessionStorage | 简单                   | 会话结束即清除     | 不采用   |

**决策**: 使用 IndexedDB，支持大量书签缓存和中断恢复。

### 7.3 平台筛选 UI 方案

| 方案     | 优点         | 缺点         | 决策     |
| -------- | ------------ | ------------ | -------- |
| 平面列表 | 简单         | 平台多时拥挤 | 不采用   |
| 分组设计 | 清晰、可扩展 | 实现稍复杂   | **采用** |
| 下拉菜单 | 节省空间     | 操作步骤多   | 不采用   |

**决策**: 采用分组设计，将内容平台和浏览器分开显示。

### 7.4 分批策略

- **批次大小**: 100 条/批次（与现有 API 限制一致）
- **批次间隔**: 500ms（避免 API 限流）
- **失败处理**: 单批失败不影响其他批次，记录失败项

---

## 8. 风险点和注意事项

### 8.1 技术风险

| 风险             | 影响             | 概率 | 缓解措施                      |
| ---------------- | ---------------- | ---- | ----------------------------- |
| 大文件解析卡顿   | 用户体验差       | 中   | 使用 Web Worker、显示加载提示 |
| HTML 格式差异    | 解析失败         | 中   | 增强容错性、多浏览器测试      |
| IndexedDB 兼容性 | 部分浏览器不支持 | 低   | 检测支持、降级方案            |
| API 限流         | 批次失败         | 低   | 批次间延迟、重试机制          |
| 中文乱码         | 标题显示异常     | 低   | 强制 UTF-8 编码               |

### 8.2 业务风险

| 风险                 | 影响         | 概率 | 缓解措施            |
| -------------------- | ------------ | ---- | ------------------- |
| 用户导入大量无效链接 | 数据质量差   | 中   | P2 阶段链接检测     |
| 存储配额超限         | 导入失败     | 中   | 导入前检查配额      |
| 文件夹层级过深       | 管理困难     | 低   | 5 层限制 + 警告     |
| 浏览器来源误判       | 平台标记错误 | 低   | 自动检测 + 手动选择 |

### 8.3 注意事项

1. **隐私安全**: 书签文件在客户端解析，不上传原始文件到服务器
2. **数据完整性**: 每批独立事务，失败不影响已成功批次
3. **向后兼容**: 新增字段使用 nullable，不影响现有数据
4. **用户体验**: 大量书签时显示进度，支持暂停/取消
5. **平台一致性**: Chrome/Edge 与微信/B站/小红书享有同等能力

---

## 9. 测试策略

### 9.1 单元测试

| 模块         | 测试重点           | 覆盖率目标 |
| ------------ | ------------------ | ---------- |
| parser.ts    | 各种 HTML 格式解析 | > 80%      |
| detector.ts  | 浏览器来源识别     | > 90%      |
| validator.ts | 深度检测逻辑       | > 80%      |
| merger.ts    | 合并去重逻辑       | > 80%      |
| batcher.ts   | 分批逻辑           | > 80%      |

### 9.2 集成测试

| 场景       | 测试内容                 |
| ---------- | ------------------------ |
| 单文件导入 | Chrome/Edge 文件完整流程 |
| 多文件合并 | 合并去重功能             |
| 分批导入   | 500+ 书签分批处理        |
| 中断恢复   | 暂停后恢复继续           |
| 错误处理   | 无效文件、网络错误       |

### 9.3 测试数据准备

需要准备以下测试文件:

- Chrome 书签文件（小型 < 50 条）
- Chrome 书签文件（大型 > 500 条）
- Edge 书签文件（小型）
- Edge 书签文件（大型）
- 深层级文件夹（> 5 层）
- 无效格式文件

---

## 附录

### A. 开发依赖

```json
{
  "devDependencies": {
    "uuid": "^9.0.0", // 生成唯一 ID
    "idb": "^7.1.1" // IndexedDB 封装（可选）
  }
}
```

### B. 相关文档

- 设计文档: `docs/feature-design/browser-bookmark-import.md`
- Netscape Bookmark Format: https://pinefore.com/docs/filetypes/netscape-html
- IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

---

**文档状态**: 待审核
**下一步**: 用户审核通过后开始 Phase 1 开发
