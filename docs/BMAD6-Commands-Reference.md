# BMAD 6.0 命令参考手册

> 所有命令格式: `/BMad:<module>:<type>:<name>`

---

## 📦 BMM (BMAD Method Module) - 核心开发模块

### 🤖 Agents (角色代理)

| 命令                                   | 角色            | 用途                     |
| -------------------------------------- | --------------- | ------------------------ |
| `/BMad:bmm:agents:analyst`             | 分析师          | 需求分析、业务建模       |
| `/BMad:bmm:agents:architect`           | 架构师          | 系统架构设计             |
| `/BMad:bmm:agents:dev`                 | 开发者 (Amelia) | Story 开发执行、代码审查 |
| `/BMad:bmm:agents:pm`                  | 产品经理        | PRD 创建、产品规划       |
| `/BMad:bmm:agents:sm`                  | Scrum Master    | Sprint 管理、进度跟踪    |
| `/BMad:bmm:agents:ux-designer`         | UX 设计师       | 用户体验设计             |
| `/BMad:bmm:agents:tea`                 | 测试工程架构师  | 测试策略、质量保障       |
| `/BMad:bmm:agents:tech-writer`         | 技术文档        | 文档编写                 |
| `/BMad:bmm:agents:quick-flow-solo-dev` | 独立开发者      | 快速开发流程             |

### 🔄 Workflows (工作流)

#### 规划阶段

| 命令                                           | 用途                  |
| ---------------------------------------------- | --------------------- |
| `/BMad:bmm:workflows:create-product-brief`     | 创建产品简报          |
| `/BMad:bmm:workflows:create-prd`               | 创建产品需求文档      |
| `/BMad:bmm:workflows:create-architecture`      | 创建系统架构          |
| `/BMad:bmm:workflows:create-ux-design`         | 创建 UX 设计          |
| `/BMad:bmm:workflows:create-epics-and-stories` | 创建 Epics 和 Stories |
| `/BMad:bmm:workflows:create-story`             | 创建单个 Story        |
| `/BMad:bmm:workflows:create-tech-spec`         | 创建技术规格          |

#### 实施阶段

| 命令                              | 用途                     |
| --------------------------------- | ------------------------ |
| `/BMad:bmm:workflows:dev-story`   | 执行 Story 开发          |
| `/BMad:bmm:workflows:code-review` | 代码审查                 |
| `/BMad:bmm:workflows:quick-dev`   | 快速开发（跳过完整流程） |

#### 管理阶段

| 命令                                                 | 用途            |
| ---------------------------------------------------- | --------------- |
| `/BMad:bmm:workflows:sprint-planning`                | Sprint 规划     |
| `/BMad:bmm:workflows:sprint-status`                  | Sprint 状态查看 |
| `/BMad:bmm:workflows:workflow-init`                  | 工作流初始化    |
| `/BMad:bmm:workflows:workflow-status`                | 工作流状态      |
| `/BMad:bmm:workflows:correct-course`                 | 路线调整        |
| `/BMad:bmm:workflows:retrospective`                  | 回顾会议        |
| `/BMad:bmm:workflows:check-implementation-readiness` | 实施准备检查    |

#### 文档与研究

| 命令                                           | 用途           |
| ---------------------------------------------- | -------------- |
| `/BMad:bmm:workflows:research`                 | 研究调研       |
| `/BMad:bmm:workflows:document-project`         | 项目文档化     |
| `/BMad:bmm:workflows:generate-project-context` | 生成项目上下文 |

#### 测试架构 (TEA)

| 命令                                       | 用途           |
| ------------------------------------------ | -------------- |
| `/BMad:bmm:workflows:testarch-framework`   | 测试框架设计   |
| `/BMad:bmm:workflows:testarch-test-design` | 测试设计       |
| `/BMad:bmm:workflows:testarch-automate`    | 测试自动化     |
| `/BMad:bmm:workflows:testarch-ci`          | CI 集成        |
| `/BMad:bmm:workflows:testarch-atdd`        | ATDD 验收测试  |
| `/BMad:bmm:workflows:testarch-nfr`         | 非功能需求测试 |
| `/BMad:bmm:workflows:testarch-trace`       | 需求追溯       |
| `/BMad:bmm:workflows:testarch-test-review` | 测试审查       |

#### 可视化

| 命令                                              | 用途         |
| ------------------------------------------------- | ------------ |
| `/BMad:bmm:workflows:create-excalidraw-diagram`   | 创建架构图   |
| `/BMad:bmm:workflows:create-excalidraw-flowchart` | 创建流程图   |
| `/BMad:bmm:workflows:create-excalidraw-dataflow`  | 创建数据流图 |
| `/BMad:bmm:workflows:create-excalidraw-wireframe` | 创建线框图   |

---

## 🎮 BMGD (Game Development) - 游戏开发模块

### 🤖 Agents

| 命令                                  | 角色              |
| ------------------------------------- | ----------------- |
| `/BMad:bmgd:agents:game-architect`    | 游戏架构师        |
| `/BMad:bmgd:agents:game-designer`     | 游戏设计师        |
| `/BMad:bmgd:agents:game-dev`          | 游戏开发者        |
| `/BMad:bmgd:agents:game-qa`           | 游戏 QA           |
| `/BMad:bmgd:agents:game-scrum-master` | 游戏 Scrum Master |
| `/BMad:bmgd:agents:game-solo-dev`     | 独立游戏开发者    |

### 🔄 Workflows

| 命令                                     | 用途         |
| ---------------------------------------- | ------------ |
| `/BMad:bmgd:workflows:game-brief`        | 游戏简报     |
| `/BMad:bmgd:workflows:gdd`               | 游戏设计文档 |
| `/BMad:bmgd:workflows:game-architecture` | 游戏架构     |
| `/BMad:bmgd:workflows:narrative`         | 叙事设计     |
| `/BMad:bmgd:workflows:quick-prototype`   | 快速原型     |
| `/BMad:bmgd:workflows:dev-story`         | 开发 Story   |
| `/BMad:bmgd:workflows:code-review`       | 代码审查     |

---

## 🔧 BMB (BMAD Builder) - 构建器模块

### 🤖 Agents

| 命令                            | 用途        |
| ------------------------------- | ----------- |
| `/BMad:bmb:agents:bmad-builder` | BMAD 构建器 |

### 🔄 Workflows

| 命令                                            | 用途            |
| ----------------------------------------------- | --------------- |
| `/BMad:bmb:workflows:create-agent`              | 创建新 Agent    |
| `/BMad:bmb:workflows:create-workflow`           | 创建新 Workflow |
| `/BMad:bmb:workflows:create-module`             | 创建新模块      |
| `/BMad:bmb:workflows:edit-agent`                | 编辑 Agent      |
| `/BMad:bmb:workflows:edit-workflow`             | 编辑 Workflow   |
| `/BMad:bmb:workflows:workflow-compliance-check` | 工作流合规检查  |

---

## 💡 CIS (Creative & Innovation Suite) - 创意创新模块

### 🤖 Agents

| 命令                                       | 角色           |
| ------------------------------------------ | -------------- |
| `/BMad:cis:agents:brainstorming-coach`     | 头脑风暴教练   |
| `/BMad:cis:agents:creative-problem-solver` | 创意问题解决者 |
| `/BMad:cis:agents:design-thinking-coach`   | 设计思维教练   |
| `/BMad:cis:agents:innovation-strategist`   | 创新战略师     |
| `/BMad:cis:agents:presentation-master`     | 演示大师       |
| `/BMad:cis:agents:storyteller`             | 故事讲述者     |

### 🔄 Workflows

| 命令                                      | 用途         |
| ----------------------------------------- | ------------ |
| `/BMad:cis:workflows:design-thinking`     | 设计思维流程 |
| `/BMad:cis:workflows:innovation-strategy` | 创新战略     |
| `/BMad:cis:workflows:problem-solving`     | 问题解决     |
| `/BMad:cis:workflows:storytelling`        | 故事叙述     |

---

## ⚙️ Core - 核心模块

### 🤖 Agents

| 命令                            | 用途          |
| ------------------------------- | ------------- |
| `/BMad:core:agents:bmad-master` | BMAD 主控制器 |

### 🔄 Workflows

| 命令                                 | 用途                     |
| ------------------------------------ | ------------------------ |
| `/BMad:core:workflows:brainstorming` | 头脑风暴                 |
| `/BMad:core:workflows:party-mode`    | 派对模式 (多 Agent 协作) |

### 🛠️ Tasks & Tools

| 命令                                    | 用途         |
| --------------------------------------- | ------------ |
| `/BMad:core:tasks:advanced-elicitation` | 高级需求引导 |
| `/BMad:core:tasks:index-docs`           | 文档索引     |
| `/BMad:core:tools:shard-doc`            | 文档分片     |

---

## 🚀 常用命令速查

### 新项目启动

```bash
/BMad:bmm:workflows:workflow-init          # 初始化工作流
/BMad:bmm:workflows:create-product-brief   # 创建产品简报
/BMad:bmm:workflows:create-prd             # 创建 PRD
/BMad:bmm:workflows:create-architecture    # 创建架构
```

### 日常开发

```bash
/BMad:bmm:agents:dev                       # 唤醒开发者 Agent
/BMad:bmm:workflows:dev-story              # 执行 Story 开发
/BMad:bmm:workflows:code-review            # 代码审查
/BMad:bmm:workflows:quick-dev              # 快速开发
```

### Sprint 管理

```bash
/BMad:bmm:agents:sm                        # 唤醒 Scrum Master
/BMad:bmm:workflows:sprint-planning        # Sprint 规划
/BMad:bmm:workflows:sprint-status          # 查看状态
```

### 创意与头脑风暴

```bash
/BMad:core:workflows:brainstorming         # 头脑风暴
/BMad:cis:agents:brainstorming-coach       # 头脑风暴教练
```

---

## ⚠️ 注意事项

1. **大小写敏感**: 命令必须使用 `BMad`（大写 B 和 M）
2. **配置文件**: 首次使用需确保 `_bmad/bmm/config.yaml` 存在
3. **输出目录**: 默认输出到 `_bmad-output/` 目录
4. **退出 Agent**: 选择菜单中的 `[D] Dismiss Agent` 或输入 `*dismiss`

---

_Generated: 2025-12-25 | BMAD Version: 6.0.0-alpha.19_
