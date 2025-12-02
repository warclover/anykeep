# 📚 AnyKeep 项目文档

本目录包含 AnyKeep 项目的所有开发文档、设计文档、报告和资源。

## 目录结构

### 📋 [planning/](./planning/) - 开发计划

存放所有开发计划、功能规划和路线图文档。

- `phases/` - 分阶段开发计划（Phase 1, Phase 2...）
- `features/` - 单个功能的规划文档
- `current/` - 当前正在执行的计划
- `roadmap/` - 产品路线图
- `archived/` - 已完成或废弃的计划

### 📊 [reports/](./reports/) - 完成报告

存放各类开发报告和总结文档。

- `weekly/` - 每周工作总结
- `phase-completion/` - 阶段完成报告
- `implementation/` - 功能实现报告
- `archived/` - 历史报告归档

### 📖 [guides/](./guides/) - 技术指南

存放技术文档、最佳实践和问题解决指南。

- `optimization/` - 性能优化、代码质量提升指南
- `migration/` - 数据迁移、版本升级指南
- `development/` - 开发环境、工具链配置指南
- `troubleshooting/` - 问题修复和故障排查指南

### 🎨 [design/](./design/) - 设计文档

存放产品设计、用户研究和 UI/UX 相关文档。

- `prd/` - 产品需求文档（PRD）
- `ui-ux/` - UI/UX 设计规范、原型、流程图
- `research/` - 用户调研、竞品分析、技术调研

### 🧪 [testing/](./testing/) - 测试相关

存放测试计划、测试报告和测试用例。

- `archived/` - 历史测试文件归档

### 🖼️ [assets/](./assets/) - 静态资源

存放文档相关的图片、图表和设计文件。

- `screenshots/` - 功能截图、界面预览
- `diagrams/` - 架构图、流程图、UML 图
- `figma-exports/` - Figma 导出的设计文件

### 🗄️ [archived/](./archived/) - 文档归档

存放已完成或过期的文档，按时间归档。

- `2024-11/` - 2024年11月归档
- `2024-12/` - 2024年12月归档

---

## 文档命名规范

### 文件命名规则

1. **使用英文命名**：所有文档文件名使用英文，便于跨平台兼容
2. **小写字母 + 连字符**：如 `feature-plan.md`、`phase-1-completion.md`
3. **包含日期标识**：如 `weekly-report-2024-12-01.md`
4. **语义化命名**：文件名应清晰表达内容，如 `browser-bookmark-import-plan.md`

### 文档格式规范

- 所有文档使用 Markdown 格式（`.md`）
- 文档顶部包含标题、日期、作者等元信息
- 使用标准的 Markdown 语法
- 图片使用相对路径引用：`![描述](../assets/screenshots/image.png)`

---

## 快速导航

### 核心文档

- [产品需求文档 (PRD)](../anykeep1121.md)
- [AI 上下文文档](../CLAUDE.md)
- [项目 README](../README.md)

### 当前进行中

- [当前开发计划](./planning/current/)
- [最新报告](./reports/)

### 功能实现

- [浏览器书签导入](./planning/features/)
- [性能优化](./guides/optimization/)

---

## 维护指南

### 添加新文档

1. 确定文档类型，选择合适的目录
2. 使用规范的文件命名
3. 在文档顶部添加元信息
4. 更新相关目录的 README（如有必要）

### 归档旧文档

1. 当文档过期或项目阶段完成时，移动到 `archived/` 目录
2. 按年月归档：`archived/YYYY-MM/`
3. 在原目录的 README 中更新文档状态

### 更新文档索引

定期更新此 README 文件，确保：

- 目录结构准确
- 快速导航链接有效
- 重要文档易于发现

---

**最后更新**: 2025-12-02
