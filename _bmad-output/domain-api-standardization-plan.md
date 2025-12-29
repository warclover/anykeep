# 领域特定 API 标准化规划

## 更新日期: 2025-12-30

## 当前 API 分类

### 1. 核心 CRUD API (已迁移到 v1) ✅

| API 路径                     | 用途        | 状态      |
| ---------------------------- | ----------- | --------- |
| `/api/v1/bookmarks`          | 书签 CRUD   | ✅ 已完成 |
| `/api/v1/bookmarks/stats`    | 书签统计    | ✅ 已完成 |
| `/api/v1/bookmarks/tags`     | 用户标签    | ✅ 已完成 |
| `/api/v1/folders`            | 文件夹 CRUD | ✅ 已完成 |
| `/api/v1/folders/{id}/path`  | 文件夹路径  | ✅ 已完成 |
| `/api/v1/folders/{id}/move`  | 文件夹移动  | ✅ 已完成 |
| `/api/v1/folders/batch-sort` | 批量排序    | ✅ 已完成 |
| `/api/v1/search`             | 搜索        | ✅ 已完成 |
| `/api/v1/ingest`             | 统一摄入    | ✅ 已完成 |

### 2. 批量操作 API (已迁移到 v1) ✅

| API 路径                       | 用途     | 优先级 | 建议 v1 路径                      |
| ------------------------------ | -------- | ------ | --------------------------------- |
| `/api/bookmarks/batch-delete`  | 批量删除 | P1     | `/api/v1/bookmarks/batch/delete`  |
| `/api/bookmarks/batch-move`    | 批量移动 | P1     | `/api/v1/bookmarks/batch/move`    |
| `/api/bookmarks/batch-tags`    | 批量标签 | P1     | `/api/v1/bookmarks/batch/tags`    |
| `/api/bookmarks/batch-restore` | 批量恢复 | P2     | `/api/v1/bookmarks/batch/restore` |
| `/api/bookmarks/batch-import`  | 批量导入 | P2     | `/api/v1/ingest/batch` (已有)     |

### 3. AI Agent API (合并优化)

**当前状态**: 9 个独立端点，可合并为统一接口

| 当前端点                       | 功能       | 建议            |
| ------------------------------ | ---------- | --------------- |
| `/api/agent/unified`           | 统一入口   | ✅ 保留为主入口 |
| `/api/agent/cancel`            | 取消请求   | 合并到 unified  |
| `/api/agent/context`           | 上下文管理 | 合并到 unified  |
| `/api/agent/feedback`          | 反馈       | 合并到 unified  |
| `/api/agent/intent-correction` | 意图纠正   | 合并到 unified  |
| `/api/agent/regenerate`        | 重新生成   | 合并到 unified  |
| `/api/agent/session`           | 会话管理   | 合并到 unified  |
| `/api/agent/stats`             | 统计       | 保留独立        |
| `/api/agent/undo`              | 撤销       | 合并到 unified  |

**v1 建议结构**:

```
/api/v1/agent
  POST /api/v1/agent          # 统一入口（支持所有操作）
  GET  /api/v1/agent/stats    # 统计
  POST /api/v1/agent/feedback # 反馈（独立保留）
```

### 4. 分类系统 API (整合)

**当前状态**: 15+ 个端点，功能分散

| 当前端点组              | 建议整合                   |
| ----------------------- | -------------------------- |
| `/api/classification/*` | → `/api/v1/classification` |
| `/api/reclassify/*`     | 合并到 classification      |
| `/api/confirmations/*`  | 合并到 classification      |

**v1 建议结构**:

```
/api/v1/classification
  GET  /classify             # 执行分类
  GET  /confirmations        # 待确认列表
  POST /confirmations/{id}   # 确认/拒绝
  GET  /analytics            # 分析统计
  POST /feedback             # 分类反馈
```

### 5. 主题合成 API (synthesis)

**当前状态**: 已有基本结构

| 当前端点                   | v1 建议                         |
| -------------------------- | ------------------------------- |
| `/api/synthesis`           | → `/api/v1/synthesis`           |
| `/api/synthesis/{id}`      | → `/api/v1/synthesis/{id}`      |
| `/api/synthesis/generate`  | → `/api/v1/synthesis/generate`  |
| `/api/synthesis/recommend` | → `/api/v1/synthesis/recommend` |

### 6. Brain-Sync API (学习复习)

**当前状态**: 6 个端点

**v1 建议结构**:

```
/api/v1/brain-sync
  GET  /queue          # 复习队列
  POST /response       # 提交回答
  GET  /stats          # 统计
  GET  /preferences    # 偏好设置
  POST /generate       # 生成闪卡
```

### 7. 其他领域 API

| 领域       | 端点数 | 优先级 | 建议                              |
| ---------- | ------ | ------ | --------------------------------- |
| 文件夹演化 | 9      | P2     | 整合为 `/api/v1/folder-evolution` |
| 知识链接   | 3      | P2     | 整合为 `/api/v1/knowledge-link`   |
| 链接健康   | 4      | P3     | 整合为 `/api/v1/link-health`      |
| 智能列表   | 4      | P2     | 整合为 `/api/v1/smart-lists`      |
| 消息通知   | 3      | P2     | 整合为 `/api/v1/messages`         |
| 用户设置   | 6      | P2     | 整合为 `/api/v1/settings`         |

---

## 迁移策略

### Phase 1: 核心 CRUD (已完成) ✅

- 书签 CRUD
- 文件夹 CRUD
- 搜索
- 统一摄入

### Phase 2: 批量操作 (已完成) ✅

1. 创建 `/api/v1/bookmarks/batch/*` 端点
2. 迁移现有批量操作 hooks
3. 保持旧端点兼容

### Phase 3: AI Agent 整合 (可选)

1. 评估是否需要统一入口
2. 简化 Agent API 结构
3. 统一响应格式

### Phase 4: 领域 API 标准化 (长期)

1. 每个领域独立迁移
2. 保持 3 个月兼容期
3. 逐步废弃旧端点

---

## v1 API 设计规范

### 响应格式标准

```typescript
// 成功响应
{
  success: true,
  data: T
}

// 错误响应
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: unknown
  }
}
```

### URL 命名规范

- 使用 kebab-case
- 资源名使用复数: `/bookmarks`, `/folders`
- 操作使用动词: `/batch/delete`, `/generate`
- 子资源使用嵌套: `/{id}/path`, `/{id}/move`

### HTTP 方法规范

| 操作     | 方法   | 示例                                  |
| -------- | ------ | ------------------------------------- |
| 列表     | GET    | `GET /api/v1/bookmarks`               |
| 详情     | GET    | `GET /api/v1/bookmarks/{id}`          |
| 创建     | POST   | `POST /api/v1/bookmarks`              |
| 更新     | PATCH  | `PATCH /api/v1/bookmarks/{id}`        |
| 删除     | DELETE | `DELETE /api/v1/bookmarks/{id}`       |
| 批量操作 | POST   | `POST /api/v1/bookmarks/batch/delete` |

---

## 实施优先级

| 优先级 | 任务                       | 预计工时      |
| ------ | -------------------------- | ------------- |
| P0     | 批量操作 API 迁移          | ✅ 已完成     |
| P1     | 异步任务队列 (system_jobs) | ✅ 已完成     |
| P2     | 分类系统 API 整合          | ✅ 已完成     |
| P2     | Agent API 整合             | 3-5 天 (可选) |
| P3     | 其他领域 API               | 1-2 周/领域   |

---

## 兼容性策略

1. **新旧共存**: 旧 API 保持 3 个月
2. **Hooks 适配器**: 支持新旧响应格式
3. **废弃警告**: 旧 API 添加 `Deprecation` header
4. **文档更新**: 明确标注迁移路径
