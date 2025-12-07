# 大文件拆分重构计划

**创建日期**: 2025-12-07
**状态**: 待审核
**风险等级**: 中等（需要全面测试）

---

## 目标文件分析

| 文件                         | 行数 | 优先级 | 复杂度 |
| ---------------------------- | ---- | ------ | ------ |
| `home-page-client.tsx`       | 1586 | P0     | 高     |
| `create-bookmark-dialog.tsx` | 1047 | P1     | 中     |
| `bookmark-detail-client.tsx` | 1018 | P1     | 中     |
| `ai-generator.ts`            | 1002 | P2     | 低     |
| `bookmarks/route.ts`         | 997  | P2     | 中     |

---

## Stage 1: home-page-client.tsx 拆分方案

### 当前结构分析

```
home-page-client.tsx (1586 lines)
├── 常量定义 (lines 108-145)
│   ├── platforms[] - 平台配置
│   ├── sortOptions[] - 排序选项
│   ├── ViewMode/LayoutMode 类型
│   └── 存储 key 常量
│
├── 主组件 HomePageClient (lines 147-1586)
│   ├── 状态管理 (~200 lines)
│   │   ├── URL 参数同步
│   │   ├── 视图模式状态
│   │   └── 选择模式状态
│   │
│   ├── SWR 数据缓存 (~150 lines)
│   │   └── useBookmarksSWR 集成
│   │
│   ├── 操作处理函数 (~250 lines)
│   │   ├── handlePlatformChange
│   │   ├── handleSortChange
│   │   ├── handleDelete/Edit/Restore
│   │   └── 批量操作函数
│   │
│   ├── JSX: Header 区域 (~400 lines)
│   │   ├── 平台筛选标签
│   │   ├── 视图模式切换
│   │   ├── 排序下拉菜单
│   │   └── 移动端菜单
│   │
│   └── JSX: 内容区域 (~400 lines)
│       ├── 书签列表渲染
│       ├── 空状态组件
│       └── 对话框组件
```

### 拆分方案

#### 1.1 提取常量配置 (~40 lines)

**新文件**: `src/components/home/constants.ts`

```typescript
// 平台配置、排序选项、存储 key、类型定义
export const platforms = [...];
export const sortOptions = [...];
export const VIEW_MODE_STORAGE_KEY = "anykeep-view-mode";
export type ViewMode = "card" | "list" | "compact";
export type LayoutMode = "auto" | "row" | "column";
```

**收益**: 提高复用性，减少主组件体积
**风险**: 低

---

#### 1.2 提取 Header 组件 (~350 lines)

**新文件**: `src/components/home/home-header.tsx`

```typescript
interface HomeHeaderProps {
  // 平台筛选
  currentPlatform: string;
  onPlatformChange: (platform: string) => void;

  // 视图模式
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;

  // 排序
  currentSort: string;
  onSortChange: (sort: string) => void;

  // 选择模式
  isSelectionMode: boolean;
  selectedCount: number;
  onToggleSelectionMode: () => void;
  onSelectAll: () => void;
  onBatchDelete: () => void;
  onBatchMove: () => void;

  // 对话框
  onOpenCreate: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onOpenBrowserImport: () => void;

  // 其他
  isTrash?: boolean;
  isBrowserPlatform?: boolean;
}

export function HomeHeader(props: HomeHeaderProps) {
  // 移动端菜单状态
  const [isMobileMoreMenuOpen, setIsMobileMoreMenuOpen] = useState(false);

  return (
    <header>
      {/* 平台筛选标签 */}
      {/* 视图/排序菜单 */}
      {/* 操作按钮 */}
    </header>
  );
}
```

**收益**: 主组件减少 ~350 行，Header 逻辑独立
**风险**: 中等（需要传递较多 props）

---

#### 1.3 提取书签操作 Hook (~150 lines)

**新文件**: `src/hooks/use-bookmark-actions.ts`

```typescript
interface UseBookmarkActionsOptions {
  bookmarks: Bookmark[];
  setBookmarks: React.Dispatch<React.SetStateAction<Bookmark[]>>;
  removeCacheItem: (id: number) => void;
}

export function useBookmarkActions(options: UseBookmarkActionsOptions) {
  const { fetchWithAbort } = useAbortableFetch();

  const handleDelete = async (id: number) => { ... };
  const handleRestore = async (id: number) => { ... };
  const handlePermanentDelete = async (id: number) => { ... };
  const handleEmptyTrash = async () => { ... };

  return {
    handleDelete,
    handleRestore,
    handlePermanentDelete,
    handleEmptyTrash,
  };
}
```

**收益**: 操作逻辑可复用于其他组件
**风险**: 低

---

#### 1.4 提取 URL 同步 Hook (~100 lines)

**新文件**: `src/hooks/use-home-url-sync.ts`

```typescript
export function useHomeUrlSync() {
  const searchParams = useSearchParams();

  const [localPlatform, setLocalPlatform] = useState("");
  const [localFolder, setLocalFolder] = useState("");
  const [localUsageTags, setLocalUsageTags] = useState<string[]>([]);

  // URL 参数同步逻辑
  useEffect(() => { ... }, [searchParams]);

  // 更新 URL 不触发导航
  const updateUrlParam = (key: string, value: string) => { ... };

  return {
    localPlatform,
    localFolder,
    localUsageTags,
    setLocalPlatform,
    setLocalFolder,
    setLocalUsageTags,
    updateUrlParam,
  };
}
```

**收益**: URL 逻辑解耦，易于测试
**风险**: 低

---

### 拆分后结构

```
src/components/home/
├── home-page-client.tsx     (~800 lines, 减少 ~50%)
├── home-header.tsx          (~350 lines, 新增)
├── constants.ts             (~40 lines, 新增)
└── index.ts                 (导出)

src/hooks/
├── use-bookmark-actions.ts  (~150 lines, 新增)
└── use-home-url-sync.ts     (~100 lines, 新增)
```

---

## Stage 2: create-bookmark-dialog.tsx 拆分方案

**当前行数**: 1047 lines

### 可提取模块

1. **表单验证逻辑** → `use-bookmark-form.ts`
2. **AI 分析面板** → `ai-analysis-panel.tsx`
3. **文件夹选择器** → 已存在，检查复用
4. **标签输入组件** → `tag-input.tsx`（如不存在）

### 预期效果

- 主对话框组件: ~600 lines
- 新增 2-3 个子组件/Hook

---

## Stage 3: bookmark-detail-client.tsx 拆分方案

**当前行数**: 1018 lines

### 可提取模块

1. **详情卡片布局** → `bookmark-detail-card.tsx`
2. **编辑表单** → `bookmark-edit-form.tsx`
3. **AI 摘要区域** → `bookmark-summary-section.tsx`

---

## 执行建议

### 推荐执行顺序

1. **Stage 1.1** (常量提取) - 最安全，立即执行
2. **Stage 1.3** (书签操作 Hook) - 低风险，高复用价值
3. **Stage 1.4** (URL 同步 Hook) - 低风险
4. **Stage 1.2** (Header 组件) - 中风险，需要测试
5. **Stage 2-3** - 后续迭代

### 测试要求

每个 Stage 完成后需验证：

- [ ] TypeScript 编译通过
- [ ] ESLint 检查通过
- [ ] 首页功能正常（平台筛选、排序、视图切换）
- [ ] 书签 CRUD 操作正常
- [ ] 移动端响应式正常
- [ ] 垃圾箱功能正常

---

## 决策点

**是否立即执行？**

| 选项                     | 优点             | 缺点       |
| ------------------------ | ---------------- | ---------- |
| 立即执行 Stage 1.1 + 1.3 | 低风险，快速见效 | 需要时间   |
| 推迟到功能稳定后         | 避免引入 bug     | 技术债累积 |
| 仅执行常量提取           | 最安全           | 收益有限   |

**建议**: 执行 Stage 1.1 (常量提取) 和 Stage 1.3 (书签操作 Hook)，这两项风险最低且收益明显。

---

## 审核确认

请审核此计划并选择执行方式：

- `执行全部` - 执行 Stage 1 完整方案
- `执行安全项` - 仅执行 Stage 1.1 + 1.3
- `暂不执行` - 将此计划归档，待后续迭代
