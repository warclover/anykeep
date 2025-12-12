# 微信视频号收藏技术实现方案

**创建日期**: 2025-11-24  
**问题描述**: 微信视频号只能分享给好友或朋友圈，没有公开链接地址  
**目标**: 实现微信视频号内容的收藏功能

---

## 📋 问题分析

### 1.1 微信视频号的技术限制

**核心问题**：

- ❌ 没有公开的 URL 链接
- ❌ 无法通过浏览器直接访问
- ❌ 只能在微信内播放
- ❌ 分享功能受限（只能分享给好友/朋友圈）

**技术挑战**：

1. 无法通过 URL 爬取内容
2. 无法获取视频的直接链接
3. 无法通过 API 获取视频信息
4. 需要依赖微信生态内的方案

---

## 🎯 技术方案对比

### 方案一：系统分享菜单 + 元数据提取 ⭐⭐⭐⭐⭐（推荐）

**原理**：

- 利用 iOS/Android 系统分享菜单
- 微信分享时会携带视频元数据
- 通过分享扩展接收元数据

**实现步骤**：

#### iOS 实现

```typescript
// iOS Share Extension
import ShareExtension from "react-native-share-extension";

// 接收分享内容
const handleShare = async (items: ShareItem[]) => {
  for (const item of items) {
    // 1. 获取分享类型
    if (item.type === "public.url") {
      // 微信视频号可能包含内部 URL
      const url = item.url;
      // 解析视频号信息
      const videoInfo = parseWechatVideoUrl(url);
    }

    // 2. 获取分享文本
    if (item.type === "public.text") {
      const text = item.text;
      // 解析视频标题、作者等信息
      const metadata = parseWechatVideoText(text);
    }

    // 3. 获取分享图片（视频封面）
    if (item.type === "public.image") {
      const image = item.image;
      // 保存为封面图
    }
  }
};
```

**优点**：

- ✅ 用户体验好（一键分享）
- ✅ 可以获取部分元数据
- ✅ 符合系统规范

**缺点**：

- ⚠️ 微信可能不提供完整元数据
- ⚠️ 需要开发原生扩展
- ⚠️ iOS 和 Android 实现不同

---

#### Android 实现

```typescript
// Android Share Intent
import { Share } from "react-native";

const handleShareIntent = async (intent: Intent) => {
  // 1. 获取分享类型
  const type = intent.getType();

  // 2. 获取分享文本
  const text = intent.getStringExtra(Intent.EXTRA_TEXT);
  // 解析：可能包含视频标题、作者、描述

  // 3. 获取分享图片
  const imageUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);

  // 4. 解析微信视频号信息
  const videoInfo = parseWechatVideoShare(text, imageUri);
};
```

**解析函数示例**：

```typescript
function parseWechatVideoShare(text: string, imageUri: string) {
  // 微信分享文本格式示例：
  // "【视频标题】\n@作者名称\n#话题标签"

  const lines = text.split("\n");
  const title = lines[0]?.replace(/【|】/g, "") || "未知标题";
  const author = lines[1]?.replace("@", "") || "未知作者";
  const tags = lines.slice(2).filter((line) => line.startsWith("#"));

  return {
    title,
    author,
    tags,
    coverUrl: imageUri,
    platform: "WECHAT_VIDEO",
    // 注意：没有视频 URL
    videoUrl: null,
  };
}
```

---

### 方案二：录屏 + 元数据手动输入 ⭐⭐⭐⭐

**原理**：

- 用户录屏视频号内容
- 通过系统分享菜单分享录屏文件
- 手动输入视频信息（或 OCR 识别）

**实现步骤**：

```typescript
// 处理录屏文件分享
const handleScreenRecord = async (videoFile: File) => {
  // 1. 上传录屏视频到 Supabase Storage
  const videoUrl = await uploadVideo(videoFile);

  // 2. 提取视频帧作为封面
  const coverImage = await extractVideoFrame(videoFile, 0);

  // 3. 显示输入表单
  const metadata = await showMetadataInputForm({
    title: "", // 用户输入
    author: "", // 用户输入
    description: "", // 用户输入（可选）
    tags: [], // 用户输入（可选）
  });

  // 4. 创建收藏记录
  const bookmark = await createBookmark({
    ...metadata,
    videoUrl,
    coverUrl: coverImage,
    platform: "WECHAT_VIDEO",
    contentType: "VIDEO",
  });

  // 5. AI 生成摘要和标签（基于用户输入）
  if (metadata.description) {
    const aiResult = await generateAIContent({
      title: metadata.title,
      description: metadata.description,
    });
    // 更新收藏记录
  }
};
```

**优点**：

- ✅ 可以保存完整视频内容
- ✅ 用户控制信息输入
- ✅ 不依赖微信 API

**缺点**：

- ⚠️ 需要用户手动输入信息
- ⚠️ 录屏文件较大（存储成本）
- ⚠️ 用户体验稍差

---

### 方案三：截图 + OCR 识别 ⭐⭐⭐

**原理**：

- 用户截图视频号页面
- 通过 OCR 识别视频标题、作者等信息
- 通过系统分享菜单分享截图

**实现步骤**：

```typescript
// 处理截图分享
const handleScreenshot = async (imageFile: File) => {
  // 1. 上传截图到 Supabase Storage
  const imageUrl = await uploadImage(imageFile);

  // 2. OCR 识别文字
  const ocrResult = await performOCR(imageFile);
  // 使用 Tesseract.js 或云端 OCR API

  // 3. 解析识别结果
  const metadata = parseOCRResult(ocrResult);
  // {
  //   title: '视频标题',
  //   author: '作者名称',
  //   description: '视频描述',
  // }

  // 4. 创建收藏记录
  const bookmark = await createBookmark({
    ...metadata,
    coverUrl: imageUrl,
    platform: "WECHAT_VIDEO",
    contentType: "IMAGE", // 或 VIDEO（如果后续能获取视频）
  });

  // 5. AI 生成摘要和标签
  const aiResult = await generateAIContent({
    title: metadata.title,
    description: metadata.description,
  });
};
```

**OCR 实现**：

```typescript
// 使用 Tesseract.js（客户端）
import Tesseract from "tesseract.js";

async function performOCR(imageFile: File) {
  const {
    data: { text },
  } = await Tesseract.recognize(
    imageFile,
    "chi_sim", // 中文简体
    {
      logger: (m) => console.log(m),
    },
  );
  return text;
}

// 或使用云端 OCR API（更准确）
async function performOCRCloud(imageFile: File) {
  // 使用百度 OCR、腾讯 OCR 或阿里 OCR
  const response = await fetch("/api/ocr", {
    method: "POST",
    body: imageFile,
  });
  return response.json();
}
```

**优点**：

- ✅ 可以自动识别文字
- ✅ 用户体验较好
- ✅ 不依赖微信 API

**缺点**：

- ⚠️ OCR 准确率有限（需要优化）
- ⚠️ 无法获取视频链接
- ⚠️ 只能保存截图，不能保存视频

---

### 方案四：微信小程序方案 ⭐⭐⭐⭐⭐（长期方案）

**原理**：

- 开发微信小程序
- 在微信内直接调用小程序
- 通过小程序获取视频信息

**实现步骤**：

```typescript
// 微信小程序代码
// pages/video-collect/index.js

Page({
  onLoad(options) {
    // 1. 获取分享的视频信息
    // 微信可能提供视频 ID 或相关信息
    const videoId = options.videoId;
    const shareInfo = wx.getShareInfo();

    // 2. 调用后端 API 获取视频详情
    wx.request({
      url: "https://api.anykeep.com/wechat/video",
      method: "POST",
      data: {
        videoId,
        shareInfo,
      },
      success: (res) => {
        const videoInfo = res.data;
        // 3. 显示视频信息确认
        this.setData({
          title: videoInfo.title,
          author: videoInfo.author,
          coverUrl: videoInfo.coverUrl,
        });
      },
    });
  },

  // 确认收藏
  async handleCollect() {
    const { title, author, coverUrl } = this.data;

    // 调用 AnyKeep API 创建收藏
    wx.request({
      url: "https://api.anykeep.com/bookmarks",
      method: "POST",
      data: {
        title,
        author,
        coverUrl,
        platform: "WECHAT_VIDEO",
        source: "miniprogram",
      },
      success: () => {
        wx.showToast({
          title: "收藏成功",
          icon: "success",
        });
      },
    });
  },
});
```

**小程序配置**：

```json
// app.json
{
  "pages": ["pages/video-collect/index"],
  "window": {
    "navigationBarTitleText": "收藏到 AnyKeep"
  },
  "permission": {
    "scope.userInfo": {
      "desc": "用于同步用户信息"
    }
  }
}
```

**优点**：

- ✅ 在微信生态内，用户体验最好
- ✅ 可能获取更多视频信息
- ✅ 符合微信使用习惯

**缺点**：

- ⚠️ 需要微信小程序开发
- ⚠️ 需要微信审核
- ⚠️ 可能受微信 API 限制

---

### 方案五：剪贴板监听方案 ⭐⭐⭐

**原理**：

- 监听系统剪贴板
- 当用户复制视频号信息时自动检测
- 解析剪贴板内容

**实现步骤**：

```typescript
// 移动端剪贴板监听
import Clipboard from "@react-native-clipboard/clipboard";

// 监听剪贴板变化
useEffect(() => {
  const interval = setInterval(async () => {
    const clipboardContent = await Clipboard.getString();

    // 检测是否是微信视频号相关内容
    if (isWechatVideoContent(clipboardContent)) {
      // 解析内容
      const videoInfo = parseClipboardContent(clipboardContent);

      // 显示收藏提示
      showCollectPrompt(videoInfo);
    }
  }, 1000); // 每秒检查一次

  return () => clearInterval(interval);
}, []);

function isWechatVideoContent(content: string) {
  // 检测微信视频号特征
  // 例如：包含"视频号"、"@作者"等关键词
  return /视频号|@\w+|【.*】/.test(content);
}

function parseClipboardContent(content: string) {
  // 解析剪贴板内容
  const titleMatch = content.match(/【(.+?)】/);
  const authorMatch = content.match(/@(\w+)/);

  return {
    title: titleMatch?.[1] || "未知标题",
    author: authorMatch?.[1] || "未知作者",
    rawContent: content,
  };
}
```

**优点**：

- ✅ 自动检测，无需手动操作
- ✅ 实现简单

**缺点**：

- ⚠️ 需要用户复制内容
- ⚠️ 剪贴板内容可能不完整
- ⚠️ 隐私问题（监听剪贴板）

---

## 🎯 推荐方案组合

### 短期方案（MVP）：方案一 + 方案二

**组合策略**：

1. **主要方案**：系统分享菜单 + 元数据提取
   - 实现简单
   - 用户体验好
   - 可以获取部分信息

2. **备用方案**：录屏 + 手动输入
   - 当分享菜单无法获取完整信息时
   - 用户可以选择录屏保存

**实现优先级**：

- ⭐⭐⭐⭐⭐ 系统分享菜单（iOS/Android）
- ⭐⭐⭐⭐ 录屏功能
- ⭐⭐⭐ OCR 识别（可选）

---

### 长期方案：方案四（微信小程序）

**优势**：

- ✅ 在微信生态内，用户体验最好
- ✅ 可能获取更多视频信息
- ✅ 符合微信使用习惯

**实施时间**：

- 建议在 MVP 验证成功后开发
- 预计 3-4 周开发时间

---

## 📝 技术实现细节

### 1. 数据库设计

```sql
-- 扩展 bookmarks 表，支持视频号
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS screen_record_url TEXT;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS collection_method TEXT;
-- 'SHARE_MENU' | 'SCREEN_RECORD' | 'SCREENSHOT' | 'MINIPROGRAM'

-- 视频号特殊字段
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS wechat_video_id TEXT;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS wechat_author_id TEXT;
```

---

### 2. API 设计

```typescript
// POST /api/bookmarks/wechat-video
interface WechatVideoBookmarkRequest {
  // 方案一：分享菜单
  shareData?: {
    text?: string;
    imageUrl?: string;
    url?: string;
  };

  // 方案二：录屏
  screenRecord?: {
    videoFile: File;
    title: string;
    author: string;
    description?: string;
  };

  // 方案三：截图
  screenshot?: {
    imageFile: File;
    ocrText?: string;
  };

  // 通用字段
  platform: "WECHAT_VIDEO";
  collectionMethod: "SHARE_MENU" | "SCREEN_RECORD" | "SCREENSHOT";
  folderId?: string;
  tags?: string[];
}
```

---

### 3. 前端实现

```typescript
// 处理微信视频号分享
export async function handleWechatVideoShare(
  shareData: ShareData,
): Promise<Bookmark> {
  // 1. 解析分享数据
  const metadata = parseWechatVideoShare(shareData);

  // 2. 创建收藏记录
  const bookmark = await createBookmark({
    title: metadata.title,
    author: metadata.author,
    coverUrl: metadata.coverUrl,
    platform: "WECHAT_VIDEO",
    collectionMethod: "SHARE_MENU",
    // 注意：没有 videoUrl
    videoUrl: null,
  });

  // 3. AI 生成摘要和标签
  if (metadata.description) {
    const aiResult = await generateAIContent({
      title: metadata.title,
      description: metadata.description,
    });

    // 更新收藏记录
    await updateBookmark(bookmark.id, {
      aiSummary: aiResult.summary,
      aiTags: aiResult.tags,
    });
  }

  return bookmark;
}

// 解析微信视频号分享数据
function parseWechatVideoShare(shareData: ShareData) {
  const { text, imageUrl, url } = shareData;

  // 解析文本格式：
  // "【视频标题】\n@作者名称\n#话题标签\n视频描述..."

  const lines = text?.split("\n") || [];
  const title = lines[0]?.replace(/【|】/g, "") || "未知标题";
  const author = lines[1]?.replace("@", "") || "未知作者";
  const tags = lines
    .filter((line) => line.startsWith("#"))
    .map((tag) => tag.replace("#", ""));
  const description = lines
    .slice(2)
    .filter((line) => !line.startsWith("#"))
    .join("\n");

  return {
    title,
    author,
    tags,
    description,
    coverUrl: imageUrl,
  };
}
```

---

### 4. 移动端实现（React Native / Capacitor）

```typescript
// Capacitor Share Plugin
import { Share } from "@capacitor/share";

// 监听分享事件
Share.addListener("share", async (data) => {
  if (data.type === "wechat-video") {
    // 处理微信视频号分享
    await handleWechatVideoShare(data);
  }
});

// 或使用原生代码
// iOS: Share Extension
// Android: Share Intent Receiver
```

---

## 🔧 实施计划

### Phase 1: 基础功能（2-3 周）

**任务清单**：

1. ✅ 实现系统分享菜单接收（iOS/Android）
2. ✅ 实现分享数据解析
3. ✅ 实现基础收藏功能
4. ✅ 测试和优化

**验收标准**：

- 可以通过分享菜单收藏视频号
- 可以解析视频标题和作者
- 可以保存封面图

---

### Phase 2: 增强功能（2-3 周）

**任务清单**：

1. ✅ 实现录屏功能
2. ✅ 实现手动输入表单
3. ✅ 实现 OCR 识别（可选）
4. ✅ 优化用户体验

**验收标准**：

- 可以录屏保存视频
- 可以手动输入视频信息
- OCR 识别准确率 > 80%

---

### Phase 3: 小程序方案（3-4 周）

**任务清单**：

1. ✅ 开发微信小程序
2. ✅ 实现视频信息获取
3. ✅ 实现收藏功能
4. ✅ 微信审核和发布

**验收标准**：

- 小程序可以正常使用
- 可以通过小程序收藏视频号
- 通过微信审核

---

## ⚠️ 注意事项

### 1. 技术限制

- ⚠️ 微信视频号没有公开 API
- ⚠️ 无法获取视频直接链接
- ⚠️ 分享数据可能不完整
- ⚠️ 需要用户手动输入部分信息

### 2. 用户体验

- ✅ 提供多种收藏方式（分享菜单、录屏、截图）
- ✅ 自动填充尽可能多的信息
- ✅ 简化手动输入流程
- ✅ 提供清晰的引导

### 3. 存储成本

- ⚠️ 录屏文件较大（需要压缩）
- ⚠️ 视频存储成本高
- ⚠️ 考虑存储限制和配额

### 4. 隐私和安全

- ✅ 明确告知用户数据使用方式
- ✅ 遵守微信平台规则
- ✅ 保护用户隐私

---

## 📊 方案对比总结

| 方案         | 实现难度   | 用户体验   | 信息完整性 | 推荐度     |
| ------------ | ---------- | ---------- | ---------- | ---------- |
| **分享菜单** | ⭐⭐⭐     | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | ⭐⭐⭐⭐⭐ |
| **录屏**     | ⭐⭐⭐⭐   | ⭐⭐⭐     | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   |
| **截图+OCR** | ⭐⭐⭐⭐   | ⭐⭐⭐⭐   | ⭐⭐⭐     | ⭐⭐⭐     |
| **小程序**   | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐ |
| **剪贴板**   | ⭐⭐       | ⭐⭐⭐     | ⭐⭐       | ⭐⭐⭐     |

---

## 🎯 最终建议

**推荐方案组合**：

1. **短期（MVP）**：分享菜单 + 录屏
   - 快速实现
   - 用户体验可接受
   - 功能完整

2. **长期**：微信小程序
   - 最佳用户体验
   - 可能获取更多信息
   - 符合微信生态

**实施优先级**：

- ⭐⭐⭐⭐⭐ 系统分享菜单（必须）
- ⭐⭐⭐⭐ 录屏功能（重要）
- ⭐⭐⭐ OCR 识别（可选）
- ⭐⭐⭐⭐⭐ 微信小程序（长期）

---

**文档维护**：随着实施进展持续更新  
**最后更新**：2025-11-24
