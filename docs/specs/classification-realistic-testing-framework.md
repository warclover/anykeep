# 智能分类系统 - 真实用户模拟测试框架

**版本**: v1.0.0  
**日期**: 2026-01-20  
**状态**: ✅ 已批准 - 实施完成  
**优先级**: P0（质量保障）

---

## 一、方案概述

### 1.1 目标

构建一个**千人千面**的自动化测试框架，模拟真实用户行为，全面评估智能分类系统的准确度。

**核心指标**：

- ✅ 覆盖 10+ 种用户画像
- ✅ 生成 1000+ 测试书签（涵盖 20+ 领域）
- ✅ 自动化测试执行
- ✅ 多维度准确度评估

### 1.2 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                   测试框架架构                                │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 用户画像生成器 │    │ 数据集生成器 │    │ 测试执行引擎 │
│              │    │              │    │              │
│ - 10+ 画像   │───▶│ - 1000+ 书签 │───▶│ - 批量分类   │
│ - 领域分布   │    │ - 20+ 领域   │    │ - 结果收集   │
│ - 行为模式   │    │ - 真实标题   │    │ - 指标计算   │
└──────────────┘    └──────────────┘    └──────────────┘
                              │
                              ▼
                    ┌──────────────┐
                    │ 评估报告生成 │
                    │              │
                    │ - 准确率统计 │
                    │ - 错误分析   │
                    │ - 改进建议   │
                    └──────────────┘
```

---

## 二、用户画像设计

### 2.1 用户画像模板

```typescript
interface UserProfile {
  // 基础信息
  id: string;
  name: string;
  type: UserType;

  // 领域偏好（权重分布）
  domainWeights: Record<Domain, number>;

  // 文件夹结构
  folderStructure: FolderStructure;

  // 行为模式
  behavior: {
    bookmarkFrequency: "low" | "medium" | "high"; // 收藏频率
    folderNamingStyle: "descriptive" | "generic" | "mixed"; // 命名风格
    organizationLevel: "organized" | "casual" | "chaotic"; // 整理程度
  };

  // 收藏内容特征
  contentFeatures: {
    avgTitleLength: number;
    useTags: boolean;
    tagStyle: "detailed" | "simple" | "none";
    summaryStyle: "ai" | "manual" | "none";
  };
}
```

### 2.2 10+ 用户画像定义

| ID                | 用户类型   | 主要领域                 | 文件夹数 | 书签数   | 命名风格 | 整理程度 |
| ----------------- | ---------- | ------------------------ | -------- | -------- | -------- | -------- |
| `dev_frontend`    | 前端开发   | React, Vue, CSS          | 15-20    | 200-300  | 描述性   | 高度整理 |
| `dev_backend`     | 后端开发   | Node.js, Python, 数据库  | 12-18    | 150-250  | 描述性   | 高度整理 |
| `dev_fullstack`   | 全栈开发   | 前后端混合               | 20-30    | 300-500  | 混合     | 中等整理 |
| `designer_ui`     | UI设计师   | Figma, 设计系统, 配色    | 10-15    | 100-200  | 描述性   | 高度整理 |
| `pm_product`      | 产品经理   | 竞品分析, 用户研究, 原型 | 15-25    | 200-400  | 混合     | 中等整理 |
| `researcher`      | 科研人员   | 论文, 实验方法, 数据分析 | 20-30    | 300-600  | 描述性   | 高度整理 |
| `student_cs`      | CS学生     | 课程笔记, 算法, 项目     | 10-15    | 100-200  | 混合     | 中等整理 |
| `content_creator` | 内容创作者 | 写作技巧, 素材, 工具     | 15-20    | 200-350  | 描述性   | 中等整理 |
| `life_organizer`  | 生活整理   | 美食, 旅行, 理财, 健康   | 20-30    | 400-600  | 混合     | 中等整理 |
| `casual_user`     | 普通用户   | 随机领域, 无明确主题     | 5-10     | 50-100   | 通用命名 | 低整理   |
| `power_user`      | 重度用户   | 多领域混合               | 30-50    | 500-1000 | 描述性   | 高度整理 |
| `new_user`        | 新用户     | 冷启动, 无历史数据       | 0-3      | 0-20     | 通用命名 | 无整理   |

---

## 三、数据集生成器

### 3.1 领域定义

```typescript
type Domain =
  | "frontend" // 前端开发
  | "backend" // 后端开发
  | "mobile" // 移动开发
  | "devops" // DevOps
  | "ai_ml" // AI/机器学习
  | "design" // 设计
  | "product" // 产品
  | "data_science" // 数据科学
  | "research" // 科研
  | "writing" // 写作
  | "photography" // 摄影
  | "cooking" // 烹饪
  | "travel" // 旅行
  | "finance" // 理财
  | "health" // 健康
  | "education" // 教育
  | "business" // 商业
  | "entertainment" // 娱乐
  | "sports" // 运动
  | "other"; // 其他

interface DomainTemplate {
  domain: Domain;
  titleTemplates: string[]; // 标题模板
  summaryTemplates: string[]; // 摘要模板
  tagSets: string[][]; // 标签集合
  folderNames: string[]; // 常见文件夹名
  keywords: string[]; // 领域关键词
}
```

### 3.2 真实数据生成策略

#### 策略 1: 模板 + 随机组合

```typescript
// 前端开发领域模板
const frontendTemplates: DomainTemplate = {
  domain: "frontend",
  titleTemplates: [
    "{framework} {topic} {action}",
    "{topic} {framework} {level}",
    "{action} {framework} {topic}",
  ],
  summaryTemplates: [
    "深入讲解 {topic} 在 {framework} 中的应用",
    "从零开始学习 {framework} {topic}",
    "{framework} {topic} 最佳实践",
  ],
  tagSets: [
    ["react", "hooks", "前端"],
    ["vue", "组件", "开发"],
    ["typescript", "类型", "安全"],
  ],
  folderNames: [
    "React学习",
    "Vue开发",
    "前端框架",
    "JavaScript进阶",
    "CSS技巧",
  ],
  keywords: ["react", "vue", "angular", "typescript", "css", "html"],
};

// 生成函数
function generateBookmark(domain: Domain, userProfile: UserProfile): Bookmark {
  const template = domainTemplates[domain];

  // 随机选择模板
  const titleTemplate = randomChoice(template.titleTemplates);
  const summaryTemplate = randomChoice(template.summaryTemplates);

  // 填充变量
  const title = fillTemplate(titleTemplate, {
    framework: randomChoice(template.keywords),
    topic: randomChoice(["组件", "状态管理", "路由", "性能优化"]),
    action: randomChoice(["教程", "指南", "实践", "深入"]),
    level: randomChoice(["入门", "进阶", "高级"]),
  });

  const summary = fillTemplate(summaryTemplate, {
    /* ... */
  });
  const tags = randomChoice(template.tagSets);

  return {
    title,
    summary,
    tags,
    url: generateFakeUrl(domain),
    expectedFolder: determineExpectedFolder(domain, userProfile),
  };
}
```

#### 策略 2: 真实数据爬取（可选）

```typescript
// 从真实网站爬取标题和摘要（仅用于测试）
async function fetchRealBookmarks(
  domain: Domain,
  count: number,
): Promise<Bookmark[]> {
  // 示例：从 GitHub Trending 爬取
  // 示例：从 Medium 爬取技术文章
  // 示例：从 B站 爬取教程视频
  // 注意：仅用于测试，不存储真实内容
}
```

### 3.3 数据集规模

| 用户类型          | 书签数量 | 文件夹数量 | 领域分布                                         |
| ----------------- | -------- | ---------- | ------------------------------------------------ |
| `dev_frontend`    | 250      | 18         | 前端 80%, 设计 15%, 其他 5%                      |
| `dev_backend`     | 200      | 15         | 后端 85%, DevOps 10%, 其他 5%                    |
| `dev_fullstack`   | 400      | 25         | 前端 40%, 后端 40%, 其他 20%                     |
| `designer_ui`     | 150      | 12         | 设计 90%, 前端 10%                               |
| `pm_product`      | 300      | 20         | 产品 60%, 设计 20%, 技术 20%                     |
| `researcher`      | 450      | 25         | 科研 85%, 数据科学 10%, 其他 5%                  |
| `student_cs`      | 150      | 12         | 算法 40%, 课程 30%, 项目 30%                     |
| `content_creator` | 275      | 18         | 写作 50%, 工具 30%, 素材 20%                     |
| `life_organizer`  | 500      | 25         | 美食 25%, 旅行 20%, 理财 20%, 健康 20%, 其他 15% |
| `casual_user`     | 75       | 7          | 随机分布                                         |
| `power_user`      | 750      | 40         | 多领域混合                                       |
| `new_user`        | 10       | 2          | 冷启动测试                                       |

**总计**: ~3500 个测试书签，覆盖 12 种用户画像

---

## 四、测试执行引擎

### 4.1 测试流程

```typescript
interface TestExecutionPlan {
  // 阶段 1: 数据准备
  phase1: {
    generateUserProfiles: () => Promise<UserProfile[]>;
    generateFolders: (profile: UserProfile) => Promise<Folder[]>;
    generateBookmarks: (profile: UserProfile) => Promise<Bookmark[]>;
  };

  // 阶段 2: 分类执行
  phase2: {
    classifyBookmarks: (
      bookmarks: Bookmark[],
    ) => Promise<ClassificationResult[]>;
    recordResults: (results: ClassificationResult[]) => Promise<void>;
  };

  // 阶段 3: 评估分析
  phase3: {
    calculateMetrics: () => Promise<TestMetrics>;
    generateReport: (metrics: TestMetrics) => Promise<TestReport>;
  };
}
```

### 4.2 核心实现

```typescript
// scripts/classification-realistic-test.ts

import { createClient } from "@/lib/supabase/server";
import { ClassificationPipelineService } from "@/lib/classification/v5/classification-pipeline/classification-pipeline.service";

/**
 * 真实用户模拟测试主程序
 */
class RealisticClassificationTest {
  private supabase: SupabaseClient;
  private classificationService: ClassificationPipelineService;
  private userProfiles: UserProfile[];
  private testResults: TestResult[] = [];

  async run() {
    console.log("🚀 开始真实用户模拟测试...");

    // Phase 1: 数据准备
    console.log("📊 Phase 1: 生成测试数据...");
    await this.prepareTestData();

    // Phase 2: 执行分类
    console.log("🔍 Phase 2: 执行分类测试...");
    await this.executeClassification();

    // Phase 3: 评估分析
    console.log("📈 Phase 3: 生成评估报告...");
    const report = await this.generateReport();

    // 输出报告
    console.log("\n" + "=".repeat(80));
    console.log("📋 测试报告");
    console.log("=".repeat(80));
    console.log(report);

    return report;
  }

  /**
   * Phase 1: 准备测试数据
   */
  private async prepareTestData() {
    // 1. 生成用户画像
    this.userProfiles = await this.generateUserProfiles();

    // 2. 为每个用户创建文件夹和书签
    for (const profile of this.userProfiles) {
      await this.setupUserData(profile);
    }
  }

  /**
   * Phase 2: 执行分类
   */
  private async executeClassification() {
    for (const profile of this.userProfiles) {
      console.log(`\n测试用户: ${profile.name} (${profile.type})`);

      const bookmarks = await this.getUserBookmarks(profile.id);
      const results: TestResult[] = [];

      for (const bookmark of bookmarks) {
        // 调用真实分类 API
        const result = await this.classifyBookmark(profile.id, bookmark);

        // 记录结果
        results.push({
          userId: profile.id,
          bookmarkId: bookmark.id,
          expectedFolder: bookmark.expectedFolder,
          actualFolder: result.folderId,
          confidence: result.confidence,
          isCorrect: this.isCorrect(result, bookmark),
          latencyMs: result.totalLatencyMs,
          strategy: result.strategy,
        });

        // 进度显示
        if (results.length % 50 === 0) {
          console.log(`  已测试 ${results.length}/${bookmarks.length} 个书签`);
        }
      }

      this.testResults.push(...results);
    }
  }

  /**
   * Phase 3: 生成报告
   */
  private async generateReport(): Promise<TestReport> {
    const metrics = this.calculateMetrics();

    return {
      summary: {
        totalUsers: this.userProfiles.length,
        totalBookmarks: this.testResults.length,
        overallAccuracy: metrics.overallAccuracy,
        avgConfidence: metrics.avgConfidence,
        avgLatency: metrics.avgLatency,
      },
      byUserType: this.calculateByUserType(),
      byDomain: this.calculateByDomain(),
      byStrategy: this.calculateByStrategy(),
      errorAnalysis: this.analyzeErrors(),
      recommendations: this.generateRecommendations(metrics),
    };
  }
}
```

---

## 五、评估指标体系

### 5.1 核心指标

```typescript
interface TestMetrics {
  // 准确率指标
  overallAccuracy: number; // 整体准确率
  accuracyByUserType: Record<string, number>; // 按用户类型
  accuracyByDomain: Record<Domain, number>; // 按领域
  accuracyByStrategy: Record<string, number>; // 按分类策略

  // 置信度指标
  avgConfidence: number; // 平均置信度
  confidenceCalibration: {
    // 置信度校准曲线（10个桶）
    buckets: Array<{
      confidenceRange: [number, number];
      predictedAccuracy: number;
      actualAccuracy: number;
      sampleCount: number;
    }>;
    ece: number; // Expected Calibration Error
  };

  // 性能指标
  avgLatency: number; // 平均延迟
  p50Latency: number; // P50 延迟
  p95Latency: number; // P95 延迟
  p99Latency: number; // P99 延迟

  // 策略分布
  strategyDistribution: Record<string, number>; // L0/L1/L2/L3 使用比例

  // 错误分析
  errorTypes: {
    falsePositive: number; // 误分类
    falseNegative: number; // 未分类
    wrongFolder: number; // 错误文件夹
  };

  // 冷启动表现
  coldStartAccuracy: number; // 新用户准确率
  warmStartAccuracy: number; // 老用户准确率
}
```

### 5.2 准确率计算

```typescript
function calculateAccuracy(results: TestResult[]): number {
  const correct = results.filter((r) => r.isCorrect).length;
  return correct / results.length;
}

function isCorrect(result: ClassificationResult, bookmark: Bookmark): boolean {
  // 策略 1: 完全匹配
  if (result.folderId === bookmark.expectedFolder) {
    return true;
  }

  // 策略 2: 语义匹配（文件夹名相似）
  const expectedName = getFolderName(bookmark.expectedFolder);
  const actualName = getFolderName(result.folderId);

  if (semanticSimilarity(expectedName, actualName) > 0.85) {
    return true;
  }

  // 策略 3: 领域匹配（同一领域的不同文件夹也算正确）
  const expectedDomain = getDomain(bookmark.expectedFolder);
  const actualDomain = getDomain(result.folderId);

  if (expectedDomain === actualDomain) {
    return true; // 可选：根据测试需求调整
  }

  return false;
}
```

---

## 六、实现细节

### 6.1 文件结构

```
scripts/classification-realistic-test/
├── index.ts                    # 主入口
├── generators/
│   ├── user-profile-generator.ts    # 用户画像生成器
│   ├── bookmark-generator.ts        # 书签生成器
│   └── folder-generator.ts          # 文件夹生成器
├── templates/
│   ├── domains.ts                   # 领域模板定义
│   └── user-profiles.ts             # 用户画像模板
├── executors/
│   ├── test-executor.ts             # 测试执行器
│   └── classification-client.ts     # 分类 API 客户端
├── evaluators/
│   ├── metrics-calculator.ts        # 指标计算
│   └── report-generator.ts           # 报告生成
└── utils/
    ├── data-helpers.ts               # 数据辅助函数
    └── similarity.ts                 # 相似度计算
```

### 6.2 核心代码实现

#### 6.2.1 用户画像生成器

```typescript
// scripts/classification-realistic-test/generators/user-profile-generator.ts

import { USER_PROFILE_TEMPLATES } from "../templates/user-profiles";

export class UserProfileGenerator {
  /**
   * 生成用户画像
   */
  generateProfiles(count?: number): UserProfile[] {
    const templates = USER_PROFILE_TEMPLATES;
    const profiles: UserProfile[] = [];

    // 如果指定数量，随机选择模板
    const selectedTemplates = count
      ? this.randomSelect(templates, count)
      : templates;

    for (const template of selectedTemplates) {
      profiles.push(this.generateFromTemplate(template));
    }

    return profiles;
  }

  /**
   * 从模板生成用户画像
   */
  private generateFromTemplate(template: UserProfileTemplate): UserProfile {
    return {
      id: `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: template.name,
      type: template.type,
      domainWeights: this.generateDomainWeights(template),
      folderStructure: this.generateFolderStructure(template),
      behavior: template.behavior,
      contentFeatures: template.contentFeatures,
    };
  }

  /**
   * 生成领域权重分布
   */
  private generateDomainWeights(
    template: UserProfileTemplate,
  ): Record<Domain, number> {
    const weights: Record<Domain, number> = {};
    const totalWeight = template.domainDistribution.reduce(
      (sum, d) => sum + d.weight,
      0,
    );

    for (const { domain, weight } of template.domainDistribution) {
      weights[domain] = weight / totalWeight;
    }

    return weights;
  }
}
```

#### 6.2.2 书签生成器

```typescript
// scripts/classification-realistic-test/generators/bookmark-generator.ts

import { DOMAIN_TEMPLATES } from "../templates/domains";

export class BookmarkGenerator {
  /**
   * 为用户生成书签
   */
  generateBookmarks(profile: UserProfile, count: number): Bookmark[] {
    const bookmarks: Bookmark[] = [];

    // 根据用户领域权重分布生成书签
    const domainCounts = this.distributeByWeights(profile.domainWeights, count);

    for (const [domain, domainCount] of Object.entries(domainCounts)) {
      for (let i = 0; i < domainCount; i++) {
        const bookmark = this.generateBookmarkForDomain(
          domain as Domain,
          profile,
        );
        bookmarks.push(bookmark);
      }
    }

    // 打乱顺序（模拟真实收藏时间线）
    return this.shuffle(bookmarks);
  }

  /**
   * 为特定领域生成书签
   */
  private generateBookmarkForDomain(
    domain: Domain,
    profile: UserProfile,
  ): Bookmark {
    const template = DOMAIN_TEMPLATES[domain];

    // 生成标题
    const title = this.generateTitle(template, profile);

    // 生成摘要
    const summary = this.generateSummary(template, profile, title);

    // 生成标签
    const tags = this.generateTags(template, profile);

    // 确定预期文件夹
    const expectedFolder = this.determineExpectedFolder(domain, profile);

    return {
      id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      summary,
      tags,
      url: this.generateFakeUrl(domain),
      expectedFolder,
      domain,
      createdAt: this.generateRandomDate(),
    };
  }

  /**
   * 生成标题
   */
  private generateTitle(
    template: DomainTemplate,
    profile: UserProfile,
  ): string {
    const titleTemplate = this.randomChoice(template.titleTemplates);

    // 填充模板变量
    return this.fillTemplate(titleTemplate, {
      framework: this.randomChoice(template.keywords),
      topic: this.randomChoice(this.getTopicsForDomain(template.domain)),
      action: this.randomChoice(["教程", "指南", "实践", "深入", "入门"]),
      level: this.randomChoice(["入门", "进阶", "高级", "专家"]),
    });
  }
}
```

#### 6.2.3 测试执行器

```typescript
// scripts/classification-realistic-test/executors/test-executor.ts

export class TestExecutor {
  private classificationService: ClassificationPipelineService;

  /**
   * 执行分类测试
   */
  async execute(
    userId: string,
    bookmark: Bookmark,
  ): Promise<ClassificationResult> {
    const request: ClassificationRequest = {
      bookmarkId: bookmark.id,
      userId,
      title: bookmark.title,
      summary: bookmark.summary,
      tags: bookmark.tags,
      url: bookmark.url,
    };

    const startTime = Date.now();

    try {
      const result = await this.classificationService.classify(request);

      return {
        ...result,
        totalLatencyMs: Date.now() - startTime,
        strategy: this.determineStrategy(result),
      };
    } catch (error) {
      return {
        folderId: null,
        confidence: 0,
        usedT1: false,
        totalLatencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 确定使用的策略
   */
  private determineStrategy(result: ClassificationResult): string {
    if (result.usedT1) return "L3_LLM";
    // 根据延迟推断（需要从结果中获取更多信息）
    if (result.totalLatencyMs < 50) return "L1_LOCAL";
    if (result.totalLatencyMs < 300) return "L2_VECTOR";
    return "L3_LLM";
  }
}
```

---

## 七、报告生成

### 7.1 报告结构

```typescript
interface TestReport {
  // 摘要
  summary: {
    totalUsers: number;
    totalBookmarks: number;
    overallAccuracy: number;
    avgConfidence: number;
    avgLatency: number;
    testDuration: string;
  };

  // 按用户类型分析
  byUserType: Array<{
    userType: string;
    userCount: number;
    bookmarkCount: number;
    accuracy: number;
    avgConfidence: number;
  }>;

  // 按领域分析
  byDomain: Array<{
    domain: Domain;
    bookmarkCount: number;
    accuracy: number;
    topErrors: Array<{
      expectedFolder: string;
      actualFolder: string;
      count: number;
    }>;
  }>;

  // 按策略分析
  byStrategy: Array<{
    strategy: string;
    usageCount: number;
    usageRate: number;
    accuracy: number;
    avgLatency: number;
  }>;

  // 错误分析
  errorAnalysis: {
    totalErrors: number;
    errorTypes: {
      falsePositive: number;
      falseNegative: number;
      wrongFolder: number;
    };
    topErrorPatterns: Array<{
      pattern: string;
      count: number;
      examples: Bookmark[];
    }>;
  };

  // 改进建议
  recommendations: string[];
}
```

### 7.2 报告输出格式

```typescript
// scripts/classification-realistic-test/evaluators/report-generator.ts

export class ReportGenerator {
  /**
   * 生成 Markdown 报告
   */
  generateMarkdownReport(metrics: TestMetrics): string {
    return `
# 智能分类系统 - 真实用户模拟测试报告

**测试时间**: ${new Date().toISOString()}
**测试规模**: ${metrics.summary.totalBookmarks} 个书签，${metrics.summary.totalUsers} 个用户

## 📊 总体表现

- **整体准确率**: ${(metrics.summary.overallAccuracy * 100).toFixed(2)}%
- **平均置信度**: ${metrics.summary.avgConfidence.toFixed(2)}
- **平均延迟**: ${metrics.summary.avgLatency.toFixed(0)}ms

## 👥 按用户类型分析

${this.generateUserTypeTable(metrics.byUserType)}

## 🌐 按领域分析

${this.generateDomainTable(metrics.byDomain)}

## ⚙️ 按策略分析

${this.generateStrategyTable(metrics.byStrategy)}

## ❌ 错误分析

${this.generateErrorAnalysis(metrics.errorAnalysis)}

## 💡 改进建议

${this.generateRecommendations(metrics.recommendations)}
`;
  }

  /**
   * 生成 JSON 报告（用于程序化分析）
   */
  generateJSONReport(metrics: TestMetrics): string {
    return JSON.stringify(metrics, null, 2);
  }
}
```

---

## 八、使用指南

### 8.1 安装依赖

```bash
# 无需额外依赖，使用项目现有依赖
npm install
```

### 8.2 配置环境变量

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 8.3 运行测试

```bash
# 完整测试（所有用户画像）
npm run test:classification:realistic

# 指定用户类型
npm run test:classification:realistic -- --user-types=dev_frontend,designer_ui

# 指定书签数量（每个用户）
npm run test:classification:realistic -- --bookmarks-per-user=100

# 输出详细日志
npm run test:classification:realistic -- --verbose

# 生成 JSON 报告
npm run test:classification:realistic -- --format=json
```

### 8.4 查看报告

```bash
# 报告保存在
reports/classification-realistic-test/
├── report-2026-01-20.md          # Markdown 报告
├── report-2026-01-20.json        # JSON 报告
└── detailed-results.json         # 详细结果数据
```

---

## 九、扩展性设计

### 9.1 自定义用户画像

```typescript
// 在 templates/user-profiles.ts 中添加
export const CUSTOM_USER_PROFILE: UserProfileTemplate = {
  name: "自定义用户",
  type: "custom",
  domainDistribution: [
    { domain: "frontend", weight: 0.5 },
    { domain: "backend", weight: 0.3 },
    { domain: "design", weight: 0.2 },
  ],
  behavior: {
    bookmarkFrequency: "high",
    folderNamingStyle: "descriptive",
    organizationLevel: "organized",
  },
  contentFeatures: {
    avgTitleLength: 30,
    useTags: true,
    tagStyle: "detailed",
    summaryStyle: "ai",
  },
};
```

### 9.2 自定义领域模板

```typescript
// 在 templates/domains.ts 中添加
export const CUSTOM_DOMAIN: DomainTemplate = {
  domain: "custom",
  titleTemplates: [
    "{topic} {action} {framework}",
    // ...
  ],
  summaryTemplates: [
    // ...
  ],
  tagSets: [
    // ...
  ],
  folderNames: [
    // ...
  ],
  keywords: [
    // ...
  ],
};
```

---

## 十、预期成果

### 10.1 测试覆盖

- ✅ **12 种用户画像**：覆盖从新用户到重度用户
- ✅ **20+ 领域**：技术、设计、生活、科研等
- ✅ **3500+ 测试书签**：真实场景模拟
- ✅ **多维度评估**：准确率、置信度、性能

### 10.2 评估指标

| 指标           | 目标值    | 说明                             |
| -------------- | --------- | -------------------------------- |
| 整体准确率     | > 85%     | 所有测试书签的平均准确率         |
| 新用户准确率   | > 70%     | 冷启动场景准确率                 |
| 老用户准确率   | > 90%     | 有历史数据用户准确率             |
| 平均置信度     | 0.75-0.85 | 置信度应在合理范围               |
| 置信度校准误差 | < 0.1     | ECE (Expected Calibration Error) |
| 平均延迟       | < 500ms   | P95 延迟                         |

---

## 十一、后续优化

### 11.1 持续集成

- 将测试集成到 CI/CD 流程
- 每次代码变更后自动运行
- 准确率下降时告警

### 11.2 A/B 测试

- 对比不同分类策略的效果
- 评估新功能对准确率的影响

### 11.3 真实数据收集

- 在用户同意的前提下，收集真实分类数据
- 持续优化测试数据集

---

## 附录

### A. 用户画像完整定义

见 `scripts/classification-realistic-test/templates/user-profiles.ts`

### B. 领域模板完整定义

见 `scripts/classification-realistic-test/templates/domains.ts`

### C. 示例报告

见 `reports/classification-realistic-test/example-report.md`

---

**审核意见**：

- [x] 方案设计合理
- [x] 实现可行性高
- [x] 评估指标完善
- [x] 可以开始实施

**实施状态**: ✅ 已完成

**实施日期**: 2026-01-20

**完成内容**:

- ✅ 用户画像生成器 (`generators/user-profile-generator.ts`)
- ✅ 书签生成器 (`generators/bookmark-generator.ts`)
- ✅ 测试执行器 (`executors/test-executor.ts`)
- ✅ 指标计算器 (`evaluators/metrics-calculator.ts`)
- ✅ 报告生成器 (`evaluators/report-generator.ts`)
- ✅ 主入口文件 (`index.ts`)
- ✅ 用户画像模板 (`templates/user-profiles.ts`)
- ✅ 领域模板 (`templates/domains.ts`)
- ✅ 类型定义 (`types.ts`)
