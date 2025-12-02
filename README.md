# AnyKeep

<div align="center">

**跨平台智能内容聚合工具**

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-green?style=flat&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?style=flat&logo=tailwind-css)](https://tailwindcss.com/)

[功能特性](#-核心功能) • [快速开始](#-快速开始) • [技术栈](#️-技术栈) • [文档](#-文档)

</div>

---

## 📖 项目简介

AnyKeep 是一款现代化的跨平台内容管理工具，帮助用户统一管理来自微信公众号、B站、小红书等平台的收藏内容。通过 AI 技术实现智能摘要、自动标签和语义搜索，让内容管理更高效。

### 核心价值

- 🔖 **统一收藏** - 集中管理多平台内容，告别分散的收藏夹
- 🤖 **AI 智能处理** - 自动生成摘要和标签，智能提取关键信息
- 🔍 **语义搜索** - 基于向量检索的智能搜索，精准定位内容
- 📱 **跨设备同步** - 实时数据同步，随时随地访问收藏
- 🌐 **浏览器书签** - 完整的浏览器书签导入和管理系统

---

## ✨ 核心功能

### 已实现功能

- ✅ **用户认证系统** - 基于 Supabase Auth 的安全认证
- ✅ **浏览器书签导入** - 支持 Chrome/Edge/Firefox/Safari 格式
  - 保留文件夹层级结构
  - 智能去重与合并
  - 元数据自动抓取（Open Graph）
  - 批量导入与进度追踪
  - HTML 格式导出
- ✅ **书签隔离与优化** - 浏览器书签独立视图
  - 虚拟滚动技术（支持 10,000+ 条）
  - 紧凑列表视图
  - 智能平台筛选
- ✅ **文件夹管理** - 多层级文件夹组织
- ✅ **RLS 数据隔离** - 完整的行级安全策略

### 规划中功能

- 📝 **内容收藏** - 一键保存多平台内容
- 🤖 **AI 摘要** - 智能内容提取与总结
- 🏷️ **自动标签** - AI 驱动的标签生成
- 🔍 **语义搜索** - 基于向量的智能检索
- 📊 **智能分类** - 自动内容分类与归档
- 📱 **移动端应用** - Capacitor 打包的原生应用

完整功能规划请查看 [anykeep1121.md](./anykeep1121.md)

---

## 🛠️ 技术栈

### 前端

- **框架**: [Next.js 16.0](https://nextjs.org/) - React 框架，App Router + Turbopack
- **语言**: [TypeScript 5](https://www.typescriptlang.org/) - 类型安全
- **样式**: [Tailwind CSS 4](https://tailwindcss.com/) - 原子化 CSS 框架
- **组件库**: [Shadcn UI](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/)
- **状态管理**: React Hooks + Context API
- **表单**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)

### 后端 (Supabase)

- **数据库**: PostgreSQL + pgvector（向量检索）
- **认证**: Supabase Auth（支持多种登录方式）
- **存储**: Supabase Storage（图片和文件存储）
- **函数**: Edge Functions (Deno)
- **实时同步**: Supabase Realtime

### 移动端

- **打包工具**: [Capacitor](https://capacitorjs.com/) - Web 转原生应用

### 开发工具

- **代码质量**: ESLint + Prettier
- **Git Hooks**: Husky
- **包管理器**: npm

---

## 🚀 快速开始

### 环境要求

- Node.js 20+
- Git
- Docker Desktop（可选，用于本地 Supabase）

### 安装步骤

1. **克隆项目**

```bash
git clone https://github.com/yourusername/anykeep.git
cd anykeep
```

2. **安装依赖**

```bash
npm install
```

3. **配置环境变量**

复制 `.env.example` 到 `.env.local` 并填写配置：

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的匿名密钥
SUPABASE_SERVICE_ROLE_KEY=服务角色密钥
```

4. **启动开发服务器**

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 数据库迁移

如果使用本地 Supabase：

```bash
# 启动本地 Supabase
npm run supabase:start

# 应用迁移
npm run supabase:db:push

# 生成 TypeScript 类型
npm run supabase:gen:types
```

---

## 📁 项目结构

```
anykeep/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # 认证相关页面
│   │   ├── (main)/            # 主应用页面
│   │   └── api/               # API Routes
│   ├── components/            # React 组件
│   │   ├── ui/               # Shadcn UI 组件
│   │   ├── bookmark/         # 收藏相关组件
│   │   └── browser-bookmark/ # 浏览器书签组件
│   ├── hooks/                # 自定义 Hooks
│   ├── lib/                  # 工具函数和业务逻辑
│   │   ├── supabase/         # Supabase 客户端
│   │   └── browser-bookmark/ # 浏览器书签逻辑
│   └── types/                # TypeScript 类型定义
├── supabase/
│   ├── migrations/           # 数据库迁移文件
│   └── functions/            # Edge Functions
├── public/                   # 静态资源
└── docs/                     # 项目文档
```

---

## 📚 文档

### 核心文档

- [产品需求文档 (PRD)](./anykeep1121.md) - 完整的产品需求和技术规范
- [AI 上下文文档](./CLAUDE.md) - 项目架构和开发指南
- [移动端访问](./MOBILE_ACCESS.md) - 移动设备访问说明

### 开发文档

- [开发进度](./docs/reports/DEVELOPMENT_PROGRESS.md)
- [测试总结](./docs/testing/TESTING_SUMMARY.md)
- [优化指南](./docs/guides/optimization/)

### 功能实现

- **浏览器书签导入** - 完整实现（Phase 1-3）
  - 支持多种浏览器格式
  - 智能去重和元数据抓取
  - 导入历史追踪
- **书签隔离与列表视图** - 性能优化
  - 虚拟滚动支持 10,000+ 条
  - 内存占用降低 60%
  - 滚动帧率提升 50%

---

## 🔧 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm start                # 启动生产服务器

# 代码质量
npm run type-check       # TypeScript 类型检查
npm run lint             # ESLint 代码检查
npm run lint:fix         # 自动修复代码问题

# Supabase
npm run supabase:start   # 启动本地 Supabase
npm run supabase:stop    # 停止本地 Supabase
npm run supabase:status  # 查看状态

# 移动端
npm run mobile:build     # 构建并同步到 Capacitor
npm run cap:open:android # 打开 Android Studio
```

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` 修复 Bug
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具链更新

---

## 📊 项目统计

- **代码规模**: 169 个 TypeScript 文件，33,451 行代码
- **数据库**: 24 个迁移文件
- **组件数**: 69 个 React 组件
- **开发周期**: 2025-11 至今

---

## 📝 许可证

本项目采用 MIT 许可证。详见 [LICENSE](./LICENSE) 文件。

---

## 📮 联系方式

- **项目主页**: [GitHub](https://github.com/yourusername/anykeep)
- **问题反馈**: [Issues](https://github.com/yourusername/anykeep/issues)
- **讨论区**: [Discussions](https://github.com/yourusername/anykeep/discussions)

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给我们一个 Star！**

Made with ❤️ by AnyKeep Team

</div>
