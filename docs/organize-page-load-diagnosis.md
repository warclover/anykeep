# Organize 页面加载慢 - 诊断说明

基于 Network 控制台截图的诊断结论与优化建议。

## 一、现象概览

| 请求                     | 耗时                               | 发起方                            | 说明                   |
| ------------------------ | ---------------------------------- | --------------------------------- | ---------------------- |
| `inbox`                  | **15.38s / 15.51s**（各出现 2 次） | organization-suggestions-panel    | 整理建议分析，最慢     |
| `folders`                | **10.07s**                         | use-folders.ts (useConfirmations) | 文件夹列表             |
| `usage-tags`             | **11.35s**                         | use-custom-usage-tags             | 书签卡片内标签组件触发 |
| `inbox?type=suggestions` | **3.06s / 6.26s**（各 2 次）       | cluster-suggestions-panel         | 聚类建议               |
| `analysis`               | **2.40s / 4.15s**（各 2 次）       | use-librarian-analysis            | 健康诊断分析，两处调用 |
| `trust-mode`             | **2.41s / 3.72s**（各 2 次）       | use-trust-mode                    | 托管模式设置           |
| `confirmations`          | 1 次中止 (0 B) + 1 次 3.30s        | useConfirmations                  | 待确认列表             |

## 二、根因分析

### 1. 后端接口响应慢（主因）

以下接口单次耗时就达数秒到十余秒，直接拉高首屏时间：

- **`/api/classification/inbox`**：15s+，待整理分析逻辑重（可能含 AI/聚类）。
- **`/api/v1/folders`**：10s+，需排查数据库查询与索引。
- **`/api/settings/usage-tags`**：11s+，书签列表渲染时由子组件触发。
- **`/api/classification/inbox?type=suggestions`**：3–6s。
- **`/api/librarian/analysis`**、**`/api/settings/trust-mode`**：2–4s。

**建议**：在服务端对上述路由做性能分析（慢查询、N+1、外部调用超时等），并加超时与缓存策略。

### 2. 重复请求（加重延迟与负载）

- **inbox**：`OrganizationSuggestionsPanel` 在 `useEffect` 中请求，开发环境 React Strict Mode 会执行两次 effect，导致 2 次 15s 请求。
- **inbox?type=suggestions**：`ClusterSuggestionsPanel` 同理，2 次请求。
- **analysis**：`useLibrarianAnalysis` 在 **OrganizePageClient** 和 **HealthDiagnosisPanel** 中各调用一次，两套独立 state，无共享缓存 → 2 次请求。
- **trust-mode**：`useTrustMode` 在 OrganizePageClient 中调用，Strict Mode 下可能 2 次。
- **confirmations**：一次中止、一次成功，可能与卸载/重挂载或取消逻辑有关。

### 3. 非首屏必要请求提前发

- **健康诊断分析**（`/api/librarian/analysis`）在页面加载时就会请求，而只有切换到「健康诊断」Tab 才需要，导致首屏多一次 2–4s 的请求。

### 4. 请求链与组件关系

```
OrganizePageClient
├── useTrustMode()           → GET /api/settings/trust-mode
├── useConfirmations()       → useFolders() → GET /api/v1/folders
│                          → GET /api/confirmations?...
├── useLibrarianAnalysis()   → GET /api/librarian/analysis  (1)
├── OrganizationSuggestionsPanel
│   └── loadAnalysis()       → GET /api/classification/inbox  (x2 in Strict Mode)
├── ClusterSuggestionsPanel
│   └── loadSuggestions()    → GET /api/classification/inbox?type=suggestions  (x2)
├── HealthDiagnosisPanel (仅 health tab 挂载)
│   └── useLibrarianAnalysis() → GET /api/librarian/analysis  (2，与上重复)
└── BookmarkCard 等
    └── 标签相关组件        → useCustomUsageTags() → GET /api/settings/usage-tags
```

## 三、已做 / 建议的代码侧优化

1. **useLibrarianAnalysis**
   - 增加 `enabled` 参数，仅在 `activeTab === "health"` 时请求。
   - 仅在一处调用（OrganizePageClient），通过 props 把 `analysis` / `refresh` 传给 HealthDiagnosisPanel，避免重复请求。

2. **inbox / inbox?type=suggestions**
   - 用 TanStack Query（或现有请求去重层）统一拉取并缓存，同一 key 只发一次请求，避免 Strict Mode 或多次挂载导致重复。

3. **useTrustMode**
   - 可考虑改为 TanStack Query，统一 cache key，减少重复请求并利于缓存。

4. **confirmations 中止**
   - 检查 useConfirmations 的依赖与卸载逻辑，避免不必要的发起后立即 abort。

## 四、后续建议

- 对 `/api/classification/inbox`、`/api/v1/folders`、`/api/settings/usage-tags` 做服务端性能与超时配置优化。
- 为可缓存的接口（如 folders、usage-tags、trust-mode）设置合理的缓存策略（如 staleTime）。
- 首屏只请求「待处理」Tab 必需数据，其余 Tab 数据在切换时再请求（已对 analysis 按 Tab 做按需加载）。
