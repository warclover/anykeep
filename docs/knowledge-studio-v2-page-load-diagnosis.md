# knowledge-studio/v2 页面加载慢 — 诊断与修复计划

基于网络面板截图与代码审查整理的诊断结论与可执行修复计划，供审核。

---

## 实施记录（已落地）

| 日期       | 项                      | 说明                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-03 | **P0 鉴权与打点**       | 在 `withAuthMiddleware` 中：鉴权 >500ms 时打 `Slow API auth` 日志；请求总耗时 >1s 时打 `Slow API request`（含 `authDuration`、`handlerDuration`）。四个 GET 接口（folders、bookmarks、usage-tags、blueprints）在 handler 内增加 `handlerMs` 打点，>1s 时打 `Slow * handler`。便于区分鉴权 vs 业务耗时。Middleware 已对 API 注入 `x-user-id`，未改。 |
| 2026-03-03 | **Folders 按需加载**    | `useFolderList` 增加可选参数 `enabled`，默认 `true`。`DetailDrawer` 中改为 `useFolderList({ enabled: isOpen })`，仅在抽屉打开时请求 folders，知识工坊等首屏不再触发 `/api/v1/folders`。                                                                                                                                                             |
| 待排期     | P1 后端/DB/冷启动       | 根据打点结果再排期。                                                                                                                                                                                                                                                                                                                                |
| 待排期     | P2 骨架屏 / content.css | 按需排期。                                                                                                                                                                                                                                                                                                                                          |

---

## 一、现象摘要

- **页面**：`/knowledge-studio/v2`（知识工坊 v2）
- **表现**：首屏加载约 **10–22 秒**，时间轴上有大量长时间 fetch 请求
- **主要慢请求**（来自网络瀑布与代码对应关系）：

| 请求                                      | 耗时             | 发起位置                      | 响应大小   |
| ----------------------------------------- | ---------------- | ----------------------------- | ---------- |
| `GET /api/v1/folders`                     | **~10.64 s**     | `use-folders.ts:62`           | 6.1 kB     |
| `GET /api/settings/usage-tags`            | **~11.16 s**     | `use-custom-usage-tags.ts:38` | 993 B      |
| `GET /api/knowledge-studio/v2/blueprints` | **~9.79 s**      | `use-blueprints.ts:66`        | 5.9 kB     |
| `GET /api/v1/bookmarks?limit=20`          | **~10.24 s**     | `use-bookmarks.ts:87`         | 72.6 kB    |
| `content.css`                             | 5 ms（可能缓存） | —                             | **1.6 MB** |

共同特征：**响应体很小（几百 B 到几十 kB），但单次请求耗时均接近或超过 10 秒**，说明瓶颈在**服务端处理或网络/冷启动**，而非传输体积。

---

## 二、请求来源与触发链

### 2.1 页面直接发起的请求

- **blueprints**：`KnowledgeStudioV2PageClient` 使用 `useBlueprints()`，挂载即请求 `/api/knowledge-studio/v2/blueprints`。
- **bookmarks**：同页面使用 `useBookmarks({ limit: 20, ... })`，挂载即请求 `/api/v1/bookmarks?limit=20`。

### 2.2 布局/全局组件触发的请求

- **usage-tags**：主布局 `(main)/layout.tsx` 中有 `<PrefetchUsageTags />`，挂载时通过 `prefetchCustomUsageTags` 预取；此外 `usage-tag-filter`、`filter-panel-embedded` 等若被渲染会使用 `useCustomUsageTags()`，同样会发起 `/api/settings/usage-tags`。
- **folders**：原由 `DetailDrawer` 内 `useFolderList()` 触发；**已改为按需**：`useFolderList({ enabled: isOpen })`，仅在打开快速添加抽屉时请求 `/api/v1/folders`，首屏不再请求。

因此，进入 knowledge-studio/v2 时，**四个接口会几乎同时被触发**（页面 + 布局），并行发出。当前瓶颈是**每个请求的服务端响应时间约 10 秒**，而非请求数量或串行化。

---

## 三、根因分析

### 3.1 后端响应时间过长（主因）

单次请求 9–11 秒、且 payload 很小，可能原因包括：

1. **鉴权慢**
   - **v1 接口**（folders、bookmarks）走 `withAuthMiddleware` → `getAuth(request)`。Cookie 路径会先 `extractAccessToken(request.cookies)` 再 `verifyJwtLocally`；若取不到 token 或本地验证失败，会回退到 `supabase.auth.getUser()`（约 1–2 s 级网络往返）。
   - **usage-tags** 使用 `getAuthenticatedUser()` → `getCachedUser()`（请求级 cache + 本地 JWT），逻辑上已优化，但若 cache 未命中或 JWT 失败，仍可能走网络认证。
   - **blueprints** 已使用本地 JWT（`verifyJwtLocally`），并有“无 JWT 时回退 getUser”的注释；若 Cookie 未正确携带或 JWT 过期，会进入慢路径。
   - 若环境存在 Cookie 未下发、JWT 过期、或未配置 `SUPABASE_JWT_SECRET` 等情况，**每条请求都可能走网络鉴权**，叠加冷启动易达到 10 s 量级。

2. **Serverless 冷启动**
   - 若部署在 Vercel/Netlify 等，路由首次被调用或实例回收后再调用，冷启动可能增加数秒甚至十秒级延迟；四个接口若分别冷启动，会表现为“每条都慢”。

3. **数据库连接 / 查询**
   - 每次请求 `createClient()` 新建连接或连接池首包慢；或列表查询（folders、bookmarks、profiles、settings）缺索引、锁等待，导致单次处理时间过长。

4. **未使用 Middleware 预验证**
   - `auth-middleware` 支持 `x-user-id` + `x-user-verified` 的快速路径，但若 API 路由未在 Middleware 中统一注入该 header，则每个 API 都会自行鉴权，无法复用一次验证结果。

### 3.2 前端可优化点（次要）

- **folders 在首屏是否必要**：当前 `useFolders()` 由 `QuickAddBookmark`（Header）触发，知识工坊页首屏并不依赖文件夹列表；若改为“打开快速添加/创建面板时再请求”（类似 `create-panel-embedded` 的 `enabled: open`），可减少首屏必等请求。
- **usage-tags**：已有 PrefetchUsageTags，若预取与使用方共用同一 TanStack Query key，理论上可减少重复请求；首屏仍可能被“未命中缓存”的一次 11 s 阻塞。
- **content.css 1.6 MB**：在未缓存场景下会拉长首屏；可作为 P2 做体积与拆包优化。

### 3.3 小结

- **主要矛盾**：四个接口的**服务端响应时间**约 10 s，导致页面整体加载 10–22 s。
- **次要矛盾**：folders 在知识工坊首屏非必需却同步拉取；大 CSS 在未缓存时影响首屏。

---

## 四、修复计划（按优先级）

### P0：确认并打通“快速鉴权”路径（高优先级）

**目标**：确保四条接口在正常登录状态下都走“本地 JWT 或 Middleware 预验证”，单次鉴权 < 100 ms，避免每条请求 1–2 s 的 `getUser()`。

| 措施                                 | 说明                                                                                                                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. 统一 API 鉴权方式**             | 检查 `withAuthMiddleware` 在 Route Handler 内从 `request.cookies` 取 Cookie 是否与 Next.js 行为一致（如 `request.cookies.get`/`getAll`）；若 Cookie 未正确读取，补充从 `next/headers` 的 `cookies()` 读取并传入，确保 Cookie 路径可用。 |
| **2. 为 API 注入 x-user-id（可选）** | 在 Next.js Middleware 中对匹配的 API 路径（如 `/api/v1/*`、`/api/settings/*`、`/api/knowledge-studio/*`）做一次鉴权，并设置 `x-user-id`、`x-user-verified`，这样 Route 内 `getAuth(request)` 直接走 header 路径，几乎 0 ms。            |
| **3. 增加服务端耗时日志**            | 在四条接口的 handler 入口/鉴权后/DB 查询后打点计时（如 `logger.info({ duration, phase })`），便于区分是鉴权、createClient、还是 DB 占时；部署后通过日志定位首因。                                                                       |
| **4. 环境与配置检查**                | 确认生产环境已配置 `SUPABASE_JWT_SECRET`；确认登录后 Cookie 在 same-site 请求中会携带（SameSite/Lax 等），避免所有请求都回退到 `getUser()`。                                                                                            |

**验收**：在正常登录、无冷启动干扰下，四条接口 P95 响应时间 < 1 s（理想 < 500 ms）。

---

### P1：后端与数据层优化（中高优先级）

**目标**：在鉴权已优化的前提下，进一步把单次请求压到 1 s 内。

| 措施                       | 说明                                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **5. 数据库与索引**        | 检查 folders、bookmarks、profiles、settings 相关查询的索引（如 `user_id`、`created_at`、列表筛选条件）；避免 N+1、全表扫描。                    |
| **6. createClient 与连接** | 评估 Supabase 服务端 `createClient()` 是否可复用（如请求级单例），减少重复建连；若有连接池配置，确认首包时间可接受。                            |
| **7. 冷启动缓解**          | 若为 serverless，考虑对上述关键 API 做定时预热（如 cron 每 5 分钟 ping 一次），或为知识工坊入口提供“预连接”轻量接口，在用户进入前触发一次调用。 |

---

### P2：前端减负与体验（中优先级）

**目标**：首屏少等、不白屏；非关键数据延后或按需加载。

| 措施                          | 说明                                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **8. folders 按需加载**       | 将 Header 内 `QuickAddBookmark` 使用的 `useFolderList()` / `useFolders()` 改为仅在“打开快速添加/创建面板”时请求（例如 `enabled: isQuickAddOpen`），知识工坊首屏不再阻塞在 folders。 |
| **9. 骨架屏与加载态**         | 知识工坊页对蓝图列表、素材列表等使用骨架屏或明确 loading 状态，避免长时间空白；已有 Suspense 的保持并统一风格。                                                                     |
| **10. usage-tags 与首屏解耦** | 若 PrefetchUsageTags 与使用方 key 一致且命中率高，首屏应只等一次；若仍发现重复或首屏强依赖，可考虑“进入知识工坊后再预取 usage-tags”，或仅在实际使用筛选/标签的 UI 时再请求。        |
| **11. content.css 体积**      | 分析 1.6 MB 的构成（未使用的 Tailwind、重复依赖、未压缩等），做 purge、拆包或按路由 chunk，减少未缓存下的首屏体积。                                                                 |

---

### P3：监控与回归（建议）

| 措施                 | 说明                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **12. 关键接口监控** | 对 `/api/v1/folders`、`/api/v1/bookmarks`、`/api/settings/usage-tags`、`/api/knowledge-studio/v2/blueprints` 做响应时间与错误率监控，便于后续回归与容量规划。 |
| **13. 前端性能指标** | 对 knowledge-studio/v2 记录 LCP / FCP 或“首屏可交互时间”，与本次优化前后对比。                                                                                |

---

## 五、建议的下一步（可审核项）

1. **是否同意 P0 方案**
   - 先做鉴权路径确认（Cookie/JWT/Middleware）+ 服务端打点日志，在测试/生产复现“10 s 慢请求”并定位是鉴权、DB 还是冷启动；再决定是否上 Middleware 注入 `x-user-id`。

2. **P2 中的“folders 按需加载”**
   - 是否接受在知识工坊（及不依赖文件夹列表的页面）首屏不请求 folders，仅在打开快速添加时再拉取；若产品希望 Header 随时显示文件夹数量等信息，可改为“首屏只请求数量/轻量接口”而非全量列表。

3. **后端优化排期**
   - P0 落地后根据日志结果排期 P1（DB/连接/冷启动）；若日志显示主要为冷启动，可优先预热或架构调整。

4. **content.css**
   - 是否在本迭代内做 P2 体积优化，还是单独排期。

---

## 六、涉及文件（便于实现与 Code Review）

| 类型               | 文件                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 前端 · 页面        | `src/app/(main)/knowledge-studio/v2/page.tsx`、`knowledge-studio-v2-page-client.tsx`                                                                                      |
| 前端 · 请求        | `src/hooks/data/use-folders.ts`、`src/hooks/data/use-custom-usage-tags.ts`、`src/hooks/queries/use-blueprints.ts`、`src/hooks/queries/use-bookmarks.ts`                   |
| 前端 · 布局/Header | `src/components/layout/app-header.tsx`、`src/components/layout/prefetch-usage-tags.tsx`、`src/components/quick-add/`（useFolderList）                                     |
| 后端 · 鉴权        | `src/lib/api/auth-middleware.ts`、`src/lib/api/middleware.ts`、`src/lib/supabase/cached-auth.ts`、`src/lib/auth/jwt-verifier.ts`                                          |
| 后端 · 路由        | `src/app/api/v1/folders/route.ts`、`src/app/api/v1/bookmarks/route.ts`、`src/app/api/settings/usage-tags/route.ts`、`src/app/api/knowledge-studio/v2/blueprints/route.ts` |
| 中间件             | `src/middleware.ts`（若采用 x-user-id 注入）                                                                                                                              |

---

## 七、验收预期

- **P0 完成后**：在鉴权正常、无冷启动干扰下，四条接口 P95 响应时间 < 1 s；有日志可区分鉴权/DB/冷启动耗时。
- **P2 完成后**：knowledge-studio/v2 首屏不再被 folders 请求阻塞（若采用 folders 按需加载）；首屏有明确骨架/loading，无长时间白屏。
- **整体**：目标首屏可交互时间从当前 10–22 s 降到 2–3 s 内（在鉴权与后端优化到位且无严重冷启动前提下）。

以上为当前诊断与修复计划，可根据业务优先级裁剪或调整顺序后实施。
