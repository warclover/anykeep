# 🖼️ 静态资源

本目录存放文档相关的图片、图表和设计文件。

## 目录说明

### screenshots/

功能截图和界面预览。

**存放内容**：

- 功能演示截图
- UI 界面预览
- 移动端截图
- 测试截图

**命名规范**：

- 使用语义化名称，如 `feature-name-screenshot.png`
- 包含日期标识，如 `rating-feature-20251202-01.png`
- 使用小写字母和连字符

**示例**：

- `browser-bookmark-import-20251201.png`
- `home-page-desktop-view.png`
- `mobile-menu-screenshot.png`

---

### diagrams/

架构图、流程图和 UML 图。

**存放内容**：

- 系统架构图
- 数据流程图
- 用户流程图
- UML 类图/序列图
- 思维导图

**命名规范**：

- 说明图表类型，如 `system-architecture-diagram.png`
- 版本标识，如 `user-flow-v2.png`

**示例**：

- `database-schema-diagram.png`
- `authentication-flow-chart.png`
- `system-architecture-v1.png`

**推荐工具**：

- [Excalidraw](https://excalidraw.com/) - 手绘风格图表
- [Draw.io](https://draw.io/) - 专业流程图
- [Mermaid](https://mermaid.js.org/) - Markdown 代码生成图表
- [PlantUML](https://plantuml.com/) - UML 图表

---

### figma-exports/

Figma 导出的设计文件。

**存放内容**：

- Figma 导出的 PNG/SVG
- 设计稿截图
- UI 组件资源
- 设计标注

**命名规范**：

- 按功能模块分类，如 `home-page/`、`login-page/`
- 包含设计版本，如 `home-v2-desktop.png`

**示例**：

- `home-page/desktop-view.png`
- `login-page/mobile-view.svg`
- `components/button-variants.png`

---

## 图片规范

### 文件格式

- **PNG**: 用于截图、UI 设计稿（支持透明）
- **JPG**: 用于照片、大图（文件较小）
- **SVG**: 用于图标、矢量图（可无限缩放）
- **WebP**: 用于网页优化（体积小，质量高）

### 图片尺寸

#### 文档用图

- 最大宽度: 1200px
- 推荐宽度: 800px
- 保持合适的压缩质量（70-85%）

#### 桌面端截图

- 推荐尺寸: 1920x1080
- 或: 1440x900

#### 移动端截图

- 推荐尺寸: 375x812 (iPhone)
- 或: 390x844 (iPhone 12/13/14)

### 图片优化

使用以下工具压缩图片：

- [TinyPNG](https://tinypng.com/) - PNG/JPG 压缩
- [Squoosh](https://squoosh.app/) - 在线图片优化
- [ImageOptim](https://imageoptim.com/) - Mac 图片压缩工具

---

## 在文档中引用图片

### Markdown 语法

```markdown
# 相对路径引用（推荐）

![功能描述](../assets/screenshots/feature-name.png)

# 绝对路径引用（避免）

![功能描述](/docs/assets/screenshots/feature-name.png)

# 带链接的图片

[![功能描述](../assets/screenshots/feature-name.png)](https://example.com)

# 指定尺寸（HTML）

<img src="../assets/screenshots/feature-name.png" alt="功能描述" width="600">
```

### 图片说明规范

```markdown
![替代文本](图片路径)

**图 1: 浏览器书签导入流程**
上图展示了用户从选择文件到导入完成的完整流程。
```

---

## 文件组织示例

```
assets/
├── screenshots/
│   ├── browser-bookmark/
│   │   ├── import-dialog-20251201.png
│   │   ├── progress-indicator.png
│   │   └── success-message.png
│   ├── home-page/
│   │   ├── desktop-view.png
│   │   └── mobile-view.png
│   └── rating-feature/
│       ├── rating-dialog.png
│       └── rating-list.png
├── diagrams/
│   ├── architecture/
│   │   ├── system-overview.png
│   │   └── database-schema.png
│   └── flows/
│       ├── user-authentication-flow.png
│       └── bookmark-import-flow.png
└── figma-exports/
    ├── home-page/
    │   ├── desktop.png
    │   └── mobile.png
    └── components/
        ├── buttons.png
        └── cards.png
```

---

## 快速链接

- [返回上级目录](../)
- [查看设计文档](../design/)
- [查看报告](../reports/)
