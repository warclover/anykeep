# API 版本状态总表

> 维护说明：当迁移某个端点后，更新此表中的状态和备注。
> 最后更新：2026-03-07

## 状态定义

| 状态        | 含义                                | 新代码可用 |
| ----------- | ----------------------------------- | ---------- |
| active      | 推荐使用，持续维护                  | ✅         |
| legacy-only | 旧版独有功能，v1 暂未实现           | ✅         |
| deprecated  | 已有 v1/v2 替代，不应在新代码中使用 | ❌         |
| redirect    | 已 308 重定向到新版                 | ❌         |

---

## 书签 API

### CRUD 操作

| 功能     | 旧版路径                         | 新版路径                         | 状态       | 迁移备注                                                                                  |
| -------- | -------------------------------- | -------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| 书签列表 | `/api/bookmarks` (GET)           | `/api/v1/bookmarks` (GET)        | deprecated | 响应结构不同：旧版 `data.bookmarks` + `data.pagination`，v1 `data.items` + `data.hasMore` |
| 创建书签 | `/api/bookmarks` (POST)          | `/api/v1/bookmarks` (POST)       | deprecated | v1 创建后未触发 AI 摘要/标签/元数据等链路，行为未等价                                     |
| 书签详情 | `/api/bookmarks/:id` (GET)       | `/api/v1/bookmarks/:id` (GET)    | deprecated | 响应字段基本一致                                                                          |
| 更新书签 | `/api/bookmarks/:id` (PUT/PATCH) | `/api/v1/bookmarks/:id` (PATCH)  | deprecated | 旧版支持 PUT+PATCH，v1 仅 PATCH                                                           |
| 删除书签 | `/api/bookmarks/:id` (DELETE)    | `/api/v1/bookmarks/:id` (DELETE) | deprecated | —                                                                                         |

### 批量操作

| 功能     | 旧版路径                       | 新版路径                          | 状态       | 迁移备注                                                |
| -------- | ------------------------------ | --------------------------------- | ---------- | ------------------------------------------------------- |
| 批量删除 | `/api/bookmarks/batch-delete`  | `/api/v1/bookmarks/batch/delete`  | deprecated | ids 类型差异：旧版部分前端传 string[]，v1 严格 number[] |
| 批量移动 | `/api/bookmarks/batch-move`    | `/api/v1/bookmarks/batch/move`    | deprecated | —                                                       |
| 批量恢复 | `/api/bookmarks/batch-restore` | `/api/v1/bookmarks/batch/restore` | deprecated | —                                                       |
| 批量标签 | `/api/bookmarks/batch-tags`    | `/api/v1/bookmarks/batch/tags`    | deprecated | —                                                       |

### 旧版独有功能

| 功能     | 路径                           | 状态        | 说明            |
| -------- | ------------------------------ | ----------- | --------------- |
| 永久删除 | `/api/bookmarks/:id/permanent` | legacy-only | v1 未实现       |
| 相关书签 | `/api/bookmarks/:id/related`   | legacy-only | v1 未实现       |
| 单个恢复 | `/api/bookmarks/:id/restore`   | legacy-only | 批量恢复已有 v1 |
| 批量导入 | `/api/bookmarks/batch-import`  | legacy-only | v1 未实现       |
| 批量状态 | `/api/bookmarks/batch-status`  | legacy-only | v1 未实现       |
| 向量嵌入 | `/api/bookmarks/embeddings`    | legacy-only | v1 未实现       |
| 抓取内容 | `/api/bookmarks/fetch-content` | legacy-only | v1 未实现       |
| 生成标签 | `/api/bookmarks/generate-tags` | legacy-only | v1 未实现       |
| 元数据   | `/api/bookmarks/metadata`      | legacy-only | v1 未实现       |
| 建议     | `/api/bookmarks/suggestions`   | legacy-only | v1 未实现       |
| 验证     | `/api/bookmarks/validate`      | legacy-only | v1 未实现       |

---

## 分类 API

### 核心端点

| 功能     | 路径                                                | 状态   | 说明     |
| -------- | --------------------------------------------------- | ------ | -------- |
| 执行分类 | `/api/classification/v2/classify` (POST)            | active | 当前标准 |
| 批量分类 | `/api/classification/v2/classify-batch` (POST)      | active | 当前标准 |
| 反馈     | `/api/classification/v2/feedback` (POST/GET)        | active | 当前标准 |
| 规则管理 | `/api/classification/v2/rules` (GET/POST/DELETE)    | active | 当前标准 |
| 规则详情 | `/api/classification/v2/rules/:id` (GET/PUT/DELETE) | active | 当前标准 |

### 已重定向端点 (308)

| 旧路径                                  | 重定向目标          | 状态     |
| --------------------------------------- | ------------------- | -------- |
| `/api/classification/classify`          | → v2/classify       | redirect |
| `/api/classification/v5/classify`       | → v2/classify       | redirect |
| `/api/classification/v5/classify-batch` | → v2/classify-batch | redirect |
| `/api/classification/v5/feedback`       | → v2/feedback       | redirect |
| `/api/classification/v5/rules`          | → v2/rules          | redirect |
| `/api/classification/v5/rules/:id`      | → v2/rules/:id      | redirect |

### v5 独占功能端点（非旧版本，是独立功能模块）

| 功能       | 路径                                        | 状态   | 说明         |
| ---------- | ------------------------------------------- | ------ | ------------ |
| 熵分析     | `/api/classification/v5/entropy/analysis`   | active | 独立功能模块 |
| 文件夹画像 | `/api/classification/v5/folder-profile/:id` | active | 独立功能模块 |
| 园丁报告   | `/api/classification/v5/gardener/report`    | active | 独立功能模块 |
| 指标遥测   | `/api/classification/v5/metrics`            | active | 独立功能模块 |
| 灰度发布   | `/api/classification/v5/rollout/*`          | active | 独立功能模块 |
| A/B 测试   | `/api/classification/v5/shadow/*`           | active | 独立功能模块 |
| T1 结果    | `/api/classification/v5/t1-result/:eventId` | active | 独立功能模块 |
| T1 流式    | `/api/classification/v5/t1-stream`          | active | 独立功能模块 |

---

## 可观测性

### 废弃响应头

对所有 deprecated 状态的书签 API，中间件自动添加：

```
X-API-Version: legacy
X-API-Deprecated: true
X-API-Recommended: /api/v1/bookmarks  (推荐替代路径)
```

### 埋点日志

日志标签：`[API-DEPRECATION]`，包含 path、method、recommended、referer 字段。

可通过以下方式统计调用量：

```bash
# 搜索日志中的废弃 API 调用
grep "[API-DEPRECATION]" logs/ | jq '.path' | sort | uniq -c | sort -rn
```
