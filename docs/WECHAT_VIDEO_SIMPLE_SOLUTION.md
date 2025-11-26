# 微信视频号收藏 - 极简实现方案

**创建日期**: 2025-11-24  
**设计原则**: 简单、实用、用户友好  
**核心理念**: 最小化用户操作，最大化自动化

---

## 🎯 方案概述

### 核心思路

**放弃复杂技术方案，采用最简单的手动输入方式**

**为什么简单更好**：
- ✅ 用户操作简单（只需输入标题）
- ✅ 技术实现简单（复用现有表单）
- ✅ 开发周期短（1-2 天）
- ✅ 用户体验可控（不依赖外部技术）

---

## 📱 用户使用流程

### 场景：用户在微信看到喜欢的视频号

**步骤 1**：打开 AnyKeep 应用
- 点击"添加收藏"按钮
- 选择"视频号"类型

**步骤 2**：填写信息（30 秒）
- **标题**：复制粘贴或手动输入（必填）
- **作者**：复制粘贴或手动输入（可选）
- **描述**：复制粘贴或手动输入（可选）
- **封面图**：从相册选择（可选）

**步骤 3**：保存
- 点击"保存"按钮
- AI 自动生成摘要和标签
- 完成收藏

**总耗时**：< 1 分钟

---

## 💻 技术实现

### 1. 前端：添加"视频号"收藏类型

```typescript
// src/components/bookmark/create-bookmark-dialog.tsx

// 添加收藏类型选择
type BookmarkType = 'URL' | 'WECHAT_VIDEO' | 'MANUAL'

export function CreateBookmarkDialog({ ... }) {
  const [bookmarkType, setBookmarkType] = useState<BookmarkType>('URL')
  const [wechatVideoData, setWechatVideoData] = useState({
    title: '',
    author: '',
    description: '',
    coverImage: null as File | null,
  })

  // 根据类型显示不同表单
  return (
    <Dialog>
      {/* 类型选择 */}
      <Tabs value={bookmarkType} onValueChange={(v) => setBookmarkType(v as BookmarkType)}>
        <TabsList>
          <TabsTrigger value="URL">链接</TabsTrigger>
          <TabsTrigger value="WECHAT_VIDEO">视频号</TabsTrigger>
          <TabsTrigger value="MANUAL">手动</TabsTrigger>
        </TabsList>

        {/* URL 收藏（现有功能） */}
        <TabsContent value="URL">
          {/* 现有的 URL 输入表单 */}
        </TabsContent>

        {/* 视频号收藏（新功能） */}
        <TabsContent value="WECHAT_VIDEO">
          <WechatVideoForm
            data={wechatVideoData}
            onChange={setWechatVideoData}
          />
        </TabsContent>
      </Tabs>
    </Dialog>
  )
}
```

---

### 2. 视频号表单组件

```typescript
// src/components/bookmark/wechat-video-form.tsx

interface WechatVideoFormProps {
  data: {
    title: string
    author: string
    description: string
    coverImage: File | null
  }
  onChange: (data: any) => void
}

export function WechatVideoForm({ data, onChange }: WechatVideoFormProps) {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onChange({ ...data, coverImage: file })
    }
  }

  return (
    <div className="space-y-4">
      {/* 标题（必填） */}
      <div>
        <Label>视频标题 *</Label>
        <Input
          value={data.title}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
          placeholder="输入或粘贴视频标题"
        />
        <p className="text-sm text-muted-foreground mt-1">
          提示：在微信视频号页面，长按标题可复制
        </p>
      </div>

      {/* 作者（可选） */}
      <div>
        <Label>作者</Label>
        <Input
          value={data.author}
          onChange={(e) => onChange({ ...data, author: e.target.value })}
          placeholder="输入或粘贴作者名称"
        />
      </div>

      {/* 描述（可选） */}
      <div>
        <Label>描述</Label>
        <Textarea
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="输入或粘贴视频描述（可选）"
          rows={3}
        />
      </div>

      {/* 封面图（可选） */}
      <div>
        <Label>封面图</Label>
        <Input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
        />
        {data.coverImage && (
          <div className="mt-2">
            <img
              src={URL.createObjectURL(data.coverImage)}
              alt="封面预览"
              className="w-32 h-32 object-cover rounded"
            />
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          提示：在微信视频号页面，长按封面图可保存到相册
        </p>
      </div>
    </div>
  )
}
```

---

### 3. 后端 API：支持无 URL 的收藏

```typescript
// src/app/api/bookmarks/route.ts

// 修改验证 Schema，URL 改为可选
export const createBookmarkSchema = z.object({
  url: bookmarkUrlSchema.optional(), // 改为可选
  title: z.string().trim().min(1, '标题不能为空'),
  description: z.string().trim().optional(),
  author: z.string().trim().optional(), // 添加作者字段
  platform: z.enum(['WECHAT_OFFICIAL_ACCOUNT', 'BILIBILI', 'XIAOHONGSHU', 'WECHAT_VIDEO', 'UNKNOWN']).optional(),
  // ... 其他字段
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const validation = createBookmarkSchema.safeParse(body)

  // 如果是视频号，URL 可以为空
  if (body.platform === 'WECHAT_VIDEO' && !body.url) {
    // 生成一个占位 URL
    body.url = `wechat-video://${Date.now()}`
  }

  // ... 后续处理逻辑
}
```

---

### 4. 数据库：支持无 URL 的收藏

```sql
-- URL 字段改为可选（如果还没有）
ALTER TABLE bookmarks ALTER COLUMN url DROP NOT NULL;

-- 添加视频号特殊标识
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS wechat_video_id TEXT;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS is_video_content BOOLEAN DEFAULT FALSE;
```

---

## 🎨 用户体验优化

### 1. 快速输入提示

在表单中添加"快速输入"按钮：

```typescript
// 从剪贴板粘贴
const handlePasteFromClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText()
    // 智能解析：尝试识别标题、作者、描述
    const parsed = parseWechatVideoText(text)
    onChange({
      ...data,
      title: parsed.title || data.title,
      author: parsed.author || data.author,
      description: parsed.description || data.description,
    })
    toast.success('已从剪贴板粘贴')
  } catch (error) {
    toast.error('无法读取剪贴板')
  }
}

// 解析文本（简单版本）
function parseWechatVideoText(text: string) {
  // 假设用户复制的内容格式：
  // "【视频标题】\n@作者名称\n视频描述..."
  
  const lines = text.split('\n').filter(Boolean)
  return {
    title: lines[0]?.replace(/【|】/g, '') || '',
    author: lines[1]?.replace('@', '') || '',
    description: lines.slice(2).join('\n') || '',
  }
}
```

---

### 2. 封面图快速选择

```typescript
// 从相册选择最近的照片
const handleSelectRecentImage = async () => {
  // 使用文件选择器，默认打开相册
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = 'environment' // 移动端直接打开相机
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      onChange({ ...data, coverImage: file })
    }
  }
  input.click()
}
```

---

### 3. AI 智能补全

```typescript
// 如果用户只输入了标题，AI 可以生成描述
const handleAIGenerate = async () => {
  if (!data.title) {
    toast.error('请先输入标题')
    return
  }

  setIsGenerating(true)
  try {
    const response = await fetch('/api/ai/generate-description', {
      method: 'POST',
      body: JSON.stringify({ title: data.title }),
    })
    const { description } = await response.json()
    onChange({ ...data, description })
    toast.success('AI 已生成描述')
  } catch (error) {
    toast.error('生成失败')
  } finally {
    setIsGenerating(false)
  }
}
```

---

## 📱 移动端优化

### 1. 快捷入口

在移动端首页添加"快速收藏视频号"按钮：

```typescript
// src/components/home/quick-actions.tsx

export function QuickActions() {
  return (
    <div className="flex gap-2">
      <Button
        onClick={() => {
          // 打开视频号收藏表单
          setBookmarkType('WECHAT_VIDEO')
          setDialogOpen(true)
        }}
        className="flex-1"
      >
        <VideoIcon className="mr-2" />
        收藏视频号
      </Button>
    </div>
  )
}
```

---

### 2. 移动端表单优化

```typescript
// 移动端使用全屏表单
<div className="mobile-form">
  {/* 标题输入框更大 */}
  <Input
    className="text-lg h-12"
    value={data.title}
    placeholder="输入视频标题"
  />
  
  {/* 作者和描述使用较小的输入框 */}
  <Input
    className="h-10"
    value={data.author}
    placeholder="作者（可选）"
  />
  
  {/* 封面图选择更明显 */}
  <Button
    onClick={handleSelectRecentImage}
    className="w-full h-32 border-2 border-dashed"
  >
    {data.coverImage ? (
      <img src={URL.createObjectURL(data.coverImage)} />
    ) : (
      <div>
        <ImageIcon />
        <p>点击选择封面图</p>
      </div>
    )}
  </Button>
</div>
```

---

## 🚀 实施计划

### Phase 1: 基础功能（1-2 天）

**任务清单**：
1. ✅ 修改创建收藏表单，添加"视频号"类型
2. ✅ 创建视频号表单组件
3. ✅ 修改后端 API，支持无 URL 的收藏
4. ✅ 修改数据库 Schema（URL 可选）

**验收标准**：
- 可以创建无 URL 的视频号收藏
- 可以输入标题、作者、描述
- 可以上传封面图

---

### Phase 2: 用户体验优化（1-2 天）

**任务清单**：
1. ✅ 添加剪贴板粘贴功能
2. ✅ 添加封面图快速选择
3. ✅ 添加 AI 智能补全
4. ✅ 移动端优化

**验收标准**：
- 可以从剪贴板快速粘贴
- 可以快速选择封面图
- AI 可以生成描述

---

### Phase 3: 高级功能（可选，1-2 天）

**任务清单**：
1. ✅ 添加收藏历史（快速选择之前收藏过的作者）
2. ✅ 添加模板功能（保存常用格式）
3. ✅ 添加批量导入（从文本导入多个视频号）

**验收标准**：
- 可以快速选择常用作者
- 可以使用模板快速填写
- 可以批量导入

---

## 💡 使用示例

### 示例 1：快速收藏

**用户操作**：
1. 在微信看到视频号，长按标题复制
2. 打开 AnyKeep，点击"收藏视频号"
3. 粘贴标题到输入框
4. 点击"保存"

**耗时**：< 30 秒

---

### 示例 2：完整收藏

**用户操作**：
1. 在微信看到视频号
2. 长按标题复制，长按封面图保存到相册
3. 打开 AnyKeep，点击"收藏视频号"
4. 粘贴标题，选择封面图
5. 可选：输入作者和描述
6. 点击"保存"

**耗时**：< 1 分钟

---

## ✅ 方案优势

### 1. 简单实用
- ✅ 用户操作简单（只需输入标题）
- ✅ 技术实现简单（复用现有代码）
- ✅ 开发周期短（1-2 天）

### 2. 用户友好
- ✅ 不依赖复杂技术（录屏、OCR、小程序）
- ✅ 用户完全控制（想填什么填什么）
- ✅ 体验可控（不依赖外部 API）

### 3. 灵活扩展
- ✅ 可以后续添加更多功能（AI 补全、模板等）
- ✅ 可以适配其他无链接平台（抖音、快手等）
- ✅ 可以优化用户体验（剪贴板、快速输入等）

---

## ⚠️ 注意事项

### 1. 用户教育

**需要引导用户**：
- 如何复制视频号标题（长按）
- 如何保存封面图（长按保存到相册）
- 如何快速输入（使用剪贴板）

**实现方式**：
- 在表单中添加提示文字
- 首次使用时显示引导
- 提供帮助文档

---

### 2. 数据完整性

**问题**：
- 用户可能只输入标题，其他信息缺失

**解决方案**：
- AI 自动生成描述和标签
- 允许后续编辑补充信息
- 不强制要求完整信息

---

### 3. 存储成本

**问题**：
- 封面图上传会增加存储成本

**解决方案**：
- 图片自动压缩
- 设置存储配额
- 提供图片删除功能

---

## 📊 方案对比

| 方案 | 实现难度 | 用户体验 | 开发周期 | 推荐度 |
|------|---------|---------|---------|--------|
| **手动输入** | ⭐ | ⭐⭐⭐⭐ | 1-2 天 | ⭐⭐⭐⭐⭐ |
| 系统分享菜单 | ⭐⭐⭐ | ⭐⭐⭐ | 2-3 周 | ⭐⭐⭐ |
| 录屏功能 | ⭐⭐⭐⭐ | ⭐⭐ | 2-3 周 | ⭐⭐ |
| OCR 识别 | ⭐⭐⭐⭐ | ⭐⭐⭐ | 3-4 周 | ⭐⭐⭐ |
| 微信小程序 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 3-4 周 | ⭐⭐⭐⭐ |

---

## 🎯 最终建议

**推荐方案**：手动输入 + AI 补全

**核心功能**：
1. ✅ 简单的表单输入（标题、作者、描述、封面图）
2. ✅ 剪贴板快速粘贴
3. ✅ AI 自动生成描述和标签
4. ✅ 移动端优化

**实施优先级**：
- ⭐⭐⭐⭐⭐ 基础表单（必须，1 天）
- ⭐⭐⭐⭐ 剪贴板粘贴（重要，0.5 天）
- ⭐⭐⭐ AI 补全（可选，0.5 天）
- ⭐⭐⭐ 移动端优化（可选，1 天）

**总开发时间**：1-2 天

---

**文档维护**：随着实施进展持续更新  
**最后更新**：2025-11-24

