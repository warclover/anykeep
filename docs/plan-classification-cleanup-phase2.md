# 分类系统精简 Phase 2 — 实施计划

> 状态：待审批 | 日期：2026-03-11
> 基于：`docs/精简方案-专职收藏整理智能体.md` 第四节

---

## 现状评估

### 已完成的工作（Phase 0-1）

| 里程碑        | 内容                                                              | 状态        |
| ------------- | ----------------------------------------------------------------- | ----------- |
| V5 路由全删   | 18 条 `/api/classification/v5/*` 路由                             | ✅ cff576c9 |
| V5 组件全删   | 14 个 shadow/v5 UI 组件                                           | ✅ cff576c9 |
| V1 归档       | 352 文件移至 `_archived/classification-v1/`                       | ✅ 已完成   |
| 桥接层删除    | `classification-integration/`、`classification-config/`           | ✅ 当前分支 |
| V2 集成层     | 新建 `classification-v2/integration/` 替代桥接                    | ✅ 当前分支 |
| 外围模块删除  | `embedding-ab-test/`、`folder-quota/`、`ai-librarian/`            | ✅ 当前分支 |
| 组件清理      | `performance-monitor.tsx`、`folder-quota-bar.tsx`、`v55-index.ts` | ✅ 当前分支 |
| Edge Function | `process-t1-corrections/` 删除                                    | ✅ 当前分支 |
| Admin 路由    | `classification-config/`、`embedding-ab-test/` 路由删除           | ✅ 当前分支 |
| 类型检查      | `tsc --noEmit` 零错误                                             | ✅ 验证通过 |

### 当前分类系统架构

```
classification-v2/          # 唯一活跃系统（17 子目录）
├── classify.ts             # 核心入口
├── config.ts               # 配置常量
├── types.ts                # 类型定义
├── scorer/                 # 5 层评分器（rule/ai-tag/vector/history/llm）
├── ranker/                 # CascadeRanker 级联排序
├── context/                # 上下文构建（bookmark/folder/user）
├── batch/                  # 批量分类 + 收件箱组织
├── feedback/               # 反馈 + 权重学习
├── integration/            # Side-effect 处理（新建）
├── folder-naming/          # 文件夹自动命名
├── infra/                  # 缓存/LLM/向量搜索
├── matchers/               # 标签匹配器
├── services/               # 聚类建议/规则生成
├── operation-log.ts        # 操作日志和撤销
├── client/                 # 客户端集成
└── __tests__/              # 测试
```

---

## Phase 2 实施计划

### Step 1：删除废弃 API 路由（低风险）

删除已标记 `@deprecated` 且无前端调用的路由：

| 路由                                            | 理由                                          | 影响       |
| ----------------------------------------------- | --------------------------------------------- | ---------- |
| `/api/classification/cluster-confirm/route.ts`  | `@deprecated`，已被 `/inbox` POST/DELETE 替代 | 无前端调用 |
| `/api/classification/source-profiles/route.ts`  | v1 来源画像，v2 内部直接访问服务层            | 无前端调用 |
| `/api/classification/folder-profiles/route.ts`  | 与 `/folders/profiles/` 重复                  | 无前端调用 |
| `/api/classification/interest-profile/route.ts` | v1 兴趣画像，已合并到 `/interests`            | 无前端调用 |

**操作**：

1. 删除 4 个路由文件
2. 从 `api-paths.ts` 移除对应常量
3. 验证 `tsc --noEmit` 通过

### Step 2：合并 v1/v2 反馈路由（中风险）

当前存在两个反馈端点：

- `/api/classification/feedback/route.ts` (v1)
- `/api/classification/v2/feedback/route.ts` (v2)

**操作**：

1. 检查 v1 feedback 的调用者
2. 如果所有调用者已迁移到 v2，将 v1 路由改为 308 重定向
3. 如果还有调用者，标记 `@deprecated` 但暂不删除

### Step 3：简化 analytics 路由（低风险）

当前 `analytics/route.ts` 883 行，包含 8 个子类型。其中 `abtest` 分支引用了已删除的 `embedding-ab-test` 服务。

**操作**：

1. 移除 `abtest` 分析分支（返回模拟数据，无实际功能）
2. 清理对已删除模块的注释引用
3. 保留其他 7 个分析类型不变

### Step 4：清理 API 路径常量（低风险）

从 `api-paths.ts` 移除所有已删除路由的常量定义，包括：

- V5 相关注释中的残留引用
- 已删除路由的常量
- `@deprecated` 标记的废弃常量

### Step 5：清理组件索引注释（极低风险）

[classification/index.ts](src/components/classification/index.ts) 中的注释 `// V5.0 Rule Management Components` 更新为 `// Rule Management Components`。

### Step 6：验证

1. `npm run type-check` — 零错误
2. `npm run lint` — 无违规
3. 搜索确认无悬空引用

---

## 不在本次范围内

以下是精简方案中提到但**不在本次 Phase 2 执行**的内容：

| 内容                                       | 原因                    |
| ------------------------------------------ | ----------------------- |
| 批量分类路由 `/api/batch-classification/*` | 54 次前端使用，活跃系统 |
| `/api/classification/v2/*` 核心路由        | 当前主系统              |
| `_archived/classification-v1/` 归档代码    | 已归档，不影响构建      |
| V5 数据库迁移/表                           | 不影响运行，优先级最低  |
| Skills Router/Engine 内部精简              | 属于 Phase 3            |

---

## 预期收益

| 指标       | 变化                   |
| ---------- | ---------------------- |
| 删除路由数 | -4                     |
| 删除代码行 | ~800                   |
| API 表面积 | 减少 4 个端点          |
| 维护负担   | 消除废弃端点的认知开销 |

---

## 风险控制

- 每步操作后执行 `tsc --noEmit` 验证
- Git 历史保留，随时可恢复
- 不涉及任何核心分类逻辑变更
