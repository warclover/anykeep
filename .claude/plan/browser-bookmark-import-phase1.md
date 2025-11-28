# 浏览器书签导入 - Phase 1 执行计划

**版本**: V1.0
**日期**: 2025-11-28
**状态**: ✅ 已完成
**实际工时**: 约 2 天

---

## 执行概述

基于已确认的技术决策：

- ✅ 模块优先开发顺序
- ✅ 使用 `crypto.randomUUID()` 生成唯一 ID（无需 uuid 库）
- ✅ 客户端 DOMParser 解析 HTML
- ✅ 为每个模块编写单元测试

---

## 执行步骤

### 阶段 1.1: 基础架构（Day 1）

#### 步骤 1.1.1: 创建模块目录结构

**工时**: 15min | **依赖**: 无

```
创建目录:
src/lib/browser-bookmark/
src/lib/browser-bookmark/__tests__/
src/lib/browser-bookmark/__tests__/fixtures/
src/components/browser-bookmark/
```

**产出文件**:

- `src/lib/browser-bookmark/index.ts` - 模块导出入口
- `src/components/browser-bookmark/index.ts` - 组件导出入口

---

#### 步骤 1.1.2: 扩展 Platform 类型

**工时**: 20min | **依赖**: 无

**修改文件**: `src/types/supabase.ts`

**变更内容**:

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

**验收标准**:

- [ ] TypeScript 编译无错误
- [ ] 现有代码不受影响

---

#### 步骤 1.1.3: 扩展平台常量配置

**工时**: 40min | **依赖**: 1.1.2

**修改文件**: `src/lib/constants/platforms.ts`

**新增内容**:

1. 添加 BROWSER_CHROME/EDGE/FIREFOX/SAFARI 配置
2. 添加 `BROWSER_PLATFORMS` 常量数组
3. 添加 `isBrowserPlatform()` 工具函数
4. 更新首页筛选相关配置（如有）

**验收标准**:

- [ ] `getPlatformConfig('BROWSER_CHROME')` 返回正确配置
- [ ] `getPlatformName('BROWSER_EDGE')` 返回 "Edge"
- [ ] `isBrowserPlatform('BROWSER_CHROME')` 返回 true
- [ ] 现有平台配置不受影响

---

#### 步骤 1.1.4: 创建浏览器书签类型定义

**工时**: 45min | **依赖**: 1.1.1, 1.1.2

**创建文件**: `src/lib/browser-bookmark/types.ts`

**类型定义清单**:

```typescript
// 1. 书签节点类型
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
  id: string; // 使用 crypto.randomUUID()
  depth: number;
}

// 2. 浏览器来源类型
export type BrowserSource =
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "unknown";

// 3. 解析后的文件
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

// 4. 来源到平台映射
export const BROWSER_SOURCE_TO_PLATFORM: Record<BrowserSource, Platform>;

// 5. 导入配置
export interface BrowserBookmarkImportOptions {
  selectedIds: string[];
  targetFolderId: number | null;
  keepFolderStructure: boolean;
  autoCreateFolders: boolean;
  enableAiClassify: boolean;
  overwriteExisting: boolean;
  preserveAddDate: boolean;
}

// 6. 导入进度
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

// 7. 导入结果
export interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ url: string; title: string; reason: string }>;
  platformBreakdown: Record<Platform, number>;
}
```

**验收标准**:

- [ ] 所有类型导出正确
- [ ] 无 TypeScript 错误

---

#### 步骤 1.1.5: 创建模块常量

**工时**: 15min | **依赖**: 1.1.4

**创建文件**: `src/lib/browser-bookmark/constants.ts`

**内容**:

```typescript
export const BATCH_SIZE = 100; // 每批导入数量
export const BATCH_DELAY_MS = 500; // 批次间延迟
export const MAX_FOLDER_DEPTH = 5; // 最大文件夹深度
export const SUPPORTED_FILE_TYPES = [".html", ".htm"];
```

---

### 阶段 1.2: 核心解析逻辑（Day 1-2）

#### 步骤 1.2.1: 实现浏览器来源检测

**工时**: 1.5h | **依赖**: 1.1.4

**创建文件**: `src/lib/browser-bookmark/detector.ts`

**函数签名**:

```typescript
/**
 * 检测浏览器来源
 * 策略优先级: 1. 文件名 → 2. HTML 内容特征 → 3. unknown
 */
export function detectBrowserSource(
  fileName: string,
  htmlContent: string,
): BrowserSource;

// 内部函数
function detectFromFileName(fileName: string): BrowserSource;
function detectFromContent(htmlContent: string): BrowserSource;
```

**检测逻辑**:
| 来源 | 文件名特征 | HTML 内容特征 |
|------|-----------|---------------|
| Chrome | `chrome`, `bookmark` | `书签栏`, `Bookmarks Bar` |
| Edge | `edge`, `favorite` | `收藏夹栏`, `Favorites Bar` |
| Firefox | `firefox` | `Bookmarks Menu` |
| Safari | `safari` | `Reading List` |

**验收标准**:

- [ ] Chrome 书签文件正确识别
- [ ] Edge 书签文件正确识别
- [ ] 无法识别时返回 'unknown'

---

#### 步骤 1.2.2: 编写检测器单元测试

**工时**: 30min | **依赖**: 1.2.1

**创建文件**: `src/lib/browser-bookmark/__tests__/detector.test.ts`

**测试用例**:

```typescript
describe("detectBrowserSource", () => {
  it("should detect Chrome from filename", () => {});
  it("should detect Edge from filename", () => {});
  it("should detect Chrome from HTML content", () => {});
  it("should detect Edge from HTML content", () => {});
  it("should return unknown for unrecognized files", () => {});
  it("should prioritize filename over content", () => {});
});
```

---

#### 步骤 1.2.3: 实现 HTML 解析器

**工时**: 3h | **依赖**: 1.1.4, 1.2.1

**创建文件**: `src/lib/browser-bookmark/parser.ts`

**函数签名**:

```typescript
/**
 * 解析书签 HTML 文件
 */
export function parseBookmarkHtml(
  fileName: string,
  htmlContent: string,
): ParsedBookmarkFile;

/**
 * 从文件中提取所有书签（扁平化）
 */
export function flattenBookmarks(
  nodes: ParsedBookmarkNode[],
): ParsedBookmarkNode[];

/**
 * 根据选中 ID 过滤书签
 */
export function filterSelectedBookmarks(
  nodes: ParsedBookmarkNode[],
  selectedIds: Set<string>,
): ParsedBookmarkNode[];
```

**解析逻辑**:

1. 使用 DOMParser 解析 HTML
2. 查找根 `<DL>` 元素
3. 递归遍历 `<DT>` 元素
4. 识别 `<H3>` (文件夹) 和 `<A>` (书签)
5. 提取属性：HREF, ADD_DATE, ICON, LAST_MODIFIED
6. 查找 `<DD>` 元素获取描述
7. 使用 `crypto.randomUUID()` 生成节点 ID
8. 计算层级深度和路径

**关键代码片段**:

```typescript
function parseBookmarkList(
  dl: Element,
  parentPath: string[],
  depth: number,
): ParsedBookmarkNode[] {
  const nodes: ParsedBookmarkNode[] = [];
  // ...递归解析逻辑
  return nodes;
}

function parseAddDate(value: string | null): number | undefined {
  if (!value) return undefined;
  const timestamp = parseInt(value, 10);
  return isNaN(timestamp) ? undefined : timestamp;
}
```

**验收标准**:

- [ ] 正确解析标准 Netscape Bookmark HTML
- [ ] 文件夹和书签类型正确识别
- [ ] 层级深度计算正确
- [ ] 路径信息正确
- [ ] 时间戳正确解析
- [ ] 无效格式抛出明确错误

---

#### 步骤 1.2.4: 准备测试数据

**工时**: 30min | **依赖**: 无

**创建文件**:

- `src/lib/browser-bookmark/__tests__/fixtures/chrome-bookmarks-small.html`
- `src/lib/browser-bookmark/__tests__/fixtures/edge-bookmarks-small.html`
- `src/lib/browser-bookmark/__tests__/fixtures/nested-folders.html`
- `src/lib/browser-bookmark/__tests__/fixtures/invalid-format.html`

**测试数据要求**:

- Chrome 小型文件：~20 个书签，3 层文件夹
- Edge 小型文件：~15 个书签，2 层文件夹
- 嵌套文件夹：6 层深度（测试超深警告）
- 无效格式：非 Netscape 格式的 HTML

---

#### 步骤 1.2.5: 编写解析器单元测试

**工时**: 1.5h | **依赖**: 1.2.3, 1.2.4

**创建文件**: `src/lib/browser-bookmark/__tests__/parser.test.ts`

**测试用例**:

```typescript
describe("parseBookmarkHtml", () => {
  it("should parse Chrome bookmark file correctly", () => {});
  it("should parse Edge bookmark file correctly", () => {});
  it("should handle nested folders up to depth N", () => {});
  it("should calculate depth correctly", () => {});
  it("should extract all bookmark attributes", () => {});
  it("should handle empty folders", () => {});
  it("should handle bookmarks without icons", () => {});
  it("should extract description from DD elements", () => {});
  it("should throw error for invalid HTML", () => {});
  it("should generate unique IDs for each node", () => {});
});

describe("flattenBookmarks", () => {
  it("should flatten nested structure", () => {});
  it("should preserve all bookmark properties", () => {});
});

describe("filterSelectedBookmarks", () => {
  it("should filter by selected IDs", () => {});
  it("should include parent folders when children selected", () => {});
});
```

**验收标准**:

- [ ] 测试覆盖率 > 80%
- [ ] 所有测试通过
- [ ] 边界情况已覆盖

---

### 阶段 1.3: UI 组件开发（Day 3-4）

#### 步骤 1.3.1: 创建文件上传组件

**工时**: 1.5h | **依赖**: 1.1.4

**创建文件**: `src/components/browser-bookmark/file-uploader.tsx`

**组件接口**:

```typescript
interface FileUploaderProps {
  onFileSelect: (file: File, content: string) => void;
  onError: (message: string) => void;
  accept?: string; // 默认 ".html,.htm"
  disabled?: boolean;
}
```

**功能要求**:

1. 拖放上传区域
2. 点击选择文件
3. 文件类型验证（仅 .html/.htm）
4. 文件读取（FileReader）
5. 加载状态提示
6. 错误处理

**UI 设计**:

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│     📁 拖放 HTML 文件到此处，或点击选择             │
│                                                      │
│     支持 Chrome、Edge 导出的书签文件                │
│                                                      │
│     [ 选择文件 ]                                    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**验收标准**:

- [ ] 拖放功能正常
- [ ] 点击选择功能正常
- [ ] 非 HTML 文件显示错误
- [ ] 大文件有加载提示
- [ ] 组件可受控禁用

---

#### 步骤 1.3.2: 创建来源选择组件

**工时**: 1h | **依赖**: 1.2.1

**创建文件**: `src/components/browser-bookmark/source-selector.tsx`

**组件接口**:

```typescript
interface SourceSelectorProps {
  detectedSource: BrowserSource;
  selectedSource: BrowserSource;
  onSourceChange: (source: BrowserSource) => void;
  disabled?: boolean;
}
```

**功能要求**:

1. 显示自动检测结果
2. 支持手动修改来源
3. 来源选项：Chrome、Edge、Firefox、Safari、其他

**UI 设计**:

```
来源: [ Chrome ▼ ]  (自动检测)
       ├─ 🌐 Chrome
       ├─ 🔷 Edge
       ├─ 🦊 Firefox
       ├─ 🧭 Safari
       └─ 📌 其他
```

**验收标准**:

- [ ] 显示自动检测结果
- [ ] 可手动修改来源
- [ ] 选择后回调正确触发

---

#### 步骤 1.3.3: 创建书签树组件

**工时**: 3h | **依赖**: 1.2.3

**创建文件**: `src/components/browser-bookmark/bookmark-tree.tsx`

**组件接口**:

```typescript
interface BookmarkTreeProps {
  nodes: ParsedBookmarkNode[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  expandedIds?: Set<string>;
  onExpandChange?: (ids: Set<string>) => void;
  maxHeight?: string; // 默认 '400px'
}
```

**功能要求**:

1. 树形结构递归渲染
2. 勾选框（Checkbox）
3. 父节点勾选时子节点联动
4. 子节点全选时父节点自动勾选
5. 展开/折叠控制
6. 文件夹和书签图标区分
7. 显示 URL 提示（hover）
8. 虚拟滚动（可选，大量节点时）

**UI 设计**:

```
☑ 📁 书签栏
  ☑ 📁 开发工具
    ☑ 🔗 GitHub - https://github.com
    ☐ 🔗 Stack Overflow
  ☐ 📁 新闻
    ☐ 🔗 Hacker News
☐ 📁 其他书签
```

**验收标准**:

- [ ] 树形结构正确渲染
- [ ] 勾选/取消勾选功能正常
- [ ] 父子节点联动正确
- [ ] 展开/折叠功能正常
- [ ] 1000+ 节点时性能良好
- [ ] 全选/取消全选功能

---

#### 步骤 1.3.4: 创建导入选项组件

**工时**: 1.5h | **依赖**: 1.1.4

**创建文件**: `src/components/browser-bookmark/import-options.tsx`

**组件接口**:

```typescript
interface ImportOptionsProps {
  options: BrowserBookmarkImportOptions;
  onOptionsChange: (options: BrowserBookmarkImportOptions) => void;
  folders: Array<{ id: number; name: string }>;
  disabled?: boolean;
}
```

**配置项**:
| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| targetFolderId | select | null | 目标文件夹 |
| keepFolderStructure | switch | true | 保持原文件夹结构 |
| autoCreateFolders | switch | true | 自动创建文件夹 (Phase 2) |
| overwriteExisting | switch | false | 覆盖已存在 URL |
| preserveAddDate | switch | true | 保留原始添加时间 (Phase 2) |
| enableAiClassify | switch | false | 启用 AI 分类 (Phase 2, 禁用) |

**验收标准**:

- [ ] 所有配置项可用
- [ ] 文件夹选择器正常工作
- [ ] 配置状态正确传递
- [ ] Phase 2 功能显示为禁用状态

---

#### 步骤 1.3.5: 创建进度展示组件

**工时**: 1h | **依赖**: 1.1.4

**创建文件**: `src/components/browser-bookmark/import-progress.tsx`

**组件接口**:

```typescript
interface ImportProgressProps {
  progress: ImportProgress;
  onCancel?: () => void;
}
```

**功能要求**:

1. 进度条（当前/总数）
2. 当前处理项名称
3. 已成功/失败/跳过数量
4. 取消按钮
5. 状态文本

**UI 设计**:

```
┌─────────────────────────────────────────────────────┐
│  正在导入书签...                                     │
│                                                      │
│  [████████████░░░░░░░░░░░░░░] 45%                   │
│                                                      │
│  当前: GitHub - https://github.com                  │
│                                                      │
│  ✅ 成功: 45   ❌ 失败: 2   ⏭️ 跳过: 3              │
│                                                      │
│                              [ 取消导入 ]            │
└─────────────────────────────────────────────────────┘
```

---

#### 步骤 1.3.6: 创建结果展示组件

**工时**: 1h | **依赖**: 1.1.4

**创建文件**: `src/components/browser-bookmark/import-result.tsx`

**组件接口**:

```typescript
interface ImportResultProps {
  result: ImportResult;
  source: BrowserSource;
  onViewBookmarks?: () => void;
  onClose?: () => void;
}
```

**功能要求**:

1. 成功图标和消息
2. 按平台分类的导入数量
3. 失败项详情（可展开）
4. 下一步建议
5. 操作按钮

**UI 设计**:

```
┌─────────────────────────────────────────────────────┐
│                 🎉 导入完成                          │
│                                                      │
│            ✅ 成功导入 145 条书签                    │
│                                                      │
│     🌐 Chrome: 89 条     🔷 Edge: 56 条             │
│                                                      │
│  ────────────────────────────────────────────────   │
│  📊 详细统计                                        │
│  • ✅ 成功: 145 条                                  │
│  • ⏭️ 跳过 (重复): 8 条                            │
│  • ❌ 失败: 3 条  [ 查看详情 ▼ ]                    │
│                                                      │
│  [ 查看书签 ]                         [ 关闭 ]      │
└─────────────────────────────────────────────────────┘
```

---

### 阶段 1.4: 对话框与集成（Day 4-5）

#### 步骤 1.4.1: 创建导入对话框

**工时**: 3h | **依赖**: 1.3.1-1.3.6

**创建文件**: `src/components/browser-bookmark/import-dialog.tsx`

**组件接口**:

```typescript
interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
```

**步骤流程**:
| 步骤 | 名称 | 组件 | 下一步条件 |
|------|------|------|-----------|
| 1 | 上传文件 | FileUploader + SourceSelector | 文件已上传且解析成功 |
| 2 | 预览选择 | BookmarkTree | 至少选择 1 个书签 |
| 3 | 配置选项 | ImportOptions | 配置有效 |
| 4 | 开始导入 | ImportProgress / ImportResult | - |

**状态管理**:

```typescript
interface DialogState {
  step: 1 | 2 | 3 | 4;
  file: File | null;
  content: string;
  parsedFile: ParsedBookmarkFile | null;
  selectedSource: BrowserSource;
  selectedIds: Set<string>;
  options: BrowserBookmarkImportOptions;
  progress: ImportProgress;
  result: ImportResult | null;
}
```

**验收标准**:

- [ ] 4 步流程完整
- [ ] 步骤间切换流畅
- [ ] 状态正确保持
- [ ] 取消/关闭行为正确
- [ ] 步骤指示器正确显示

---

#### 步骤 1.4.2: 创建导入 Hook

**工时**: 2h | **依赖**: 1.4.1

**创建文件**: `src/hooks/use-browser-bookmark-import.ts`

**Hook 接口**:

```typescript
interface UseBrowserBookmarkImportReturn {
  importBookmarks: (
    bookmarks: ParsedBookmarkNode[],
    platform: Platform,
    options: BrowserBookmarkImportOptions,
  ) => Promise<ImportResult>;
  progress: ImportProgress;
  cancel: () => void;
  reset: () => void;
}
```

**功能**:

1. 调用 batch-import API
2. 处理进度更新
3. 处理错误
4. 支持取消操作

---

#### 步骤 1.4.3: 扩展批量导入 API

**工时**: 2h | **依赖**: 1.1.3

**修改文件**: `src/app/api/bookmarks/batch-import/route.ts`

**变更内容**:

1. 支持 `platform` 参数直接指定平台
2. 支持 `browserAddDate` 字段
3. 支持 `importSource` 字段

**API 请求体扩展**:

```typescript
interface ImportBookmark {
  url: string;
  title: string;
  description?: string;
  folderId?: number;
  userTags?: string[];
  notes?: string;
  // 新增字段
  platform?: Platform; // 直接指定平台
  browserAddDate?: string; // 原始添加时间 (ISO 格式)
  importSource?: string; // 导入来源标记
}
```

**逻辑变更**:

```typescript
// 现有逻辑
const platform = detectPlatformFromUrl(bookmark.url);

// 新逻辑
const platform = bookmark.platform || detectPlatformFromUrl(bookmark.url);
```

**验收标准**:

- [ ] platform 参数生效
- [ ] browserAddDate 正确保存
- [ ] importSource 正确保存
- [ ] 向后兼容（不传参数时行为不变）

---

#### 步骤 1.4.4: 首页集成入口

**工时**: 1.5h | **依赖**: 1.4.1

**修改文件**: `src/components/home/home-page-client.tsx`

**变更内容**:

1. 将"批量导入"按钮改为下拉菜单
2. 添加"从浏览器书签导入"选项
3. 集成 ImportDialog 组件

**UI 变更**:

```
现有: [ 批量导入 ]
改为: [ 批量导入 ▼ ]
       ├─ 📄 从 JSON 文件导入
       └─ 🌐 从浏览器书签导入
```

**代码变更示例**:

```tsx
import { BrowserBookmarkImportDialog } from '@/components/browser-bookmark'

// 状态
const [showBrowserImportDialog, setShowBrowserImportDialog] = useState(false)

// UI
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">
      批量导入 <ChevronDown className="ml-1 h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleJsonImport}>
      📄 从 JSON 文件导入
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setShowBrowserImportDialog(true)}>
      🌐 从浏览器书签导入
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

<BrowserBookmarkImportDialog
  open={showBrowserImportDialog}
  onOpenChange={setShowBrowserImportDialog}
  onSuccess={handleRefresh}
/>
```

**验收标准**:

- [ ] 下拉菜单正常工作
- [ ] 两个导入入口都能打开对应对话框
- [ ] 移动端菜单也包含新选项

---

#### 步骤 1.4.5: 首页筛选平台扩展

**工时**: 1h | **依赖**: 1.1.3

**修改文件**: `src/components/home/home-page-client.tsx`

**变更内容**:
更新平台筛选列表，新增 Chrome 和 Edge 选项

```typescript
// 现有
const platforms = [
  { id: "all", name: "全部", value: "" },
  { id: "wechat", name: "微信", value: "WECHAT_OFFICIAL_ACCOUNT" },
  { id: "xiaohongshu", name: "小红书", value: "XIAOHONGSHU" },
  { id: "bilibili", name: "B站", value: "BILIBILI" },
];

// 更新后
const platforms = [
  { id: "all", name: "全部", value: "" },
  { id: "wechat", name: "微信", value: "WECHAT_OFFICIAL_ACCOUNT" },
  { id: "xiaohongshu", name: "小红书", value: "XIAOHONGSHU" },
  { id: "bilibili", name: "B站", value: "BILIBILI" },
  { id: "chrome", name: "Chrome", value: "BROWSER_CHROME" }, // 新增
  { id: "edge", name: "Edge", value: "BROWSER_EDGE" }, // 新增
];
```

**注意**: Phase 2 会将此平面列表重构为分组设计

**验收标准**:

- [ ] Chrome/Edge 筛选选项显示
- [ ] 筛选功能正常工作
- [ ] URL 参数正确处理

---

#### 步骤 1.4.6: 服务端页面平台支持

**工时**: 30min | **依赖**: 1.1.2

**修改文件**: `src/app/(main)/home/page.tsx`

**变更内容**:
更新 `VALID_PLATFORMS` 数组

```typescript
// 现有
const VALID_PLATFORMS: Platform[] = [
  "WECHAT_OFFICIAL_ACCOUNT",
  "BILIBILI",
  "XIAOHONGSHU",
  "UNKNOWN",
];

// 更新后
const VALID_PLATFORMS: Platform[] = [
  "WECHAT_OFFICIAL_ACCOUNT",
  "BILIBILI",
  "XIAOHONGSHU",
  "BROWSER_CHROME", // 新增
  "BROWSER_EDGE", // 新增
  "UNKNOWN",
];
```

---

### 阶段 1.5: 测试与修复（Day 6）

#### 步骤 1.5.1: 集成测试

**工时**: 2h | **依赖**: 全部

**测试场景**:
| 场景 | 测试内容 | 预期结果 |
|------|---------|---------|
| 单文件导入 Chrome | 上传 Chrome 书签文件，全选导入 | 成功导入，platform=BROWSER_CHROME |
| 单文件导入 Edge | 上传 Edge 书签文件，部分选择导入 | 成功导入选中项，platform=BROWSER_EDGE |
| URL 去重 | 导入包含已存在 URL 的书签 | 重复项显示为"跳过" |
| 取消导入 | 导入过程中点击取消 | 已导入的保留，剩余取消 |
| 无效文件 | 上传非 HTML 文件 | 显示错误提示 |
| 空文件 | 上传空 HTML 文件 | 显示"无书签"提示 |
| 首页筛选 | 按 Chrome/Edge 筛选 | 仅显示对应平台书签 |

**验收标准**:

- [ ] 完整流程可走通
- [ ] 数据正确保存到数据库
- [ ] 平台标识正确
- [ ] 错误提示友好
- [ ] 无控制台错误

---

#### 步骤 1.5.2: Bug 修复与优化

**工时**: 预留 2h | **依赖**: 1.5.1

**常见问题检查清单**:

- [ ] 中文标题乱码
- [ ] 特殊字符 URL 编码
- [ ] 大量书签时性能
- [ ] 对话框关闭后状态重置
- [ ] 移动端适配
- [ ] 暗色模式兼容

---

## 验收标准汇总

### Phase 1 MVP 验收清单

**核心功能**:

- [ ] 可上传 Chrome/Edge 导出的 HTML 书签文件
- [ ] 自动检测浏览器来源，支持手动修改
- [ ] 正确解析文件夹结构和书签
- [ ] 支持预览和勾选选择
- [ ] 成功导入到数据库
- [ ] platform 正确设置为 `BROWSER_CHROME` 或 `BROWSER_EDGE`
- [ ] 显示导入结果（含平台分布）
- [ ] 首页可访问入口（下拉菜单）
- [ ] 重复 URL 自动跳过

**质量要求**:

- [ ] 单元测试覆盖率 > 80%
- [ ] TypeScript 无编译错误
- [ ] ESLint 无警告
- [ ] 响应式设计兼容移动端
- [ ] 暗色模式兼容

---

## 文件清单

### 新建文件

```
src/lib/browser-bookmark/
├── index.ts
├── types.ts
├── constants.ts
├── parser.ts
├── detector.ts
└── __tests__/
    ├── parser.test.ts
    ├── detector.test.ts
    └── fixtures/
        ├── chrome-bookmarks-small.html
        ├── edge-bookmarks-small.html
        ├── nested-folders.html
        └── invalid-format.html

src/components/browser-bookmark/
├── index.ts
├── import-dialog.tsx
├── file-uploader.tsx
├── source-selector.tsx
├── bookmark-tree.tsx
├── import-options.tsx
├── import-progress.tsx
└── import-result.tsx

src/hooks/
└── use-browser-bookmark-import.ts
```

### 修改文件

```
src/types/supabase.ts                      # 扩展 Platform 类型
src/lib/constants/platforms.ts             # 添加浏览器平台配置
src/app/api/bookmarks/batch-import/route.ts # 支持 platform 参数
src/components/home/home-page-client.tsx   # 下拉菜单 + 筛选扩展
src/app/(main)/home/page.tsx               # VALID_PLATFORMS 更新
```

---

## 风险与注意事项

| 风险                       | 缓解措施                              |
| -------------------------- | ------------------------------------- |
| DOMParser 兼容性           | 客户端运行，主流浏览器均支持          |
| 大文件解析卡顿             | 显示加载提示，后续可优化为 Web Worker |
| 中文乱码                   | 强制 UTF-8 编码读取                   |
| crypto.randomUUID() 兼容性 | 主流浏览器均支持，IE 不支持（可接受） |

---

**计划状态**: ✅ Phase 1 已完成
**完成日期**: 2025-11-28
**下一步**: 用户可手动测试功能，或继续 Phase 2
