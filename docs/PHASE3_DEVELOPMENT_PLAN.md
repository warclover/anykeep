# AnyKeep Phase 3 开发计划

**文档版本**: 1.0
**创建日期**: 2025-11-25
**基于文档**: PRD v4.1
**当前阶段**: Phase 3 - MVP 核心功能完善

---

## 📊 PRD v4.1 对标分析

### P0 功能完成度对比

| # | PRD 要求功能 | 优先级 | 当前状态 | 完成度 | 差距分析 |
|---|-------------|--------|----------|--------|---------|
| 1 | **浏览器扩展** | ⭐⭐⭐⭐⭐ | 60% | 🟡 进行中 | 缺少右键菜单、快捷键、书签导入 |
| 2 | **移动端 PWA** | ⭐⭐⭐⭐⭐ | 30% | 🟠 需加速 | 缺少 Capacitor 打包、系统分享 |
| 3 | **AI 自动分类** | ⭐⭐⭐⭐⭐ | 80% | 🟢 基本完成 | 文件夹推荐已实现 |
| 4 | **视觉化展示** | ⭐⭐⭐⭐⭐ | 100% | ✅ 完成 | 瀑布流/列表/紧凑三视图 |
| 5 | 微信一键保存 | ⭐⭐⭐⭐⭐ | 100% | ✅ 完成 | 爬虫 + 图片代理 |
| 6 | AI 摘要标签 | ⭐⭐⭐⭐⭐ | 100% | ✅ 完成 | DeepSeek 集成 |
| 7 | 全文搜索 | ⭐⭐⭐⭐ | 100% | ✅ 完成 | PostgreSQL FTS |
| 8 | 批量导入/导出 | ⭐⭐⭐⭐ | 100% | ✅ 完成 | JSON/Markdown |

**P0 整体完成度**: **77%** (7/9 完全完成)

---

### 关键差距 (Must Fix)

#### 1. 🔴 浏览器扩展 (差距 40%)

**已完成**:
- ✅ 一键收藏 Popup
- ✅ 平台检测 (微信/B站/小红书)
- ✅ 认证集成
- ✅ WXT 框架 + React UI

**待完成 (PRD 要求)**:
| 功能 | PRD 描述 | 优先级 | 预计工时 |
|------|----------|--------|---------|
| 右键菜单 | 选中文本/图片快速收藏 | P0 | 4h |
| 快捷键 | Ctrl+Shift+S 快速保存 | P0 | 2h |
| 书签导入 | 浏览器书签批量导入 | P0 | 8h |
| 保存动画 | 轻快的成功提示 | P0 | 2h |

#### 2. 🔴 移动端 PWA (差距 70%)

**已完成**:
- ✅ PWA 清单配置
- ✅ 响应式设计
- ✅ 移动端导航栏

**待完成 (PRD 要求)**:
| 功能 | PRD 描述 | 优先级 | 预计工时 |
|------|----------|--------|---------|
| Capacitor 打包 | iOS/Android 双平台 | P0 | 16h |
| 系统分享菜单 | 从其他 App 分享到 AnyKeep | P0 | 8h |
| 离线支持 | Service Worker 缓存 | P0 | 8h |
| 添加到主屏幕 | iOS/Android 引导 | P0 | 4h |

---

## 🎯 Phase 3 开发计划 (Week 3-5)

### Week 3: 浏览器扩展完善 (本周)

**目标**: 完成浏览器扩展 P0 所有功能

| 日期 | 任务 | 预计工时 | 验收标准 |
|------|------|---------|---------|
| Day 1 | 右键菜单快速收藏 | 4h | 选中文本/链接可通过右键保存 |
| Day 1 | 快捷键支持 | 2h | Ctrl+Shift+S 触发保存 |
| Day 2 | 书签导入功能 | 8h | 支持导入浏览器书签 |
| Day 3 | 保存成功动画 | 2h | 轻快的弹跳动画反馈 |
| Day 3 | 测试 & Bug 修复 | 4h | Chrome/Edge 兼容性测试 |
| Day 4 | Chrome Web Store 准备 | 4h | 截图、描述、隐私政策 |

**Week 3 交付物**:
- [ ] 浏览器扩展 v1.0 发布包
- [ ] Chrome Web Store 上架申请
- [ ] 使用文档

---

### Week 4: 移动端 Capacitor 打包

**目标**: 完成 iOS/Android 双平台打包

| 日期 | 任务 | 预计工时 | 验收标准 |
|------|------|---------|---------|
| Day 1 | Capacitor 初始化 | 4h | 项目配置完成 |
| Day 1-2 | iOS 平台配置 | 8h | Xcode 构建成功 |
| Day 2-3 | Android 平台配置 | 8h | Android Studio 构建成功 |
| Day 3 | 系统分享菜单集成 | 8h | 从微信分享到 AnyKeep |
| Day 4 | 离线支持 | 8h | 离线浏览已缓存内容 |
| Day 5 | 测试 & 调试 | 8h | 真机测试 |

**Week 4 交付物**:
- [ ] iOS TestFlight 版本
- [ ] Android APK 测试版
- [ ] 系统分享功能可用

---

### Week 5: 测试框架 & 质量保障

**目标**: 建立单元测试框架，覆盖核心功能

| 日期 | 任务 | 预计工时 | 验收标准 |
|------|------|---------|---------|
| Day 1 | Vitest 配置 | 4h | 测试框架运行正常 |
| Day 1-2 | API 路由测试 | 8h | 80%+ 覆盖率 |
| Day 2-3 | Hooks 测试 | 8h | 90%+ 覆盖率 |
| Day 3-4 | 组件测试 | 8h | 60%+ 覆盖率 |
| Day 4 | CI/CD 集成 | 4h | PR 自动测试 |
| Day 5 | 错误监控 (Sentry) | 4h | 生产环境错误追踪 |

**Week 5 交付物**:
- [ ] 测试覆盖率报告
- [ ] CI/CD 流水线
- [ ] Sentry 错误监控

---

## 📋 详细任务清单

### 浏览器扩展任务 (Week 3)

```typescript
// browser-extension/entrypoints/background.ts
// 需要添加的功能

// 1. 右键菜单
browser.contextMenus.create({
  id: 'save-to-anykeep',
  title: '保存到 AnyKeep',
  contexts: ['selection', 'link', 'image', 'page']
})

// 2. 快捷键监听
browser.commands.onCommand.addListener((command) => {
  if (command === 'save-page') {
    // 触发保存
  }
})

// 3. 书签导入
async function importBookmarks() {
  const bookmarks = await browser.bookmarks.getTree()
  // 批量导入逻辑
}
```

### Capacitor 配置任务 (Week 4)

```bash
# 安装依赖
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android

# 初始化
npx cap init AnyKeep com.anykeep.app

# 添加平台
npx cap add ios
npx cap add android

# 安装插件
npm install @capacitor/share  # 系统分享
npm install @capacitor/browser # 外部链接
npm install @capacitor/storage # 本地存储
```

---

## 🚀 成功指标 (PRD v4.1)

### Phase 3 结束时目标

| 指标 | 目标值 | 当前值 | 差距 |
|------|--------|--------|------|
| 种子用户 | 10-20 人 | 0 | 需推广 |
| 日活跃用户 | > 5 人 | 0 | 需推广 |
| 7 天留存率 | > 40% | N/A | 待测量 |
| AI 分类准确率 | > 70% | ~75% | ✅ 达标 |
| P0 功能完成度 | 100% | 77% | 23% |

### 验收标准

**浏览器扩展** (PRD 要求):
- [ ] 用户点击扩展图标，当前页面自动保存
- [ ] 支持 Chrome/Edge 浏览器
- [ ] 保存成功后显示轻快动画
- [ ] 与 Web 端数据同步

**移动端 PWA** (PRD 要求):
- [ ] 用户可添加到主屏幕
- [ ] 支持系统分享菜单保存
- [ ] 移动端响应式布局
- [ ] 基础离线功能

---

## ⚠️ 风险与应对

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|---------|
| Chrome 审核延迟 | 中 | 高 | 提前准备，并行推 Edge |
| Capacitor iOS 配置复杂 | 高 | 中 | 预留额外时间，参考官方文档 |
| 系统分享菜单兼容性 | 中 | 高 | 分平台测试，降级方案 |
| 测试覆盖不足 | 低 | 中 | 优先覆盖核心路径 |

---

## 📝 决策记录

### 已确认的战略方向 (PRD v4.1)

**必须做**:
1. ✅ 中国平台护城河 (微信/B站/小红书)
2. ✅ 零心理负担 (瀑布流设计)
3. ⏳ 视频 X-Ray (P1，暂缓)
4. ✅ 视觉优先 (MyMind 级别颜值)

**不要做**:
1. ❌ 知识图谱
2. ❌ 学习复习 (闪卡)
3. ❌ 团队协作

---

## 🔄 下一步行动

### 立即行动 (今天)

1. **启动浏览器扩展完善**
   - 启用右键菜单代码
   - 添加快捷键配置

2. **准备 Capacitor 环境**
   - 安装 Xcode (macOS)
   - 安装 Android Studio

### 本周目标

- [ ] 浏览器扩展 v1.0 完成
- [ ] Chrome Web Store 提交
- [ ] Capacitor 项目初始化

---

**文档维护**: 每周更新进度
**下次更新**: Week 3 结束时
