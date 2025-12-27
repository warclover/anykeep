# AI Skills 新增功能文档

> **版本**: 1.0.0
> **更新日期**: 2025-12-27
> **适用版本**: AnyKeep v2.7.x+

---

## 概述

本文档介绍 AnyKeep v2.7.x 新增的 4 个 AI Skills，这些 Skills 扩展了平台的内容理解和工具能力。

### Skills 总览

| Skill ID              | 名称         | 分类          | 触发方式      | 状态      |
| --------------------- | ------------ | ------------- | ------------- | --------- |
| `bilibili_transcript` | B站字幕提取  | understanding | 自动/自然语言 | ✅ 已实现 |
| `link_health_check`   | 链接健康检测 | utility       | 自然语言      | ✅ 已实现 |
| `tts_synthesis`       | 语音朗读助手 | understanding | 自然语言      | ✅ 已实现 |
| `wechat_digest`       | 微信阅读摘要 | understanding | 自然语言      | ✅ 已实现 |

---

## 1. B站字幕提取 (bilibili_transcript)

### 功能描述

从 B站视频中提取 CC 字幕，支持多种输出格式，可自动保存到书签记录便于后续阅读和搜索。

### 元数据

```typescript
{
  id: "bilibili_transcript",
  name: "B站字幕提取",
  category: "understanding",
  version: "1.0.0",
  capabilities: [
    "bilibili-subtitle",      // B站字幕提取
    "video-transcript",       // 视频转文字
    "multi-format-export",    // 多格式导出
    "auto-save"               // 自动保存到书签
  ],
  deliverableTypes: ["document"],
  outputFormats: ["markdown", "json", "plain"],
  estimatedDurationMs: 15000,
  maxExecutionTimeMs: 60000
}
```

### 执行步骤

| 步骤 | ID           | 名称         | 进度 |
| ---- | ------------ | ------------ | ---- |
| 1    | parse        | 解析链接     | 15%  |
| 2    | fetch_info   | 获取视频信息 | 20%  |
| 3    | get_subtitle | 获取字幕列表 | 25%  |
| 4    | download     | 下载字幕内容 | 25%  |
| 5    | format       | 格式化输出   | 10%  |
| 6    | save         | 保存到书签   | 5%   |

### 触发方式

1. **自动触发**: 保存 B站视频书签时自动执行
2. **自然语言**:
   - "帮我提取这个B站视频的字幕"
   - "把bilibili视频转成文字"
   - "提取视频字幕"

### 输入参数

```typescript
interface BilibiliTranscriptInput {
  url: string; // B站视频 URL
  bookmarkId?: number; // 关联的书签 ID
  format?: "text" | "srt" | "json" | "markdown"; // 输出格式
  saveToBookmark?: boolean; // 是否保存到书签
}
```

### 输出格式

```typescript
interface BilibiliTranscriptOutput {
  videoInfo: {
    bvid: string; // BV 号
    title: string; // 视频标题
    duration: number; // 时长（秒）
    uploader: string; // UP主
  };
  transcriptStatus: "available" | "not_available" | "error";
  transcript?: {
    format: string;
    content: string;
    fullText: string;
    wordCount: number;
  };
  savedToBookmark?: boolean;
}
```

### 支持的 URL 格式

- 标准格式: `https://www.bilibili.com/video/BVxxxx`
- 无 www: `https://bilibili.com/video/BVxxxx`
- 分 P 视频: `https://www.bilibili.com/video/BVxxxx?p=2`
- 短链接: `https://b23.tv/xxxxx`

### Feature Flag

```bash
ENABLE_BILIBILI_TRANSCRIPT=true  # 默认启用
```

---

## 2. 链接健康检测 (link_health_check)

### 功能描述

智能检测收藏链接的可访问性，发现失效链接并提供修复建议，保持收藏夹健康。

### 元数据

```typescript
{
  id: "link_health_check",
  name: "链接健康检测",
  category: "utility",
  version: "1.0.0",
  capabilities: [
    "batch-check",           // 批量检测
    "error-classification",  // 错误分类
    "wayback-lookup",        // Wayback Machine 存档查询
    "fix-suggestions"        // 修复建议
  ],
  deliverableTypes: ["report", "list"],
  outputFormats: ["markdown", "json"],
  estimatedDurationMs: 30000,
  maxExecutionTimeMs: 120000
}
```

### 执行步骤

| 步骤 | ID       | 名称     | 进度 |
| ---- | -------- | -------- | ---- |
| 1    | collect  | 收集链接 | 10%  |
| 2    | check    | 批量检测 | 50%  |
| 3    | classify | 错误分类 | 15%  |
| 4    | lookup   | 存档查询 | 15%  |
| 5    | report   | 生成报告 | 10%  |

### 触发方式

**自然语言**:

- "检查我的收藏链接是否有效"
- "找出失效的链接"
- "清理过期链接"

### 错误分类

| 错误类型        | 说明           | 建议操作       |
| --------------- | -------------- | -------------- |
| `not_found`     | 404 页面不存在 | 查询存档或删除 |
| `server_error`  | 5xx 服务器错误 | 稍后重试       |
| `timeout`       | 请求超时       | 检查网络或重试 |
| `dns_error`     | DNS 解析失败   | 域名可能已关闭 |
| `redirect_loop` | 重定向循环     | 需手动检查     |
| `ssl_error`     | SSL 证书问题   | 可能不安全     |

### Feature Flag

```bash
ENABLE_LINK_HEALTH_CHECK=true  # 默认启用
```

---

## 3. 语音朗读助手 (tts_synthesis)

### 功能描述

将书签摘要内容转换为语音朗读，支持一句话总结、完整摘要、关键要点等多种模式。

### 元数据

```typescript
{
  id: "tts_synthesis",
  name: "语音朗读助手",
  category: "understanding",
  version: "1.0.0",
  capabilities: [
    "tts-synthesis",         // TTS 合成
    "content-extraction",    // 内容提取
    "audio-generation"       // 音频生成
  ],
  deliverableTypes: ["audio"],
  outputFormats: ["audio"],
  estimatedDurationMs: 10000,
  maxExecutionTimeMs: 60000
}
```

### 执行步骤

| 步骤 | ID         | 名称     | 进度 |
| ---- | ---------- | -------- | ---- |
| 1    | parse      | 解析请求 | 10%  |
| 2    | fetch      | 获取摘要 | 20%  |
| 3    | prepare    | 准备文本 | 20%  |
| 4    | synthesize | 合成语音 | 40%  |
| 5    | deliver    | 输出音频 | 10%  |

### 触发方式

**自然语言**:

- "帮我朗读这篇文章"
- "读一下摘要"
- "播放这个收藏的内容"
- "念给我听"

### 朗读模式

| 模式           | 说明       | 适用场景 |
| -------------- | ---------- | -------- |
| `one_sentence` | 一句话总结 | 快速了解 |
| `summary`      | 完整摘要   | 详细了解 |
| `key_points`   | 关键要点   | 学习记忆 |
| `full`         | 全文朗读   | 深度阅读 |

### Feature Flag

```bash
ENABLE_TTS_SYNTHESIS=true  # 默认启用
```

---

## 4. 微信阅读摘要 (wechat_digest)

### 功能描述

分析微信公众号收藏，按公众号或话题生成摘要报告，帮助用户回顾和整理阅读内容。

### 元数据

```typescript
{
  id: "wechat_digest",
  name: "微信阅读摘要",
  category: "understanding",
  version: "1.0.0",
  capabilities: [
    "wechat-analysis",       // 微信内容分析
    "content-digest",        // 内容摘要
    "topic-grouping",        // 话题分组
    "reading-insights"       // 阅读洞察
  ],
  deliverableTypes: ["report"],
  outputFormats: ["markdown", "json"],
  estimatedDurationMs: 30000,
  maxExecutionTimeMs: 120000
}
```

### 执行步骤

| 步骤 | ID        | 名称     | 进度 |
| ---- | --------- | -------- | ---- |
| 1    | analyze   | 分析收藏 | 15%  |
| 2    | extract   | 提取内容 | 25%  |
| 3    | group     | 话题分组 | 20%  |
| 4    | summarize | 生成摘要 | 25%  |
| 5    | compile   | 编译报告 | 15%  |

### 触发方式

**自然语言**:

- "帮我总结微信收藏"
- "生成公众号阅读摘要"
- "整理微信文章"

### 分组方式

| 方式      | 说明                 |
| --------- | -------------------- |
| `account` | 按公众号分组（默认） |
| `topic`   | 按话题/主题分组      |
| `date`    | 按日期分组           |

### 摘要深度

| 深度       | 说明             |
| ---------- | ---------------- |
| `brief`    | 简要摘要         |
| `standard` | 标准摘要（默认） |
| `detailed` | 详细摘要         |

### Feature Flag

```bash
ENABLE_WECHAT_DIGEST=true  # 默认启用
```

---

## 意图路由配置

### 意图规则 (intent-classifier.ts)

| 意图类型                     | 匹配模式                                                                                 | 目标 Skill            |
| ---------------------------- | ---------------------------------------------------------------------------------------- | --------------------- |
| `create:bilibili_transcript` | `/B站\|bilibili.{0,5}(字幕\|文字稿\|转文字)\|视频.{0,3}(字幕\|文字稿)\|提取.{0,3}字幕/i` | `bilibili_transcript` |
| `create:tts`                 | `/(?<!阅)读\|朗读\|播放.{0,3}摘要\|听\|语音\|念\|tts/i`                                  | `tts_synthesis`       |
| `analyze:wechat`             | `/微信.{0,3}(文章\|阅读\|收藏).{0,3}(摘要\|总结\|整理\|报告)\|公众号.{0,3}(摘要\|总结)/` | `wechat_digest`       |
| `organize:expire`            | `/过期\|失效\|无效.{0,3}链接/`                                                           | `link_health_check`   |

### Skill 映射 (mode-selector.ts)

```typescript
"create:bilibili_transcript": {
  skillId: "bilibili_transcript",
  name: "B站字幕提取",
  minComplexity: "medium",
  enabled: true
},
"create:tts": {
  skillId: "tts_synthesis",
  name: "语音朗读助手",
  minComplexity: "simple",
  enabled: true
},
"create:wechat_digest": {
  skillId: "wechat_digest",
  name: "微信阅读摘要",
  minComplexity: "medium",
  enabled: true
},
"organize:expire": {
  skillId: "link_health_check",
  name: "链接健康检测",
  minComplexity: "medium",
  enabled: true
}
```

---

## 文件结构

```
src/lib/ai-skills/skills/
├── bilibili-transcript/
│   ├── index.ts                           # 模块导出
│   ├── types.ts                           # 类型定义 + Zod Schema
│   ├── bilibili-transcript.skill.ts       # 主 Skill 类
│   ├── api/
│   │   ├── bilibili-api.ts                # B站 API 封装
│   │   └── url-parser.ts                  # URL 解析
│   ├── formatters/
│   │   └── transcript-formatter.ts        # 字幕格式化
│   └── __tests__/
│       ├── url-parser.test.ts
│       └── transcript-formatter.test.ts
│
├── link-health-check/
│   ├── index.ts
│   ├── types.ts
│   ├── link-health-check.skill.ts
│   ├── services/
│   │   ├── link-checker.ts                # 链接检测服务
│   │   └── wayback-service.ts             # Wayback 查询
│   └── __tests__/
│       └── link-health-check.skill.test.ts
│
├── tts-synthesis/
│   ├── index.ts
│   ├── types.ts
│   ├── tts-synthesis.skill.ts
│   ├── services/
│   │   └── tts-service.ts                 # TTS 服务
│   └── __tests__/
│       ├── tts-synthesis.skill.test.ts
│       └── tts-integration.test.ts
│
└── wechat-digest/
    ├── index.ts
    ├── types.ts
    ├── wechat-digest.skill.ts
    ├── services/
    │   └── digest-generator.ts            # 摘要生成服务
    └── __tests__/
        └── wechat-digest.skill.test.ts
```

---

## 注册配置

### register.ts

```typescript
// B站字幕提取（支持 Feature Flag 开关）
if (process.env.ENABLE_BILIBILI_TRANSCRIPT !== "false") {
  unifiedEngine.registerOrchestrationSkill(bilibiliTranscriptSkill);
}

// 链接健康检测（支持 Feature Flag 开关）
if (process.env.ENABLE_LINK_HEALTH_CHECK !== "false") {
  unifiedEngine.registerOrchestrationSkill(linkHealthCheckSkill);
}

// TTS 语音朗读（支持 Feature Flag 开关）
if (process.env.ENABLE_TTS_SYNTHESIS !== "false") {
  unifiedEngine.registerOrchestrationSkill(ttsSynthesisSkill);
}

// 微信阅读摘要（支持 Feature Flag 开关）
if (process.env.ENABLE_WECHAT_DIGEST !== "false") {
  unifiedEngine.registerOrchestrationSkill(wechatDigestSkill);
}
```

---

## 数据库字段

### bookmarks 表新增字段

```sql
-- B站字幕相关
ALTER TABLE bookmarks
  ADD COLUMN video_transcript TEXT,
  ADD COLUMN video_transcript_word_count INTEGER,
  ADD COLUMN video_transcript_status VARCHAR(20)
    CHECK (video_transcript_status IN ('pending', 'available', 'not_available', 'error'));
```

---

## 测试覆盖

| Skill               | 测试文件                                             | 测试数量 |
| ------------------- | ---------------------------------------------------- | -------- |
| bilibili_transcript | url-parser.test.ts, transcript-formatter.test.ts     | 46       |
| link_health_check   | link-health-check.skill.test.ts                      | ~20      |
| tts_synthesis       | tts-synthesis.skill.test.ts, tts-integration.test.ts | ~30      |
| wechat_digest       | wechat-digest.skill.test.ts                          | ~25      |

---

## 版本历史

| 版本  | 日期       | 变更                         |
| ----- | ---------- | ---------------------------- |
| 1.0.0 | 2025-12-27 | 初始版本，添加 4 个新 Skills |

---

## 相关文档

- [AI Skills 统一架构](../CLAUDE.md#5-ai-skills-统一智能架构-)
- [意图路由系统](./intent-routing.md)
- [编排引擎设计](./orchestration-engine.md)
