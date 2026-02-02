# 双模式智能体系统 - Epics & Stories (V4.0)

## 文档信息

| 属性                | 值                                   |
| ------------------- | ------------------------------------ |
| **版本**            | V4.0                                 |
| **创建日期**        | 2026-02-02                           |
| **基于文档**        | requirements-V4.0.md, design-V4.0.md |
| **预估周期**        | 2-2.5 周                             |
| **总 Story Points** | 89 SP                                |

---

## Epic 概览

| Epic   | 名称           | 优先级 | Story Points | 预估时间 |
| ------ | -------------- | ------ | ------------ | -------- |
| **E1** | 可扩展规则引擎 | P0     | 21 SP        | 3 天     |
| **E2** | 预测性操作 UI  | P0     | 18 SP        | 2.5 天   |
| **E3** | 操作执行与监控 | P0     | 16 SP        | 2 天     |
| **E4** | 快照回滚系统   | P0     | 13 SP        | 1.5 天   |
| **E5** | 全能指令框     | P1     | 10 SP        | 1.5 天   |
| **E6** | 电池配额系统   | P1     | 8 SP         | 1 天     |
| **E7** | 规则遥测系统   | P0     | 8 SP         | 1 天     |

---

## E1: 可扩展规则引擎

**Epic 目标**: 构建可动态扩展的规则引擎，支持基于选中内容的智能推荐

**验收标准**:

- 规则引擎在 10ms 内完成匹配
- 支持 20+ 条初始规则
- 规则可动态注���/禁用
- 语言检测准确率 > 90%

---

### Story 1.1: RuleRegistry 核心实现

**用户故事**: 作为开发者，我需要一个可扩展的规则注册表，以便动态管理推荐规则

**Story Points**: 5 SP

**验收标准**:

- [ ] 实现 `RuleRegistry` 类，支持 `register()`, `registerMany()`, `getById()`, `getEnabled()`
- [ ] 规则按 priority 自动排序
- [ ] 支持 `setEnabled()` 启用/禁用规则
- [ ] 支持 `setPriority()` 动态调整优先级
- [ ] 单例导出 `ruleRegistry`

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/prediction/rule-registry.ts
- [ ] 定义 PredictionRule 接口 (id, name, icon, priority, condition, action, category, enabled)
- [ ] 实现 Map + 排序缓存机制
- [ ] 单元测试: 注册、查询、排序、启用/禁用
```

**依赖**: 无

---

### Story 1.2: 语言检测器封装

**用户故事**: 作为规则引擎，我需要检测书签标题的语言，以便触发翻译相关规则

**Story Points**: 3 SP

**验收标准**:

- [ ] 集成 `franc-min` 库 (3KB)
- [ ] 支持检测 en/zh/ja/ko/unknown
- [ ] 提供 `isAllLanguage()` 批量判断
- [ ] 提供 `isMixedLanguage()` 混合语言检测
- [ ] 短文本 (<10字符) 返回 unknown

**技术任务**:

```
- [ ] npm install franc-min
- [ ] 创建 src/lib/fluid-agent/prediction/language-detector.ts
- [ ] 实��� LanguageDetector 类
- [ ] 单元测试: 中英文检测、混合语言、边界情况
```

**依赖**: 无

---

### Story 1.3: PredictionEngine 规则匹配

**用户故事**: 作为系统，我需要根据用户选中的书签匹配最相关的规则，以便显示智能推荐

**Story Points**: 5 SP

**验收标准**:

- [ ] `predict(selection, limit)` 返回前 N 个匹配规则
- [ ] 匹配过程记录遥测事件
- [ ] 规则执行异常不影响其他规则
- [ ] `recordFeedback()` 记录用户决策
- [ ] 匹配耗时 < 10ms (100 条规则)

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/prediction/prediction-engine.ts
- [ ] 实现 predict() 方法，遍历规则并匹配
- [ ] 集成 TelemetryManager.recordMatch()
- [ ] try-catch 保护每条规则执行
- [ ] 性能测试: 100 规则 < 10ms
```

**依赖**: Story 1.1, Story 1.2, Story 7.1

---

### Story 1.4: 初始规则集实现 (20条)

**用户故事**: 作为用户，我需要系统能识别常见的操作场景，以便获得有用的推荐

**Story Points**: 5 SP

**验收标准**:

- [ ] 语言规则: all_english, all_chinese, mixed_language (3条)
- [ ] 类型规则: all_pdf, all_video, all_article (3条)
- [ ] 来源规则: same_domain, same_author, same_platform (3条)
- [ ] 数量规则: count_gt_10, count_gt_50 (2条)
- [ ] 时间规则: unread_7days, this_week, today (3条)
- [ ] 内容规则: duplicates, tech, news (3条)
- [ ] 标签规则: no_tags, same_tags (2条)
- [ ] 文件夹规则: no_folder (1条)

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/prediction/rules/language-rules.ts
- [ ] 创建 src/lib/fluid-agent/prediction/rules/content-rules.ts
- [ ] 创建 src/lib/fluid-agent/prediction/rules/quantity-rules.ts
- [ ] 创建 src/lib/fluid-agent/prediction/rules/time-rules.ts
- [ ] 创建 src/lib/fluid-agent/prediction/rules/source-rules.ts
- [ ] 创建 src/lib/fluid-agent/prediction/rules/index.ts (聚合导出)
- [ ] 每条规则配套单元测试 (40+ 用例)
```

**依赖**: Story 1.1, Story 1.2

---

### Story 1.5: 规则引擎集成测试

**用户故事**: 作为开发者，我需要确保规则引擎各模块协同工作正常

**Story Points**: 3 SP

**验收标准**:

- [ ] 端到端测试: 选中书签 → 规则匹配 → 返回推荐
- [ ] 边界测试: 空选择、单选、大批量 (100+)
- [ ] 优先级测试: 高优先级规则排在前面
- [ ] 性能基准: 建立回归测试基线

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/prediction/__tests__/integration.test.ts
- [ ] 创建 src/lib/fluid-agent/prediction/__tests__/performance.test.ts
- [ ] 配置 CI 性能回归检测
```

**依赖**: Story 1.3, Story 1.4

---

## E2: 预测性操作 UI

**Epic 目标**: 在桌面端和移动端展示智能推荐按钮，提供流畅的交互体验

**验收标准**:

- 推荐按钮在选中后 10ms 内显示
- 移动端 FAB 支持变形动画
- Bottom Sheet 支持展开更多推荐

---

### Story 2.1: PredictionButton 组件

**用户故事**: 作为用户，我想在 Action Bar 看到智能推荐按钮，以便一键执行推荐操作

**Story Points**: 3 SP

**验收标准**:

- [ ] 显示规则图标 + "✨ {规则名称}"
- [ ] 支持 loading 状态
- [ ] 渐变背景 (purple→blue)
- [ ] 点击触发操作执行

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/ui/components/prediction-button.tsx
- [ ] 使用现有 Button 组件扩展
- [ ] 添加渐变样式
- [ ] Storybook 文档
```

**依赖**: 无

---

### Story 2.2: usePrediction Hook

**用户故事**: 作为前端组件，我需要一个 Hook 来获取当前选中内容的推荐操作

**Story Points**: 3 SP

**验收标准**:

- [ ] `usePrediction(selection)` 返回 predictions 数组
- [ ] 选中变化时自动重新计算
- [ ] 支持 loading/error 状态
- [ ] 防抖处理 (100ms)

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/ui/hooks/use-prediction.ts
- [ ] 集成 PredictionEngine
- [ ] useMemo 优化性能
- [ ] 单元测试
```

**依赖**: Story 1.3

---

### Story 2.3: ActionBar 组件 (新建)

**用户故事**: 作为用户，我想在选中书签后看到操作工具栏，包含常用操作和智能推荐

**Story Points**: 5 SP

**验收标准**:

- [ ] 固定在列表底部或顶部
- [ ] 显示: 删除、移动、标签 + 推荐按钮
- [ ] 选中时滑入，取消选中时滑出
- [ ] 响应式: 移动端隐藏部分按钮

**技术任务**:

```
- [ ] 创建 src/components/ui/action-bar.tsx
- [ ] ActionBarProps: actions[], position, visible
- [ ] 进入/退出动画 (Framer Motion 或 CSS)
- [ ] 集成 PredictionButton
- [ ] 集成到书签列表页
```

**依赖**: Story 2.1, Story 2.2

---

### Story 2.4: FAB 组件 (新建)

**用户故事**: 作为移动端用户，我想通过悬浮按钮快速访问功能

**Story Points**: 3 SP

**验收标准**:

- [ ] 固定在右下角
- [ ] 默认显示 "+" 图标
- [ ] 支持自定义图标和文本
- [ ] 圆形按钮 + 阴影

**技术任务**:

```
- [ ] 创建 src/components/ui/floating-action-button.tsx
- [ ] FABProps: icon, label, onClick, position
- [ ] 响应式尺寸 (56px 移动端)
- [ ] Tailwind 样式
```

**依赖**: 无

---

### Story 2.5: FAB 变形动画

**用户故事**: 作为移动端用户，当我选中书签后，FAB 应该变形显示推荐数量

**Story Points**: 2 SP

**验收标准**:

- [ ] ���认: "+" 图标
- [ ] 选中后: "✨{数量}" 变形
- [ ] 变形动画流畅 (300ms)
- [ ] 点击展开 Bottom Sheet

**技术任务**:

```
- [ ] 扩展 FAB 组件支持 morphTo 属性
- [ ] CSS transition 动画
- [ ] 集成 usePrediction Hook
```

**依赖**: Story 2.2, Story 2.4

---

### Story 2.6: PredictionSheet (可展开 Bottom Sheet)

**用户故事**: 作为移动端用户，我想在底部弹出层看到所有推荐操作

**Story Points**: 2 SP

**验收标准**:

- [ ] 使用现有 Sheet 组件 (side="bottom")
- [ ] 默认显示 3 个推荐
- [ ] 支持 "展开更多" 按钮
- [ ] 点击推荐项触发操作

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/ui/components/prediction-sheet.tsx
- [ ] 复用 Sheet 组件
- [ ] 展开/收起状态管理
```

**依赖**: Story 2.2

---

## E3: 操作执行与监控

**Epic 目标**: 执行推荐操作，显示进度，支持取消

**验收标准**:

- 操作执行过程可视化
- 支持取消并自动回滚
- 列表项高亮反馈

---

### Story 3.1: OperationExecutor 核心

**用户故事**: 作为系统，我需要执行推荐操作并管理执行状态

**Story Points**: 5 SP

**验收标准**:

- [ ] `execute(action, selection, params)` 执行操作
- [ ] 支持 `cancel(operationId)` 取消
- [ ] 取消时自动��滚已执行部分
- [ ] `subscribe()` 订阅状态变化
- [ ] 操作前自动创建快照

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/execution/operation-executor.ts
- [ ] 实现 activeOperations Map
- [ ] 集成 SnapshotManager
- [ ] 集成 HighlightManager
- [ ] 单元测试: 执行、取消、回滚
```

**依赖**: Story 4.1

---

### Story 3.2: ExecutionStatus 状态栏

**用户故事**: 作为用户，我想看到操作执行的进度

**Story Points**: 3 SP

**验收标准**:

- [ ] 固定在底部居中
- [ ] 显示: 图标 + 当前步骤 + 进度 (3/5)
- [ ] 支持取消按钮
- [ ] 操作完成后自动隐藏

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/ui/components/execution-status.tsx
- [ ] Card 样式 + 阴影
- [ ] 订阅 OperationExecutor 状态
```

**依赖**: Story 3.1

---

### Story 3.3: HighlightManager 高亮管理

**用户故事**: 作为用户，我想看到当前正在处理的书签被高亮

**Story Points**: 3 SP

**验收标准**:

- [ ] `highlight(entityId, type)` 触发高亮
- [ ] processing: 蓝色边框 + pulse 动画
- [ ] completed: 绿色边框
- [ ] 1.5 秒后自动清除
- [ ] 支持减少动效偏好

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/ui/hooks/use-agent-highlight.ts
- [ ] Zustand store 管理高亮状态
- [ ] CSS 边框发光效果
- [ ] useReduceMotion Hook
```

**依赖**: 无

---

### Story 3.4: 高亮集成到列表

**用户故事**: 作为用户，我想在书签列表中看到高亮效果

**Story Points**: 2 SP

**验收标准**:

- [ ] 列表项支持 `useAgentHighlight(id)` Hook
- [ ] 动态应用高亮 className
- [ ] 虚拟列表兼容

**技术任务**:

```
- [ ] 修改书签列表组件
- [ ] 集成 useAgentHighlight
- [ ] 测试虚拟列表场景
```

**依赖**: Story 3.3

---

### Story 3.5: FAB 自动位移

**用户故事**: 作为移动端用户，当状态栏显示时，FAB 不应被遮挡

**Story Points**: 2 SP

**验收标准**:

- [ ] 状态栏显示时 FAB 上移 60px
- [ ] 平滑过渡动画
- [ ] 状态栏隐藏后恢复位置

**技术任务**:

```
- [ ] 全局状态管理 (是否有活跃操作)
- [ ] CSS transform 动画
- [ ] 修改 FAB 组件
```

**依赖**: Story 2.4, Story 3.2

---

### Story 3.6: React Query 乐观更新配置

**用户故事**: 作为系统，我需要在操作执行时立即更新 UI，失败时回滚

**Story Points**: 1 SP

**验收标准**:

- [ ] onMutate 乐观更新缓存
- [ ] onError 回滚 + Toast 提示
- [ ] onSettled 强制 invalidate

**技术任务**:

```
- [ ] 配置 useMutation 统一模式
- [ ] 创建 useOptimisticMutation 通用 Hook
```

**依赖**: 无

---

## E4: 快照回滚系统

**Epic 目标**: 支持操作撤销，提供安全的回滚机制

**验收标准**:

- 操作完成后 10 秒内可撤销
- 快照 24 小时自动清理
- 撤销成功率 100%

---

### Story 4.1: SnapshotManager 实现

**用户故事**: 作为系统，我需要在操作前保存快照，以便支持撤销

**Story Points**: 5 SP

**验收标准**:

- [ ] `createSnapshot(operationId, entities)` 保存快照
- [ ] `rollback(operationId)` 覆盖式恢复
- [ ] 支持 bookmark/folder/tag 三种实体
- [ ] 恢复软删除的实体
- [ ] 回滚后清理快照

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/execution/snapshot-manager.ts
- [ ] 复用现有 operation_snapshots 表
- [ ] 扩展表结构 (如需要)
- [ ] 单元测试: 创建、回滚、清理
```

**依赖**: Story 4.2

---

### Story 4.2: operation_snapshots 表扩展

**用户故事**: 作为系统，我需要数据库支持通用的操作快照

**Story Points**: 2 SP

**验收标准**:

- [ ] 确认现有表结构是否满足需求
- [ ] 如需扩展，添加 entity_type 枚举
- [ ] 保持与现有功能的向后兼容

**技术任务**:

```
- [ ] 分析现有 operation_snapshots 表
- [ ] 创建迁移文件 (如需要)
- [ ] 更新 TypeScript 类型
```

**依赖**: 无

---

### Story 4.3: UndoToast 撤销通知

**用户故事**: 作为用户，我想在操作完成后看到撤销入口

**Story Points**: 3 SP

**验收标准**:

- [ ] 显示 "✅ {操作描述}" + 撤销按钮
- [ ] 10 秒倒计时进度条
- [ ] 点击撤销触发回滚
- [ ] 撤销成功显示确认

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/ui/components/undo-toast.tsx
- [ ] 复用 Sonner Toast
- [ ] 进度条动画
- [ ] 集成 SnapshotManager.rollback()
```

**依赖**: Story 4.1

---

### Story 4.4: Cron Job 自动清理

**用户故事**: 作为系统，我需要自动清理过期快照以节省存储

**Story Points**: 1 SP

**验收标准**:

- [ ] 每小时清理 expires_at < now() 的记录
- [ ] 使用 pg_cron 或现有机制

**技术任务**:

```
- [ ] 检查现有清理机制
- [ ] 配置 pg_cron (如需要)
- [ ] 验证清理效果
```

**依赖**: Story 4.2

---

### Story 4.5: 删除确认对话框

**用户故事**: 作为用户，我想在删除操作前收到确认提示

**Story Points**: 2 SP

**验收标准**:

- [ ] 显示将删除的项目列表
- [ ] 提示 "30 天内可从回收站恢复"
- [ ] 确认/取消按钮

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/ui/components/delete-confirm-dialog.tsx
- [ ] 复用 AlertDialog 组件
```

**依赖**: 无

---

## E5: 全能指令框

**Epic 目标**: 提供 Cmd+K 快捷入口，支持关键词匹配执行命令

**验收标准**:

- Cmd/Ctrl+K 打开指令框
- 关键词匹配 < 50ms
- 支持 10+ 预设命令

---

### Story 5.1: CommandMatcher 关键词匹配

**用户故事**: 作为系统，我需要根据用户输入匹配预设命令

**Story Points**: 3 SP

**验收标准**:

- [ ] `match(input)` 返回匹配的命令
- [ ] 支持中英文关键词
- [ ] 模糊匹配 (包含即可)
- [ ] 返回前 5 个结果

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/commands/command-matcher.ts
- [ ] PresetCommand 接口
- [ ] 匹配算法实现
```

**依赖**: 无

---

### Story 5.2: 预设命令集

**用户故事**: 作为用户，我想通过常用关键词快速执行操作

**Story Points**: 2 SP

**验收标准**:

- [ ] 整理收件箱 (整理/inbox/organize)
- [ ] 生成周报 (周报/weekly/report)
- [ ] 清理重复 (重复/duplicate/去重)
- [ ] 翻译选中 (翻译/translate)
- [ ] 阅读统计 (统计/stats/analytics)

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/commands/preset-commands.ts
- [ ] 定义 5+ 预设命令
- [ ] 配置 tools 串联
```

**依赖**: 无

---

### Story 5.3: Command Dialog UI

**用户故事**: 作为用户，我想通过 Cmd+K 打开快捷指令框

**Story Points**: 5 SP

**验收标准**:

- [ ] Cmd/Ctrl+K 全局快捷键
- [ ] 输入框 + 命令列表
- [ ] 键盘导航 (↑↓ Enter Esc)
- [ ] 选择后执行命令

**技术任务**:

```
- [ ] 检查现有 Command 组件
- [ ] 创建或迁移 Command Dialog
- [ ] 集成 CommandMatcher
- [ ] 全局快捷键监听
```

**依赖**: Story 5.1, Story 5.2

---

## E6: 电池配额系统

**Epic 目标**: 模糊化成本显示，管理免费用户配额

**验收标准**:

- 免费用户每日 5 次
- 三档电量显示
- 配额耗尽时阻断并提示升级

---

### Story 6.1: BatterySystem 配额管理

**用户故事**: 作为系统，我需要追踪用户的智能推荐使用次数

**Story Points**: 3 SP

**验收标准**:

- [ ] `getState()` 获取当前配额状态
- [ ] `consume()` 消耗一次配额
- [ ] `canUse()` 检查是否可用
- [ ] 复用现有 user_quota_usage 表
- [ ] 用户本地时区 00:00 重置

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/ui/hooks/use-battery.ts
- [ ] 复用 user_entitlements 逻辑
- [ ] 本地时区处理
```

**依赖**: 无

---

### Story 6.2: BatteryIndicator 图标

**用户故事**: 作为用户，我想知道今日还剩多少智能推荐次数

**Story Points**: 2 SP

**验收标准**:

- [ ] 满电 (>50%): 不显示
- [ ] 中电 (20-50%): 不显示
- [ ] 低电 (<20%): 🪫 + 提示
- [ ] 空电: ⚡ + 阻断

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/ui/components/battery-indicator.tsx
- [ ] Tooltip 显示详情
```

**依赖**: Story 6.1

---

### Story 6.3: 配额耗尽弹窗

**用户故事**: 作为免费用户，当配额用完时我想知道如何获取更多

**Story Points**: 3 SP

**验收标准**:

- [ ] 显示 "今日次数已用完"
- [ ] 显示重置时间
- [ ] "升级 Pro" 按钮
- [ ] "明天再试" 按钮

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/ui/components/quota-exhausted-dialog.tsx
- [ ] 复用 Dialog 组件
- [ ] 集成支付入口
```

**依赖**: Story 6.1

---

## E7: 规则遥测系统

**Epic 目标**: 收集规则匹配和用户决策数据，验证假设

**验收标准**:

- 记录每次规则匹配
- 记录用户接受/忽略
- 支持按规则聚合统计

---

### Story 7.1: TelemetryManager 实现

**用户故事**: 作为系统，我需要收集规则引擎的使用数据

**Story Points**: 5 SP

**验收标准**:

- [ ] `recordMatch(ruleId, selectionCount)` 记录匹配
- [ ] `recordDecision(ruleId, accepted)` 记录决策
- [ ] 批量写入 (5秒缓冲)
- [ ] `getRuleStats()` 获取统计

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/telemetry/telemetry-manager.ts
- [ ] 会话 ID 生成
- [ ] 批量刷新机制
- [ ] 单元测试
```

**依赖**: Story 7.2

---

### Story 7.2: rule_telemetry 表

**用户故事**: 作为系统，我需要持久化存储规则遥测数据

**Story Points**: 2 SP

**验收标准**:

- [ ] 表结构: id, user_id, rule_id, selection_count, matched_at, accepted, decided_at, session_id
- [ ] RLS 策略: 用户只能写入自己的数据
- [ ] 30 天自动清理

**技术任务**:

```
- [ ] 创建迁移文件
- [ ] 配置 RLS
- [ ] 配置 pg_cron 清理
- [ ] 生成 TypeScript 类型
```

**依赖**: 无

---

### Story 7.3: 遥测 Hooks

**用户故事**: 作为前端组件，我需要方便地记录遥测事件

**Story Points**: 1 SP

**验收标准**:

- [ ] `useTelemetry()` Hook
- [ ] 自动关联当前会话

**技术任务**:

```
- [ ] 创建 src/lib/fluid-agent/telemetry/telemetry-hooks.ts
- [ ] 封装 TelemetryManager
```

**依赖**: Story 7.1

---

## 依赖关系图

```
E7 (遥测) ──────────────────────────────────┐
  │                                          │
  ▼                                          │
E1 (规则引擎) ──────► E2 (预测UI) ──────► E3 (执行监控)
                                              │
                                              ▼
                     E4 (快照回滚) ◄──────────┘
                          │
                          ▼
                     E5 (指令框)
                          │
                          ▼
                     E6 (电池系统)
```

---

## Sprint 规划建议

### Sprint 1 (Week 1): 核心引擎

| Story                 | SP  | 优先级 |
| --------------------- | --- | ------ |
| 7.2 rule_telemetry 表 | 2   | P0     |
| 7.1 TelemetryManager  | 5   | P0     |
| 1.1 RuleRegistry      | 5   | P0     |
| 1.2 LanguageDetector  | 3   | P0     |
| 1.3 PredictionEngine  | 5   | P0     |
| 1.4 初始规则集        | 5   | P0     |

**Sprint 1 总计: 25 SP**

### Sprint 2 (Week 2): UI + 执行

| Story                 | SP  | 优先级 |
| --------------------- | --- | ------ |
| 2.1 PredictionButton  | 3   | P0     |
| 2.2 usePrediction     | 3   | P0     |
| 2.3 ActionBar         | 5   | P0     |
| 2.4 FAB               | 3   | P0     |
| 2.5 FAB 变形          | 2   | P1     |
| 2.6 PredictionSheet   | 2   | P1     |
| 4.2 表扩展            | 2   | P0     |
| 4.1 SnapshotManager   | 5   | P0     |
| 3.1 OperationExecutor | 5   | P0     |

**Sprint 2 总计: 30 SP**

### Sprint 3 (Week 3): 完善 + 测试

| Story                | SP  | 优先级 |
| -------------------- | --- | ------ |
| 3.2 ExecutionStatus  | 3   | P0     |
| 3.3 HighlightManager | 3   | P0     |
| 3.4 高亮集成         | 2   | P0     |
| 4.3 UndoToast        | 3   | P0     |
| 5.1 CommandMatcher   | 3   | P1     |
| 5.2 预设���令        | 2   | P1     |
| 5.3 Command Dialog   | 5   | P1     |
| 6.1 BatterySystem    | 3   | P1     |
| 6.2 BatteryIndicator | 2   | P1     |
| 6.3 配额弹窗         | 3   | P1     |
| 1.5 集成测试         | 3   | P0     |
| 其他收尾             | 2   | P0     |

**Sprint 3 总计: 34 SP**

---

## 风险与缓解

| 风险                    | 影响 Story | 缓解措施                      |
| ----------------------- | ---------- | ----------------------------- |
| ActionBar 设计不确定    | 2.3        | 先实现基础版，迭代优化        |
| Command Dialog 复用问题 | 5.3        | 备选方案: 使用 shadcn/ui 重建 |
| 快照表扩展兼容性        | 4.2        | 仅添加字段，不修改现有        |
| 性能不达标              | 1.5        | 提前建立基准，持续监控        |

---

## 完成定义 (DoD)

- [ ] 代码已提交并通过 CI
- [ ] 单元测试覆盖率 > 80%
- [ ] TypeScript 无类型错误
- [ ] ESLint 无警告
- [ ] 组件有 Storybook 文档 (UI 组件)
- [ ] API 有 JSDoc 注释
- [ ] 性能符合需求文档标准
