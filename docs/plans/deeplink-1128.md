# Deep Link 能力详解

**创建日期**: 2025-11-28
**相关功能**: F4.2 Deep Link 生成
**优先支持平台**: 微信公众号

---

## 一、Deep Link 基本概念

**Deep Link（深度链接）** 是一种能够直接跳转到 App 内特定页面的链接技术，而非仅打开 App 首页。

```
普通链接:  https://example.com          → 打开网站首页
Deep Link: example://article/12345      → 直接打开 App 内的第 12345 篇文章
```

---

## 二、Deep Link 三种实现方式

| 类型                      | 格式示例                       | 优点                   | 缺点                                |
| :------------------------ | :----------------------------- | :--------------------- | :---------------------------------- |
| **URI Scheme**            | `weixin://` `bilibili://`      | 实现简单、兼容性好     | 无法判断 App 是否安装，可能弹错误   |
| **Universal Links (iOS)** | `https://mp.weixin.qq.com/...` | 无需特殊协议，体验流畅 | 需要 App 开发者配置，第三方无法使用 |
| **App Links (Android)**   | `https://mp.weixin.qq.com/...` | 同上                   | 同上                                |

---

## 三、Deep Link 在 AnyKeep 中的能力

```
用户收藏了一篇微信公众号文章
         ↓
AnyKeep 存储原始 URL + 解析的平台信息
         ↓
用户点击「打开原 App」按钮
         ↓
┌─────────────────────────────────────────┐
│  Deep Link 能力                          │
├─────────────────────────────────────────┤
│  ✅ 唤起目标 App（如微信）                │
│  ✅ 跳转到具体内容页面（如某篇文章）       │
│  ✅ 未安装 App 时降级到浏览器打开          │
│  ✅ 记录跳转成功率用于优化                 │
└─────────────────────────────────────────┘
```

---

## 四、微信公众号 Deep Link 的特殊性

### 4.1 微信的限制

微信是**封闭生态**，Deep Link 能力受限较大：

| 场景                 | 可行性    | 说明                      |
| :------------------- | :-------- | :------------------------ |
| 从外部 App 唤起微信  | ✅ 可行   | `weixin://` Scheme 可用   |
| 跳转到指定公众号文章 | ❌ 不可行 | 微信不支持直接跳转文章页  |
| 跳转到公众号主页     | ⚠️ 有限   | 需要公众号的 `__biz` 参数 |
| 在微信内打开链接     | ✅ 可行   | 通过剪贴板 + 提示用户操作 |

### 4.2 微信公众号的解决方案

**方案 A: 直接浏览器打开（推荐）**

```
┌─────────────────────────────────────────┐
│  点击「打开原文」                         │
│         ↓                               │
│  在系统浏览器中打开原始 URL               │
│         ↓                               │
│  用户可选择「在微信中打开」               │
└─────────────────────────────────────────┘
```

**方案 B: 剪贴板 + 引导**

```
┌─────────────────────────────────────────┐
│  点击「在微信中打开」                     │
│         ↓                               │
│  复制链接到剪贴板                         │
│         ↓                               │
│  唤起微信 App (weixin://)                │
│         ↓                               │
│  提示用户：「链接已复制，请粘贴到微信打开」│
└─────────────────────────────────────────┘
```

**方案 C: 微信内置浏览器（仅限微信小程序）**

```
┌─────────────────────────────────────────┐
│  如果 AnyKeep 有小程序版本               │
│         ↓                               │
│  可通过 web-view 组件直接打开公众号文章   │
└─────────────────────────────────────────┘
```

---

## 五、各平台 Deep Link 能力对比

| 平台           | URI Scheme                    | 跳转文章/视频 | 可行性        |
| :------------- | :---------------------------- | :------------ | :------------ |
| **微信公众号** | `weixin://`                   | ❌ 不支持     | ⚠️ 需降级方案 |
| **B 站**       | `bilibili://video/{bvid}`     | ✅ 支持       | ✅ 推荐       |
| **小红书**     | `xhsdiscover://item/{id}`     | ✅ 支持       | ✅ 推荐       |
| **知乎**       | `zhihu://answers/{id}`        | ✅ 支持       | ✅ 推荐       |
| **抖音**       | `snssdk1128://detail/{id}`    | ✅ 支持       | ✅ 推荐       |
| **微博**       | `sinaweibo://detail?mblogid=` | ✅ 支持       | ✅ 可行       |

---

## 六、针对微信公众号的实现建议

考虑到微信的封闭性，建议采用**分层策略**：

```typescript
// 伪代码示意
function openBookmark(bookmark: Bookmark) {
  const { platform, originalUrl } = bookmark;

  if (platform === "WECHAT") {
    // 微信公众号特殊处理
    return openWechatArticle(originalUrl);
  }

  // 其他平台尝试 Deep Link
  const deepLink = generateDeepLink(platform, bookmark);
  if (deepLink && (await canOpenUrl(deepLink))) {
    await openUrl(deepLink);
  } else {
    // 降级到浏览器
    await openInBrowser(originalUrl);
  }
}

async function openWechatArticle(url: string) {
  // 方案 A: 直接浏览器打开（最可靠）
  const choice = await showActionSheet([
    "在浏览器中打开",
    "复制链接并打开微信",
  ]);

  if (choice === 0) {
    await openInBrowser(url);
  } else {
    // 方案 B: 剪贴板 + 唤起微信
    await copyToClipboard(url);
    await openUrl("weixin://");
    showToast("链接已复制，请在微信中粘贴打开");
  }
}
```

---

## 七、实现计划建议

鉴于微信公众号的限制，建议按以下优先级实现：

| 优先级 | 平台           | 实现方式                |
| :----- | :------------- | :---------------------- |
| P0     | **微信公众号** | 浏览器打开 + 剪贴板引导 |
| P1     | B 站           | 标准 Deep Link          |
| P1     | 小红书         | 标准 Deep Link          |
| P2     | 知乎/抖音      | 标准 Deep Link          |

---

## 八、待确认事项

1. **微信方案选择**：是否采用「浏览器打开 + 剪贴板引导」双选项方案？
2. **用户体验优先级**：微信用户是否接受「复制链接 → 打开微信 → 粘贴」的操作流程？
3. **是否考虑小程序**：未来是否计划开发 AnyKeep 微信小程序以获得更好的微信生态集成？

---

## 九、技术实现要点

### 9.1 平台检测

```typescript
// 根据 URL 识别平台
function detectPlatform(url: string): Platform {
  if (url.includes("mp.weixin.qq.com")) return "WECHAT";
  if (url.includes("bilibili.com") || url.includes("b23.tv")) return "BILIBILI";
  if (url.includes("xiaohongshu.com") || url.includes("xhslink.com"))
    return "XIAOHONGSHU";
  if (url.includes("zhihu.com")) return "ZHIHU";
  if (url.includes("douyin.com")) return "DOUYIN";
  return "UNKNOWN";
}
```

### 9.2 Deep Link 生成

```typescript
// 生成各平台 Deep Link
function generateDeepLink(
  platform: Platform,
  metadata: Metadata,
): string | null {
  switch (platform) {
    case "BILIBILI":
      // 从 URL 或元数据中提取 BV 号
      const bvid = extractBvid(metadata.originalUrl);
      return bvid ? `bilibili://video/${bvid}` : null;

    case "XIAOHONGSHU":
      const noteId = extractNoteId(metadata.originalUrl);
      return noteId ? `xhsdiscover://item/${noteId}` : null;

    case "ZHIHU":
      const answerId = extractAnswerId(metadata.originalUrl);
      return answerId ? `zhihu://answers/${answerId}` : null;

    case "WECHAT":
      // 微信不支持直接跳转文章，返回 null
      return null;

    default:
      return null;
  }
}
```

### 9.3 Capacitor 集成

```typescript
// 使用 Capacitor 打开链接
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";

async function openDeepLink(deepLink: string, fallbackUrl: string) {
  try {
    // 尝试打开 Deep Link
    await App.openUrl({ url: deepLink });
  } catch (error) {
    // 失败时降级到浏览器
    await Browser.open({ url: fallbackUrl });
  }
}
```

---

## 十、参考资料

- [iOS Universal Links 官方文档](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)
- [Android App Links 官方文档](https://developer.android.com/training/app-links)
- [Capacitor App Plugin](https://capacitorjs.com/docs/apis/app)
- [Capacitor Browser Plugin](https://capacitorjs.com/docs/apis/browser)
