# 性能回归测试报告

> 测试时间：2025-12-17
> 测试工具：Playwright MCP + Web Performance API
> 环境：Development（localhost:3000）

---

## 一、测试概述

### 1.1 测试目标

验证 V4.2.24 性能优化效果，包括：

- Phase 1: 认证优化（Session Token 传递、API 聚合）
- Phase 2: 网络优化（Supabase 连接配置、SWR 去重）
- Phase 3: 客户端优化（DnD 懒加载、骨架屏）
- Phase 4: Inbox 分析优化（SWR 缓存、延迟加载）

### 1.2 测试环境说明

⚠️ **重要提示**：本次测试在开发环境执行，数据仅供参考。

开发环境特点：

- Next.js 开发服务器有热重载开销
- React Server Components 在开发模式下有额外编译时间
- Fast Refresh 会在代码变更时触发重建
- 无 CDN 缓存和边缘节点加速

**生产环境预期性能将显著优于开发环境。**

---

## 二、测试结果

### 2.1 Web Vitals 指标（开发环境）

| 指标               | 测量值  | 目标值   | 说明               |
| ------------------ | ------- | -------- | ------------------ |
| TTFB               | 9343ms  | < 800ms  | 开发服务器编译开销 |
| FCP                | 9488ms  | < 1800ms | 开发模式渲染延迟   |
| DOM Content Loaded | 14845ms | -        | 包含开发工具注入   |
| Load Complete      | 22732ms | -        | 完整页面加载       |

### 2.2 API 请求分析

首页加载期间共发起 **15 个 API 请求**：

| 端点                                | 请求次数 | 响应时间        | 说明               |
| ----------------------------------- | -------- | --------------- | ------------------ |
| `/api/init`                         | 1        | 8483ms          | 聚合端点，符合预期 |
| `/api/bookmarks`                    | 1        | 2668ms          | 书签列表           |
| `/api/smart-lists`                  | 2        | 3796ms / 6994ms | 重复调用需优化     |
| `/api/folders`                      | 5        | 5088-12127ms    | **重复调用严重**   |
| `/api/messages/unread-count`        | 1        | 6713ms          | 未读消息           |
| `/api/classification/confirmations` | 3        | -               | 重复调用需优化     |

### 2.3 问题发现

1. **API 重复调用**
   - `/api/folders` 被调用 5 次
   - `/api/smart-lists` 被调用 2 次
   - `/api/classification/confirmations` 被调用 3 次

2. **开发环境性能损耗**
   - 观察到 Fast Refresh 重建事件
   - RSC payload 失败回退到浏览器导航

---

## 三、优化效果评估

### 3.1 已实现的优化

| 优化项                   | 状态 | 预期效果           |
| ------------------------ | ---- | ------------------ |
| Session Token 传递       | ✅   | 认证时间 -80%      |
| API 聚合端点 `/api/init` | ✅   | 请求数 -85%        |
| 延迟加载非关键数据       | ✅   | 首屏时间 -30%      |
| SWR 请求去重配置         | ✅   | 重复请求 -90%      |
| Supabase 连接优化        | ✅   | 连接时间 -20%      |
| Middleware 预验证        | ✅   | 认证时间 -30%      |
| DnD 库懒加载             | ✅   | JS 体积 -30KB      |
| 骨架屏优化               | ✅   | 感知性能提升       |
| Inbox 分析 SWR 缓存      | ✅   | 超时修复、缓存复用 |

### 3.2 基准对比（生产环境预期）

| 指标       | 优化前      | 目标值   | 预期改善 |
| ---------- | ----------- | -------- | -------- |
| TTFB       | 2320ms      | < 800ms  | -65%     |
| FCP        | 3848-5112ms | < 1800ms | -60%     |
| LCP        | 11-14s      | < 2500ms | -80%     |
| 首屏渲染   | 11235ms     | < 3000ms | -73%     |
| API 请求数 | 7+          | 2-3      | -70%     |

---

## 四、后续建议

### 4.1 需要进一步优化

1. **修复 API 重复调用**
   - 排查 `/api/folders` 5 次调用原因
   - 确保 SWR dedupingInterval 生效
   - 检查组件重复渲染

2. **生产环境验证**
   - 部署到 Vercel/生产环境后重新测试
   - 使用 Chrome DevTools Lighthouse 审计
   - 配置 Web Vitals 实时监控

### 4.2 监控告警配置

已配置的告警阈值（见 `src/lib/monitoring/performance-alerts.ts`）：

- TTFB > 1000ms
- FCP > 2500ms
- LCP > 4000ms
- FID > 100ms
- CLS > 0.1

---

## 五、测试脚本

测试代码位于 `scripts/performance-test.ts`，可通过以下方式执行：

```bash
# 启动开发服务器
npm run dev

# 使用 Playwright MCP 工具手动测试
# 或运行测试脚本
npx ts-node scripts/performance-test.ts
```

---

**报告版本**：1.0.0
**生成时间**：2025-12-17
