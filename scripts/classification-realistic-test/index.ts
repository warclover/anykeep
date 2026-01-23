/**
 * 智能分类系统 - 真实用户模拟测试
 *
 * 主入口文件
 */

import { UserProfileGenerator } from "./generators/user-profile-generator";
import { BookmarkGenerator } from "./generators/bookmark-generator";
import { TestExecutor } from "./executors/test-executor";
import { MetricsCalculator } from "./evaluators/metrics-calculator";
import { ReportGenerator } from "./evaluators/report-generator";
import type { UserProfile, Bookmark, TestResult } from "./types";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// 加载环境变量（支持 .env.local / .env）
// Next.js 会自动加载，但独立脚本需要手动加载
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

// 初始化 Supabase 客户端（使用服务角色密钥，绕过 RLS）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// 分类服务客户端（直接调用分类服务，不通过 API）
class ClassificationServiceClient {
  async classify(request: {
    bookmarkId: string;
    userId: string;
    title: string;
    summary?: string;
    tags?: string[];
    url: string;
  }): Promise<{
    folderId: number | null;
    confidence: number;
    usedT1: boolean;
    totalLatencyMs: number;
    t0LatencyMs: number;
    t1LatencyMs?: number;
  }> {
    // 说明：为了能在“模拟用户数据集”上稳定跑通，我们优先走 v4.1 的 SimpleClassificationService
    // - 不依赖 OPENAI_API_KEY
    // - 直接使用项目现有 embedding-generator 生成 1024 维向量
    // - 通过 search_folders_unified（profile_embedding + name_embedding）完成匹配

    const { createSimpleClassificationService } = await import(
      "../../src/lib/classification/services/simple-classification.service"
    );

    const service = createSimpleClassificationService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      {
        enableAISelection: false,
        enableAICreate: false,
      },
    );

    const startTime = Date.now();
    const result = await service.classify(request.userId, {
      id: parseInt(request.bookmarkId, 10),
      title: request.title,
      summary: request.summary,
      tags: request.tags,
      url: request.url,
    });

    const totalLatencyMs = Date.now() - startTime;

    return {
      folderId: result.folderId != null ? String(result.folderId) : null,
      confidence: (result.confidence ?? 0) / 100, // 统一到 0-1
      usedT1: result.matchType === "ai_select",
      totalLatencyMs,
      t0LatencyMs: totalLatencyMs,
    };
  }
}

/**
 * 真实用户模拟测试主程序
 */
class RealisticClassificationTest {
  private userProfileGenerator: UserProfileGenerator;
  private bookmarkGenerator: BookmarkGenerator;
  private testExecutor: TestExecutor;
  private metricsCalculator: MetricsCalculator;
  private reportGenerator: ReportGenerator;
  private userProfiles: UserProfile[] = [];
  private testResults: TestResult[] = [];
  private bookmarksMap: Map<string, Bookmark[]> = new Map();
  private sharedUserId: string | null = null;
  private folderNameCache = new Map<string, string>();

  constructor() {
    this.userProfileGenerator = new UserProfileGenerator();
    this.bookmarkGenerator = new BookmarkGenerator();
    this.testExecutor = new TestExecutor(new ClassificationServiceClient());
    this.metricsCalculator = new MetricsCalculator();
    this.reportGenerator = new ReportGenerator();
  }

  async run(
    options: {
      quick?: boolean;
      verbose?: boolean;
      userTypes?: string[];
    } = {},
  ) {
    const startTime = Date.now();
    console.log("🚀 开始真实用户模拟测试...\n");

    try {
      // Phase 1: 数据准备
      console.log("📊 Phase 1: 生成测试数据...");
      await this.prepareTestData(options);

      // Phase 2: 执行分类
      console.log("\n🔍 Phase 2: 执行分类测试...");
      await this.executeClassification(options);

      // Phase 3: 评估分析
      console.log("\n📈 Phase 3: 生成评估报告...");
      const testDuration = this.formatDuration(Date.now() - startTime);
      const report = await this.generateReport(testDuration);

      // 输出报告
      console.log("\n" + "=".repeat(80));
      console.log("📋 测试报告");
      console.log("=".repeat(80));
      console.log(report.markdown);

      // 保存报告
      await this.saveReport(report, testDuration);

      console.log("\n✅ 测试完成！");
      console.log(`📁 报告已保存到: reports/classification-realistic-test/`);

      return report;
    } catch (error) {
      console.error("\n❌ 测试失败:", error);
      throw error;
    }
  }

  /**
   * Phase 1: 准备测试数据
   */
  private async prepareTestData(options: {
    quick?: boolean;
    userTypes?: string[];
  }) {
    // 1. 生成用户画像
    const userCount = options.quick ? 3 : undefined; // 快速模式只生成 3 个用户
    this.userProfiles = this.userProfileGenerator.generateProfiles(userCount);

    // 过滤用户类型（如果指定）
    if (options.userTypes && options.userTypes.length > 0) {
      this.userProfiles = this.userProfiles.filter((p) =>
        options.userTypes!.includes(p.type),
      );
    }

    console.log(`  生成 ${this.userProfiles.length} 个用户画像`);

    // 2. 选择一个“可用的测试用户”（优先新建；如失败则回退到现有用户），并在其名下按画像“顺序重置数据”来模拟不同用户
    // 这样可以避免 Auth Admin 创建用户不稳定导致测试无法完成，同时保持每个画像的数据隔离。
    const baseUserId = await this.getOrCreateBaseTestUser();
    this.sharedUserId = baseUserId;

    for (const profile of this.userProfiles) {
      // 2.1 清空该用户下旧的测试数据（仅本脚本创建的）
      await this.cleanupUserTestData(baseUserId);

      // 2.2 创建文件夹（并初始化 name_embedding）
      profile.folderStructure = await this.createFoldersForProfile(
        baseUserId,
        profile,
      );

      // 2.3 生成并创建书签（写入 embedding），并把 expectedFolder 映射为真实 folder_id
      const bookmarkCount = options.quick ? 20 : 200;
      const generated = this.bookmarkGenerator.generateBookmarks(
        profile,
        bookmarkCount,
      );
      const created = await this.createBookmarksForProfile(
        baseUserId,
        profile,
        generated,
      );

      // 2.4 计算每个文件夹的 profile_embedding（compute_folder_profile）
      await this.computeFolderProfilesForUser(profile.folderStructure.folders);

      // profile.id 用于报告分组（确保唯一），但实际分类使用 sharedUserId
      profile.id = `${baseUserId}:${profile.type}`;
      this.bookmarksMap.set(profile.id, created);

      console.log(
        `  ${profile.name}: ${created.length} 个书签, ${profile.folderStructure.folders.length} 个文件夹`,
      );
    }
  }

  private async getOrCreateBaseTestUser(): Promise<string> {
    // 1) 若显式指定则优先使用（便于在生产/沙箱跑）
    const envUserId = process.env.CLASSIFICATION_TEST_USER_ID;
    if (envUserId) return envUserId;

    // 2) 尝试创建一个新用户
    try {
      const tmpProfile: UserProfile = {
        id: `bootstrap_${Date.now()}`,
        name: "测试基准用户",
        type: "casual_user",
        domainWeights: {
          frontend: 0,
          backend: 0,
          mobile: 0,
          devops: 0,
          ai_ml: 0,
          design: 0,
          product: 0,
          data_science: 0,
          research: 0,
          writing: 0,
          photography: 0,
          cooking: 0,
          travel: 0,
          finance: 0,
          health: 0,
          education: 0,
          business: 0,
          entertainment: 0,
          sports: 0,
          other: 1,
        },
        folderStructure: { folders: [] },
        behavior: {
          bookmarkFrequency: "low",
          folderNamingStyle: "generic",
          organizationLevel: "chaotic",
        },
        contentFeatures: {
          avgTitleLength: 20,
          useTags: false,
          tagStyle: "none",
          summaryStyle: "none",
        },
      };
      return await this.createTestUser(tmpProfile);
    } catch {
      // ignore
    }

    // 3) 回退：拿一个已有用户（需要 service role 权限）
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    if (error || !data?.users?.[0]?.id) {
      throw new Error(
        `无法创建或获取测试用户。请在环境变量中提供 CLASSIFICATION_TEST_USER_ID。`,
      );
    }
    return data.users[0].id;
  }

  private async cleanupUserTestData(userId: string) {
    // 仅删除脚本创建的数据：书签 url 使用 https://* /article/xxx；文件夹名在模板列表内
    // 这里以 user_id 维度直接清空，避免污染真实数据：建议用专用测试用户运行。
    await supabase.from("bookmarks").delete().eq("user_id", userId);
    await supabase.from("folders").delete().eq("user_id", userId);
    // folder_profiles 依赖 folders/bookmarks，可交给 cascade / 或留给 compute 重新生成
  }

  private async createTestUser(profile: UserProfile): Promise<string> {
    const password = "test_password_123";

    // Supabase Auth 有时会出现短暂的 DB error，这里做多次重试 + 退避，并确保邮箱唯一
    let lastError: string | undefined;
    for (let attempt = 0; attempt < 8; attempt++) {
      const email = `test_${profile.type}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}@anykeep.test`;

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (!error && data.user) {
        // 创建 profile（失败不阻塞）
        await supabase.from("profiles").upsert({
          id: data.user.id,
          nickname: profile.name,
        });

        return data.user.id;
      }

      lastError = error?.message ?? "unknown";

      // 退避等待（1s, 2s, 4s, 8s... 上限 10s）
      const delayMs = Math.min(10_000, 1000 * Math.pow(2, attempt));
      await new Promise((r) => setTimeout(r, delayMs));
    }

    throw new Error(`创建测试用户失败: ${lastError ?? "unknown"}`);

    // unreachable
  }

  private async createFoldersForProfile(
    userId: string,
    profile: UserProfile,
  ): Promise<UserProfile["folderStructure"]> {
    const folders: Array<{ id: string; name: string; domain: string }> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { DOMAIN_TEMPLATES } = (await import("./templates/domains")) as any;

    for (const [domain, weight] of Object.entries(profile.domainWeights)) {
      if (weight <= 0.1) continue;

      const nameCandidates: string[] = DOMAIN_TEMPLATES[domain]
        ?.folderNames ?? [`${domain}`];

      // quick 模式：每个领域最多 2 个文件夹
      const folderCount = Math.min(2, Math.max(1, Math.ceil(weight * 4)));

      for (let i = 0; i < folderCount; i++) {
        const folderName =
          nameCandidates[i % nameCandidates.length] ?? `${domain}_${i}`;
        const { data, error } = await supabase
          .from("folders")
          .insert({ user_id: userId, name: folderName, parent_id: null })
          .select("id, name")
          .single();

        if (error || !data) {
          throw new Error(
            `创建文件夹失败: ${folderName} - ${error?.message ?? "unknown"}`,
          );
        }

        folders.push({
          id: String(data.id),
          name: data.name,
          domain,
        });

        // 初始化 name_embedding（v1.1 优先，失败自动降级到 v1）
        await this.initializeFolderNameEmbedding(Number(data.id), data.name);
      }
    }

    // 如果没有任何文件夹（极端用户），创建一个兜底
    if (folders.length === 0) {
      const { data, error } = await supabase
        .from("folders")
        .insert({ user_id: userId, name: "未分类", parent_id: null })
        .select("id, name")
        .single();
      if (error || !data)
        throw new Error(`创建兜底文件夹失败: ${error?.message ?? "unknown"}`);
      folders.push({ id: String(data.id), name: data.name, domain: "other" });
      await this.initializeFolderNameEmbedding(Number(data.id), data.name);
    }

    return { folders };
  }

  private async initializeFolderNameEmbedding(
    folderId: number,
    folderName: string,
  ) {
    // 说明：不能复用 `initializeFolderNameProfile`（它依赖 Next.js server cookies 上下文）
    // 这里用 service-role 直接写入 DB：生成 name embedding → rpc(update_folder_name_embedding_v2/v1)
    const { generateEmbedding, generateFolderTags } = await import(
      "../../src/lib/utils/embedding-generator"
    );

    // v1.1 smart tags（复用既有生成器）
    const { generateFolderTags: genTags } = await import(
      "../../src/lib/classification/utils/folder-tag-generator"
    );
    const smartTags = genTags(folderName);

    const embedding = await generateEmbedding(folderName);
    const embeddingString = `[${embedding.join(",")}]`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)(
      "update_folder_name_embedding_v2",
      {
        p_folder_id: folderId,
        p_name_embedding: embeddingString,
        p_smart_tags: smartTags,
      },
    );

    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: fallbackError } = await (supabase.rpc as any)(
        "update_folder_name_embedding",
        {
          p_folder_id: folderId,
          p_name_embedding: embeddingString,
        },
      );
      if (fallbackError) {
        throw new Error(
          `初始化文件夹名称向量失败: ${fallbackError.message ?? String(fallbackError)}`,
        );
      }
    }
  }

  private async createBookmarksForProfile(
    userId: string,
    profile: UserProfile,
    bookmarks: Bookmark[],
  ): Promise<Bookmark[]> {
    const created: Bookmark[] = [];

    const { generateEmbedding, buildEmbeddingText } = await import(
      "../../src/lib/utils/embedding-generator"
    );

    // 每个 domain 选一个文件夹作为“预期”
    const folderByDomain = new Map<string, string>();
    for (const f of profile.folderStructure.folders) {
      if (!folderByDomain.has(f.domain)) folderByDomain.set(f.domain, f.id);
    }

    for (const b of bookmarks) {
      const folderId =
        folderByDomain.get(b.domain) ?? profile.folderStructure.folders[0]!.id;
      const embeddingText = buildEmbeddingText(b.title, b.summary, b.tags);
      const embedding = await generateEmbedding(embeddingText);
      const embeddingString = `[${embedding.join(",")}]`;

      // 写入 bookmarks.embedding，保证 compute_folder_profile 可用
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("bookmarks") as any)
        .insert({
          user_id: userId,
          title: b.title,
          url: b.url,
          description: b.summary ?? null,
          platform: "UNKNOWN",
          folder_id: Number(folderId),
          user_tags: b.tags ?? null,
          status: "COMPLETED",
          embedding: embeddingString,
        })
        .select("id")
        .single();

      if (error || !data) {
        // 失败不阻塞整批（方便先跑通）
        continue;
      }

      created.push({
        ...b,
        id: String(data.id),
        expectedFolder: String(folderId),
      });
    }

    return created;
  }

  private async computeFolderProfilesForUser(
    folders: Array<{ id: string; name: string; domain: string }>,
  ) {
    // 计算 folder_profiles.profile_embedding（v4.1 统一搜索会优先用它）
    for (const f of folders) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.rpc as any)("compute_folder_profile", {
        p_folder_id: Number(f.id),
      });
    }
  }

  /**
   * Phase 2: 执行分类
   */
  private async executeClassification(options: { verbose?: boolean }) {
    for (const profile of this.userProfiles) {
      if (options.verbose) {
        console.log(`\n测试用户: ${profile.name} (${profile.type})`);
      }

      const bookmarks = this.bookmarksMap.get(profile.id) || [];
      const results: TestResult[] = [];

      for (let i = 0; i < bookmarks.length; i++) {
        const bookmark = bookmarks[i];

        try {
          // 调用真实分类 API
          const result = await this.testExecutor.execute(
            this.sharedUserId ?? profile.id,
            bookmark,
          );

          // 判断是否正确
          const isCorrect = await this.isCorrect(result, bookmark);
          const expectedFolderName =
            profile.folderStructure.folders.find(
              (f) => f.id === bookmark.expectedFolder,
            )?.name ?? bookmark.expectedFolder;
          const actualFolderName =
            result.folderId != null
              ? await this.getFolderName(result.folderId)
              : null;

          // 记录结果
          results.push({
            userId: profile.id,
            bookmarkId: bookmark.id,
            title: bookmark.title,
            domain: bookmark.domain,
            expectedFolder: bookmark.expectedFolder,
            expectedFolderName,
            actualFolder: result.folderId,
            actualFolderName,
            confidence: result.confidence,
            isCorrect,
            latencyMs: result.totalLatencyMs,
            strategy: result.strategy,
          });

          // 进度显示
          if (options.verbose && (i + 1) % 10 === 0) {
            console.log(
              `  已测试 ${i + 1}/${bookmarks.length} 个书签 (准确率: ${((results.filter((r) => r.isCorrect).length / results.length) * 100).toFixed(1)}%)`,
            );
          }
        } catch (error) {
          console.error(`  书签 ${bookmark.id} 分类失败:`, error);
        }
      }

      this.testResults.push(...results);

      if (options.verbose) {
        const accuracy =
          (results.filter((r) => r.isCorrect).length / results.length) * 100;
        console.log(
          `  ✅ 完成: ${results.length} 个书签, 准确率 ${accuracy.toFixed(1)}%`,
        );
      }
    }
  }

  /**
   * 判断分类是否正确
   */
  private async isCorrect(
    result: { folderId: number | null },
    bookmark: Bookmark,
  ): Promise<boolean> {
    if (result.folderId === null) {
      return false;
    }

    // 完全匹配
    if (result.folderId === bookmark.expectedFolder) {
      return true;
    }

    // 如果预期文件夹是占位符，检查领域匹配
    if (bookmark.expectedFolder.startsWith("expected_folder_")) {
      // 获取实际分类的文件夹信息
      const { data: actualFolder } = await supabase
        .from("folders")
        .select("name")
        .eq("id", parseInt(result.folderId, 10))
        .single();

      if (actualFolder) {
        // 简单的名称匹配（可以改进为语义匹配）
        const expectedDomain = bookmark.domain;
        const folderName = actualFolder.name.toLowerCase();
        const domainKeywords: Record<string, string[]> = {
          frontend: ["react", "vue", "前端", "javascript"],
          backend: ["node", "python", "后端", "api"],
          design: ["设计", "ui", "ux", "figma"],
          product: ["产品", "用户", "竞品"],
          research: ["研究", "论文", "实验"],
        };

        const keywords = domainKeywords[expectedDomain] || [];
        return keywords.some((kw) => folderName.includes(kw));
      }
    }

    return false;
  }

  private async getFolderName(folderId: number): Promise<string> {
    const cacheKey = String(folderId);
    if (this.folderNameCache.has(cacheKey)) {
      return this.folderNameCache.get(cacheKey)!;
    }
    const { data, error } = await supabase
      .from("folders")
      .select("name")
      .eq("id", folderId)
      .single();
    if (error || !data?.name) {
      return String(folderId);
    }
    this.folderNameCache.set(cacheKey, data.name);
    return data.name;
  }

  /**
   * Phase 3: 生成报告
   */
  private async generateReport(testDuration: string) {
    const metrics = this.metricsCalculator.calculateMetrics(
      this.testResults,
      this.userProfiles,
    );

    const markdown = this.reportGenerator.generateMarkdownReport(
      metrics,
      testDuration,
    );
    const json = this.reportGenerator.generateJSONReport(metrics, testDuration);

    return { markdown, json, metrics };
  }

  /**
   * 保存报告
   */
  private async saveReport(
    report: { markdown: string; json: string },
    testDuration: string,
  ) {
    const reportsDir = path.join(
      process.cwd(),
      "reports",
      "classification-realistic-test",
    );

    // 确保目录存在
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dateStr = new Date().toISOString().split("T")[0];

    // 保存 Markdown 报告
    const mdPath = path.join(reportsDir, `report-${dateStr}.md`);
    fs.writeFileSync(mdPath, report.markdown);

    // 保存 JSON 报告
    const jsonPath = path.join(reportsDir, `report-${dateStr}.json`);
    fs.writeFileSync(jsonPath, report.json);

    // 保存详细结果
    const detailsPath = path.join(
      reportsDir,
      `detailed-results-${timestamp}.json`,
    );
    fs.writeFileSync(
      detailsPath,
      JSON.stringify(
        {
          testResults: this.testResults,
          userProfiles: this.userProfiles,
          testDuration,
        },
        null,
        2,
      ),
    );
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟${seconds % 60}秒`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }
}

// 主程序入口
async function main() {
  const args = process.argv.slice(2);
  const options: {
    quick?: boolean;
    verbose?: boolean;
    userTypes?: string[];
  } = {};

  // 解析命令行参数
  for (const arg of args) {
    if (arg === "--quick") {
      options.quick = true;
    } else if (arg === "--verbose") {
      options.verbose = true;
    } else if (arg.startsWith("--user-types=")) {
      options.userTypes = arg.split("=")[1].split(",");
    }
  }

  const test = new RealisticClassificationTest();
  await test.run(options);
}

// 运行主程序
// tsx/ESM 环境下没有 require.main，这里用 argv 判断是否为直接执行
const isDirectRun = process.argv[1]
  ?.replace(/\\/g, "/")
  ?.endsWith("/scripts/classification-realistic-test/index.ts");
if (isDirectRun) {
  main().catch((error) => {
    console.error("测试执行失败:", error);
    process.exit(1);
  });
}

export { RealisticClassificationTest };
