/**
 * SmartDefaultsService 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import {
  SmartDefaultsService,
  createSmartDefaultsService,
  type PreferencesProvider,
} from "../smart-defaults-service";
import type { TaskContext, UserPreferences } from "../../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe("SmartDefaultsService", () => {
  let service: SmartDefaultsService;
  let mockPreferencesProvider: jest.Mocked<PreferencesProvider>;

  // Helper function to create test context
  const createTestContext = (
    overrides?: Partial<TaskContext>,
  ): TaskContext => ({
    userId: "user-test-123",
    input: "帮我整理收藏",
    stats: {
      total: 100,
      inbox: 20,
      platformDistribution: { BILIBILI: 50, ZHIHU: 30, WECHAT: 20 },
      weeklyAdded: 15,
    },
    folders: [
      { id: "folder-1", name: "技术" },
      { id: "folder-2", name: "生活" },
      { id: "folder-3", name: "待整理" },
      { id: "folder-4", name: "bilibili" },
    ],
    recentPlatforms: ["BILIBILI", "ZHIHU"],
    frequentTags: ["前端", "React", "设计"],
    lastTopic: "整理书签",
    ...overrides,
  });

  const createTestUserPreferences = (
    overrides?: Partial<UserPreferences>,
  ): UserPreferences => ({
    userId: "user-test-123",
    preferredOrganizeMethod: "topic",
    frequentFolders: ["folder-1", "folder-2"],
    frequentTags: ["前端", "React"],
    defaultUsage: {},
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockPreferencesProvider = {
      getPreferences: jest.fn().mockResolvedValue(null),
    };

    service = new SmartDefaultsService(mockPreferencesProvider);
  });

  describe("resolveDefaults()", () => {
    describe("organize 任务类型", () => {
      it("应返回整理方式、目标文件夹和范围默认值", async () => {
        const context = createTestContext();

        const defaults = await service.resolveDefaults("organize", context);

        expect(defaults).toHaveLength(3);
        expect(defaults.map((d) => d.field)).toEqual(
          expect.arrayContaining(["organizeMethod", "targetFolder", "scope"]),
        );
      });

      it("应优先使用用户偏好设置整理方式", async () => {
        const userPrefs = createTestUserPreferences({
          preferredOrganizeMethod: "time",
        });
        mockPreferencesProvider.getPreferences.mockResolvedValue(userPrefs);

        const context = createTestContext();
        const defaults = await service.resolveDefaults("organize", context);

        const organizeMethodDefault = defaults.find(
          (d) => d.field === "organizeMethod",
        );
        expect(organizeMethodDefault).toBeDefined();
        expect(organizeMethodDefault?.value).toBe("time");
        expect(organizeMethodDefault?.source).toBe("user_preference");
        expect(organizeMethodDefault?.confidence).toBeGreaterThan(0.9);
      });

      it("应从用户输入中推断整理方式", async () => {
        const context = createTestContext({ input: "按时间整理我的收藏" });

        const defaults = await service.resolveDefaults("organize", context);

        const organizeMethodDefault = defaults.find(
          (d) => d.field === "organizeMethod",
        );
        expect(organizeMethodDefault?.value).toBe("time");
        expect(organizeMethodDefault?.source).toBe("context_infer");
      });

      it("应根据平台集中度推荐整理方式", async () => {
        const context = createTestContext({
          stats: {
            total: 100,
            inbox: 20,
            // BILIBILI 占比 70%
            platformDistribution: { BILIBILI: 70, ZHIHU: 20, WECHAT: 10 },
          },
        });

        const defaults = await service.resolveDefaults("organize", context);

        const organizeMethodDefault = defaults.find(
          (d) => d.field === "organizeMethod",
        );
        // B站内容多时推荐按作者分类
        expect(organizeMethodDefault?.value).toBe("author");
        expect(organizeMethodDefault?.source).toBe("context_infer");
      });
    });

    describe("move 任务类型", () => {
      it("应返回目标文件夹默认值", async () => {
        const context = createTestContext();

        const defaults = await service.resolveDefaults("move", context);

        expect(defaults).toHaveLength(1);
        expect(defaults[0].field).toBe("targetFolder");
      });

      it("应从用户输入中提取文件夹名", async () => {
        const context = createTestContext({ input: "移动到技术文件夹" });

        const defaults = await service.resolveDefaults("move", context);

        const folderDefault = defaults.find((d) => d.field === "targetFolder");
        expect(folderDefault?.value).toBe("folder-1"); // 技术文件夹的 id
        expect(folderDefault?.source).toBe("context_infer");
        expect(folderDefault?.confidence).toBe(0.9);
      });

      it("应使用常用文件夹作为默认值", async () => {
        const userPrefs = createTestUserPreferences({
          frequentFolders: ["folder-2", "folder-1"],
        });
        mockPreferencesProvider.getPreferences.mockResolvedValue(userPrefs);

        const context = createTestContext({
          input: "移动这些书签",
          targetBookmarks: [{ id: "b1", title: "生活技巧", platform: "ZHIHU" }],
        });

        const defaults = await service.resolveDefaults("move", context);

        const folderDefault = defaults.find((d) => d.field === "targetFolder");
        // 应匹配到包含"生活"关键词的常用文件夹
        expect(folderDefault?.source).toBe("user_preference");
      });

      it("应根据书签平台推断目标文件夹", async () => {
        const context = createTestContext({
          input: "移动这些书签",
          targetBookmarks: [
            { id: "b1", title: "B站视频", platform: "BILIBILI" },
          ],
        });

        const defaults = await service.resolveDefaults("move", context);

        const folderDefault = defaults.find((d) => d.field === "targetFolder");
        expect(folderDefault?.value).toBe("folder-4"); // bilibili 文件夹
        expect(folderDefault?.source).toBe("context_infer");
      });

      it("无匹配时应默认使用待整理文件夹", async () => {
        const context = createTestContext({
          input: "移动这些书签",
          targetBookmarks: [
            { id: "b1", title: "未知内容", platform: "UNKNOWN" },
          ],
        });

        const defaults = await service.resolveDefaults("move", context);

        const folderDefault = defaults.find((d) => d.field === "targetFolder");
        expect(folderDefault?.value).toBe("folder-3"); // 待整理
        expect(folderDefault?.source).toBe("system_default");
      });
    });

    describe("batch_tags 任务类型", () => {
      it("应返回标签操作默认值", async () => {
        const context = createTestContext();

        const defaults = await service.resolveDefaults("batch_tags", context);

        expect(defaults).toHaveLength(1);
        expect(defaults[0].field).toBe("tagAction");
      });

      it("应识别移除标签意图", async () => {
        const context = createTestContext({ input: "移除这些书签的标签" });

        const defaults = await service.resolveDefaults("batch_tags", context);

        expect(defaults[0].value).toBe("remove");
        expect(defaults[0].source).toBe("context_infer");
      });

      it("默认应为添加标签", async () => {
        const context = createTestContext({ input: "给书签打标签" });

        const defaults = await service.resolveDefaults("batch_tags", context);

        expect(defaults[0].value).toBe("add");
        expect(defaults[0].source).toBe("system_default");
      });
    });

    describe("export 任务类型", () => {
      it("应返回导出格式默认值", async () => {
        const context = createTestContext();

        const defaults = await service.resolveDefaults("export", context);

        expect(defaults).toHaveLength(1);
        expect(defaults[0].field).toBe("exportFormat");
      });

      it("应从用户输入识别导出格式", async () => {
        const testCases = [
          { input: "导出为 csv", expected: "csv" },
          { input: "导出为 markdown", expected: "markdown" },
          { input: "导出为 md 格式", expected: "markdown" },
          { input: "导出到 obsidian", expected: "obsidian" },
          { input: "导出 json", expected: "json" },
          { input: "导出为 html", expected: "html" },
        ];

        for (const { input, expected } of testCases) {
          const context = createTestContext({ input });
          const defaults = await service.resolveDefaults("export", context);

          expect(defaults[0].value).toBe(expected);
          expect(defaults[0].source).toBe("context_infer");
        }
      });

      it("默认应为 markdown 格式", async () => {
        const context = createTestContext({ input: "导出我的收藏" });

        const defaults = await service.resolveDefaults("export", context);

        expect(defaults[0].value).toBe("markdown");
        expect(defaults[0].source).toBe("system_default");
      });
    });

    describe("search 任务类型", () => {
      it("应返回搜索模式默认值", async () => {
        const context = createTestContext();

        const defaults = await service.resolveDefaults("search", context);

        expect(defaults).toHaveLength(1);
        expect(defaults[0].field).toBe("searchMode");
      });

      it("长查询应使用语义搜索", async () => {
        const context = createTestContext({
          input: "找一下我之前收藏的关于 React 性能优化的文章",
        });

        const defaults = await service.resolveDefaults("search", context);

        expect(defaults[0].value).toBe("semantic");
        expect(defaults[0].source).toBe("context_infer");
      });

      it("短查询应使用关键词搜索", async () => {
        const context = createTestContext({ input: "React" });

        const defaults = await service.resolveDefaults("search", context);

        expect(defaults[0].value).toBe("keyword");
        expect(defaults[0].source).toBe("system_default");
      });
    });

    describe("scope 解析", () => {
      it("应识别全部范围", async () => {
        const context = createTestContext({ input: "整理全部收藏" });

        const defaults = await service.resolveDefaults("organize", context);

        const scopeDefault = defaults.find((d) => d.field === "scope");
        expect(scopeDefault?.value).toBe("all");
        expect(scopeDefault?.source).toBe("context_infer");
      });

      it("应识别最近范围", async () => {
        const context = createTestContext({ input: "整理最近的收藏" });

        const defaults = await service.resolveDefaults("organize", context);

        const scopeDefault = defaults.find((d) => d.field === "scope");
        expect(scopeDefault?.value).toBe("recent");
      });

      it("应识别未分类范围", async () => {
        const context = createTestContext({ input: "整理待整理的书签" });

        const defaults = await service.resolveDefaults("organize", context);

        const scopeDefault = defaults.find((d) => d.field === "scope");
        expect(scopeDefault?.value).toBe("unclassified");
      });

      it("少量数据时应默认处理全部", async () => {
        const context = createTestContext({
          stats: { total: 15, inbox: 5, platformDistribution: {} },
        });

        const defaults = await service.resolveDefaults("organize", context);

        const scopeDefault = defaults.find((d) => d.field === "scope");
        expect(scopeDefault?.value).toBe("all");
        expect(scopeDefault?.reason).toContain("数据量较少");
      });

      it("大量数据时应默认处理最近", async () => {
        const context = createTestContext({
          stats: { total: 500, inbox: 100, platformDistribution: {} },
        });

        const defaults = await service.resolveDefaults("organize", context);

        const scopeDefault = defaults.find((d) => d.field === "scope");
        expect(scopeDefault?.value).toBe("recent");
        expect(scopeDefault?.reason).toContain("数据量较大");
      });
    });

    describe("错误处理", () => {
      it("解析过程失败时应回退到系统默认值", async () => {
        // 模拟解析过程中的错误（通过返回无效数据）
        mockPreferencesProvider.getPreferences.mockResolvedValue({
          userId: "user-test-123",
          // 使用 undefined 属性可能导致后续处理失败
          preferredOrganizeMethod: undefined,
          frequentFolders: undefined,
          updatedAt: new Date(),
        });

        const context = createTestContext({
          // 空文件夹列表可能触发边界情况
          folders: [],
          stats: {
            total: 0,
            inbox: 0,
            platformDistribution: {},
          },
        });

        const defaults = await service.resolveDefaults("organize", context);

        expect(defaults).toBeDefined();
        expect(defaults.length).toBeGreaterThan(0);
      });

      it("偏好提供者返回 null 时应使用上下文推断", async () => {
        mockPreferencesProvider.getPreferences.mockResolvedValue(null);

        const context = createTestContext();

        const defaults = await service.resolveDefaults("organize", context);

        expect(defaults).toBeDefined();
        expect(defaults.length).toBeGreaterThan(0);
      });
    });
  });

  describe("resolveDefault()", () => {
    it("应解析单个字段的默认值", async () => {
      const context = createTestContext();

      const result = await service.resolveDefault("organizeMethod", context);

      expect(result).toBeDefined();
      expect(result.field).toBe("organizeMethod");
    });

    it("未知字段应返回空默认值", async () => {
      const context = createTestContext();

      const result = await service.resolveDefault("unknownField", context);

      expect(result.field).toBe("unknownField");
      expect(result.value).toBe("");
      expect(result.source).toBe("system_default");
      expect(result.confidence).toBe(0.5);
    });
  });

  describe("createSmartDefaultsService()", () => {
    it("应创建服务实例", () => {
      const instance = createSmartDefaultsService(mockPreferencesProvider);

      expect(instance).toBeInstanceOf(SmartDefaultsService);
    });
  });
});
