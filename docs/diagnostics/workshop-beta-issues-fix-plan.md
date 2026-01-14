# 工坊 Beta 问题修复方案（完整版）

**诊断日期**: 2026-01-07
**诊断人**: BMad Master
**状态**: 待审核

---

## 问题总览

| # | 问题 | 严重程度 | 类型 | 修复难度 |
|---|------|----------|------|----------|
| 1 | 场景快速入口 blueprintId 不存在 | 🔴 关键 | 用户报告 | 低 |
| 2 | 推荐窗口宽度太窄 | 🟡 中 | 用户报告 | 低 |
| 3 | 生成大纲 "Blueprint not found" | 🔴 关键 | 用户报告 | - (同#1) |
| 4 | 历史复用功能缓存未读取 | 🔴 关键 | 全流程审查 | 低 |
| 5 | sessionStorage 缓存键不一致 | 🟠 高 | 全流程审查 | 中 |
| 6 | 素材验证失败静默重定向 | 🟡 中 | 全流程审查 | 低 |

---

## 修复方案详情

### 修复 1: 更新场景快速入口的 blueprintId 映射 ✅ 已确认

**文件**: `src/components/knowledge-studio/v2/scenario-quick-entry.tsx`

**修复代码** (替换第 41-77 行):
```typescript
const SCENARIOS: Scenario[] = [
  {
    id: "newsletter",
    icon: "📰",
    label: "周刊策展",
    description: "生成专业周刊内容",
    blueprintId: "creator-newsletter",
  },
  {
    id: "scriptwriter",
    icon: "🎬",
    label: "视频脚本",
    description: "生成视频脚本和分镜",
    blueprintId: "creator-scriptwriter",
  },
  {
    id: "analysis",
    icon: "📊",
    label: "竞品分析",
    description: "生成竞品分析报告",
    blueprintId: "business-competitor_scout",
  },
  {
    id: "tutorial",
    icon: "📝",
    label: "技术教程",
    description: "生成技术教程文章",
    blueprintId: "geek-tutorial_architect",
  },
  {
    id: "paper",
    icon: "📄",
    label: "论文解读",
    description: "解读学术论文",
    blueprintId: "geek-arxiv_decoder",
  },
];
```

---

### 修复 2: 优化页面布局 ✅ 已确认

**文件**: `src/app/(main)/knowledge-studio/v2/knowledge-studio-v2-page-client.tsx`

**修复 A - 蓝图选择阶段** (第 284 行附近):
```typescript
// 原：grid-cols-1 lg:grid-cols-4
// 改：grid-cols-1 lg:grid-cols-5
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
  {/* 左侧推荐栏 - 原 lg:col-span-1 改为 lg:col-span-2 */}
  <div className="lg:col-span-2 order-2 lg:order-1">
    <BlueprintRecommendations ... />
  </div>
  {/* 右侧蓝图网格 */}
  <div className="lg:col-span-3 order-1 lg:order-2">
    ...
  </div>
</div>
```

**修复 B - 素材选择阶段** (第 322 行附近):
```typescript
// 同样改为 5 列布局
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
  <div className="lg:col-span-2 order-2 lg:order-1">
    <MaterialRecommendations ... />
  </div>
  <div className="lg:col-span-3 order-1 lg:order-2">
    ...
  </div>
</div>
```

---

### 修复 3: (同修复 1，无需额外操作)

---

### 修复 4: 工坊首页缺失 preselect-blueprint 缓存读取 🆕

**问题描述**:
- 历史页面 (`history-page-client.tsx:158`) 将蓝图类型存入 `ks-v2-preselect-blueprint`
- 工坊首页 (`knowledge-studio-v2-page-client.tsx`) **未读取此缓存**
- 导致"复用配置"功能完全失效

**文件**: `src/app/(main)/knowledge-studio/v2/knowledge-studio-v2-page-client.tsx`

**修复代码** (在组件初始化处添加):
```typescript
// 在 useEffect 或初始化逻辑中添加
useEffect(() => {
  // 读取历史页面传递的预选蓝图
  const preselectBlueprint = sessionStorage.getItem("ks-v2-preselect-blueprint");
  if (preselectBlueprint) {
    setSelectedBlueprintId(preselectBlueprint);
    // 一次性使用后清除
    sessionStorage.removeItem("ks-v2-preselect-blueprint");
  }
}, []);
```

---

### 修复 5: 统一 sessionStorage 缓存键命名 🆕

**问题描述**:
两个文件使用不同的缓存键模式，可能导致缓存读写不一致：

| 文件 | 键模式 | 示例 |
|------|--------|------|
| `blueprint-workflow-client.tsx` | 全局键 | `ks-v2-outline` |
| `use-blueprint-workflow.ts` | 蓝图作用域键 | `ks:v2:${blueprintId}:outline` |

**修复方案**:

**文件**: `src/app/(main)/knowledge-studio/v2/[blueprintId]/blueprint-workflow-client.tsx`

将硬编码的 `CACHE_KEYS` 改为从 hooks 导入的函数式键：

```typescript
// 删除第 74-83 行的硬编码 CACHE_KEYS
// 改为使用 hooks 中的统一缓存键

import { CACHE_KEYS, saveToCache, loadFromCache, clearCache } from "./hooks";

// 使用示例（需要 blueprintId 参数）：
saveToCache(CACHE_KEYS.OUTLINE(blueprintId), outline);
const cachedOutline = loadFromCache<BlueprintOutline>(CACHE_KEYS.OUTLINE(blueprintId));
```

**同时修改 clearAllCache 函数**:
```typescript
function clearAllCache(blueprintId: string) {
  clearCache(blueprintId);  // 使用 hooks 中的统一方法
}
```

---

### 修复 6: 素材数据校验失败添加错误提示 🆕

**问题描述**:
- 素材数据校验失败时静默重定向到工坊首页
- 用户不知道发生了什么，体验差

**文件**: `src/app/(main)/knowledge-studio/v2/[blueprintId]/blueprint-workflow-client.tsx`

**当前代码** (第 212-238 行):
```typescript
const validationResult = StoredMaterialsSchema.safeParse(parsedMaterials);
if (!validationResult.success) {
  sessionStorage.removeItem("ks-v2-materials");
  router.push("/knowledge-studio/v2");  // 静默重定向
  return;
}
```

**修复代码**:
```typescript
const validationResult = StoredMaterialsSchema.safeParse(parsedMaterials);
if (!validationResult.success) {
  sessionStorage.removeItem("ks-v2-materials");
  // 添加错误参数，在首页显示提示
  router.push("/knowledge-studio/v2?error=invalid-materials");
  return;
}
```

**同时在工坊首页添加错误提示处理**:

**文件**: `src/app/(main)/knowledge-studio/v2/knowledge-studio-v2-page-client.tsx`

```typescript
import { useSearchParams } from "next/navigation";

// 在组件中
const searchParams = useSearchParams();
const errorType = searchParams.get("error");

// 在 JSX 中
{errorType === "invalid-materials" && (
  <Alert variant="destructive" className="mb-4">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>素材数据异常</AlertTitle>
    <AlertDescription>
      请重新选择素材后继续
    </AlertDescription>
  </Alert>
)}
```

---

## 待观察问题（非本次修复范围）

以下问题已记录，但影响较小或需要更多调研：

| 问题 | 描述 | 建议 |
|------|------|------|
| RPC 函数缺失 | `match_bookmarks_by_embedding` 不存在 | 素材推荐会降级到"最近收藏"，功能可用 |
| SSE 心跳不一致 | `/outline` 和 `/generate` 心跳策略不同 | 功能正常，属于优化项 |
| outline API 配额检查 | 大纲生成未检查配额 | 配额消耗较小，可后续优化 |

---

## 修复清单

| # | 修复项 | 文件 | 状态 |
|---|--------|------|------|
| 1 | 更新场景快速入口 blueprintId | `scenario-quick-entry.tsx` | ⏳ 待执行 |
| 2a | 调整蓝图选择阶段布局 | `knowledge-studio-v2-page-client.tsx` | ⏳ 待执行 |
| 2b | 调整素材选择阶段布局 | `knowledge-studio-v2-page-client.tsx` | ⏳ 待执行 |
| 4 | 添加 preselect-blueprint 读取逻辑 | `knowledge-studio-v2-page-client.tsx` | ⏳ 待执行 |
| 5 | 统一缓存键命名 | `blueprint-workflow-client.tsx` | ⏳ 待执行 |
| 6a | 添加素材验证错误参数 | `blueprint-workflow-client.tsx` | ⏳ 待执行 |
| 6b | 添加错误提示 UI | `knowledge-studio-v2-page-client.tsx` | ⏳ 待执行 |
| ✓ | 运行类型检查 | - | ⏳ 待执行 |

---

## 影响范围

| 修改文件 | 变更类型 |
|----------|----------|
| `scenario-quick-entry.tsx` | 数据修改 |
| `knowledge-studio-v2-page-client.tsx` | 布局 + 逻辑 |
| `blueprint-workflow-client.tsx` | 缓存键 + 错误处理 |

**不涉及**:
- 后端 API
- 数据库结构
- 核心业务逻辑

---

## 审核确认

请 Xiafe 确认是否执行以上全部修复方案。

回复 **"确认执行"** 开始实施。
