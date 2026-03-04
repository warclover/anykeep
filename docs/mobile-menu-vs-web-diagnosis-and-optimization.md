# AnyKeep 移动端菜单与 Web 端不一致诊断与优化方案

**文档目的**：分析移动端菜单与 Web 端侧边栏的差异，给出统一数据源与体验的优化方案，供审核。

---

## 一、现状概览

| 端     | 组件                           | 数据源                                                | 展示形式                               |
| ------ | ------------------------------ | ----------------------------------------------------- | -------------------------------------- |
| Web    | `AppSidebar`                   | `nav-config.ts`（NAV_GROUPS + getDesktopItems）       | 左侧固定侧边栏，五色分组、可折叠       |
| 移动端 | `MobileBottomNav`「更多」Sheet | `nav-config.ts`（getMobileMoreGroups）                | 底部 4 Tab，点击「更多」弹出底部 Sheet |
| 移动端 | `MobileMenu` 汉堡抽屉          | **本地硬编码**（mobile-menu.tsx 内 navigationGroups） | 顶部左侧汉堡图标，点击展开左侧抽屉     |

结论：**Web 与移动端「更多」Sheet 已共用 nav-config；移动端汉堡菜单仍使用独立配置，导致双入口内容不一致。**

---

## 二、不一致详情

### 2.1 移动端存在「双菜单入口」

- **入口 1**：顶部导航栏左侧 **汉堡图标** → 打开 `MobileMenu` 左侧抽屉。
- **入口 2**：底部导航栏 **「更多」** Tab → 打开 `MobileBottomNav` 的底部 Sheet。

两处均为「完整功能导航」，但数据源不同，用户会看到两套不同的菜单项与分组。

### 2.2 汉堡菜单与 nav-config / Web 侧边栏的差异

#### 分组与命名

| 维度         | 汉堡菜单 (mobile-menu.tsx)                 | Web / nav-config                                         |
| ------------ | ------------------------------------------ | -------------------------------------------------------- |
| 分组数量     | 4 组（内容中心、整理工具、洞察中心、系统） | 5 组（我的内容、智能工具、洞察与通知、系统、开发者工具） |
| 智能工具组名 | 「整理工具」语义                           | 「智能工具」                                             |

#### 我的内容

| 项                             | 汉堡菜单 | nav-config / Web    |
| ------------------------------ | -------- | ------------------- |
| 我的收藏/搜索/文件夹/标签/笔记 | ✅       | ✅                  |
| 我的音频                       | ❌ 缺失  | ✅ `/audio-library` |

#### 智能工具 / 整理工具

| 项       | 汉堡菜单                         | nav-config / Web                                                   |
| -------- | -------------------------------- | ------------------------------------------------------------------ |
| 收件箱   | ✅ `/inbox`                      | ✅（nav 中为「整理中心」下的能力之一，入口为整理中心 `/organize`） |
| 主题合成 | ✅ `/synthesis`                  | 对应「主题合成」能力，nav 入口为整理中心                           |
| 知识工坊 | ✅ **`/knowledge-studio`**（旧） | ✅ **`/knowledge-studio/v2`**（新）                                |
| 内容导出 | ✅ `/export`                     | ✅（visibility: mobile）                                           |
| 整理中心 | ❌ 缺失                          | ✅ `/organize`                                                     |
| 内容分析 | ❌ 缺失                          | ✅ `/content-analysis`                                             |
| 学习中心 | ❌ 缺失                          | ✅ `/learning-hub`                                                 |
| 分发中心 | ❌ 缺失                          | ✅ `/distribution`（visibility: mobile）                           |
| 链接检测 | ❌ 缺失                          | ✅ `/link-health`（visibility: mobile）                            |
| 数据中心 | -                                | ✅ `/data`（visibility: desktop，仅 Web）                          |

#### 洞察中心

| 项                           | 汉堡菜单 | nav-config / Web  |
| ---------------------------- | -------- | ----------------- |
| 数据分析、活动日志、消息通知 | ✅       | ✅                |
| AI学习                       | ❌ 缺失  | ✅ `/ai-learning` |

#### 系统

| 项           | 汉堡菜单 | nav-config / Web |
| ------------ | -------- | ---------------- |
| 设置、垃圾箱 | ✅       | ✅               |

#### 开发者工具

- Web：在侧边栏显示（需开发者模式），nav-config 中 `requireDevMode: true`。
- 移动端：`getMobileMoreGroups()` 已过滤掉 `requireDevMode` 分组，故「更多」Sheet 不显示。
- 汉堡菜单：本地配置中未包含开发者工具，与「更多」行为一致，但缺少统一配置来源。

### 2.3 路由与产品形态不一致

- **知识工坊**：汉堡为 `/knowledge-studio`（旧），Web 与「更多」Sheet 为 `/knowledge-studio/v2`（新），移动端用户从汉堡进入会到旧版。
- **整理中心**：Web 侧边栏有「整理中心」入口 `/organize`，底部 Tab 也有「整理」；汉堡菜单无「整理中心」项，仅有收件箱/主题合成/知识工坊/导出，与当前产品结构不一致。

### 2.4 小结

| 问题类型   | 说明                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| 数据源分裂 | 汉堡菜单自维护一份导航配置，与 nav-config 不同步                             |
| 缺项       | 汉堡缺少：我的音频、整理中心、内容分析、学习中心、分发中心、链接检测、AI学习 |
| 错误链接   | 知识工坊指向旧版 `/knowledge-studio`                                         |
| 双入口体验 | 同一用户从「汉堡」与「更多」进入看到不同菜单，增加认知负担                   |

---

## 三、优化目标

1. **单一数据源**：所有导航项与分组来自 `nav-config.ts`，新增/下线/改链接只改一处。
2. **移动端与 Web 语义一致**：分组命名、项含义与 Web 侧边栏对齐（考虑 visibility 与移动端隐藏开发者工具）。
3. **消除错误入口**：知识工坊等统一到当前主路径（如 `/knowledge-studio/v2`）。
4. **移动端入口策略清晰**：明确「汉堡」与「更多」的职责，避免两套完整菜单并行。

---

## 四、优化方案（供审核）

### 方案 A：统一数据源，保留双入口（推荐）

**思路**：汉堡菜单与「更多」Sheet 都从 nav-config 读取，仅展示形式不同（左侧抽屉 vs 底部 Sheet），内容完全一致。

**实施要点**：

1. **汉堡菜单改为使用 nav-config**
   - 删除 `mobile-menu.tsx` 内本地 `navigationGroups`。
   - 使用 `getMobileMoreGroups()`（与「更多」Sheet 相同）或新增 `getMobileMenuGroups()`（若需与「更多」略有区分时再封装）。
   - 分组标题、项名称、链接、图标、Pro/徽章等全部从 nav-config 渲染，保证与 Web 及「更多」一致。

2. **统一知识工坊链接**
   - 若 nav-config 已为 `/knowledge-studio/v2`，则汉堡菜单改用 nav-config 后自动修复；无需在 mobile-menu 内再改链接。

3. **可选：分组配色与 Web 对齐**
   - 当前 Web 侧边栏按分组有「五色」方案（我的内容/智能工具/洞察/系统/开发者工具）。
   - 移动端汉堡与「更多」Sheet 可复用同一套分组 ID 与配色逻辑（从 nav-config 的 group.id 映射），视觉与语义统一。

4. **保留双入口**
   - 顶部汉堡：适合单手点击、从左侧滑出，与底部「更多」并存，满足不同操作习惯。
   - 两者内容一致，用户无论从哪边进入都能看到同一套导航。

**优点**：改动集中在 mobile-menu 组件与数据拉取方式，风险可控；一次修改长期受益。  
**缺点**：移动端仍有两个入口，需在 UI 上保持明显一致性（同一套分组与项）。

---

### 方案 B：单一入口，汉堡仅作快捷/品牌

**思路**：移动端只保留「更多」Sheet 作为完整导航；汉堡菜单改为「品牌 + 少量快捷操作（如主题切换、设置）+ 可能的一个「打开底部更多」的入口」，不再展示完整导航列表。

**实施要点**：

1. **精简 MobileMenu 内容**
   - 移除完整分组与导航列表。
   - 保留：品牌/Logo、主题切换、设置、版本号等；可选增加「打开更多」按钮，点击后关闭抽屉并触发打开底部「更多」Sheet（需 MobileMenu 与 MobileBottomNav 间通信或全局状态）。

2. **完整导航仅来自底部「更多」**
   - 所有从 nav-config 来的项仅出现在「更多」Sheet，与 Web 侧边栏一致。

**优点**：移动端只有一个「完整菜单」心智，无重复感。  
**缺点**：依赖底部 Tab 的「更多」，部分用户若习惯左上角入口会需要适应；且需实现「汉堡内打开更多」的联动。

---

### 方案 C：单一入口，仅保留汉堡

**思路**：移除底部「更多」Tab，仅保留汉堡菜单作为移动端完整导航入口；底部 Tab 改为 3 个（如收藏、搜索、整理），其余全部进汉堡抽屉。

**实施要点**：

1. **MobileBottomNav**
   - 底部仅 3 个 Tab：收藏、搜索、整理；删除「更多」Tab 及对应 Sheet。

2. **MobileMenu**
   - 改为从 nav-config 读取（同方案 A），作为移动端唯一完整导航；需排除已在底部 Tab 的 3 个页面（/home、/search、/organize），与当前 getMobileMoreGroups() 逻辑一致。

**优点**：单一口径的「更多」入口，无两套菜单。  
**缺点**：消息/设置等高频入口需要多一步（点汉堡再点项）；与当前 4 Tab 设计相比改动较大，需产品确认。

---

## 五、推荐结论与后续步骤

- **推荐采用方案 A**：统一数据源，保留双入口。
  - 实现成本低（主要改 mobile-menu 数据源 + 可选分组配色）。
  - 不改变现有「顶部汉堡 + 底部更多」的布局，仅统一内容与链接，避免错误入口（如旧版知识工坊）和缺项问题。

**建议实施顺序**：

1. **Phase 1（必做）**
   - 将 `mobile-menu.tsx` 改为使用 `getMobileMoreGroups()`（或基于 NAV_GROUPS + getMobileItems 的等价逻辑），删除本地 `navigationGroups`。
   - 确认知识工坊等链接全部来自 nav-config（已为 v2）。
   - 回归测试：汉堡与「更多」Sheet 的项、分组、链接与 Web 侧边栏一致（考虑 visibility 与开发者工具过滤）。

2. **Phase 2（可选）**
   - 为移动端汉堡/Sheet 引入与 Web 一致的分组配色（按 group.id 映射），提升一致感。
   - 在 nav-config 中为需要区分「仅桌面 / 仅移动 / 两端」的项补全 `visibility` 与 `description`，便于后续扩展。

3. **产品决策**
   - 若希望移动端仅保留一个完整菜单入口，再评估方案 B 或 C，并明确「汉堡」的最终定位（快捷入口 vs 完整导航）。

---

## 六、涉及文件清单

| 文件                                                    | 变更说明                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/components/layout/mobile-menu.tsx`                 | 移除本地 navigationGroups，改为从 `@/lib/navigation/nav-config` 获取数据并渲染；可选统一分组配色 |
| `src/lib/navigation/nav-config.ts`                      | 仅当需要新增 visibility/description 或新项时修改；Phase 1 可不改                                 |
| `src/components/layout/mobile-bottom-nav.tsx`           | 已使用 getMobileMoreGroups()，无需改数据源；注释可更新为「与汉堡菜单共用 nav-config」            |
| `docs/mobile-menu-vs-web-diagnosis-and-optimization.md` | 本文档，记录诊断与方案，审核通过后可作实施依据                                                   |

---

## 七、优化后一致性检查报告

**检查时间**：方案 A 实施后  
**结论**：✅ **移动端与 Web 端菜单已通过统一数据源达成一致**（按设计存在合理的端差异）。

### 7.1 数据源

| 端 / 入口           | 数据来源                                | 说明                                               |
| ------------------- | --------------------------------------- | -------------------------------------------------- |
| Web 侧边栏          | `NAV_GROUPS` + `getDesktopItems(group)` | 仅展示 `visibility` 为未设置 / both / desktop 的项 |
| 移动端汉堡菜单      | `getMobileMoreGroups()`                 | 与「更多」Sheet 同源                               |
| 移动端「更多」Sheet | `getMobileMoreGroups()`                 | 与汉堡菜单同源                                     |

三者均来自 **`src/lib/navigation/nav-config.ts`**，无独立配置。

### 7.2 分组与顺序

- **Web**：myContent → smartTools → insight → system → devTools（开发者模式时）。
- **移动端**：myContent → smartTools → insight → system（无 devTools，与设计一致）。
- 分组标题翻译键一致：`navGroup.myContent`、`navGroup.smartTools`、`navGroup.insightCenter`、`mobileMenu.system`。

### 7.3 项与链接（语义一致）

- **共用项**（无 visibility 或 visibility 为 both）：名称、href、图标、Pro/徽章由 nav-config 统一维护，两端一致。例如：知识工坊均为 `/knowledge-studio/v2`，我的收藏/搜索/文件夹/标签/笔记/音频、内容分析、学习中心、数据分析、活动日志、消息、设置、垃圾箱等均一致。
- **设计上的端差异**：
  - **仅 Web**：智能工具中的「数据中心」`/data`（`visibility: "desktop"`）。
  - **仅移动端**：智能工具中的「导出」「分发中心」「链接检测」（`visibility: "mobile"`）；底部 Tab 已覆盖「收藏 / 搜索 / 整理」，故「更多」与汉堡中不重复展示这三项，由 `getMobileMoreGroups()` 的 `bottomTabHrefs` 过滤保证。

### 7.4 移动端双入口一致性

- 汉堡菜单与「更多」Sheet 均使用 **同一调用** `getMobileMoreGroups()`（分别为 `mobileMenuGroups`、`moreNavigationGroups`），分组顺序、项列表、链接、翻译键完全一致。

### 7.5 代码引用核对

- `app-sidebar.tsx`：`NAV_GROUPS`、`getDesktopItems`（第 35–36、547–550 行）。
- `mobile-menu.tsx`：`getMobileMoreGroups()`（第 30、63 行）。
- `mobile-bottom-nav.tsx`：`getMobileMoreGroups()`（第 47、51 行）。

**结论**：优化后移动端与 Web 端菜单在统一数据源下一致；差异仅来自 nav-config 的 `visibility` 与「移动端不展示开发者工具」「底部 Tab 占位项在更多中不重复」的既定规则。

---

**文档版本**：v1  
**日期**：2026-03-04  
**状态**：方案 A 已实施（2026-03-04）；一致性检查已完成。
