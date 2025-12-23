# BMAD 新手使用教程

## 目录

1. [什么是 BMAD](#什么是-bmad)
2. [已安装模块](#已安装模块)
3. [核心概念](#核心概念)
4. [快速上手](#快速上手)
5. [常用命令速查表](#常用命令速查表)
6. [开发流程示例](#开发流程示例)

---

## 什么是 BMAD

**BMAD (BMad Method)** 是一套 AI 驱动的敏捷开发框架，通过专业化的 AI 代理（Agents）和结构化的工作流（Workflows）帮助你高效地完成软件开发。

**当前版本**: `6.0.0-alpha.19`

**核心理念**:

- 🤖 **专业代理** - 每个代理专注于特定领域（产品、架构、开发、测试等）
- 📋 **结构化流程** - 四阶段开发流程：分析 → 规划 → 设计 → 实施
- 🔄 **渐进式开发** - 每个 Story 独立完成，持续交付

---

## 已安装模块

| 模块     | 说明                  | 主要用途                          |
| -------- | --------------------- | --------------------------------- |
| **core** | 核心框架              | BMad Master、头脑风暴、多代理协作 |
| **bmm**  | BMad Method           | 标准软件开发流程                  |
| **bmgd** | Game Development      | 游戏开发专用工作流                |
| **bmb**  | Module Builder        | 创建自定义代理和工作流            |
| **cis**  | Creative & Innovation | 创意思维、故事叙述、问题解决      |

---

## 核心概念

### 🤖 代理 (Agents)

代理是拥有特定专业能力的 AI 角色。你的项目中有 **24 个代理**：

**BMM 核心代理**（标准开发）:

| 代理                | 图标 | 名称    | 职责                     |
| ------------------- | ---- | ------- | ------------------------ |
| analyst             | 📊   | Mary    | 业务分析、需求挖掘       |
| pm                  | 📋   | John    | 产品管理、PRD 编写       |
| architect           | 🏗️   | Winston | 系统架构设计             |
| sm                  | 🏃   | Bob     | Scrum Master、Story 管理 |
| dev                 | 💻   | Amelia  | 代码实现                 |
| tea                 | 🧪   | Murat   | 测试架构                 |
| ux-designer         | 🎨   | Sally   | UX/UI 设计               |
| quick-flow-solo-dev | 🚀   | Barry   | 快速开发全栈专家         |

**BMGD 游戏开发代理**:

| 代理           | 名称             | 职责     |
| -------------- | ---------------- | -------- |
| game-designer  | Samus Shepard    | 游戏设计 |
| game-architect | Cloud Dragonborn | 游戏架构 |
| game-dev       | Link Freeman     | 游戏开发 |
| game-qa        | GLaDOS           | 游戏测试 |

### 📋 工作流 (Workflows)

工作流是预定义的任务流程。当前有 **71 个工作流**，按阶段组织：

**Phase 1 - 分析** (可选):

- `brainstorming` - 头脑风暴
- `research` - 市场/技术调研
- `create-product-brief` - 产品简介

**Phase 2 - 规划** (必需):

- `create-prd` - 创建 PRD 文档
- `create-tech-spec` - 创建技术规格（Quick Flow）
- `create-ux-design` - UX 设计

**Phase 3 - 设计** (根据规模):

- `create-architecture` - 系统架构设计
- `create-epics-and-stories` - 创建 Epics 和 Stories
- `check-implementation-readiness` - 实施准备检查

**Phase 4 - 实施** (必需):

- `sprint-planning` - Sprint 规划
- `create-story` - 创建 Story
- `dev-story` - 实现 Story
- `code-review` - 代码审查

### 🛤️ 三种开发轨道

| 轨道            | 适用场景         | 流程                               |
| --------------- | ---------------- | ---------------------------------- |
| **Quick Flow**  | Bug 修复、小功能 | tech-spec → dev → review           |
| **BMad Method** | 标准产品开发     | PRD → Architecture → Stories → Dev |
| **Enterprise**  | 大型企业项目     | BMad + 安全/DevOps/测试            |

---

## 快速上手

### 方式一：使用 BMad Master（推荐）

1. **激活 BMad Master**:

   ```
   /bmad:core:agents:bmad-master
   ```

2. **查看可用选项**:
   - `*menu` - 重新显示菜单
   - `*list-workflows` - 列出所有工作流
   - `*list-tasks` - 列出所有任务
   - `*party-mode` - 多代理协作模式

### 方式二：直接使用工作流

在 Claude Code 中直接调用工作流 Skill：

```bash
# 初始化项目
/bmad:bmm:workflows:workflow-init

# 查看项目状态
/bmad:bmm:workflows:workflow-status

# 创建 PRD
/bmad:bmm:workflows:create-prd

# 创建架构
/bmad:bmm:workflows:create-architecture

# Quick Flow 快速开发
/bmad:bmm:workflows:create-tech-spec
/bmad:bmm:workflows:quick-dev
```

### 方式三：直接激活代理

```bash
# 激活产品经理
/bmad:bmm:agents:pm

# 激活架构师
/bmad:bmm:agents:architect

# 激活开发者
/bmad:bmm:agents:dev

# 快速开发专家
/bmad:bmm:agents:quick-flow-solo-dev
```

---

## 常用命令速查表

### 项目管理

| 命令                                  | 说明         |
| ------------------------------------- | ------------ |
| `/bmad:bmm:workflows:workflow-init`   | 初始化新项目 |
| `/bmad:bmm:workflows:workflow-status` | 查看当前进度 |
| `/bmad:bmm:workflows:sprint-planning` | Sprint 规划  |
| `/bmad:bmm:workflows:sprint-status`   | Sprint 状态  |

### 规划阶段

| 命令                                           | 说明                  |
| ---------------------------------------------- | --------------------- |
| `/bmad:bmm:workflows:create-prd`               | 创建 PRD              |
| `/bmad:bmm:workflows:create-architecture`      | 创建架构文档          |
| `/bmad:bmm:workflows:create-epics-and-stories` | 创建 Epics 和 Stories |
| `/bmad:bmm:workflows:create-ux-design`         | UX 设计               |

### 实施阶段

| 命令                                | 说明             |
| ----------------------------------- | ---------------- |
| `/bmad:bmm:workflows:create-story`  | 创建下一个 Story |
| `/bmad:bmm:workflows:dev-story`     | 实现 Story       |
| `/bmad:bmm:workflows:code-review`   | 代码审查         |
| `/bmad:bmm:workflows:retrospective` | 回顾总结         |

### Quick Flow（快速开发）

| 命令                                   | 说明         |
| -------------------------------------- | ------------ |
| `/bmad:bmm:workflows:create-tech-spec` | 创建技术规格 |
| `/bmad:bmm:workflows:quick-dev`        | 快速实现     |

### 创意与协作

| 命令                                 | 说明       |
| ------------------------------------ | ---------- |
| `/bmad:core:workflows:brainstorming` | 头脑风暴   |
| `/bmad:core:workflows:party-mode`    | 多代理协作 |

---

## 开发流程示例

### 场景 1：快速修复 Bug / 小功能

```bash
# 1. 激活 Quick Flow 专家
/bmad:bmm:agents:quick-flow-solo-dev

# 2. 描述你的需求，Barry 会帮你快速完成
```

或者使用工作流：

```bash
# 1. 创建技术规格
/bmad:bmm:workflows:create-tech-spec

# 2. 快速实现
/bmad:bmm:workflows:quick-dev
```

### 场景 2：标准功能开发

```bash
# 1. 初始化项目（首次）
/bmad:bmm:workflows:workflow-init

# 2. 创建 PRD
/bmad:bmm:workflows:create-prd

# 3. 创建架构
/bmad:bmm:workflows:create-architecture

# 4. 创建 Epics 和 Stories
/bmad:bmm:workflows:create-epics-and-stories

# 5. Sprint 规划
/bmad:bmm:workflows:sprint-planning

# 6. 循环：创建 → 实现 → 审查
/bmad:bmm:workflows:create-story
/bmad:bmm:workflows:dev-story
/bmad:bmm:workflows:code-review
```

### 场景 3：现有项目文档化

```bash
# 分析并文档化现有代码库
/bmad:bmm:workflows:document-project
```

---

## 重要提示

1. **每个工作流使用新会话** - 避免上下文混乱导致幻觉
2. **工作流会自动更新状态文件** - 无需手动编辑 `.yaml` 文件
3. **Story 是实现的唯一真理来源** - 开发时严格按照 Story 定义
4. **先测试后实现** - 遵循 Red-Green-Refactor 循环

---

## 更多资源

- **官方文档**: `_bmad/bmm/docs/` 目录
- **快速入门**: `_bmad/bmm/docs/quick-start.md`
- **FAQ**: `_bmad/bmm/docs/faq.md`
- **词汇表**: `_bmad/bmm/docs/glossary.md`
- **Discord 社区**: https://discord.gg/gk8jAdXWmj
