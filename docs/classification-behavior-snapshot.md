# Classification System Behavior Snapshot

**版本**: v1.0.0
**日期**: 2026-01-24
**用途**: 记录重构前的分类系统行为，用于验证重构后的行为一致性

---

## 一、版本支持矩阵

| 版本 | 环境变量                             | 状态   | 说明                        |
| ---- | ------------------------------------ | ------ | --------------------------- |
| V3   | `CLASSIFICATION_VERSION=v3`          | 废弃中 | 5层匹配器架构               |
| V4.1 | `CLASSIFICATION_VERSION=v4.1`        | 稳定   | SimpleClassificationService |
| V5.0 | `CLASSIFICATION_VERSION=v5.0` (默认) | 生产   | L0+T0+T1 三层架构           |

---

## 二、置信度阈值

| 阈值名称      | 值  | 行为                   |
| ------------- | --- | ---------------------- |
| AUTO_CLASSIFY | 80% | 自动分类到目标文件夹   |
| SUGGEST       | 60% | 创建建议，等待用户确认 |
| INBOX         | 0%  | 保留在待整理           |

---

## 三、核心行为场景

### 场景 1: 高置信度自动分类

**触发条件**: `confidence >= 80%`

**行为**:

1. 将书签移动到目标文件夹
2. 清除 `pending_cluster` 状态
3. 发送分类完成通知（静默级别）
4. 更新分类状态为 `classified`
5. 同步更新文件夹 Profile

**代码位置**: `integration.ts:527-628`

---

### 场景 2: 中置信度生成建议

**触发条件**: `60% <= confidence < 80%`

**行为（semi_auto/manual 模式）**:

1. 创建 `classification_suggestions` 记录
2. 创建待确认消息（非 full_auto 模式）
3. 更新分类状态为 `suggested`
4. 清除 `pending_cluster` 状态

**行为（full_auto 模式）**:

1. 直接移动书签到目标文件夹
2. 更新分类状态为 `classified`

**代码位置**: `integration.ts:633-817`

---

### 场景 3: 低置信度进入收件箱

**触发条件**: `confidence < 60%`

**行为**:

1. 标记 `pending_cluster = true`
2. 更新分类状态为 `inbox`
3. 等待智能分拣处理

**代码位置**: `integration.ts:1027-1067`

---

### 场景 4: 建议创建新文件夹

**触发条件**: `action === "suggest_new" && folderName !== null`

**行为**:

1. 检查每日创建限额（MAX_AUTO_CREATE_PER_DAY）
2. 高置信度：自动创建文件夹并分类
3. 中置信度：保存建议等待用户确认

**代码位置**: `integration.ts:821-1024`

---

### 场景 5: V5 透传模式

**环境变量**: `V5_PASSTHROUGH_MODE` (默认启用)

**行为**:

- 启用时：直接使用 V5 的决策逻辑（needsT1/usedT1）
- 禁用时：使用非线性置信度重映射

**映射公式（禁用时）**:

```
similarity 0.25-0.45 → confidence 65-100%
```

**代码位置**: `integration.ts:389-453`

---

### 场景 6: 托管模式影响

| 模式      | 高置信度行为 | 中置信度行为 |
| --------- | ------------ | ------------ |
| full_auto | 自动分类     | 自动分类     |
| semi_auto | 自动分类     | 创建确认     |
| manual    | 创建确认     | 创建确认     |

**代码位置**: `integration.ts:509-524`

---

## 四、API 端点清单

### 当前 API 结构

```
/api/classification/
├── classify/route.ts           # 单条分类
├── v5/
│   ├── classify/route.ts       # V5 分类
│   ├── classify-batch/route.ts # V5 批量分类
│   ├── feedback/route.ts       # V5 反馈
│   ├── rules/                  # V5 规则管理
│   ├── shadow/                 # V5 影子排序
│   ├── metrics/route.ts        # V5 指标
│   ├── entropy/                # V5 熵检测
│   └── gardener/               # V5 园丁
├── feedback/route.ts           # 通用反馈
├── confirmations/              # 确认管理
└── debug/route.ts              # 调试
```

---

## 五、关键类和函数

### 入口函数

| 函数                          | 文件                | 说明       |
| ----------------------------- | ------------------- | ---------- |
| `classifyBookmarkV2()`        | integration.ts:112  | 主分类入口 |
| `getClassificationVersion()`  | integration.ts:82   | 版本路由   |
| `shouldUseV2Classification()` | integration.ts:1099 | V2 开关    |

### V3 容器

| 方法                         | 说明         | 状态        |
| ---------------------------- | ------------ | ----------- |
| `getClassificationService()` | V3 分类服务  | @deprecated |
| `getV3Matchers()`            | V3 5层匹配器 | @deprecated |
| `getUserStageService()`      | 用户阶段服务 | 保留        |
| `getInterestService()`       | 兴趣服务     | 保留        |
| `getInboxOrganizerService()` | 收件箱整理   | 保留        |

### V5 Pipeline

| 组件                            | 文件                               | 说明         |
| ------------------------------- | ---------------------------------- | ------------ |
| `ClassificationPipelineService` | classification-pipeline.service.ts | 主 Pipeline  |
| `ClassificationPipelineFactory` | pipeline-factory.ts                | 工厂单例     |
| `getClassificationPipeline()`   | pipeline-factory.ts:208            | 便捷获取函数 |

---

## 六、Feature Flags

### 分类版本 Flags

| Flag                        | 默认值 | 说明        |
| --------------------------- | ------ | ----------- |
| `CLASSIFICATION_VERSION`    | v5.0   | 分类版本    |
| `CLASSIFICATION_V2_ENABLED` | true   | V2 系统开关 |
| `CLASSIFICATION_V5_ENABLED` | true   | V5 启用     |
| `CLASSIFICATION_V5_STAGE`   | full   | V5 灰度阶段 |
| `V5_PASSTHROUGH_MODE`       | true   | V5 透传模式 |

### V3 Matcher Flags

| Flag                        | 默认值 | 说明          |
| --------------------------- | ------ | ------------- |
| `enableKnnDirect`           | true   | k-NN 直接匹配 |
| `enableFolderFingerprint`   | true   | 文件夹指��    |
| `enableTagMatcher`          | true   | 标签匹配      |
| `enableUniversalCategories` | true   | 通用分类      |

---

## 七、文件统计

```
src/lib/classification/
├── 总文件数: 296 个 TypeScript 文件
├── 目录层级: 最深 5 级
├── V5 目录: src/lib/classification/v5/
├── V5.5 目录: src/lib/classification/v5.5/
└── 服务目录: src/lib/classification/services/
```

---

## 八、测试覆盖

**基线测试文件**: `src/__tests__/e2e/classification-baseline.test.ts`

**覆盖场景**:

1. 高置信度自动分类 (≥80%)
2. 中置信度生成建议 (60-79%)
3. 低置信度进入收件箱 (<60%)
4. 版本路由正确性
5. V2 分类系统开关
6. 置信度阈值常量完整性
7. 分类状态常量完整性
8. 输入验证
9. 返回值结构完整性
10. V5 透传模式

---

## 九、重构注意事项

### 必须保持的行为

1. `classifyBookmarkV2()` 函数签名不变
2. 返回值结构不变
3. 置信度阈值不变（80/60/0）
4. 托管模式行为不变
5. V5 透传模式行为不变

### 可以变更的行为

1. 内部类/函数命名
2. 目录结构
3. 依赖注入方式
4. 日志格式

### 禁止操作

1. 修改已有数据库迁移
2. 删除未标记废弃的公开 API
3. 在未通过测试时提交代码

---

**文档维护者**: Amelia (Dev Agent)
**最后更新**: 2026-01-24
