# Requirements Document: MD Reader Upgrade

## Introduction

本需求文档定义了 AnyKeep Markdown 阅读器的升级计划，旨在提升用户阅读体验的**舒适感**和**沉浸感**。

当前 MD 阅读器已具备基础功能（Markdown 渲染、代码高亮、目录导航、进度跟踪），但在视觉体验、阅读定制、交互细节方面仍有显著提升空间。

**核心价值主张**：

- 让长文阅读成为享受而非负担
- 提供媲美专业阅读器（如 Kindle、微信读书）的沉浸体验
- 支持个性化定制，适应不同用户偏好和场景

## Alignment with Product Vision

本功能支持 AnyKeep 的核心愿景：**跨平台智能内容聚合工具**

- **提升内容消费体验**：收藏只是第一步，阅读才是核心价值
- **增强用户粘性**：优质阅读体验促进用户回访和长期使用
- **Pro 功能差异化**：MD 收藏为 Pro 专属功能，阅读器升级进一步提升付费价值

---

## Requirements

### REQ-1: 阅读主题系统

**User Story:** 作为一名 Pro 用户，我希望能够切换阅读主题，以便在不同光线环境下获得舒适的阅读体验。

#### Acceptance Criteria

1. WHEN 用户点击主题切换按钮 THEN 系统 SHALL 显示主题选择器（明亮/暗黑/护眼/羊皮纸）
2. WHEN 用户选择主题 THEN 系统 SHALL 立即应用主题样式，无需刷新页面
3. WHEN 用户选择主题 THEN 系统 SHALL 将偏好保存到 localStorage
4. WHEN 用户下次访问阅读页 THEN 系统 SHALL 自动应用上次选择的主题
5. IF 系统检测到用户系统偏好为暗色模式 AND 用户未手动选择主题 THEN 系统 SHALL 默认使用暗黑主题

**主题规格**：

| 主题 ID | 名称   | 背景色    | 文字色    | 强调色    | 适用场景   |
| ------- | ------ | --------- | --------- | --------- | ---------- |
| `light` | 明亮   | `#ffffff` | `#1a1a1a` | `#2563eb` | 日间办公   |
| `dark`  | 暗黑   | `#1a1a1a` | `#e5e5e5` | `#60a5fa` | 夜间阅读   |
| `sepia` | 护眼   | `#f5f0e6` | `#5c4b37` | `#b45309` | 长时间阅读 |
| `paper` | 羊皮纸 | `#faf8f5` | `#3d3d3d` | `#6366f1` | 文学类内容 |

---

### REQ-2: 排版优化

**User Story:** 作为一名长文阅读用户，我希望阅读器具有专业的排版，以便减少眼睛疲劳并提高阅读效率。

#### Acceptance Criteria

1. WHEN 阅读页面加载 THEN 系统 SHALL 应用优化后的排版参数（行高 1.8、段间距 1.5em、最大宽度 70ch）
2. WHEN 内容包含中文 THEN 系统 SHALL 使用阅读级中文字体（思源宋体或霞鹜文楷）
3. WHEN 内容包含代码块 THEN 系统 SHALL 使用等宽字体（JetBrains Mono 或 Fira Code）
4. IF 用户选择字体大小 THEN 系统 SHALL 按比例调整所有排版参数

**排版参数规格**：

| 参数         | 当前值 | 目标值               | 说明         |
| ------------ | ------ | -------------------- | ------------ |
| 正文行高     | 1.5    | 1.8                  | 中文长文最优 |
| 段落间距     | 1em    | 1.5em                | 增加呼吸感   |
| 内容最大宽度 | 65ch   | 70ch                 | 中文适当放宽 |
| 标题间距     | -      | 2em top / 1em bottom | 层次分明     |
| 列表缩进     | -      | 1.5em                | 结构清晰     |

**字体栈**：

```css
--font-reading-cn:
  "LXGW WenKai", "Source Han Serif SC", "Noto Serif CJK SC", serif;
--font-reading-en: Georgia, "Times New Roman", serif;
--font-code: "JetBrains Mono", "Fira Code", "SF Mono", monospace;
```

---

### REQ-3: 目录同步高亮

**User Story:** 作为一名阅读长文档的用户，我希望目录能够实时显示当前阅读位置，以便随时了解阅读进度和文档结构。

#### Acceptance Criteria

1. WHEN 用户滚动页面 THEN 系统 SHALL 高亮目录中当前可见章节
2. WHEN 当前章节变化 THEN 系统 SHALL 平滑滚动目录使当前项可见
3. WHEN 用户点击目录项 THEN 系统 SHALL 平滑滚动到对应章节
4. IF 多个章节同时可见 THEN 系统 SHALL 高亮最靠近视口顶部的章节
5. WHEN 页面初始化 THEN 系统 SHALL 正确计算并高亮初始可见章节

**实现约束**：

- 使用 `IntersectionObserver` API，避免滚动事件节流
- 高亮过渡动画 ≤ 200ms
- 目录滚动使用 `scroll-behavior: smooth`

---

### REQ-4: 阅读进度增强

**User Story:** 作为一名阅读用户，我希望看到更详细的阅读进度信息，以便合理安排阅读时间。

#### Acceptance Criteria

1. WHEN 用户滚动页面 THEN 系统 SHALL 显示阅读进度百分比和预计剩余时间
2. WHEN 进度条显示 THEN 系统 SHALL 格式为 `50% · 约 3 分钟`
3. IF 剩余时间 < 1 分钟 THEN 系统 SHALL 显示 `即将读完`
4. WHEN 用户完成阅读（进度 ≥ 95%） THEN 系统 SHALL 显示 `阅读完成` 并更新数据库 `is_read` 字段

**计算公式**：

```
剩余时间 = (1 - 当前进度) × 预估总阅读时间
预估总阅读时间 = reading_time_minutes（数据库字段）
```

---

### REQ-5: 阅读位置记忆

**User Story:** 作为一名分多次阅读长文的用户，我希望系统记住我的阅读位置，以便下次打开时能够继续阅读。

#### Acceptance Criteria

1. WHEN 用户离开阅读页（切换页面或关闭） THEN 系统 SHALL 保存当前滚动位置
2. WHEN 用户重新打开同一文档 AND 存在保存的位置 THEN 系统 SHALL 显示提示 `继续上次阅读？`
3. WHEN 用户确认继续 THEN 系统 SHALL 平滑滚动到上次位置
4. WHEN 用户选择从头开始 THEN 系统 SHALL 清除保存的位置并从头显示
5. IF 保存的位置已超过文档长度（内容被编辑） THEN 系统 SHALL 忽略并从头开始

**存储方案**：

- 主存储：localStorage（`md-reader-position-{collectionId}`）
- 数据结构：`{ scrollTop: number, progress: number, timestamp: number }`
- 过期时间：30 天

---

### REQ-6: 专注模式

**User Story:** 作为一名追求沉浸阅读体验的用户，我希望能够进入专注模式，以便排除干扰专心阅读。

#### Acceptance Criteria

1. WHEN 用户点击专注模式按钮 THEN 系统 SHALL 进入专注模式
2. WHEN 进入专注模式 THEN 系统 SHALL 隐藏目录侧边栏
3. WHEN 进入专注模式 THEN 系统 SHALL 使顶部工具栏在静止 3 秒后自动隐藏
4. WHEN 专注模式下用户移动鼠标或滚动 THEN 系统 SHALL 暂时显示工具栏
5. WHEN 用户按 `Esc` 或点击退出按钮 THEN 系统 SHALL 退出专注模式
6. WHEN 专注模式下 THEN 系统 SHALL 将内容居中显示并增加侧边留白

**视觉规格**：

- 工具栏淡出动画：500ms ease-out
- 内容区最大宽度：保持 70ch
- 侧边留白：自动居中（`margin: 0 auto`）

---

### REQ-7: 图片查看增强

**User Story:** 作为一名阅读包含图片内容的用户，我希望能够放大查看图片细节，以便更好地理解图文内容。

#### Acceptance Criteria

1. WHEN 用户点击文档中的图片 THEN 系统 SHALL 以 Lightbox 形式全屏显示图片
2. WHEN Lightbox 打开 THEN 系统 SHALL 显示关闭按钮和图片原始尺寸
3. WHEN Lightbox 中用户点击背景或按 `Esc` THEN 系统 SHALL 关闭 Lightbox
4. IF 图片加载失败 THEN 系统 SHALL 显示优雅的占位图和错误提示
5. WHEN 图片在视口外 THEN 系统 SHALL 延迟加载（lazy loading）

**技术约束**：

- 推荐使用 `yet-another-react-lightbox`（~15KB gzip）
- 支持键盘导航（多图场景：← → 切换）

---

### REQ-8: 代码块增强

**User Story:** 作为一名技术文档阅读者，我希望代码块具有更好的展示和交互，以便高效阅读和使用代码。

#### Acceptance Criteria

1. WHEN 代码块行数 > 20 THEN 系统 SHALL 默认折叠并显示展开按钮
2. WHEN 用户点击展开按钮 THEN 系统 SHALL 平滑展开显示全部代码
3. WHEN 用户点击复制按钮 THEN 系统 SHALL 复制代码并显示成功动画（按钮变 ✓）
4. WHEN 复制成功动画 THEN 系统 SHALL 在 2 秒后恢复原状
5. WHEN 代码块渲染 THEN 系统 SHALL 显示语言标签（右上角）

**视觉规格**：

- 折叠时显示前 10 行 + 渐变遮罩
- 展开动画：300ms ease-in-out
- 语言标签：半透明背景，右上角固定

---

### REQ-9: 键盘导航

**User Story:** 作为一名键盘用户，我希望能够使用快捷键控制阅读器，以便提高操作效率。

#### Acceptance Criteria

1. WHEN 用户按 `J` THEN 系统 SHALL 滚动到下一个章节
2. WHEN 用户按 `K` THEN 系统 SHALL 滚动到上一个章节
3. WHEN 用户按 `T` THEN 系统 SHALL 切换目录侧边栏显示/隐藏
4. WHEN 用户按 `F` THEN 系统 SHALL 切换专注模式
5. WHEN 用户按 `Esc` THEN 系统 SHALL 退出专注模式或 Lightbox
6. WHEN 用户按 `?` THEN 系统 SHALL 显示快捷键帮助面板

**快捷键列表**：

| 快捷键    | 功能         |
| --------- | ------------ |
| `J` / `↓` | 下一章节     |
| `K` / `↑` | 上一章节     |
| `T`       | 切换目录     |
| `F`       | 切换专注模式 |
| `Esc`     | 退出/返回    |
| `?`       | 快捷键帮助   |
| `1-4`     | 字体大小预设 |

---

### REQ-10: 文字高亮标记

**User Story:** 作为一名深度阅读用户，我希望能够选中文字并添加高亮颜色标记，以便标注重点内容和方便日后回顾。

#### Acceptance Criteria

1. WHEN 用户选中文字 THEN 系统 SHALL 显示高亮工具栏（浮动气泡）
2. WHEN 高亮工具栏显示 THEN 系统 SHALL 提供多种颜色选项（黄色/绿色/蓝色/粉色/紫色）
3. WHEN 用户点击颜色 THEN 系统 SHALL 立即应用高亮样式到选中文字
4. WHEN 用户点击已高亮文字 THEN 系统 SHALL 显示编辑菜单（更换颜色/删除高亮）
5. WHEN 用户创建/修改/删除高亮 THEN 系统 SHALL 自动保存到数据库
6. WHEN 用户重新打开文档 THEN 系统 SHALL 恢复所有已保存的高亮标记
7. IF 用户未选中任何文字 THEN 系统 SHALL 不显示高亮工具栏

**高亮颜色规格**：

| 颜色 ID  | 名称 | 背景色    | 文字色  | 用途建议    |
| -------- | ---- | --------- | ------- | ----------- |
| `yellow` | 黄色 | `#fef08a` | inherit | 重点内容    |
| `green`  | 绿色 | `#bbf7d0` | inherit | 已掌握/同意 |
| `blue`   | 蓝色 | `#bfdbfe` | inherit | 待深入/疑问 |
| `pink`   | 粉色 | `#fbcfe8` | inherit | 个人感悟    |
| `purple` | 紫色 | `#ddd6fe` | inherit | 引用/摘录   |

**数据模型**：

```typescript
interface TextHighlight {
  id: string; // UUID
  collection_id: number; // 所属文档 ID
  user_id: string; // 用户 ID

  // 定位信息
  start_offset: number; // 起始字符偏移
  end_offset: number; // 结束字符偏移
  anchor_text: string; // 锚定文本（用于内容变更后重新定位）

  // 样式
  color: "yellow" | "green" | "blue" | "pink" | "purple";

  // 时间戳
  created_at: string;
  updated_at: string;
}
```

**数据库表**：新增 `md_collection_highlights` 表

**交互规格**：

- 工具栏位置：选区上方居中，距离选区 8px
- 工具栏出现动画：fade-in 150ms
- 颜色圆点大小：20px，hover 时 scale 1.1
- 已高亮文字 hover：显示淡色边框提示可点击

**边界情况处理**：

- 跨段落选择：支持，高亮分段存储
- 选区重叠：后创建的高亮覆盖先前的
- 内容编辑后：使用 `anchor_text` 模糊匹配重新定位

---

## Non-Functional Requirements

### Code Architecture and Modularity

- **Single Responsibility Principle**: 每个新增组件专注单一功能
  - `ThemeProvider`: 主题状态管理
  - `ReadingProgress`: 进度计算和显示
  - `TOCSyncHighlight`: 目录同步逻辑
  - `FocusMode`: 专注模式状态
  - `HighlightManager`: 文字高亮状态管理
  - `HighlightToolbar`: 高亮颜色选择器浮层

- **Modular Design**: 复用现有组件和工具
  - 复用 `md-renderer.tsx` 核心渲染逻辑
  - 复用 `use-md-view-preference.ts` 偏好存储模式
  - 新增 hooks 遵循现有命名规范（`use-*.ts`）

- **Dependency Management**: 最小化新增依赖
  - 主题切换：CSS Variables + 自实现（无新依赖）
  - 图片放大：`yet-another-react-lightbox`（~15KB）
  - 其他功能：原生 API（IntersectionObserver、localStorage）

- **Clear Interfaces**: 定义清晰的 Props 和 Context 接口
  - `ReaderTheme`: 主题配置类型
  - `ReadingState`: 阅读状态类型
  - `ReaderPreferences`: 用户偏好类型
  - `TextHighlight`: 高亮标记类型
  - `HighlightColor`: 高亮颜色枚举

### Performance

- **初始加载**: 主题切换不增加首屏加载时间（CSS Variables 预定义）
- **滚动性能**: 目录同步使用 `IntersectionObserver`，避免滚动事件节流
- **图片加载**: Lightbox 库动态导入（`next/dynamic`），不影响首屏
- **内存占用**: 阅读位置存储使用 localStorage，不增加内存压力
- **高亮渲染**: 高亮标记使用 CSS `::highlight` 伪元素或 `<mark>` 标签，避免 DOM 重构

### Security

- **XSS 防护**: 保持现有 `rehype-sanitize` 配置
- **存储安全**: localStorage 仅存储非敏感偏好数据
- **图片安全**: Lightbox 不执行任何图片 URL 修改

### Reliability

- **降级策略**:
  - 字体加载失败时回退到系统字体
  - localStorage 不可用时使用内存存储
  - IntersectionObserver 不支持时禁用目录同步

- **错误边界**: 新增组件包裹 ErrorBoundary，防止阅读器崩溃

### Usability

- **可访问性**:
  - 主题切换支持键盘操作
  - 专注模式保持可访问性焦点管理
  - Lightbox 支持 `Esc` 关闭和 `aria-label`

- **响应式**:
  - 移动端隐藏目录侧边栏
  - 主题切换器适配触摸操作
  - 快捷键仅在桌面端启用

---

## Out of Scope（本期不包含）

- 移动端手势支持（左滑返回、双击专注）
- 批注/笔记功能（高亮仅支持颜色标记，不支持添加文字注释）
- 阅读统计仪表盘
- 离线阅读支持
- 文本转语音（TTS）
- PDF 导出
- 高亮导出/分享

---

## Success Metrics

| 指标                         | 目标                 |
| ---------------------------- | -------------------- |
| 主题切换响应时间             | < 100ms              |
| 目录同步延迟                 | < 50ms               |
| 高亮创建响应时间             | < 200ms              |
| 高亮加载时间（100条）        | < 500ms              |
| Lighthouse Performance Score | ≥ 90                 |
| 新增包体积                   | < 30KB gzip          |
| 用户阅读时长                 | 提升 20%（A/B 测试） |

---

## Implementation Priority

| 优先级 | 需求                | 预估工时 | 依赖         |
| ------ | ------------------- | -------- | ------------ |
| P0     | REQ-1 阅读主题系统  | 0.5d     | 无           |
| P0     | REQ-2 排版优化      | 0.5d     | 无           |
| P0     | REQ-3 目录同步高亮  | 0.5d     | 无           |
| P0     | REQ-4 阅读进度增强  | 0.3d     | 无           |
| P1     | REQ-5 阅读位置记忆  | 1d       | 无           |
| P1     | REQ-6 专注模式      | 1d       | REQ-3        |
| P1     | REQ-10 文字高亮标记 | 2d       | 数据库迁移   |
| P2     | REQ-7 图片查看增强  | 1d       | 无           |
| P2     | REQ-8 代码块增强    | 0.5d     | 无           |
| P2     | REQ-9 键盘导航      | 1d       | REQ-3, REQ-6 |

**总预估工时**: 8.3 天
