# 微信视频号收藏 - 截图 OCR 智能识别方案

**创建日期**: 2025-11-24  
**设计原则**: 智能、自动化、用户友好  
**核心理念**: 用户截图 → AI 识别 → 自动创建收藏

---

## 🎯 方案概述

### 核心思路

**用户截图视频号页面 → 上传截图 → OCR 识别文字 → AI 解析信息 → 自动创建收藏**

**优势**：

- ✅ 用户操作简单（只需截图和上传）
- ✅ 自动化程度高（AI 自动识别和解析）
- ✅ 准确率高（OCR + AI 双重识别）
- ✅ 用户体验好（一键完成）

---

## 📱 用户使用流程

### 场景：用户在微信看到喜欢的视频号

**步骤 1**：截图视频号页面（5 秒）

- 在微信视频号页面截图
- 确保截图包含：标题、作者、封面图

**步骤 2**：打开 AnyKeep（5 秒）

- 点击"收藏视频号"
- 选择"截图识别"模式

**步骤 3**：上传截图（5 秒）

- 点击"上传截图"按钮
- 选择刚才的截图

**步骤 4**：AI 自动识别（10-15 秒）

- OCR 识别截图中的文字
- AI 解析标题、作者、描述等信息
- 自动提取封面图区域

**步骤 5**：确认保存（5 秒）

- 查看识别结果
- 确认或修改信息
- 点击"保存"

**总耗时**：< 1 分钟（大部分时间在 AI 处理）

---

## 💻 技术实现

### 1. 前端：截图上传组件

```typescript
// src/components/bookmark/wechat-video-screenshot-form.tsx

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImageUpload } from '@/components/ui/image-upload'

interface ScreenshotFormProps {
  onRecognize: (imageFile: File) => Promise<RecognizedData>
  onSubmit: (data: RecognizedData) => Promise<void>
}

interface RecognizedData {
  title: string
  author: string
  description: string
  coverImageUrl?: string
  confidence: number // 识别置信度
}

export function WechatVideoScreenshotForm({
  onRecognize,
  onSubmit,
}: ScreenshotFormProps) {
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [recognizedData, setRecognizedData] = useState<RecognizedData | null>(null)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 处理截图上传
  const handleScreenshotUpload = async (file: File) => {
    setScreenshot(file)
    setIsRecognizing(true)

    try {
      // 调用识别 API
      const data = await onRecognize(file)
      setRecognizedData(data)
    } catch (error) {
      console.error('识别失败:', error)
      toast.error('识别失败，请重试')
    } finally {
      setIsRecognizing(false)
    }
  }

  // 处理提交
  const handleSubmit = async () => {
    if (!recognizedData) return

    setIsSubmitting(true)
    try {
      await onSubmit(recognizedData)
      toast.success('收藏成功！')
    } catch (error) {
      console.error('保存失败:', error)
      toast.error('保存失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 截图上传区域 */}
      <div>
        <Label>上传视频号截图</Label>
        <ImageUpload
          onUpload={handleScreenshotUpload}
          accept="image/*"
          maxSize={5 * 1024 * 1024} // 5MB
        />
        {screenshot && (
          <div className="mt-2">
            <img
              src={URL.createObjectURL(screenshot)}
              alt="截图预览"
              className="w-full max-w-md rounded border"
            />
          </div>
        )}
      </div>

      {/* 识别状态 */}
      {isRecognizing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" />
          <span>正在识别截图中的信息...</span>
        </div>
      )}

      {/* 识别结果 */}
      {recognizedData && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">识别结果</h3>
            <Badge variant={recognizedData.confidence > 0.8 ? 'success' : 'warning'}>
              置信度: {Math.round(recognizedData.confidence * 100)}%
            </Badge>
          </div>

          {/* 标题 */}
          <div>
            <Label>视频标题 *</Label>
            <Input
              value={recognizedData.title}
              onChange={(e) =>
                setRecognizedData({ ...recognizedData, title: e.target.value })
              }
            />
          </div>

          {/* 作者 */}
          <div>
            <Label>作者</Label>
            <Input
              value={recognizedData.author}
              onChange={(e) =>
                setRecognizedData({ ...recognizedData, author: e.target.value })
              }
            />
          </div>

          {/* 描述 */}
          <div>
            <Label>描述</Label>
            <Textarea
              value={recognizedData.description}
              onChange={(e) =>
                setRecognizedData({
                  ...recognizedData,
                  description: e.target.value,
                })
              }
              rows={3}
            />
          </div>

          {/* 封面图预览 */}
          {recognizedData.coverImageUrl && (
            <div>
              <Label>封面图</Label>
              <img
                src={recognizedData.coverImageUrl}
                alt="封面预览"
                className="w-32 h-32 object-cover rounded"
              />
            </div>
          )}

          {/* 保存按钮 */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !recognizedData.title}
            className="w-full"
          >
            {isSubmitting ? '保存中...' : '保存收藏'}
          </Button>
        </div>
      )}
    </div>
  )
}
```

---

### 2. 后端 API：OCR + AI 识别

```typescript
// src/app/api/wechat-video/recognize/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recognizeScreenshot } from "@/lib/utils/ocr-recognizer";
import { parseWechatVideoInfo } from "@/lib/utils/ai-parser";

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 2. 获取上传的截图
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;

    if (!imageFile) {
      return NextResponse.json({ error: "请上传截图" }, { status: 400 });
    }

    // 3. OCR 识别文字
    const ocrResult = await recognizeScreenshot(imageFile);
    // {
    //   text: "识别的所有文字",
    //   blocks: [
    //     { text: "视频标题", bbox: { x, y, width, height } },
    //     { text: "@作者名称", bbox: { ... } },
    //     ...
    //   ]
    // }

    // 4. AI 解析视频信息
    const videoInfo = await parseWechatVideoInfo(
      ocrResult.text,
      ocrResult.blocks,
    );
    // {
    //   title: "视频标题",
    //   author: "作者名称",
    //   description: "视频描述",
    //   confidence: 0.95
    // }

    // 5. 提取封面图区域
    const coverImage = await extractCoverImage(imageFile, ocrResult.blocks);

    // 6. 上传封面图到 Supabase Storage
    const coverUrl = await uploadCoverImage(coverImage, user.id);

    return NextResponse.json({
      title: videoInfo.title,
      author: videoInfo.author,
      description: videoInfo.description,
      coverImageUrl: coverUrl,
      confidence: videoInfo.confidence,
    });
  } catch (error) {
    console.error("识别失败:", error);
    return NextResponse.json({ error: "识别失败，请重试" }, { status: 500 });
  }
}
```

---

### 3. OCR 识别工具函数

```typescript
// src/lib/utils/ocr-recognizer.ts

import Tesseract from "tesseract.js";

interface OCRResult {
  text: string;
  blocks: Array<{
    text: string;
    bbox: { x: number; y: number; width: number; height: number };
    confidence: number;
  }>;
}

/**
 * 识别截图中的文字
 */
export async function recognizeScreenshot(imageFile: File): Promise<OCRResult> {
  // 方案一：使用 Tesseract.js（客户端，免费）
  const result = await Tesseract.recognize(imageFile, "chi_sim+eng", {
    logger: (m) => {
      if (m.status === "recognizing text") {
        console.log(`进度: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  // 解析识别结果
  const blocks = result.data.words.map((word) => ({
    text: word.text,
    bbox: {
      x: word.bbox.x0,
      y: word.bbox.y0,
      width: word.bbox.x1 - word.bbox.x0,
      height: word.bbox.y1 - word.bbox.y0,
    },
    confidence: word.confidence / 100,
  }));

  return {
    text: result.data.text,
    blocks,
  };
}

/**
 * 使用云端 OCR API（更准确，推荐）
 */
export async function recognizeScreenshotCloud(
  imageFile: File,
): Promise<OCRResult> {
  // 方案二：使用百度 OCR API（推荐，准确率高）
  const formData = new FormData();
  formData.append("image", imageFile);

  const response = await fetch("/api/ocr/baidu", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  // 百度 OCR 返回格式：
  // {
  //   words_result: [
  //     { words: "文字内容", location: { left, top, width, height } }
  //   ]
  // }

  const blocks = data.words_result.map((item: any) => ({
    text: item.words,
    bbox: {
      x: item.location.left,
      y: item.location.top,
      width: item.location.width,
      height: item.location.height,
    },
    confidence: 0.9, // 百度 OCR 默认置信度
  }));

  return {
    text: blocks.map((b) => b.text).join("\n"),
    blocks,
  };
}
```

---

### 4. AI 解析工具函数

```typescript
// src/lib/utils/ai-parser.ts

import { generateAIContent } from "./ai-generator";

interface VideoInfo {
  title: string;
  author: string;
  description: string;
  confidence: number;
}

/**
 * 从 OCR 结果中解析视频号信息
 */
export async function parseWechatVideoInfo(
  ocrText: string,
  blocks: Array<{ text: string; bbox: any }>,
): Promise<VideoInfo> {
  // 1. 基于规则的初步解析
  const ruleBasedResult = parseByRules(ocrText, blocks);

  // 2. AI 智能解析（提高准确率）
  const aiResult = await parseByAI(ocrText, ruleBasedResult);

  return {
    title: aiResult.title || ruleBasedResult.title || "未知标题",
    author: aiResult.author || ruleBasedResult.author || "",
    description: aiResult.description || ruleBasedResult.description || "",
    confidence: aiResult.confidence || ruleBasedResult.confidence || 0.5,
  };
}

/**
 * 基于规则的解析
 */
function parseByRules(
  text: string,
  blocks: Array<{ text: string; bbox: any }>,
) {
  // 1. 识别标题（通常在顶部，字体较大）
  const titleBlock = blocks.find((block) => {
    // 标题通常在顶部 20% 区域
    return block.bbox.y < 0.2 && block.text.length > 5;
  });

  // 2. 识别作者（通常包含 @ 符号）
  const authorBlock = blocks.find((block) => block.text.includes("@"));

  // 3. 识别描述（通常在中间区域，多行文本）
  const descriptionBlocks = blocks.filter((block) => {
    return block.bbox.y > 0.3 && block.bbox.y < 0.8 && block.text.length > 10;
  });

  return {
    title: titleBlock?.text.replace(/【|】/g, "") || "",
    author: authorBlock?.text.replace("@", "") || "",
    description: descriptionBlocks.map((b) => b.text).join("\n"),
    confidence: 0.7, // 规则解析置信度较低
  };
}

/**
 * AI 智能解析
 */
async function parseByAI(
  ocrText: string,
  ruleBasedResult: any,
): Promise<VideoInfo> {
  const prompt = `请从以下 OCR 识别的文字中，提取微信视频号的信息：

OCR 识别结果：
${ocrText}

初步解析结果：
- 标题: ${ruleBasedResult.title}
- 作者: ${ruleBasedResult.author}
- 描述: ${ruleBasedResult.description}

请以 JSON 格式返回更准确的解析结果：
{
  "title": "视频标题",
  "author": "作者名称",
  "description": "视频描述",
  "confidence": 0.95
}

要求：
1. 标题要准确，去除无关符号
2. 作者要准确，去除 @ 符号
3. 描述要完整，包含视频的主要内容
4. confidence 表示解析的置信度（0-1）`;

  try {
    const response = await generateAIContent({
      title: "解析视频号信息",
      description: prompt,
    });

    // 解析 AI 返回的 JSON
    const result = JSON.parse(response.summary);
    return result;
  } catch (error) {
    console.error("AI 解析失败:", error);
    return ruleBasedResult;
  }
}
```

---

### 5. 封面图提取

```typescript
// src/lib/utils/image-extractor.ts

/**
 * 从截图中提取封面图区域
 */
export async function extractCoverImage(
  imageFile: File,
  ocrBlocks: Array<{ text: string; bbox: any }>,
): Promise<File> {
  // 1. 加载图片
  const image = await loadImage(imageFile);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // 2. 识别封面图区域（通常在左侧或中间，较大区域）
  // 封面图通常在顶部，占据较大空间
  const coverRegion = {
    x: 0,
    y: 0,
    width: image.width * 0.4, // 假设封面图占 40% 宽度
    height: image.height * 0.6, // 假设封面图占 60% 高度
  };

  // 3. 裁剪封面图
  canvas.width = coverRegion.width;
  canvas.height = coverRegion.height;
  ctx.drawImage(
    image,
    coverRegion.x,
    coverRegion.y,
    coverRegion.width,
    coverRegion.height,
    0,
    0,
    coverRegion.width,
    coverRegion.height,
  );

  // 4. 转换为 Blob
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(new File([blob], "cover.jpg", { type: "image/jpeg" }));
        }
      },
      "image/jpeg",
      0.9,
    );
  });
}
```

---

### 6. 集成到创建收藏流程

```typescript
// src/components/bookmark/create-bookmark-dialog.tsx

export function CreateBookmarkDialog({ ... }) {
  const [bookmarkType, setBookmarkType] = useState<'URL' | 'SCREENSHOT'>('URL')

  // 处理截图识别
  const handleScreenshotRecognize = async (imageFile: File) => {
    const formData = new FormData()
    formData.append('image', imageFile)

    const response = await fetch('/api/wechat-video/recognize', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('识别失败')
    }

    return response.json()
  }

  // 处理截图收藏提交
  const handleScreenshotSubmit = async (data: RecognizedData) => {
    // 创建收藏记录（URL 使用占位符）
    const bookmark = await createBookmark({
      url: `wechat-video://${Date.now()}`,
      title: data.title,
      author: data.author,
      description: data.description,
      coverUrl: data.coverImageUrl,
      platform: 'WECHAT_VIDEO',
    })

    // AI 生成摘要和标签
    if (data.description) {
      const aiResult = await generateAIContent({
        title: data.title,
        description: data.description,
      })
      // 更新收藏记录
      await updateBookmark(bookmark.id, {
        aiSummary: aiResult.summary,
        aiTags: aiResult.tags,
      })
    }
  }

  return (
    <Dialog>
      <Tabs value={bookmarkType} onValueChange={(v) => setBookmarkType(v as any)}>
        <TabsList>
          <TabsTrigger value="URL">链接</TabsTrigger>
          <TabsTrigger value="SCREENSHOT">截图识别</TabsTrigger>
        </TabsList>

        <TabsContent value="SCREENSHOT">
          <WechatVideoScreenshotForm
            onRecognize={handleScreenshotRecognize}
            onSubmit={handleScreenshotSubmit}
          />
        </TabsContent>
      </Tabs>
    </Dialog>
  )
}
```

---

## 🎨 用户体验优化

### 1. 截图引导

```typescript
// 首次使用时显示截图示例
<div className="screenshot-guide">
  <h3>如何截图？</h3>
  <ol>
    <li>在微信视频号页面，确保能看到：标题、作者、封面图</li>
    <li>使用手机截图功能（iOS: 电源键+音量上，Android: 电源键+音量下）</li>
    <li>确保截图清晰，文字可读</li>
  </ol>
  <img src="/screenshot-example.png" alt="截图示例" />
</div>
```

---

### 2. 识别进度显示

```typescript
// 显示识别进度
{isRecognizing && (
  <div className="recognition-progress">
    <Progress value={progress} />
    <p>正在识别：{currentStep}</p>
    {/* currentStep: "OCR 识别中..." | "AI 解析中..." | "提取封面图中..." */}
  </div>
)}
```

---

### 3. 识别结果预览

```typescript
// 在截图上高亮显示识别到的区域
<div className="screenshot-preview">
  <img src={screenshotUrl} />
  {/* 高亮标题区域 */}
  <div
    className="highlight-box"
    style={{
      left: titleBbox.x,
      top: titleBbox.y,
      width: titleBbox.width,
      height: titleBbox.height,
    }}
  >
    标题
  </div>
  {/* 高亮作者区域 */}
  <div className="highlight-box" style={{ ...authorBbox }}>
    作者
  </div>
</div>
```

---

## 📊 OCR 方案对比

| 方案             | 准确率     | 成本      | 速度         | 推荐度     |
| ---------------- | ---------- | --------- | ------------ | ---------- |
| **Tesseract.js** | ⭐⭐⭐     | 免费      | 慢（客户端） | ⭐⭐⭐     |
| **百度 OCR**     | ⭐⭐⭐⭐⭐ | ¥0.005/次 | 快           | ⭐⭐⭐⭐⭐ |
| **腾讯 OCR**     | ⭐⭐⭐⭐⭐ | ¥0.01/次  | 快           | ⭐⭐⭐⭐   |
| **阿里 OCR**     | ⭐⭐⭐⭐   | ¥0.008/次 | 快           | ⭐⭐⭐⭐   |

**推荐**：百度 OCR API

- 准确率高（> 95%）
- 成本低（¥0.005/次，1000 次 = ¥5）
- 速度快（< 2 秒）

---

## 🚀 实施计划

### Phase 1: 基础功能（3-5 天）

**任务清单**：

1. ✅ 实现截图上传组件
2. ✅ 集成 OCR API（百度 OCR）
3. ✅ 实现 AI 解析功能
4. ✅ 实现封面图提取
5. ✅ 集成到创建收藏流程

**验收标准**：

- 可以上传截图
- OCR 识别准确率 > 90%
- AI 解析准确率 > 85%
- 可以自动创建收藏

---

### Phase 2: 用户体验优化（2-3 天）

**任务清单**：

1. ✅ 添加截图引导
2. ✅ 添加识别进度显示
3. ✅ 添加识别结果预览
4. ✅ 移动端优化

**验收标准**：

- 用户知道如何截图
- 识别过程有进度提示
- 可以预览识别结果
- 移动端体验良好

---

### Phase 3: 高级功能（可选，2-3 天）

**任务清单**：

1. ✅ 支持批量识别（多张截图）
2. ✅ 支持识别结果编辑
3. ✅ 支持识别历史记录
4. ✅ 优化识别准确率

**验收标准**：

- 可以批量上传截图
- 可以编辑识别结果
- 可以查看识别历史
- 识别准确率 > 95%

---

## 💰 成本估算

### OCR API 成本

**百度 OCR API**：

- 价格：¥0.005/次
- 1000 次识别 = ¥5
- 10000 次识别 = ¥50

**月度成本估算**（1000 用户，每人每天 2 次）：

- 识别次数：1000 × 2 × 30 = 60,000 次
- OCR 成本：60,000 × ¥0.005 = ¥300/月

**优化方案**：

- 缓存识别结果（相同截图不重复识别）
- 客户端 OCR（Tesseract.js）作为备选
- 降低识别成本

---

## ✅ 方案优势

### 1. 用户体验好

- ✅ 操作简单（只需截图和上传）
- ✅ 自动化程度高（AI 自动识别）
- ✅ 准确率高（OCR + AI 双重识别）

### 2. 技术可行

- ✅ OCR 技术成熟（百度 OCR 准确率 > 95%）
- ✅ AI 解析可靠（基于现有 AI 功能）
- ✅ 实现难度中等（3-5 天）

### 3. 成本可控

- ✅ OCR 成本低（¥0.005/次）
- ✅ 可以优化（缓存、客户端 OCR）
- ✅ 成本可预测

---

## ⚠️ 注意事项

### 1. 截图质量要求

**需要确保**：

- 截图清晰，文字可读
- 包含标题、作者、封面图
- 避免模糊、倾斜、遮挡

**解决方案**：

- 提供截图示例和引导
- 识别前检查图片质量
- 低质量图片给出提示

---

### 2. 识别准确率

**影响因素**：

- 截图质量
- 文字清晰度
- 布局复杂度

**解决方案**：

- 使用高准确率 OCR（百度 OCR）
- AI 二次解析提高准确率
- 允许用户编辑识别结果

---

### 3. 识别速度

**影响因素**：

- OCR API 响应时间
- AI 解析时间
- 网络延迟

**解决方案**：

- 使用快速 OCR API（百度 OCR < 2 秒）
- 优化 AI 解析（使用缓存）
- 显示识别进度

---

## 🎯 最终建议

**推荐方案**：截图 + OCR + AI 识别

**核心功能**：

1. ✅ 截图上传
2. ✅ OCR 文字识别（百度 OCR）
3. ✅ AI 智能解析
4. ✅ 封面图自动提取
5. ✅ 自动创建收藏

**实施优先级**：

- ⭐⭐⭐⭐⭐ 基础功能（必须，3-5 天）
- ⭐⭐⭐⭐ 用户体验优化（重要，2-3 天）
- ⭐⭐⭐ 高级功能（可选，2-3 天）

**总开发时间**：5-8 天

---

**文档维护**：随着实施进展持续更新  
**最后更新**：2025-11-24
