# 内联快速添加收藏组件设计方案 V2

> **版本**: v2.1
> **日期**: 2025-12-13
> **状态**: ✅ 设计已确认
> **设计师**: Sally (UX Expert)

---

## 设计理念

> **"一秒收藏，零干扰浏览"**

这个设计追求的是：让添加收藏变得如此自然，以至于用户感觉不到自己在"使用功能"——就像呼吸一样自然。

### 核心原则

| 原则           | 含义                 | 实现方式                           |
| -------------- | -------------------- | ---------------------------------- |
| **即时反馈**   | 每个动作都有视觉响应 | 微动画、状态变化、声音反馈（可选） |
| **渐进披露**   | 复杂功能按需展现     | 单行快捷 → 抽屉详情                |
| **零布局干扰** | 不打断用户浏览心流   | 单行不展开 + 侧边抽屉              |
| **愉悦感**     | 让用户感到"爽"       | 流畅动画、成功庆祝、智能预测       |

---

## 一、整体架构

### 1.1 双模式设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   【极简模式】                    【详情模式】                        │
│                                                                     │
│   ┌─────────────────────┐        ┌──────────────────┐              │
│   │ 单行快速输入框       │   ──▶  │ 右侧滑入抽屉     │              │
│   │ (始终可见)          │        │ (按需打开)        │              │
│   └─────────────────────┘        └──────────────────┘              │
│                                                                     │
│   适用场景：                      适用场景：                         │
│   • 快速收藏一个链接              • 需要选择文件夹                   │
│   • 不需要分类的场景              • 需要添加标签/笔记                │
│   • 80% 的日常使用                • 20% 的详细整理                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 用户旅程地图

```
    复制链接          点击输入框         自动识别          按下回车
       │                 │                │                 │
       ▼                 ▼                ▼                 ▼
   ┌───────┐        ┌───────┐        ┌───────┐        ┌───────┐
   │ 准备  │───────▶│ 聚焦  │───────▶│ 预览  │───────▶│ 完成  │
   └───────┘        └───────┘        └───────┘        └───────┘
       │                 │                │                 │
   用户在其他          自动粘贴         显示标题          成功动画
   网页复制URL        剪贴板内容        智能预览          列表更新

                              │
                              │ 点击设置图标
                              ▼
                         ┌───────┐
                         │ 详情  │ ──▶ 右侧抽屉滑出
                         └───────┘     完整表单选项
```

---

## 二、极简模式设计

### 2.1 状态机

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  【空闲状态】                                                           │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  🔗  粘贴链接，一秒收藏                                         │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│                    │ 点击 / 聚焦                                       │
│                    ▼                                                   │
│                                                                        │
│  【聚焦状态】 - 自动读取剪贴板                                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  🔗  https://mp.weixin.qq.com/s/abc...█                    ⏳   │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│                    │ 元数据获取完成                                     │
│                    ▼                                                   │
│                                                                        │
│  【预览状态】 - 显示智能预览                                            │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  ✨ 从氛围编程到规范驱动开发  ·  架构师修行录      [⚙️] [收藏]  │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│        │ Enter / 点击收藏              │ 点击 ⚙️                       │
│        ▼                               ▼                              │
│                                                                        │
│  【成功状态】                     【详情模式】                          │
│  ┌─────────────────────────┐     右侧抽屉滑出                         │
│  │  ✅ 已收藏！              │                                         │
│  └─────────────────────────┘                                          │
│         │ 1.5s 后自动                                                  │
│         ▼                                                              │
│  【空闲状态】                                                           │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 视觉规格

#### 空闲状态

```css
.quick-add-idle {
  height: 44px;
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.03) 0%,
    rgba(59, 130, 246, 0.03) 100%
  );
  border: 1px dashed rgba(139, 92, 246, 0.2);
  border-radius: 22px; /* 胶囊形状 */
  padding: 0 20px;

  /* 呼吸动画 - 吸引注意力 */
  animation: breathe 3s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    border-color: rgba(139, 92, 246, 0.2);
  }
  50% {
    border-color: rgba(139, 92, 246, 0.4);
  }
}

.quick-add-idle:hover {
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.08) 0%,
    rgba(59, 130, 246, 0.08) 100%
  );
  border-style: solid;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
}
```

#### 聚焦状态

```css
.quick-add-focused {
  height: 44px;
  background: white;
  border: 2px solid #8b5cf6;
  border-radius: 22px;
  box-shadow:
    0 0 0 4px rgba(139, 92, 246, 0.1),
    0 4px 16px rgba(139, 92, 246, 0.2);

  /* 聚焦时的放大效果 */
  transform: scale(1.02);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 加载动画 */
.loading-indicator {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(139, 92, 246, 0.2);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
```

#### 预览状态

```css
.quick-add-preview {
  height: 44px;
  background: linear-gradient(
    135deg,
    rgba(16, 185, 129, 0.05) 0%,
    rgba(139, 92, 246, 0.05) 100%
  );
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 22px;

  /* 成功获取的微光效果 */
  box-shadow:
    0 0 20px rgba(16, 185, 129, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

/* 标题出现动画 */
.preview-title {
  animation: slideInFade 0.3s ease-out;
}

@keyframes slideInFade {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

#### 成功状态

```css
.quick-add-success {
  height: 44px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  border-radius: 22px;
  color: white;

  /* 成功庆祝动画 */
  animation: successPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes successPop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

/* 可选：撒花/粒子效果 */
.confetti-container {
  /* 使用 canvas-confetti 库 */
}
```

### 2.3 交互细节

#### 自动粘贴流程

```typescript
// 点击输入框时的处理逻辑
const handleInputFocus = async () => {
  // 1. 检查剪贴板权限
  const permissionStatus = await navigator.permissions.query({
    name: "clipboard-read",
  });

  if (
    permissionStatus.state === "granted" ||
    permissionStatus.state === "prompt"
  ) {
    try {
      // 2. 读取剪贴板
      const clipboardText = await navigator.clipboard.readText();

      // 3. 智能识别 URL
      const extractedUrl = extractUrlFromText(clipboardText);

      if (extractedUrl) {
        // 4. 自动填充并开始获取元数据
        setInputValue(extractedUrl);
        fetchMetadata(extractedUrl);

        // 5. 显示自动粘贴提示（可选的微反馈）
        showToast("✨ 已自动粘贴链接", { duration: 1500 });
      }
    } catch (err) {
      // 静默失败，用户手动粘贴
    }
  }
};
```

#### 智能预览显示

```typescript
// 预览状态的内容布局
interface PreviewContent {
  icon: "📄" | "🎬" | "📱" | "🎵" | "🛒"; // 根据平台智能显示
  title: string; // 截断到 30 字符
  source: string; // 来源名称
  favicon?: string; // 网站图标
}

// 平台图标映射
const platformIcons = {
  WX_OFFICIAL: "📄",
  BILIBILI: "🎬",
  XIAOHONGSHU: "📱",
  DOUYIN: "🎵",
  TAOBAO: "🛒",
  DEFAULT: "🔗",
};
```

#### 键盘快捷键

```typescript
const keyboardShortcuts = {
  Enter: () => {
    if (hasValidPreview) {
      submitQuickAdd(); // 快速收藏
    }
  },
  Tab: () => {
    openDetailDrawer(); // 打开详情抽屉
  },
  Escape: () => {
    resetToIdle(); // 重置到空闲状态
  },
  "Ctrl+Enter": () => {
    openDetailDrawer(); // 打开详情抽屉
  },
};
```

---

## 三、详情模式设计（右侧抽屉）

### 3.1 抽屉规格

```
┌────────────────────────────────────────────┬────────────────────────┐
│                                            │                        │
│                                            │   ╭──────────────────╮ │
│            主内容区域                        │   │  添加收藏        │ │
│            (保持不变)                        │   │  ──────────────  │ │
│                                            │   │                  │ │
│  ┌────────┐  ┌────────┐  ┌────────┐        │   │  🔗 链接         │ │
│  │  卡片   │  │  卡片   │  │  卡片   │        │   │  https://...    │ │
│  └────────┘  └────────┘  └────────┘        │   │                  │ │
│                                            │   │  📄 标题         │ │
│  ┌────────┐  ┌────────┐  ┌────────┐        │   │  从氛围编程到... │ │
│  │  卡片   │  │  卡片   │  │  卡片   │        │   │                  │ │
│                                            │   │  🏠 来源         │ │
│                                            │   │  架构师修行录    │ │
│                                            │   │                  │ │
│                                            │   │  📁 文件夹       │ │
│                                            │   │  [待整理 ▼]      │ │
│                                            │   │                  │ │
│                                            │   │  🏷️ 标签         │ │
│                                            │   │  [+ 添加标签]    │ │
│                                            │   │                  │ │
│                                            │   │  📝 笔记         │ │
│                                            │   │  [添加笔记...]   │ │
│                                            │   │                  │ │
│                                            │   │  ────────────    │ │
│                                            │   │  [取消] [收藏]   │ │
│                                            │   ╰──────────────────╯ │
│                                            │                        │
└────────────────────────────────────────────┴────────────────────────┘
                      ▲                                  ▲
                      │                                  │
              主内容区域宽度自适应                    抽屉宽度 360px
              (calc(100% - 360px))                  (固定)
```

### 3.2 抽屉动画

```css
/* 抽屉容器 */
.detail-drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: 360px;
  height: 100vh;
  background: white;
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.1);
  z-index: 100;

  /* 滑入动画 */
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

.detail-drawer.open {
  transform: translateX(0);
}

/* 背景遮罩（可选，半透明） */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.1);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.drawer-overlay.visible {
  opacity: 1;
  pointer-events: auto;
}

/* 主内容区域收缩动画 */
.main-content {
  transition: margin-right 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

.main-content.drawer-open {
  margin-right: 360px;
}
```

### 3.3 抽屉内容布局

```typescript
interface DrawerSection {
  id: string;
  title: string;
  icon: string;
  component: React.ReactNode;
  defaultExpanded: boolean;
}

const drawerSections: DrawerSection[] = [
  {
    id: 'link',
    title: '链接',
    icon: '🔗',
    component: <LinkInput />,
    defaultExpanded: true
  },
  {
    id: 'preview',
    title: '预览',
    icon: '👁️',
    component: <MetadataPreview />,
    defaultExpanded: true
  },
  {
    id: 'folder',
    title: '文件夹',
    icon: '📁',
    component: <FolderSelector />,
    defaultExpanded: true
  },
  {
    id: 'tags',
    title: '标签',
    icon: '🏷️',
    component: <TagInput />,
    defaultExpanded: false  // 默认折叠
  },
  {
    id: 'notes',
    title: '笔记',
    icon: '📝',
    component: <NotesTextarea />,
    defaultExpanded: false  // 默认折叠
  }
];
```

### 3.4 智能文件夹推荐

```
┌────────────────────────────────────────┐
│  📁 文件夹                              │
│  ┌──────────────────────────────────┐  │
│  │  待整理                        ▼ │  │
│  └──────────────────────────────────┘  │
│                                        │
│  💡 AI 推荐                            │
│  ┌──────────────────────────────────┐  │
│  │  ⭐ 技术文章  (92% 匹配)           │  │
│  │  这篇文章讨论了软件开发方法论...   │  │
│  └──────────────────────────────────┘  │
│                                        │
│  最近使用                              │
│  ┌────────┐ ┌────────┐ ┌────────┐     │
│  │技术文章 │ │待阅读  │ │ 工具   │     │
│  └────────┘ └────────┘ └────────┘     │
│                                        │
└────────────────────────────────────────┘
```

### 3.5 标签输入优化

```
┌────────────────────────────────────────┐
│  🏷️ 标签                               │
│  ┌──────────────────────────────────┐  │
│  │ AI编程 × │ 规范驱动 × │ + 添加   │  │
│  └──────────────────────────────────┘  │
│                                        │
│  🤖 AI 建议                            │
│  ┌────────┐ ┌────────┐ ┌──────────┐   │
│  │+软件架构│ │+开发流程│ │+最佳实践 │   │
│  └────────┘ └────────┘ └──────────┘   │
│                                        │
│  📊 热门标签                           │
│  ┌────────┐ ┌────────┐ ┌────────┐     │
│  │ 教程   │ │ 工具   │ │ 资源   │     │
│  └────────┘ └────────┘ └────────┘     │
│                                        │
└────────────────────────────────────────┘
```

---

## 四、惊艳细节设计

### 4.1 微交互动画库

#### 链接图标动画

```css
/* 空闲状态的链接图标 */
.link-icon {
  transition: transform 0.2s ease;
}

.quick-add:hover .link-icon {
  animation: linkBounce 0.5s ease;
}

@keyframes linkBounce {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-10deg);
  }
  75% {
    transform: rotate(10deg);
  }
}
```

#### 成功状态动画

```css
/* 成功时的脉冲效果（替代撒花） */
.quick-add-success {
  animation: successPulse 0.5s ease-out;
}

@keyframes successPulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}
```

#### 预览卡片展现动画

```css
/* 元数据加载完成后的展现 */
.preview-card-enter {
  animation: previewReveal 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes previewReveal {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 封面图片渐显 */
.preview-cover {
  animation: fadeIn 0.6s ease 0.2s both;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

### 4.2 智能提示系统

#### 键盘快捷键提示

```
┌────────────────────────────────────────────────────────────────────┐
│  ✨ 从氛围编程到规范驱动开发  ·  架构师修行录      [⚙️] [收藏]    │
└────────────────────────────────────────────────────────────────────┘
                                                          ▲
                                               ┌─────────────────┐
                                               │ ↵ 快速收藏      │
                                               │ Tab 更多选项    │
                                               └─────────────────┘
                                               (首次使用时显示提示)
```

### 4.2.1 首次使用引导教程（Onboarding）

> **触发条件**：用户首次访问首页时自动展示

#### 引导流程设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  步骤 1/3: 高亮快速添加输入框                                             │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│      ┌─────────────────────────────────────────────────────────┐       │
│      │  🔗  粘贴链接，一秒收藏                                 │       │
│      └─────────────────────────────────────────────────────────┘       │
│                              ▲                                          │
│                    ┌─────────┴─────────┐                               │
│                    │  ✨ 一键收藏       │                               │
│                    │                   │                               │
│                    │  复制任意网页链接  │                               │
│                    │  点击这里自动粘贴  │                               │
│                    │  识别并预览内容    │                               │
│                    │                   │                               │
│                    │  [跳过]   [下一步] │                               │
│                    └───────────────────┘                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  步骤 2/3: 模拟预览状态                                                  │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│      ┌─────────────────────────────────────────────────────────┐       │
│      │  ✨ 示例文章标题 · 来源名称                [⚙️] [收藏]  │       │
│      └─────────────────────────────────────────────────────────┘       │
│                                      ▲           ▲                      │
│                    ┌─────────────────┴───────────┴─────────┐           │
│                    │  🎯 快速操作                          │           │
│                    │                                       │           │
│                    │  按 Enter 或点击 [收藏] 快速保存      │           │
│                    │  点击 ⚙️ 可选择文件夹和添加标签       │           │
│                    │                                       │           │
│                    │  [上一步]              [下一步]       │           │
│                    └───────────────────────────────────────┘           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  步骤 3/3: 完成引导                                                      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│                    ┌───────────────────────────────┐                   │
│                    │                               │                   │
│                    │        🎉 准备就绪！          │                   │
│                    │                               │                   │
│                    │   现在就试试粘贴一个链接吧    │                   │
│                    │                               │                   │
│                    │   💡 小技巧：                  │                   │
│                    │   • Tab 键打开详情面板        │                   │
│                    │   • Esc 键取消操作            │                   │
│                    │   • Enter 键快速收藏          │                   │
│                    │                               │                   │
│                    │        [开始使用]             │                   │
│                    └───────────────────────────────┘                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 技术实现

```typescript
// hooks/useOnboarding.ts
interface OnboardingStep {
  id: string;
  target: string; // CSS 选择器
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
  action?: () => void; // 步骤特殊操作
}

const QUICK_ADD_ONBOARDING: OnboardingStep[] = [
  {
    id: "quick-add-intro",
    target: ".quick-add-input",
    title: "✨ 一键收藏",
    description: "复制任意网页链接，点击这里自动粘贴识别并预览内容",
    position: "bottom",
  },
  {
    id: "quick-add-actions",
    target: ".quick-add-preview",
    title: "🎯 快速操作",
    description:
      "按 Enter 或点击 [收藏] 快速保存\n点击 ⚙️ 可选择文件夹和添加标签",
    position: "bottom",
    action: () => {
      // 模拟显示预览状态
      setDemoPreviewVisible(true);
    },
  },
  {
    id: "quick-add-complete",
    target: null, // 居中显示
    title: "🎉 准备就绪！",
    description: "现在就试试粘贴一个链接吧",
    position: "center",
  },
];

// 存储引导完成状态
const ONBOARDING_KEY = "anykeep_onboarding_quick_add_v1";

const useOnboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // 检查是否已完成引导
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      setIsActive(true);
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setIsActive(false);
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  return {
    isActive,
    currentStep,
    totalSteps: QUICK_ADD_ONBOARDING.length,
    step: QUICK_ADD_ONBOARDING[currentStep],
    next: () => {
      if (currentStep < QUICK_ADD_ONBOARDING.length - 1) {
        setCurrentStep((prev) => prev + 1);
      } else {
        completeOnboarding();
      }
    },
    prev: () => setCurrentStep((prev) => Math.max(0, prev - 1)),
    skip: skipOnboarding,
  };
};
```

#### 视觉样式

```css
/* 引导遮罩层 */
.onboarding-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

/* 高亮区域（穿透遮罩） */
.onboarding-spotlight {
  position: absolute;
  background: transparent;
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  transition: all 0.3s ease;
}

/* 提示气泡 */
.onboarding-tooltip {
  position: absolute;
  background: white;
  border-radius: 12px;
  padding: 20px;
  max-width: 320px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);

  animation: tooltipEnter 0.3s ease;
}

@keyframes tooltipEnter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 气泡箭头 */
.onboarding-tooltip::before {
  content: "";
  position: absolute;
  width: 12px;
  height: 12px;
  background: white;
  transform: rotate(45deg);
}

.onboarding-tooltip.position-bottom::before {
  top: -6px;
  left: 50%;
  margin-left: -6px;
}

/* 步骤指示器 */
.onboarding-steps {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-top: 16px;
}

.onboarding-step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e2e8f0;
}

.onboarding-step-dot.active {
  background: #8b5cf6;
  width: 20px;
  border-radius: 4px;
}
```

### 4.3 声音反馈系统

> **设置**：默认关闭，用户可在「设置 → 偏好设置」中开启

```typescript
// 声音反馈系统
interface SoundEffectConfig {
  enabled: boolean; // 默认 false
  volume: number; // 0-1，默认 0.5
}

const soundEffects = {
  focus: "/sounds/focus.mp3", // 轻柔的点击音（~50ms）
  success: "/sounds/success.mp3", // 成功的叮咚声（~200ms）
  error: "/sounds/error.mp3", // 轻柔的提示音（~150ms）
};

// Hook: useSoundEffects
const useSoundEffects = () => {
  const { soundEnabled, soundVolume } = useUserSettings();
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

  const play = useCallback(
    (type: keyof typeof soundEffects) => {
      if (!soundEnabled) return;

      let audio = audioCache.current.get(type);
      if (!audio) {
        audio = new Audio(soundEffects[type]);
        audioCache.current.set(type, audio);
      }

      audio.volume = soundVolume;
      audio.currentTime = 0;
      audio.play().catch(() => {}); // 静默处理自动播放限制
    },
    [soundEnabled, soundVolume],
  );

  return { play };
};

// 使用示例
const { play } = useSoundEffects();
play("success"); // 收藏成功时播放
```

**声音文件要求**：

- 格式：MP3（兼容性最佳）
- 时长：< 500ms
- 大小：< 20KB
- 风格：轻柔、不刺耳

### 4.4 手势支持（移动端）

```typescript
// 移动端手势
const gestureHandlers = {
  // 从右向左滑动打开抽屉
  swipeLeft: () => openDetailDrawer(),

  // 从左向右滑动关闭抽屉
  swipeRight: () => closeDetailDrawer(),

  // 长按输入框显示粘贴选项
  longPress: () => showPasteOptions(),
};
```

---

## 五、完整用户流程

### 5.1 快速收藏流程（80% 场景）

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  步骤 1: 用户在其他网页复制链接                                       │
│  ────────────────────────────────────────────────────────────────   │
│  [浏览器地址栏] Ctrl+C                                               │
│                                                                     │
│          ↓ 切换到 AnyKeep                                           │
│                                                                     │
│  步骤 2: 点击快速添加输入框                                          │
│  ────────────────────────────────────────────────────────────────   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  🔗  粘贴链接，一秒收藏                                     │    │
│  └────────────────────────────────────────────────────────────┘    │
│                    ▲                                                │
│                    │ 点击                                           │
│                    │                                                │
│          ↓ 自动粘贴 + 获取元数据 (0.5-2s)                            │
│                                                                     │
│  步骤 3: 查看预览，按回车确认                                        │
│  ────────────────────────────────────────────────────────────────   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  ✨ 从氛围编程到规范驱动开发  ·  架构师修行录    [⚙️] [收藏] │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                        ▲            │
│                                                  Enter │            │
│                                                        │            │
│          ↓ 提交成功 (< 0.3s)                                         │
│                                                                     │
│  步骤 4: 看到成功反馈                                                │
│  ────────────────────────────────────────────────────────────────   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  ✅ 已收藏到「待整理」！                           [撤销]   │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  + 新书签出现在列表顶部（带高亮动画）                                  │
│  + 可选：撒花庆祝效果                                                │
│                                                                     │
│  总耗时：2-4 秒                                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 详细收藏流程（20% 场景）

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  步骤 1-3: 同快速流程                                                │
│                                                                     │
│  步骤 4: 点击设置图标或按 Tab                                        │
│  ────────────────────────────────────────────────────────────────   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  ✨ 从氛围编程到规范驱动开发  ·  架构师修行录    [⚙️] [收藏] │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                     ▲               │
│                                                     │ 点击 ⚙️       │
│                                                                     │
│          ↓ 右侧抽屉滑出 (0.35s 动画)                                 │
│                                                                     │
│  步骤 5: 在抽屉中编辑详情                                            │
│  ────────────────────────────────────────────────────────────────   │
│  ┌────────────────────────────────┬──────────────────────────┐     │
│  │                                │  添加收藏            ✕   │     │
│  │        主内容区域               │  ───────────────────     │     │
│  │        (向左收缩)               │                          │     │
│  │                                │  📄 从氛围编程到规范...   │     │
│  │                                │  🏠 架构师修行录          │     │
│  │                                │                          │     │
│  │                                │  📁 [技术文章 ▼]  ← 选择  │     │
│  │                                │  🏷️ AI编程, 规范驱动     │     │
│  │                                │  📝 这篇文章很有启发...  │     │
│  │                                │                          │     │
│  │                                │  [取消]       [收藏]     │     │
│  └────────────────────────────────┴──────────────────────────┘     │
│                                                                     │
│          ↓ 点击收藏                                                  │
│                                                                     │
│  步骤 6: 成功反馈 + 抽屉关闭                                         │
│  ────────────────────────────────────────────────────────────────   │
│  + 抽屉向右滑出                                                      │
│  + 主内容区域恢复                                                    │
│  + 新书签出现在列表（带分类标签）                                     │
│  + Toast 提示："已收藏到「技术文章」"                                 │
│                                                                     │
│  总耗时：5-10 秒                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 六、组件架构

### 6.1 文件结构

```
src/components/quick-add/
├── index.tsx                      # 导出入口
├── QuickAddBookmark.tsx           # 主组件（状态机控制器）
│
├── inline/                        # 极简模式组件
│   ├── QuickAddInput.tsx          # 输入框组件
│   ├── QuickAddPreview.tsx        # 预览状态组件
│   ├── QuickAddSuccess.tsx        # 成功状态组件
│   └── QuickAddLoading.tsx        # 加载状态组件
│
├── drawer/                        # 详情模式组件
│   ├── DetailDrawer.tsx           # 抽屉容器
│   ├── DrawerHeader.tsx           # 抽屉头部
│   ├── MetadataPreview.tsx        # 元数据预览卡片
│   ├── FolderSelector.tsx         # 文件夹选择器
│   ├── TagInput.tsx               # 标签输入
│   ├── NotesInput.tsx             # 笔记输入
│   └── DrawerFooter.tsx           # 抽屉底部按钮
│
├── hooks/
│   ├── useQuickAddState.ts        # 状态管理
│   ├── useClipboardPaste.ts       # 剪贴板处理
│   ├── useMetadataFetch.ts        # 元数据获取
│   └── useKeyboardShortcuts.ts    # 键盘快捷键
│
├── animations/
│   ├── transitions.ts             # 过渡动画配置
│   └── pulse.ts                   # 脉冲动画效果
│
├── onboarding/
│   ├── OnboardingProvider.tsx     # 引导上下文
│   ├── OnboardingOverlay.tsx      # 遮罩层组件
│   ├── OnboardingTooltip.tsx      # 提示气泡组件
│   └── useOnboarding.ts           # 引导状态管理
│
├── sounds/
│   ├── useSoundEffects.ts         # 声音反馈 Hook
│   └── assets/                    # 音效文件
│       ├── focus.mp3
│       ├── success.mp3
│       └── error.mp3
│
└── styles/
    └── quick-add.css              # 样式文件
```

### 6.2 状态管理

```typescript
// useQuickAddState.ts
type QuickAddMode =
  | "idle"
  | "focused"
  | "loading"
  | "preview"
  | "success"
  | "error";
type DetailDrawerState = "closed" | "opening" | "open" | "closing";

interface QuickAddState {
  // 模式状态
  mode: QuickAddMode;
  drawerState: DetailDrawerState;

  // 输入数据
  inputValue: string;
  extractedUrl: string | null;

  // 元数据
  metadata: BookmarkMetadata | null;
  metadataError: string | null;

  // 表单数据（抽屉使用）
  folderId: number | null;
  tags: string[];
  notes: string;

  // UI 状态
  isSubmitting: boolean;
  showKeyboardHints: boolean;
}

// 状态机转换
const stateTransitions: Record<QuickAddMode, QuickAddMode[]> = {
  idle: ["focused"],
  focused: ["idle", "loading"],
  loading: ["preview", "error", "idle"],
  preview: ["success", "idle", "loading"],
  success: ["idle"],
  error: ["idle", "focused"],
};
```

---

## 七、实现计划（并行开发）

> **开发策略**：极简模式和详情抽屉同时开发，最大化开发效率

### 并行任务分配

```
Week 1
├── 【任务线 A】极简模式
│   ├── Day 1-2: 核心组件 + 状态机
│   └── Day 3: 交互优化 + 动画
│
└── 【任务线 B】详情抽屉
    ├── Day 1-2: 抽屉容器 + 动画
    └── Day 3: 表单集成

Week 2
├── 【合并】集成测试 + Bug 修复
├── 【新增】首次引导教程
└── 【新增】声音反馈系统
```

### 详细任务清单

#### Phase 1: 核心组件（并行，4h × 2）

**任务线 A - 极简模式**

- [ ] QuickAddBookmark 主组件和状态机
- [ ] QuickAddInput 输入框组件
- [ ] 剪贴板自动粘贴功能
- [ ] 元数据获取集成
- [ ] QuickAddPreview 预览组件
- [ ] QuickAddSuccess 成功组件

**任务线 B - 详情抽屉**

- [ ] DetailDrawer 抽屉容器
- [ ] 滑入/滑出动画
- [ ] DrawerHeader 头部组件
- [ ] FolderSelector 文件夹选择器
- [ ] TagInput 标签输入
- [ ] NotesInput 笔记输入

#### Phase 2: 交互完善（3h）

- [ ] 键盘快捷键支持（Enter/Tab/Escape）
- [ ] 抽屉与主内容区域联动
- [ ] 基础动画效果
- [ ] 错误状态处理

#### Phase 3: 惊艳细节（4h）

- [ ] 首次使用引导教程（3步骤）
- [ ] 声音反馈系统（默认关闭）
- [ ] 微交互动画优化
- [ ] 智能文件夹推荐 UI

#### Phase 4: 集成与测试（3h）

- [ ] 集成到首页布局
- [ ] 响应式适配测试
- [ ] 功能测试 & Bug 修复
- [ ] 性能优化

**总预计工时**: 18 小时

### 里程碑

| 里程碑 | 目标                     | 预计完成 |
| ------ | ------------------------ | -------- |
| M1     | 极简模式可用（快速收藏） | Day 3    |
| M2     | 详情抽屉可用（完整表单） | Day 3    |
| M3     | 两者集成联动             | Day 4    |
| M4     | 首次引导 + 声音反馈      | Day 5    |
| M5     | 测试完成，可发布         | Day 6    |

---

## 八、设计决策确认

| 决策项       | 结果      | 说明                           |
| ------------ | --------- | ------------------------------ |
| **撒花效果** | ❌ 不启用 | 使用脉冲动画替代，更加克制     |
| **声音反馈** | ✅ 启用   | 默认关闭，用户可在设置中开启   |
| **首次引导** | ✅ 启用   | 3 步引导教程，首次访问自动展示 |
| **开发策略** | 并行开发  | 极简模式和详情抽屉同时开发     |

---

## 九、设计验收标准

### 功能验收

- [ ] 点击输入框自动粘贴剪贴板 URL
- [ ] 元数据获取成功显示预览
- [ ] Enter 快速收藏到「待整理」
- [ ] Tab 或 ⚙️ 打开详情抽屉
- [ ] 抽屉中可选择文件夹/标签/笔记
- [ ] Escape 取消并重置
- [ ] 首次使用展示引导教程

### 体验验收

- [ ] 从复制到收藏完成 < 4 秒
- [ ] 动画流畅无卡顿（60fps）
- [ ] 状态切换有明确的视觉反馈
- [ ] 成功时有脉冲动画反馈
- [ ] 错误时有清晰的提示和恢复路径
- [ ] 声音反馈可开关且不刺耳

### 技术验收

- [ ] 复用现有 API 和验证逻辑
- [ ] 触发 bookmarkCreated 事件
- [ ] 主内容布局无跳动
- [ ] 移动端基础可用
- [ ] 引导状态持久化存储

---

## 附录：视觉效果预览

### A. 完整交互流程图

```
     ┌─────────────────────────────────────────────────────────────┐
     │                        AnyKeep                              │
     ├─────────────────────────────────────────────────────────────┤
     │                                                             │
 ①   │  ┌───────────────────────────────────────────────────────┐  │
空闲  │  │  🔗  粘贴链接，一秒收藏                               │  │
     │  └───────────────────────────────────────────────────────┘  │
     │                                                             │
     │                    │ 点击                                   │
     │                    ▼                                        │
     │                                                             │
 ②   │  ┌───────────────────────────────────────────────────────┐  │
聚焦  │  │  🔗  https://mp.weixin.qq.com/s/abc...█           ⏳  │  │
     │  └───────────────────────────────────────────────────────┘  │
     │                                                             │
     │                    │ 加载完成                                │
     │                    ▼                                        │
     │                                                             │
 ③   │  ┌───────────────────────────────────────────────────────┐  │
预览  │  │  ✨ 从氛围编程到规范驱动开发 · 架构师修行录  [⚙️][收藏]│  │
     │  └───────────────────────────────────────────────────────┘  │
     │                                                             │
     │        │ Enter                    │ 点击 ⚙️                 │
     │        ▼                          ▼                         │
     │                                                             │
 ④   │  ┌─────────────────┐    ┌────────────────────────────────┐ │
成功  │  │ ✅ 已收藏！[撤销]│    │         右侧抽屉               │ │
     │  └─────────────────┘    │  ┌────────────────────────┐    │ │
     │        + 💫 脉冲动画      │  │ 详细表单...            │    │ │
     │                          │  └────────────────────────┘    │ │
     │                          └────────────────────────────────┘ │
     │                                                             │
     └─────────────────────────────────────────────────────────────┘
```

### B. 颜色系统

| 状态 | 主色           | 背景     | 边框   |
| ---- | -------------- | -------- | ------ |
| 空闲 | `#8b5cf6` (紫) | 渐变透明 | 虚线紫 |
| 聚焦 | `#8b5cf6` (紫) | 白色     | 实线紫 |
| 预览 | `#10b981` (绿) | 渐变透明 | 实线绿 |
| 成功 | `#ffffff` (白) | 渐变绿   | 无     |
| 错误 | `#ef4444` (红) | 渐变透明 | 实线红 |

---

**文档结束** | 等待审核反馈
