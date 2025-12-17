# P2-007: Markdown 内容收藏 - 详细实施计划

> **版本**: v1.0
> **创建日期**: 2025-12-17
> **关联设计文档**: [P2-007-markdown-bookmark-design.md](./P2-007-markdown-bookmark-design.md)
> **预计工时**: 9 天
> **分支名称**: `feature/md-collections`

---

## 一、实施原则

### 1.1 解耦原则（核心）

```
⚠️ 不影响现有功能是最高优先级

1. 独立数据表 - md_collections（不修改 bookmarks 表）
2. 独立模块目录 - src/features/md-collections/
3. 独立路由 - /md-collections（不修改现有路由）
4. 独立 API - /api/md-collections/（不修改现有 API）
5. 可回滚设计 - 删除模块目录即可完全移除功能
```

### 1.2 复用原则

```
✅ 可复用的现有服务（调用但不修改）：
- SummaryService.generate() - AI 摘要生成
- generateEmbedding() - 向量生成
- generateAIContent() - AI 标签生成
- ContentTypeDetector - 内容类型检测
- TagSelector 组件 - 标签选择器

❌ 需要新建的独立组件：
- md-collections 专属组件
- markdown 渲染组件（共享）
```

---

## 二、里程碑划分

### M1: 基础设施（Day 1）

| 任务ID    | 任务内容           | 工时  | 验收标准                   |
| --------- | ------------------ | ----- | -------------------------- |
| P2-007-1  | 数据库 Schema 迁移 | 0.5d  | 表创建成功，RLS 策略生效   |
| P2-007-2  | 模块目录结构搭建   | 0.25d | 目录结构完整，类型定义完成 |
| P2-007-13 | 功能开关门控       | 0.25d | FREE/PRO 权限判断正确      |

**M1 交付物**:

- [x] `supabase/migrations/20251220000001_create_md_collections.sql`
- [x] `src/features/md-collections/` 目录结构
- [x] `src/features/md-collections/lib/feature-gate.ts`
- [x] `src/features/md-collections/types/index.ts`

---

### M2: 核心 API（Day 2-3）

| 任务ID    | 任务内容                 | 工时  | 依赖     | 验收标准               |
| --------- | ------------------------ | ----- | -------- | ---------------------- |
| P2-007-3  | API: 创建/列表/详情/删除 | 1d    | M1       | CRUD 功能完整          |
| P2-007-4  | API: 文件上传/去重检测   | 0.5d  | P2-007-1 | 上传和去重正常         |
| P2-007-16 | API: 标签库共享          | 0.25d | P2-007-3 | 跨表标签查询正常       |
| P2-007-12 | AI 处理适配              | 0.5d  | P2-007-3 | 摘要/标签/向量生成正常 |

**M2 交付物**:

- [x] `src/app/api/md-collections/route.ts` (GET/POST)
- [x] `src/app/api/md-collections/[id]/route.ts` (GET/PATCH/DELETE)
- [x] `src/app/api/md-collections/upload/route.ts`
- [x] `src/app/api/md-collections/check-duplicate/route.ts`
- [x] `src/app/api/md-collections/search/route.ts`
- [x] `src/features/md-collections/lib/md-processor.ts`

---

### M3: 页面 UI（Day 4-6）

| 任务ID    | 任务内容       | 工时  | 依赖      | 验收标准                      |
| --------- | -------------- | ----- | --------- | ----------------------------- |
| P2-007-5  | 侧边栏菜单集成 | 0.25d | -         | 菜单显示，Pro 标签正确        |
| P2-007-6  | MD 列表页面    | 1d    | P2-007-3  | 列表展示正常，空状态正确      |
| P2-007-7  | 拖拽上传区组件 | 0.5d  | P2-007-4  | 拖拽/点击上传正常             |
| P2-007-8  | 粘贴对话框组件 | 0.5d  | P2-007-3  | 粘贴预览保存正常              |
| P2-007-14 | 卡片视图组件   | 0.5d  | P2-007-6  | 卡片展示正常                  |
| P2-007-15 | 视图切换功能   | 0.25d | P2-007-14 | 列表/卡片切换正常，偏好持久化 |

**M3 交付物**:

- [x] `src/components/layout/app-sidebar.tsx` (修改 - 添加菜单项)
- [x] `src/app/(main)/md-collections/page.tsx`
- [x] `src/features/md-collections/components/md-collection-page.tsx`
- [x] `src/features/md-collections/components/md-upload-zone.tsx`
- [x] `src/features/md-collections/components/md-paste-dialog.tsx`
- [x] `src/features/md-collections/components/md-list-view.tsx`
- [x] `src/features/md-collections/components/md-card-view.tsx`
- [x] `src/features/md-collections/components/md-card-item.tsx`
- [x] `src/features/md-collections/components/md-view-toggle.tsx`
- [x] `src/features/md-collections/components/md-empty-state.tsx`
- [x] `src/features/md-collections/hooks/use-md-collections.ts`
- [x] `src/features/md-collections/hooks/use-md-upload.ts`
- [x] `src/features/md-collections/hooks/use-md-view-preference.ts`

---

### M4: 阅读体验（Day 7-9）

| 任务ID    | 任务内容          | 工时 | 依赖        | 验收标准                   |
| --------- | ----------------- | ---- | ----------- | -------------------------- |
| P2-007-9  | Markdown 渲染组件 | 1d   | -           | prose 排版正确，GFM 支持   |
| P2-007-10 | 代码块高亮 + 复制 | 0.5d | P2-007-9    | 语法高亮正确，复制功能正常 |
| P2-007-11 | 专业阅读视图页面  | 1d   | P2-007-9,10 | 阅读体验优秀               |
| P2-007-17 | 集成测试          | 0.5d | All         | 全流程测试通过             |

**M4 交付物**:

- [x] `src/components/markdown/markdown-renderer.tsx`
- [x] `src/components/markdown/markdown-code-block.tsx`
- [x] `src/components/markdown/sanitize-schema.ts`
- [x] `src/components/markdown/index.ts`
- [x] `src/app/(main)/md-collections/[id]/page.tsx`
- [x] `src/features/md-collections/components/md-reader-view.tsx`

---

## 三、详细任务清单

### Day 1: 基础设施

#### Task 1.1: 安装依赖包

```bash
npm install react-markdown@9.0.0 remark-gfm@4.0.0 rehype-sanitize@6.0.0 rehype-slug@6.0.0 rehype-autolink-headings@7.0.0 react-syntax-highlighter@15.5.0
npm install -D @types/react-syntax-highlighter@15.5.0
```

#### Task 1.2: 创建数据库迁移文件

```
文件: supabase/migrations/20251220000001_create_md_collections.sql
内容: 见设计文档 3.1 节
验证: supabase db push && supabase db reset (本地)
```

#### Task 1.3: 创建模块目录结构

```
src/features/md-collections/
├── components/
│   └── index.ts
├── lib/
│   ├── feature-gate.ts
│   └── index.ts
├── hooks/
│   └── index.ts
├── types/
│   └── index.ts
├── constants/
│   └── index.ts
└── index.ts
```

#### Task 1.4: 实现功能门控

```typescript
// src/features/md-collections/lib/feature-gate.ts
// 见设计文档 2.3 节代码
```

---

### Day 2: API - CRUD

#### Task 2.1: 列表/创建 API

```
文件: src/app/api/md-collections/route.ts
方法:
  - GET: 获取用户 MD 收藏列表（分页、筛选）
  - POST: 创建新的 MD 收藏

验证:
  - curl GET /api/md-collections 返回列表
  - curl POST /api/md-collections 创建成功
```

#### Task 2.2: 详情/更新/删除 API

```
文件: src/app/api/md-collections/[id]/route.ts
方法:
  - GET: 获取单条详情
  - PATCH: 更新（标题、标签、备注）
  - DELETE: 软删除

验证:
  - 各方法正常工作
  - RLS 策略生效（只能操作自己的数据）
```

---

### Day 3: API - 上传/去重/AI

#### Task 3.1: 文件上传 API

```
文件: src/app/api/md-collections/upload/route.ts
功能:
  - 接收 FormData (file + 可选 title/folderId/userTags)
  - 验证文件类型和大小
  - 解析文件内容
  - 调用创建逻辑

验证:
  - 上传 .md 文件成功
  - 错误文件类型被拒绝
```

#### Task 3.2: 去重检测 API

```
文件: src/app/api/md-collections/check-duplicate/route.ts
功能:
  - 接收 content
  - 计算 SHA-256 hash
  - 查询是否存在相同 hash

验证:
  - 相同内容返回已存在
  - 不同内容返回不存在
```

#### Task 3.3: AI 处理适配

```
文件: src/features/md-collections/lib/md-processor.ts
功能:
  - preprocessMarkdownForAI(): 预处理 MD 内容
  - 调用 SummaryService.generate()
  - 调用 generateEmbedding()
  - 调用 generateAIContent() 获取标签

验证:
  - 摘要生成正确
  - 向量维度为 1024
  - 标签合理
```

#### Task 3.4: 标签库共享 API

```
文件: src/features/md-collections/lib/tag-library.ts
功能:
  - getUserTagLibrary(): 合并 bookmarks + md_collections 标签

验证:
  - 返回去重后的标签列表
```

---

### Day 4: 页面 - 列表基础

#### Task 4.1: 侧边栏菜单集成

```
文件: src/components/layout/app-sidebar.tsx
修改:
  - 在"首页"下方添加"MD收藏"链接
  - 添加 Pro 标签
  - 添加活跃状态样式

验证:
  - 菜单项显示正确
  - 点击跳转正常
  - 当前页高亮
```

#### Task 4.2: 列表页路由

```
文件: src/app/(main)/md-collections/page.tsx
内容:
  - 导入 MdCollectionPage 组件
  - 添加权限检查

验证:
  - /md-collections 路由可访问
  - FREE 用户看到升级提示
```

#### Task 4.3: 列表页主组件

```
文件: src/features/md-collections/components/md-collection-page.tsx
功能:
  - 页面头部（标题、操作按钮）
  - 拖拽上传区
  - 列表/卡片视图
  - 空状态

验证:
  - 页面布局正确
  - 加载状态显示
```

---

### Day 5: 页面 - 交互组件

#### Task 5.1: 数据获取 Hook

```
文件: src/features/md-collections/hooks/use-md-collections.ts
功能:
  - useMdCollections(): 获取列表
  - useMdCollection(id): 获取详情
  - useCreateMdCollection(): 创建
  - useDeleteMdCollection(): 删除

验证:
  - 数据获取正常
  - 缓存和刷新正常
```

#### Task 5.2: 拖拽上传区组件

```
文件: src/features/md-collections/components/md-upload-zone.tsx
功能:
  - 拖拽检测
  - 文件选择
  - 上传进度
  - 多文件支持

验证:
  - 拖拽上传正常
  - 点击选择正常
  - 进度显示正常
```

#### Task 5.3: 粘贴对话框组件

```
文件: src/features/md-collections/components/md-paste-dialog.tsx
功能:
  - 文本输入区
  - 实时预览
  - 标题提取
  - 文件夹/标签选择
  - 字数统计

验证:
  - 粘贴内容正常
  - 预览渲染正常
  - 保存成功
```

---

### Day 6: 页面 - 视图组件

#### Task 6.1: 列表视图组件

```
文件: src/features/md-collections/components/md-list-view.tsx
功能:
  - 列表项渲染
  - 标题、摘要、元信息
  - 点击跳转

验证:
  - 列表显示正确
  - 点击跳转正常
```

#### Task 6.2: 卡片视图组件

```
文件: src/features/md-collections/components/md-card-view.tsx
文件: src/features/md-collections/components/md-card-item.tsx
功能:
  - 网格布局
  - 内容类型徽章
  - 标题、摘要、标签
  - 操作菜单

验证:
  - 卡片显示正确
  - 响应式布局正常
```

#### Task 6.3: 视图切换组件

```
文件: src/features/md-collections/components/md-view-toggle.tsx
文件: src/features/md-collections/hooks/use-md-view-preference.ts
功能:
  - 列表/卡片切换
  - localStorage 持久化

验证:
  - 切换正常
  - 刷新后保持选择
```

#### Task 6.4: 空状态组件

```
文件: src/features/md-collections/components/md-empty-state.tsx
功能:
  - 引导文案
  - 粘贴/上传按钮
  - 功能特性展示

验证:
  - 空状态显示正确
  - 按钮功能正常
```

---

### Day 7: 阅读 - Markdown 渲染

#### Task 7.1: Markdown 渲染器

```
文件: src/components/markdown/markdown-renderer.tsx
功能:
  - react-markdown 集成
  - remark-gfm 支持
  - rehype-sanitize 防护
  - prose 样式
  - 多种 variant（default/reader/preview）

验证:
  - GFM 语法正确渲染
  - 表格、列表、引用正常
  - XSS 内容被过滤
```

#### Task 7.2: XSS 防护配置

```
文件: src/components/markdown/sanitize-schema.ts
功能:
  - 白名单标签
  - 白名单属性
  - 协议限制

验证:
  - script 标签被移除
  - onclick 等事件被移除
  - javascript: 协议被阻止
```

---

### Day 8: 阅读 - 代码高亮

#### Task 8.1: 代码块组件

```
文件: src/components/markdown/markdown-code-block.tsx
功能:
  - 语言检测
  - 语法高亮（react-syntax-highlighter）
  - 行号显示
  - 复制按钮
  - 语言标签

验证:
  - 多种语言高亮正确
  - 复制功能正常
  - 视觉效果良好
```

#### Task 8.2: 阅读视图路由

```
文件: src/app/(main)/md-collections/[id]/page.tsx
功能:
  - 获取 MD 收藏详情
  - 渲染阅读视图

验证:
  - 路由参数正确
  - 404 处理正确
```

---

### Day 9: 阅读视图 + 测试

#### Task 9.1: 专业阅读视图

```
文件: src/features/md-collections/components/md-reader-view.tsx
功能:
  - 返回按钮
  - AI 摘要卡片
  - Markdown 内容渲染
  - 元信息展示
  - 删除操作

验证:
  - 阅读体验优秀
  - 代码块可复制
  - 响应式适配
```

#### Task 9.2: 集成测试

```
测试项:
  1. 创建 MD 收藏（粘贴）
  2. 创建 MD 收藏（上传）
  3. 查看列表
  4. 切换视图
  5. 查看详情
  6. 代码复制
  7. 删除收藏
  8. 权限验证（FREE 用户）

验证:
  - 全流程无错误
  - 性能可接受
```

---

## 四、风险与缓解

| 风险                            | 可能性 | 影响 | 缓解措施                 |
| ------------------------------- | ------ | ---- | ------------------------ |
| react-syntax-highlighter 包大小 | 高     | 中   | 动态导入，按需加载语言包 |
| AI 处理失败                     | 中     | 中   | 降级策略：无摘要也可保存 |
| 大文件渲染卡顿                  | 中     | 中   | 内容截断，虚拟滚动       |
| XSS 漏洞                        | 低     | 高   | rehype-sanitize + CSP 头 |

---

## 五、回滚方案

如需回滚：

1. **数据库**: 执行 `DROP TABLE md_collections CASCADE;`
2. **前端**: 删除 `src/features/md-collections/` 目录
3. **API**: 删除 `src/app/api/md-collections/` 目录
4. **路由**: 删除 `src/app/(main)/md-collections/` 目录
5. **菜单**: 撤销 `app-sidebar.tsx` 的修改
6. **依赖**: 可选择保留（共享 markdown 组件可能复用）

---

## 六、验收清单

### 功能验收

- [ ] 侧边栏显示「MD收藏」菜单项（带 Pro 标签）
- [ ] 支持粘贴 Markdown 文本收藏
- [ ] 支持上传 .md 文件收藏
- [ ] 支持拖拽 .md 文件收藏
- [ ] 专业阅读视图（优美排版、代码高亮、一键复制）
- [ ] AI 自动生成摘要和标签
- [ ] 列表/卡片视图切换
- [ ] 视图偏好持久化
- [ ] Pro 专属功能，免费用户看到升级引导

### 解耦验收

- [ ] 所有代码位于 `src/features/md-collections/`
- [ ] 使用独立数据表 `md_collections`
- [ ] 功能开关可独立控制
- [ ] 不影响现有 bookmarks 功能
- [ ] 可单独删除模块而不破坏其他功能

### 安全验收

- [ ] 无 XSS 安全漏洞
- [ ] 内容大小限制生效
- [ ] RLS 策略正确执行

---

**计划状态**: 待审核
**创建者**: BMad Master
**审核者**: [待填写]
