# AnyKeep 智能分类系统设计 V2.1

**版本**: 2.1
**日期**: 2025-12-05
**状态**: ✅ 已确认

---

## 目录

1. [问题诊断与解决方案](#一问题诊断与解决方案)
2. [系统概述](#二系统概述)
3. [用户生命周期](#三用户生命周期)
4. [冷启动机制](#四冷启动机制)
5. [智能分类引擎](#五智能分类引擎)
6. [待整理智能整理](#六待整理智能整理)
7. [文件夹管理策略](#七文件夹管理策略)
8. [用户画像系统](#八用户画像系统)
9. [数据模型设计](#九数据模型设计)
10. [核心算法实现](#十核心算法实现)
11. [实施计划](#十一实施计划)

---

## 一、问题诊断与解决方案

### 1.1 当前系统 5 个核心问题

通过代码审查发现的问题及本方案的解决措施：

| 问题 | 严重度 | 说明 | 本方案解决措施 |
|------|--------|------|----------------|
| **AI 缺乏文件夹上下文** | ⭐⭐⭐⭐⭐ | AI 只看到文件夹名称，不知道里面有什么内容 | ✅ 文件夹画像系统：提供 Top 标签、示例书签、统计信息给 AI |
| **未利用向量相似度** | ⭐⭐⭐⭐⭐ | 书签已有 1024 维向量，分类时完全没用 | ✅ 向量匹配 (40%权重)：计算书签与文件夹画像的余弦相似度 |
| **未学习用户偏好** | ⭐⭐⭐⭐ | 不知道用户把类似内容放在哪里 | ✅ 历史行为匹配 (30%权重)：分析相似书签的归属文件夹 |
| **硬编码语义映射** | ⭐⭐⭐ | `semanticKeywords` 覆盖面有限 | ✅ 动态画像：基于实际书签内容生成标签和关键词 |
| **没有文件夹画像** | ⭐⭐⭐⭐⭐ | 文件夹没有语义表示，无法计算相似度 | ✅ folder_profiles 表：存储画像向量、统计、元数据 |

### 1.2 解决方案架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        问题 → 解决方案映射                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  问题: AI 缺乏上下文                                                         │
│  ──────────────────                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 解决: 增强版 AI Prompt                                               │   │
│  │                                                                      │   │
│  │ 【内容相似度最高的文件夹】                                            │   │
│  │ - "前端学习" (相似度: 85%)                                           │   │
│  │   已有 23 个书签                                                     │   │
│  │   高频标签: React, Vue, TypeScript                                   │   │
│  │   示例内容: React 18 新特性; Vue 3 组合式 API                        │   │
│  │                                                                      │   │
│  │ 【用户历史偏好】                                                      │   │
│  │ - "前端学习": 6 个相似书签也放在这里                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  问题: 未利用向量                                                            │
│  ──────────────────                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 解决: 向量相似度匹配                                                  │   │
│  │                                                                      │   │
│  │ 书签向量 ─────────► cosine_similarity ◄───────── 文件夹画像向量      │   │
│  │ (1024维)              │                           (1024维)           │   │
│  │                       ▼                                              │   │
│  │               相似度排名 Top 5                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  问题: 未学习偏好                                                            │
│  ──────────────────                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 解决: 历史行为分析                                                    │   │
│  │                                                                      │   │
│  │ 新书签 ──► 找 10 个最相似的历史书签 ──► 统计它们的文件夹分布          │   │
│  │                                                                      │   │
│  │ 结果: "前端学习"文件夹出现 6 次 → 大概率也该放这里                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、系统概述

### 2.1 设计目标

构建一个**自适应、千人千面**的智能分类系统：

- **冷启动友好**：新用户无需手动创建文件夹即可开始使用
- **渐进式学习**：随着收藏增多，系统越来越了解用户偏好
- **适度自动化**：在恰当时机自动创建文件夹，但控制数量
- **尊重个性化**：不同用户有不同的分类风格，系统要适应

### 2.2 已确认的配置参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 权重配置 | 向量 40% + 历史 30% + AI 30% | 综合评分权重 |
| 低置信度阈值 | < 30 | 低于此值放入待整理 |
| 历史匹配数量 | 10 | 参考最近 10 个相似书签 |
| 画像更新策略 | 定时批量 | 每日凌晨更新 |
| **文件夹数量上限** | **16 个** | 所有用户统一 |
| **单日自动创建上限** | **8 个** | 防止过度自动化 |
| 聚类相似度阈值 | 70% | 相似度 > 70% 聚为一组 |
| 聚类最小规模 | 5 个 | 至少 5 个书签才建议整理 |

---

## 三、用户生命周期

### 3.1 阶段定义

```
用户生命周期阶段
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

阶段 1: 新手期 (Onboarding)
├── 触发: 用户注册
├── 特征: 0 书签，无分类文件夹
├── 系统行为:
│   ├── 展示兴趣选择引导（可跳过）
│   ├── 根据选择预创建 3-5 个文件夹
│   └── 若跳过，仅保留系统文件夹
└── 持续: 至首次收藏

阶段 2: 冷启动期 (Cold Start)
├── 触发: 首次收藏
├── 特征: 1-20 书签，文件夹画像不足
├── 系统行为:
│   ├── 所有书签优先放入「待整理」
│   ├── 积累到一定量后触发首次整理建议
│   └── AI 基于内容主题推荐文件夹结构
└── 持续: 至 20 书签

阶段 3: 成长期 (Growing)
├── 触发: 书签数 > 20
├── 特征: 有一定历史数据，开始形成分类模式
├── 系统行为:
│   ├── 启用向量匹配 + 历史行为
│   ├── 高置信度直接分类，低置信度放待整理
│   └── 待整理达阈值时触发智能整理
└── 持续: 至 100 书签

阶段 4: 成熟期 (Mature)
├── 触发: 书签数 > 100
├── 特征: 丰富的历史数据和文件夹画像
├── 系统行为:
│   ├── 高精度个性化分类
│   ├── 主动建议合并相似文件夹
│   └── 定期健康度检查
└── 持续: 长期
```

---

## 四、冷启动机制

### 4.1 注册时兴趣选择

#### 4.1.1 预定义兴趣领域（12 个）

```typescript
/**
 * 预定义的兴趣领域
 * 覆盖主流用户群体的常见知识领域
 */
export const PRESET_INTEREST_DOMAINS = {
  // 技术类 (4个)
  tech_frontend: {
    name: '前端开发',
    icon: '🖥️',
    category: 'tech',
    keywords: ['React', 'Vue', 'CSS', 'JavaScript', 'TypeScript'],
    suggestedFolders: ['前端学习', '框架教程', '组件库']
  },
  tech_backend: {
    name: '后端开发',
    icon: '⚙️',
    category: 'tech',
    keywords: ['Node.js', 'Python', 'Java', 'Go', '数据库'],
    suggestedFolders: ['后端技术', 'API设计', '架构模式']
  },
  tech_ai: {
    name: 'AI/机器学习',
    icon: '🤖',
    category: 'tech',
    keywords: ['ChatGPT', '大模型', '深度学习', 'Prompt'],
    suggestedFolders: ['AI工具', '学习资料', '论文收藏']
  },
  tech_mobile: {
    name: '移动开发',
    icon: '📱',
    category: 'tech',
    keywords: ['iOS', 'Android', 'Flutter', 'React Native'],
    suggestedFolders: ['移动开发', 'App设计']
  },

  // 设计类 (2个)
  design_ui: {
    name: 'UI/UX设计',
    icon: '🎨',
    category: 'design',
    keywords: ['Figma', '界面设计', '用户体验', '交互'],
    suggestedFolders: ['设计灵感', '设计规范', '工具资源']
  },
  design_graphic: {
    name: '平面设计',
    icon: '🖼️',
    category: 'design',
    keywords: ['海报', '品牌', 'Logo', '配色'],
    suggestedFolders: ['视觉设计', '品牌案例']
  },

  // 产品/运营类 (2个)
  product: {
    name: '产品经理',
    icon: '📊',
    category: 'business',
    keywords: ['需求', '原型', '用户研究', '数据分析'],
    suggestedFolders: ['产品方法论', '竞品分析', '数据报告']
  },
  marketing: {
    name: '营销运营',
    icon: '📈',
    category: 'business',
    keywords: ['增长', '转化', '内容营销', '社群'],
    suggestedFolders: ['营销案例', '运营工具', '增长策略']
  },

  // 生活/学习类 (4个)
  reading: {
    name: '阅读写作',
    icon: '📚',
    category: 'lifestyle',
    keywords: ['书籍', '文章', '写作技巧', '知识管理'],
    suggestedFolders: ['书单', '好文收藏', '写作素材']
  },
  investment: {
    name: '投资理财',
    icon: '💰',
    category: 'lifestyle',
    keywords: ['股票', '基金', '理财', '财经'],
    suggestedFolders: ['投资学习', '市场分析', '理财工具']
  },
  lifestyle: {
    name: '生活方式',
    icon: '🌟',
    category: 'lifestyle',
    keywords: ['美食', '旅行', '健康', '穿搭'],
    suggestedFolders: ['生活灵感', '好物推荐']
  },
  learning: {
    name: '学习提升',
    icon: '🎓',
    category: 'lifestyle',
    keywords: ['课程', '教程', '技能', '认证'],
    suggestedFolders: ['学习资料', '课程收藏', '教程笔记']
  }
} as const

export type PresetInterestId = keyof typeof PRESET_INTEREST_DOMAINS
```

#### 4.1.2 用户自定义兴趣

```typescript
/**
 * 用户自定义兴趣领域
 */
export interface CustomInterest {
  id: string                    // 唯一标识 (uuid)
  userId: string                // 所属用户
  name: string                  // 名称 (最长 20 字符)
  icon: string                  // emoji 图标
  keywords: string[]            // 关键词 (最多 10 个)
  suggestedFolders: string[]    // 建议文件夹 (最多 3 个)
  createdAt: Date
}

/**
 * 用户兴趣配置（预设 + 自定义）
 */
export interface UserInterestConfig {
  presetInterests: PresetInterestId[]   // 选择的预设兴趣
  customInterests: CustomInterest[]      // 自定义兴趣 (最多 5 个)
}

// 自定义兴趣限制
export const CUSTOM_INTEREST_LIMITS = {
  MAX_CUSTOM_INTERESTS: 5,      // 最多 5 个自定义兴趣
  MAX_NAME_LENGTH: 20,          // 名称最长 20 字符
  MAX_KEYWORDS: 10,             // 最多 10 个关键词
  MAX_SUGGESTED_FOLDERS: 3      // 最多建议 3 个文件夹
}
```

#### 4.1.3 兴趣选择 UI 流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        注册完成 - 兴趣选择引导                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  👋 欢迎来到 AnyKeep！                                                      │
│                                                                             │
│  为了帮你更好地整理收藏，请选择你感兴趣的领域（可多选）                        │
│                                                                             │
│  【技术】                                                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ 🖥️ 前端开发  │ │ ⚙️ 后端开发  │ │ 🤖 AI/ML    │ │ 📱 移动开发  │       │
│  │   [✓]       │ │   [ ]       │ │   [✓]       │ │   [ ]       │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                             │
│  【设计】                           【产品/运营】                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ 🎨 UI设计   │ │ 🖼️ 平面设计  │ │ 📊 产品经理  │ │ 📈 营销运营  │       │
│  │   [ ]       │ │   [ ]       │ │   [ ]       │ │   [ ]       │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                             │
│  【生活/学习】                                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ 📚 阅读写作  │ │ 💰 投资理财  │ │ 🌟 生活方式  │ │ 🎓 学习提升  │       │
│  │   [✓]       │ │   [ ]       │ │   [ ]       │ │   [ ]       │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ➕ 添加自定义兴趣领域                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  已选择: 3 个领域                                                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  根据你的选择，我们将创建以下文件夹：                                   │   │
│  │  • 前端学习  • AI工具  • 学习资料  • 好文收藏  • 框架教程              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│          [ 跳过，稍后设置 ]              [ 确认并开始使用 ]                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 4.1.4 自定义兴趣添加弹窗

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        添加自定义兴趣领域                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  图标:  [ 🎯 ▼ ]                                                            │
│                                                                             │
│  名称:  [ 区块链技术______________ ]  (最多 20 字符)                         │
│                                                                             │
│  关键词 (帮助 AI 识别相关内容):                                              │
│  [ Web3 ] [ DeFi ] [ NFT ] [ 智能合约 ] [ + 添加 ]                          │
│                                                                             │
│  建议创建的文件夹:                                                           │
│  [ 区块链学习 ] [ + 添加 ]                                                   │
│                                                                             │
│                                                                             │
│                    [ 取消 ]              [ 保存 ]                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 预创建文件夹逻辑

```typescript
/**
 * 根据用户选择的兴趣领域，预创建文件夹
 * 限制总数不超过 16 个（用户文件夹上限）
 */
export async function createInitialFolders(
  userId: string,
  config: UserInterestConfig
): Promise<string[]> {
  const MAX_FOLDERS = 16  // 用户文件夹上限
  const MAX_INITIAL = 7   // 初始预创建最多 7 个
  const MIN_INITIAL = 3   // 初始预创建最少 3 个

  // 收集所有建议的文件夹
  const allSuggestedFolders: string[] = []

  // 从预设兴趣收集
  for (const interestId of config.presetInterests) {
    const domain = PRESET_INTEREST_DOMAINS[interestId]
    allSuggestedFolders.push(...domain.suggestedFolders)
  }

  // 从自定义兴趣收集
  for (const custom of config.customInterests) {
    allSuggestedFolders.push(...custom.suggestedFolders)
  }

  // 去重
  const uniqueFolders = [...new Set(allSuggestedFolders)]

  // 限制数量
  let finalFolders = uniqueFolders.slice(0, Math.min(MAX_INITIAL, MAX_FOLDERS))

  // 确保至少有最小数量
  if (finalFolders.length < MIN_INITIAL) {
    const defaultFolders = ['学习资料', '稍后阅读', '收藏夹']
    for (const df of defaultFolders) {
      if (finalFolders.length >= MIN_INITIAL) break
      if (!finalFolders.includes(df)) {
        finalFolders.push(df)
      }
    }
  }

  // 创建文件夹
  const supabase = await createClient()
  for (const folderName of finalFolders) {
    await supabase.from('folders').insert({
      user_id: userId,
      name: folderName,
      is_system: false,
      source: 'interest_onboarding'
    })
  }

  // 记录用户兴趣配置
  await supabase.from('profiles').update({
    settings: {
      interest_config: config,
      onboarding_completed_at: new Date().toISOString()
    }
  }).eq('id', userId)

  return finalFolders
}
```

---

## 五、智能分类引擎

### 5.1 分类决策流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        智能分类决策流程                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  新书签输入 (title, summary, tags, embedding)                               │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 0: 判断用户阶段                                                 │   │
│  │ ────────────────────────────────────────────────────────────────────│   │
│  │  冷启动期 (≤20书签)? ──Yes──► 直接放入「待整理」                      │   │
│  │      │                                                               │   │
│  │      No (成长期/成熟期)                                              │   │
│  │      ▼                                                               │   │
│  └──────┼───────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 1: 向量相似度匹配 (权重 40%)                                    │   │
│  │ ────────────────────────────────────────────────────────────────────│   │
│  │  • 计算书签向量与各文件夹画像向量的余弦相似度                          │   │
│  │  • 获取 Top 5 最相似的文件夹                                          │   │
│  │  • 解决问题：未利用向量相似度 ✅                                       │   │
│  └──────┬───────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 2: 历史行为匹配 (权重 30%)                                      │   │
│  │ ────────────────────────────────────────────────────────────────────│   │
│  │  • 找到与新书签最相似的 10 个历史书签                                 │   │
│  │  • 统计这些书签的文件夹分布                                           │   │
│  │  • 解决问题：未学习用户偏好 ✅                                         │   │
│  └──────┬───────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 3: AI 上下文增强推荐 (权重 30%)                                 │   │
│  │ ────────────────────────────────────────────────────────────────────│   │
│  │  • 将 Step 1&2 的候选文件夹 + 示例书签提供给 AI                       │   │
│  │  • AI 基于丰富上下文做最终决策                                        │   │
│  │  • 解决问题：AI 缺乏文件夹上下文 ✅                                    │   │
│  └──────┬───────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 4: 综合评分 & 决策                                              │   │
│  │ ────────────────────────────────────────────────────────────────────│   │
│  │  final_score = 0.4 × vector + 0.3 × history + 0.3 × ai              │   │
│  │                                                                      │   │
│  │  if (score >= 30) → 分类到推荐的文件夹                                │   │
│  │  if (score < 30)  → 放入「待整理」文件夹                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 增强版 AI Prompt（解决上下文问题）

```typescript
function buildEnhancedPrompt(context: RecommendationContext): string {
  const { title, summary, tags, vectorMatches, historyMatches, allFolders } = context

  let candidateFolders = ''

  // 【关键改进】提供文件夹内容上下文，而不仅是名称
  if (vectorMatches.length > 0) {
    candidateFolders += '\n【内容相似度最高的文件夹】\n'
    for (const match of vectorMatches.slice(0, 3)) {
      candidateFolders += `- "${match.folderName}" (相似度: ${(match.similarity * 100).toFixed(0)}%)\n`
      candidateFolders += `  已有 ${match.bookmarkCount} 个书签\n`
      candidateFolders += `  高频标签: ${match.topTags.slice(0, 5).join(', ') || '无'}\n`
      candidateFolders += `  示例内容: ${match.sampleTitles.slice(0, 2).join('; ') || '无'}\n`
    }
  }

  // 【关键改进】提供用户历史分类偏好
  if (historyMatches.length > 0) {
    candidateFolders += '\n【用户历史偏好（相似书签的去向）】\n'
    for (const match of historyMatches.slice(0, 3)) {
      candidateFolders += `- "${match.folderName}": ${match.similarBookmarkCount} 个相似书签\n`
      candidateFolders += `  相似书签: ${match.similarTitles.slice(0, 2).join('; ')}\n`
    }
  }

  return `请为以下书签选择最合适的文件夹。

【书签信息】
标题：${title}
摘要：${summary || '无'}
标签：${tags.join(', ') || '无'}
${candidateFolders}

【决策要求】
1. 优先考虑"内容相似度最高"的文件夹
2. 参考"用户历史偏好"了解用户的分类习惯
3. 只有完全不匹配时，才建议新建文件夹

【返回格式】(JSON)
{
  "folderId": 123,
  "folderName": "文件夹名",
  "confidence": 85,
  "reason": "选择理由"
}

只返回 JSON，不要其他内容。`
}
```

---

## 六、待整理智能整理

### 6.1 整理触发条件

```typescript
export const INBOX_ORGANIZE_TRIGGERS = {
  COUNT_THRESHOLD: 10,           // 待整理达到 10 条时触发
  DAYS_SINCE_LAST_ORGANIZE: 7,   // 或距离上次整理超过 7 天
  MIN_CLUSTER_SIZE: 5,           // 聚类最小规模 5 个
  CLUSTER_SIMILARITY: 0.7        // 相似度阈值 70%
}
```

### 6.2 整理流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        待整理智能整理流程                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  待整理文件夹 (10+ 书签)                                                     │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 1: 聚类分析                                                     │   │
│  │ ────────────────────────────────────────────────────────────────────│   │
│  │  • 基于向量相似度，将书签分组                                         │   │
│  │  • 相似度 > 70% 的归为一组                                           │   │
│  │  • 每组至少 5 个书签                                                  │   │
│  └──────┬───────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 2: 匹配现有文件夹                                               │   │
│  │ ────────────────────────────────────────────────────────────────────│   │
│  │  对每个聚类:                                                          │   │
│  │  • 计算聚类中心与各文件夹画像的相似度                                  │   │
│  │  • 相似度 > 60% → 建议移动到该文件夹                                  │   │
│  │  • 相似度 < 60% → 建议创建新文件夹                                    │   │
│  └──────┬───────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 3: 生成整理建议                                                 │   │
│  │ ────────────────────────────────────────────────────────────────────│   │
│  │  • 建议 A: 移动到现有文件夹                                           │   │
│  │  • 建议 B: 创建新文件夹（需检查数量限制）                             │   │
│  │  • 剩余书签: 继续留在待整理                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 整理建议 UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📥 待整理智能整理                                                15 个书签   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  发现以下整理机会：                                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 💡 建议 1: 移动到「前端学习」                           置信度: 85%  │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │ 6 个书签内容与「前端学习」文件夹相似                                  │   │
│  │                                                                     │   │
│  │ 📄 React 18 新特性详解                                              │   │
│  │ 📄 Vue 3 组合式 API 入门                                            │   │
│  │ 📄 TypeScript 高级类型技巧                                          │   │
│  │ ...还有 3 个                                                        │   │
│  │                                                                     │   │
│  │        [ 忽略 ]    [ 修改目标 ▼ ]    [ ✓ 确认移动 ]                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 💡 建议 2: 创建新文件夹「AI工具」                       置信度: 72%  │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │ 5 个书签内容相似，建议创建新文件夹归类                                │   │
│  │                                                                     │   │
│  │ 📄 ChatGPT 提示词技巧大全                                           │   │
│  │ 📄 Claude 3 使用指南                                                │   │
│  │ 📄 AI 绘画工具对比                                                  │   │
│  │ ...还有 2 个                                                        │   │
│  │                                                                     │   │
│  │        [ 忽略 ]    [ ✏️ 修改名称 ]    [ ✓ 创建并移动 ]               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  剩余 4 个书签暂无明显规律，继续留在待整理                                   │
│                                                                             │
│                    [ 全部忽略 ]              [ 🚀 一键应用所有建议 ]          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 七、文件夹管理策略

### 7.1 数量限制（已确认）

```typescript
export const FOLDER_LIMITS = {
  // 所有用户统一上限
  MAX_FOLDERS: 16,

  // 单日自动创建上限
  MAX_AUTO_CREATE_PER_DAY: 8,

  // 初始预创建范围
  INITIAL_MIN: 3,
  INITIAL_MAX: 7,

  // 合并建议阈值
  MERGE_SIMILARITY_THRESHOLD: 0.8,

  // 拆分建议阈值
  SPLIT_SIZE_THRESHOLD: 100
}
```

### 7.2 自动创建条件检查

```typescript
export async function shouldAutoCreateFolder(
  userId: string,
  suggestedName: string,
  bookmarkCount: number
): Promise<{ allowed: boolean; reason: string }> {
  const supabase = await createClient()

  // 1. 检查总数量限制
  const { count: folderCount } = await supabase
    .from('folders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_system', false)
    .is('deleted_at', null)

  if ((folderCount || 0) >= FOLDER_LIMITS.MAX_FOLDERS) {
    return {
      allowed: false,
      reason: `已达到文件夹数量上限(${FOLDER_LIMITS.MAX_FOLDERS}个)，请整理现有文件夹`
    }
  }

  // 2. 检查今日创建次数
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count: todayCreatedCount } = await supabase
    .from('folders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_system', false)
    .gte('created_at', today.toISOString())

  if ((todayCreatedCount || 0) >= FOLDER_LIMITS.MAX_AUTO_CREATE_PER_DAY) {
    return {
      allowed: false,
      reason: `今日已创建 ${FOLDER_LIMITS.MAX_AUTO_CREATE_PER_DAY} 个文件夹，请明日再试`
    }
  }

  // 3. 检查是否有相似名称
  const { data: similarFolders } = await supabase
    .from('folders')
    .select('id, name')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .ilike('name', `%${suggestedName}%`)

  if (similarFolders && similarFolders.length > 0) {
    return {
      allowed: false,
      reason: `已存在相似文件夹「${similarFolders[0].name}」，建议移动到该文件夹`
    }
  }

  // 4. 检查书签数量
  if (bookmarkCount < INBOX_ORGANIZE_TRIGGERS.MIN_CLUSTER_SIZE) {
    return {
      allowed: false,
      reason: `书签数量不足(需要至少${INBOX_ORGANIZE_TRIGGERS.MIN_CLUSTER_SIZE}个)`
    }
  }

  return { allowed: true, reason: '' }
}
```

---

## 八、用户画像系统

### 8.1 基础画像（已实现）

```typescript
interface BasicUserProfile {
  // 兴趣配置
  interestConfig: UserInterestConfig

  // 分类阶段
  classificationStage: 'onboarding' | 'cold_start' | 'growing' | 'mature'

  // 统计数据
  totalBookmarks: number
  totalFolders: number
  lastActivityAt: Date
}
```

### 8.2 扩展画像（未来可考虑）

```typescript
/**
 * 扩展用户画像
 * 用于更深层的个性化（千人千面）
 */
interface ExtendedUserProfile {
  // 职业信息（可选填）
  occupation?: {
    type: 'developer' | 'designer' | 'product_manager' | 'marketer' | 'student' | 'other'
    industry?: string        // 所属行业
    yearsOfExperience?: number
  }

  // 使用场景（可选填）
  usageScenarios?: Array<'learning' | 'work_reference' | 'inspiration' | 'entertainment' | 'research'>

  // 内容偏好（系统学习）
  contentPreferences?: {
    preferredPlatforms: string[]    // 常收藏的平台
    preferredFormats: string[]      // 偏好的内容格式（文章/视频/工具）
    averageReadingTime?: number     // 平均阅读时长（从阅读记录学习）
  }

  // 分类风格（系统学习）
  classificationStyle?: {
    granularity: 'coarse' | 'medium' | 'fine'  // 粗分类 / 中等 / 细分类
    namingPattern: 'topic' | 'purpose' | 'mixed'  // 按主题 / 按用途 / 混合
    averageFolderSize: number  // 平均每个文件夹书签数
  }
}
```

### 8.3 画像收集时机

| 画像类型 | 收集时机 | 收集方式 |
|---------|---------|---------|
| 兴趣配置 | 注册时 | 用户主动选择 |
| 职业信息 | 设置页/引导 | 用户主动填写（可选） |
| 使用场景 | 设置页/引导 | 用户主动选择（可选） |
| 内容偏好 | 持续 | 系统自动学习 |
| 分类风格 | 持续 | 系统自动学习 |

### 8.4 职业/场景选择 UI（扩展功能）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        完善你的资料（可选）                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  帮助我们更好地理解你的需求 💡                                               │
│                                                                             │
│  你的职业是？                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ 💻 开发者    │ │ 🎨 设计师    │ │ 📊 产品经理  │ │ 📈 市场运营  │       │
│  │   [✓]       │ │   [ ]       │ │   [ ]       │ │   [ ]       │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐                                         │
│  │ 🎓 学生     │ │ 📝 其他     │                                         │
│  │   [ ]       │ │   [ ]       │                                         │
│  └──────────────┘ └──────────────┘                                         │
│                                                                             │
│  你主要用 AnyKeep 来？（可多选）                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ 📚 学习提升  │ │ 💼 工作参考  │ │ 💡 找灵感    │ │ 🔬 研究调研  │       │
│  │   [✓]       │ │   [✓]       │ │   [ ]       │ │   [ ]       │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                             │
│                    [ 跳过 ]              [ 保存 ]                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 九、数据模型设计

### 9.1 新增表

#### 9.1.1 用户自定义兴趣表

```sql
CREATE TABLE IF NOT EXISTS public.user_custom_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(20) NOT NULL,
  icon VARCHAR(10) NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  suggested_folders TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT max_keywords CHECK (cardinality(keywords) <= 10),
  CONSTRAINT max_folders CHECK (cardinality(suggested_folders) <= 3)
);

CREATE INDEX idx_custom_interests_user ON public.user_custom_interests(user_id);

-- RLS
ALTER TABLE public.user_custom_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own custom interests"
  ON public.user_custom_interests FOR ALL
  USING (auth.uid() = user_id);
```

#### 9.1.2 文件夹画像表（增强版）

```sql
CREATE TABLE IF NOT EXISTS public.folder_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,

  -- 画像向量
  profile_embedding vector(1024),

  -- 统计信息
  bookmark_count INT DEFAULT 0,
  last_bookmark_at TIMESTAMPTZ,

  -- 画像元数据
  top_tags TEXT[],
  sample_titles TEXT[],
  internal_similarity FLOAT,  -- 内部一致性

  -- 来源标记
  source VARCHAR(50),  -- interest_onboarding | manual | auto_created

  -- 时间戳
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(folder_id)
);

CREATE INDEX idx_folder_profiles_user ON public.folder_profiles(user_id);
CREATE INDEX idx_folder_profiles_embedding ON public.folder_profiles
  USING hnsw (profile_embedding vector_cosine_ops);

-- RLS
ALTER TABLE public.folder_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folder profiles"
  ON public.folder_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own folder profiles"
  ON public.folder_profiles FOR ALL
  USING (auth.uid() = user_id);
```

#### 9.1.3 整理建议表

```sql
CREATE TABLE IF NOT EXISTS public.organization_suggestions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  suggestion_type VARCHAR(20) NOT NULL,  -- move_to_existing | create_new
  bookmark_ids BIGINT[] NOT NULL,

  target_folder_id BIGINT REFERENCES public.folders(id),
  suggested_folder_name VARCHAR(100),

  confidence INT NOT NULL,
  reason TEXT,
  sample_titles TEXT[],

  status VARCHAR(20) DEFAULT 'pending',  -- pending | accepted | rejected | expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,

  CONSTRAINT valid_suggestion_type CHECK (
    suggestion_type IN ('move_to_existing', 'create_new', 'merge', 'split')
  )
);

CREATE INDEX idx_org_suggestions_user_status
  ON public.organization_suggestions(user_id, status);

-- RLS
ALTER TABLE public.organization_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own suggestions"
  ON public.organization_suggestions FOR ALL
  USING (auth.uid() = user_id);
```

### 9.2 profiles 表扩展字段

```sql
-- 在 profiles.settings JSON 中添加以下字段结构
{
  "interest_config": {
    "preset_interests": ["tech_frontend", "tech_ai", "reading"],
    "custom_interest_ids": ["uuid1", "uuid2"]
  },
  "classification_stage": "growing",
  "onboarding_completed_at": "2025-12-05T10:00:00Z",
  "last_inbox_organize_at": "2025-12-01T00:00:00Z",

  // 扩展画像（可选）
  "extended_profile": {
    "occupation": "developer",
    "usage_scenarios": ["learning", "work_reference"]
  }
}
```

---

## 十、解耦架构设计

### 10.1 设计原则

遵循 **SOLID** 原则，确保系统可测试、可扩展、易维护：

- **S**ingle Responsibility: 每个模块只负责一个功能
- **O**pen/Closed: 对扩展开放，对修改关闭
- **L**iskov Substitution: 可替换的策略实现
- **I**nterface Segregation: 小而专的接口
- **D**ependency Inversion: 依赖抽象而非具体实现

### 10.2 模块架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        智能分类系统 - 解耦架构                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API 层 (Routes)                              │   │
│  │  /api/classification/classify    - 分类书签                          │   │
│  │  /api/classification/inbox       - 分析待整理                         │   │
│  │  /api/classification/interests   - 兴趣管理                          │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                             │                                              │
│                             ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Service 层 (业务逻辑)                            │   │
│  │  ClassificationService  - 分类服务协调器                              │   │
│  │  InboxOrganizerService  - 待整理整理服务                              │   │
│  │  InterestService        - 兴趣管理服务                                │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                             │                                              │
│                             ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Strategy 层 (可插拔策略)                         │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │ VectorMatcher   │  │ HistoryMatcher  │  │ AIRecommender   │      │   │
│  │  │ (向量匹配策略)   │  │ (历史匹配策略)   │  │ (AI推荐策略)    │      │   │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘      │   │
│  │           │                    │                    │               │   │
│  │           └────────────────────┼────────────────────┘               │   │
│  │                                │                                    │   │
│  │                    ┌───────────▼───────────┐                        │   │
│  │                    │   ScoreAggregator     │                        │   │
│  │                    │   (评分聚合器)         │                        │   │
│  │                    └───────────────────────┘                        │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                             │                                              │
│                             ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Repository 层 (数据访问)                         │   │
│  │  FolderProfileRepository  - 文件夹画像数据                            │   │
│  │  BookmarkRepository       - 书签数据                                  │   │
│  │  InterestRepository       - 兴趣数据                                  │   │
│  │  SuggestionRepository     - 建议数据                                  │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                             │                                              │
│                             ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Infrastructure 层                               │   │
│  │  Supabase Client  │  Embedding Generator  │  AI Client (DeepSeek)   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 目录结构

```
src/lib/classification/
├── index.ts                      # 模块入口，导出公共 API
│
├── types/                        # 类型定义
│   ├── index.ts
│   ├── classification.ts         # 分类相关类型
│   ├── interest.ts               # 兴趣相关类型
│   └── suggestion.ts             # 建议相关类型
│
├── constants/                    # 常量配置
│   ├── index.ts
│   ├── limits.ts                 # 限制配置 (文件夹数量、阈值等)
│   └── interest-domains.ts       # 预设兴趣领域
│
├── repositories/                 # 数据访问层
│   ├── index.ts
│   ├── folder-profile.repository.ts
│   ├── bookmark.repository.ts
│   ├── interest.repository.ts
│   └── suggestion.repository.ts
│
├── strategies/                   # 策略实现
│   ├── index.ts
│   ├── interfaces.ts             # 策略接口定义
│   ├── vector-matcher.ts         # 向量匹配策略
│   ├── history-matcher.ts        # 历史匹配策略
│   ├── ai-recommender.ts         # AI 推荐策略
│   └── score-aggregator.ts       # 评分聚合器
│
├── services/                     # 业务服务层
│   ├── index.ts
│   ├── classification.service.ts # 分类服务
│   ├── inbox-organizer.service.ts# 待整理整理服务
│   ├── interest.service.ts       # 兴趣管理服务
│   └── user-stage.service.ts     # 用户阶段服务
│
└── utils/                        # 工具函数
    ├── index.ts
    ├── clustering.ts             # 聚类算法
    └── similarity.ts             # 相似度计算
```

### 10.4 核心接口定义

#### 10.4.1 匹配策略接口

```typescript
// src/lib/classification/strategies/interfaces.ts

/**
 * 匹配结果
 */
export interface MatchResult {
  folderId: number
  folderName: string
  score: number           // 0-100 的分数
  confidence: number      // 置信度
  reason: string          // 匹配原因
  metadata?: Record<string, unknown>  // 额外元数据
}

/**
 * 匹配器上下文
 */
export interface MatcherContext {
  userId: string
  title: string
  summary: string
  tags: string[]
  embedding: number[]
}

/**
 * 匹配器策略接口
 * 所有匹配策略都需要实现此接口
 */
export interface IMatcher {
  /** 策略名称 */
  readonly name: string

  /** 策略权重 (0-1) */
  readonly weight: number

  /**
   * 执行匹配
   * @param context 匹配上下文
   * @returns 匹配结果列表
   */
  match(context: MatcherContext): Promise<MatchResult[]>

  /**
   * 检查策略是否可用
   * @param context 匹配上下文
   * @returns 是否可用
   */
  isAvailable(context: MatcherContext): Promise<boolean>
}
```

#### 10.4.2 评分聚合器接口

```typescript
/**
 * 评分聚合策略接口
 */
export interface IScoreAggregator {
  /**
   * 聚合多个匹配器的结果
   * @param results 各匹配器的结果
   * @param matchers 匹配器列表（用于获取权重）
   * @returns 最终推荐结果
   */
  aggregate(
    results: Map<string, MatchResult[]>,
    matchers: IMatcher[]
  ): ClassificationResult
}

/**
 * 分类结果
 */
export interface ClassificationResult {
  folderId: number | null
  folderName: string
  confidence: number
  reason: string
  action: 'classify' | 'inbox' | 'suggest_new'
  scores: {
    vectorScore: number
    historyScore: number
    aiScore: number
  }
  matchDetails?: MatchResult[]  // 详细匹配信息（用于调试）
}
```

#### 10.4.3 服务接口

```typescript
// src/lib/classification/services/interfaces.ts

/**
 * 分类服务接口
 */
export interface IClassificationService {
  /**
   * 对书签进行分类
   */
  classify(
    userId: string,
    bookmark: BookmarkInput
  ): Promise<ClassificationResult>

  /**
   * 批量分类
   */
  classifyBatch(
    userId: string,
    bookmarks: BookmarkInput[]
  ): Promise<ClassificationResult[]>
}

/**
 * 待整理整理服务接口
 */
export interface IInboxOrganizerService {
  /**
   * 分析待整理文件夹
   */
  analyze(userId: string): Promise<OrganizationAnalysis>

  /**
   * 应用整理建议
   */
  applySuggestion(
    userId: string,
    suggestionId: number
  ): Promise<void>

  /**
   * 拒绝整理建议
   */
  rejectSuggestion(
    userId: string,
    suggestionId: number
  ): Promise<void>
}

/**
 * 兴趣服务接口
 */
export interface IInterestService {
  /**
   * 获取用户兴趣配置
   */
  getUserInterests(userId: string): Promise<UserInterestConfig>

  /**
   * 设置预设兴趣
   */
  setPresetInterests(
    userId: string,
    interestIds: PresetInterestId[]
  ): Promise<void>

  /**
   * 添加自定义兴趣
   */
  addCustomInterest(
    userId: string,
    interest: CustomInterestInput
  ): Promise<CustomInterest>

  /**
   * 根据兴趣创建初始文件夹
   */
  createInitialFolders(userId: string): Promise<string[]>
}
```

### 10.5 依赖注入设计

```typescript
// src/lib/classification/container.ts

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * 依赖容器
 * 管理所有服务和策略的实例化
 */
export class ClassificationContainer {
  private supabase: SupabaseClient

  // 单例实例
  private static instance: ClassificationContainer | null = null

  // 缓存的服务实例
  private _classificationService: IClassificationService | null = null
  private _inboxOrganizerService: IInboxOrganizerService | null = null
  private _interestService: IInterestService | null = null

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  /**
   * 初始化容器
   */
  static initialize(supabase: SupabaseClient): ClassificationContainer {
    if (!ClassificationContainer.instance) {
      ClassificationContainer.instance = new ClassificationContainer(supabase)
    }
    return ClassificationContainer.instance
  }

  /**
   * 获取容器实例
   */
  static getInstance(): ClassificationContainer {
    if (!ClassificationContainer.instance) {
      throw new Error('ClassificationContainer not initialized')
    }
    return ClassificationContainer.instance
  }

  /**
   * 获取分类服务
   */
  getClassificationService(): IClassificationService {
    if (!this._classificationService) {
      // 创建依赖
      const folderProfileRepo = new FolderProfileRepository(this.supabase)
      const bookmarkRepo = new BookmarkRepository(this.supabase)

      // 创建策略
      const matchers: IMatcher[] = [
        new VectorMatcher(folderProfileRepo, { weight: 0.4 }),
        new HistoryMatcher(bookmarkRepo, { weight: 0.3 }),
        new AIRecommender(folderProfileRepo, { weight: 0.3 })
      ]

      const aggregator = new WeightedScoreAggregator()
      const userStageService = new UserStageService(this.supabase)

      this._classificationService = new ClassificationService(
        matchers,
        aggregator,
        userStageService,
        this.supabase
      )
    }
    return this._classificationService
  }

  /**
   * 获取待整理整理服务
   */
  getInboxOrganizerService(): IInboxOrganizerService {
    if (!this._inboxOrganizerService) {
      const bookmarkRepo = new BookmarkRepository(this.supabase)
      const folderProfileRepo = new FolderProfileRepository(this.supabase)
      const suggestionRepo = new SuggestionRepository(this.supabase)

      this._inboxOrganizerService = new InboxOrganizerService(
        bookmarkRepo,
        folderProfileRepo,
        suggestionRepo
      )
    }
    return this._inboxOrganizerService
  }

  /**
   * 获取兴趣服务
   */
  getInterestService(): IInterestService {
    if (!this._interestService) {
      const interestRepo = new InterestRepository(this.supabase)

      this._interestService = new InterestService(
        interestRepo,
        this.supabase
      )
    }
    return this._interestService
  }

  /**
   * 重置容器（用于测试）
   */
  static reset(): void {
    ClassificationContainer.instance = null
  }
}
```

### 10.6 策略可扩展性

通过策略模式，可以轻松添加新的匹配策略：

```typescript
// 示例：添加一个新的 "标签匹配" 策略

export class TagMatcher implements IMatcher {
  readonly name = 'tag_matcher'
  readonly weight = 0.2

  private folderProfileRepo: FolderProfileRepository

  constructor(repo: FolderProfileRepository, options?: { weight?: number }) {
    this.folderProfileRepo = repo
    if (options?.weight) {
      (this as { weight: number }).weight = options.weight
    }
  }

  async match(context: MatcherContext): Promise<MatchResult[]> {
    // 基于标签的匹配逻辑
    const profiles = await this.folderProfileRepo.findByUserId(context.userId)

    return profiles
      .map(profile => {
        const commonTags = context.tags.filter(
          tag => profile.topTags?.includes(tag)
        )
        const score = (commonTags.length / Math.max(context.tags.length, 1)) * 100

        return {
          folderId: profile.folderId,
          folderName: profile.folderName,
          score,
          confidence: score,
          reason: `${commonTags.length} 个标签匹配`
        }
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
  }

  async isAvailable(context: MatcherContext): Promise<boolean> {
    return context.tags.length > 0
  }
}

// 使用时只需添加到策略列表
const matchers: IMatcher[] = [
  new VectorMatcher(repo, { weight: 0.35 }),
  new HistoryMatcher(repo, { weight: 0.25 }),
  new AIRecommender(repo, { weight: 0.25 }),
  new TagMatcher(repo, { weight: 0.15 })  // 新增策略
]
```

### 10.7 测试友好设计

```typescript
// 示例：单元测试 ClassificationService

describe('ClassificationService', () => {
  let service: ClassificationService
  let mockVectorMatcher: jest.Mocked<IMatcher>
  let mockHistoryMatcher: jest.Mocked<IMatcher>
  let mockAggregator: jest.Mocked<IScoreAggregator>

  beforeEach(() => {
    // 创建 mock
    mockVectorMatcher = {
      name: 'vector',
      weight: 0.4,
      match: jest.fn(),
      isAvailable: jest.fn().mockResolvedValue(true)
    }

    mockHistoryMatcher = {
      name: 'history',
      weight: 0.3,
      match: jest.fn(),
      isAvailable: jest.fn().mockResolvedValue(true)
    }

    mockAggregator = {
      aggregate: jest.fn()
    }

    // 注入 mock 依赖
    service = new ClassificationService(
      [mockVectorMatcher, mockHistoryMatcher],
      mockAggregator,
      mockUserStageService,
      mockSupabase
    )
  })

  it('should call all available matchers', async () => {
    mockVectorMatcher.match.mockResolvedValue([
      { folderId: 1, folderName: 'Test', score: 80, confidence: 80, reason: 'test' }
    ])
    mockHistoryMatcher.match.mockResolvedValue([])
    mockAggregator.aggregate.mockReturnValue({
      folderId: 1,
      folderName: 'Test',
      confidence: 32,
      reason: 'test',
      action: 'classify',
      scores: { vectorScore: 80, historyScore: 0, aiScore: 0 }
    })

    const result = await service.classify('user-1', {
      title: 'Test',
      summary: '',
      tags: []
    })

    expect(mockVectorMatcher.match).toHaveBeenCalled()
    expect(mockHistoryMatcher.match).toHaveBeenCalled()
    expect(result.folderId).toBe(1)
  })
})
```

---

## 十一、核心算法实现

核心模块路径：

```
src/lib/classification/
├── types/                    # 类型定义
├── constants/                # 常量配置
├── repositories/             # 数据访问
├── strategies/               # 匹配策略
├── services/                 # 业务服务
└── utils/                    # 工具函数
```

---

## 十二、实施计划

### 12.1 阶段分解

```
Phase 1: 基础设施 (3 天)
├── Day 1: 数据库迁移
│   ├── 创建 user_custom_interests 表
│   ├── 创建 folder_profiles 表
│   ├── 创建 organization_suggestions 表
│   └── 添加相关 SQL 函数
├── Day 2: 兴趣系统
│   ├── 定义兴趣领域配置 (12 预设 + 自定义)
│   ├── 实现预创建文件夹逻辑
│   └── 实现自定义兴趣 CRUD
└── Day 3: 用户阶段判断
    ├── 实现 get_user_classification_stage 函数
    └── 实现阶段感知的分类入口

Phase 2: 核心算法 (3 天)
├── Day 4: 分类引擎
│   ├── 实现 classifyBookmark 主函数
│   ├── 实现向量匹配 (解决问题 1,2)
│   └── 实现历史匹配 (解决问题 3)
├── Day 5: AI 增强
│   ├── 实现增强版 AI Prompt (解决问题 1)
│   └── 实现综合评分算法
└── Day 6: 待整理整理
    ├── 实现聚类算法
    └── 实现整理建议生成

Phase 3: 用户界面 (2 天)
├── Day 7: 注册引导 UI
│   ├── 兴趣选择组件
│   └── 自定义兴趣添加弹窗
└── Day 8: 整理建议 UI
    └── 待整理整理建议面板

Phase 4: 集成与测试 (2 天)
├── Day 9: 集成
│   ├── 替换现有分类逻辑
│   └── 添加定时任务
└── Day 10: 测试
    ├── 端到端测试
    └── 性能测试

总计: 10 个工作日
```

### 11.2 任务清单

| 优先级 | 任务 | 文件 | 预计时间 |
|--------|------|------|----------|
| P0 | 创建数据库表 | `migrations/xxx.sql` | 3h |
| P0 | 实现 SQL 函数 | `migrations/xxx.sql` | 4h |
| P0 | 定义兴趣领域配置 | `lib/classification/interest-domains.ts` | 2h |
| P0 | 实现自定义兴趣 CRUD | `lib/classification/custom-interests.ts` | 2h |
| P0 | 实现用户阶段判断 | `lib/classification/user-stage.ts` | 2h |
| P0 | 实现 classifyBookmark | `lib/classification/folder-recommendation.ts` | 6h |
| P0 | 实现 analyzeInbox | `lib/classification/inbox-organizer.ts` | 4h |
| P1 | 注册兴趣选择 UI | `components/onboarding/` | 4h |
| P1 | 自定义兴趣弹窗 | `components/onboarding/` | 2h |
| P1 | 整理建议 UI | `components/inbox/` | 4h |
| P1 | 定时任务配置 | `lib/cron/` | 2h |
| P2 | 扩展画像收集 UI | `components/settings/` | 3h |
| P2 | 单元测试 | `__tests__/` | 4h |

---

## 总结

### 核心设计要点

1. **问题驱动**：针对 5 个核心问题设计解决方案
2. **用户生命周期**：从注册到成熟，不同阶段采用不同策略
3. **冷启动友好**：12 预设 + 自定义兴趣，降低使用门槛
4. **渐进式学习**：低置信度先放待整理，积累后再整理
5. **文件夹数量控制**：16 个上限，单日自动创建 8 个上限
6. **千人千面**：兴趣选择 + 历史行为 + 可选扩展画像

### 已确认配置

| 配置项 | 值 |
|--------|-----|
| 权重配置 | 向量 40% + 历史 30% + AI 30% |
| 低置信度阈值 | < 30 放入待整理 |
| 历史匹配数量 | 10 个相似书签 |
| 画像更新 | 每日凌晨 |
| 健康检查 | 每周一次 |
| 文件夹上限 | 16 个 |
| 单日创建上限 | 8 个 |
| 聚类相似度 | 70% |
| 聚类最小规模 | 5 个 |

---

**文档状态**: ✅ 已确认
**预计工期**: 10 个工作日
**下一步**: 开始实施
