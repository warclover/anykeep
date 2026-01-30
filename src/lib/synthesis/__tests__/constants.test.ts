/**
 * 综述模块常量单元测试
 *
 * @description 验证所有常量的定义和取值合理性
 */

import {
  // Token 限制
  MAX_PER_SOURCE_TOKENS,
  MAX_TOTAL_INPUT_TOKENS,
  OUTPUT_TOKEN_RESERVE,
  // 书签限制
  MIN_BOOKMARKS_COUNT,
  MAX_BOOKMARKS_STANDARD,
  MAX_BOOKMARKS_ACADEMIC,
  BATCH_THRESHOLD,
  FORCE_SUGGEST_THRESHOLD,
  // 超时配置
  QUICK_MODE_TIMEOUT_MS,
  STANDARD_MODE_TIMEOUT_MS,
  ACADEMIC_MODE_TIMEOUT_MS,
  STEP_TIMEOUT_MS,
  // 输出限制
  QUICK_OVERVIEW_WORDS,
  STANDARD_OVERVIEW_WORDS,
  ACADEMIC_OVERVIEW_WORDS,
  MAX_CONSENSUS_POINTS,
  MAX_DIVERGENCE_POINTS,
  MAX_BLIND_SPOTS,
  // 分页配置
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  // AI 推荐配置
  RECOMMEND_THRESHOLD,
  MAX_DAILY_RECOMMENDATIONS,
  RECOMMENDATION_AUTO_HIDE_SECONDS,
  // 缓存配置
  LIST_CACHE_TTL_SECONDS,
  DETAIL_CACHE_TTL_SECONDS,
  // 预览配置
  OVERVIEW_PREVIEW_MAX_LENGTH,
  SOURCE_PREVIEW_MAX_COUNT,
  // UI 文本
  UI_TEXT,
  // 导出格式
  EXPORT_FORMATS,
} from "../constants";

// ============================================================================
// Token 限制测试
// ============================================================================

describe("Token 限制常量", () => {
  it("MAX_PER_SOURCE_TOKENS 定义合理", () => {
    expect(MAX_PER_SOURCE_TOKENS).toBe(8000);
    expect(MAX_PER_SOURCE_TOKENS).toBeGreaterThan(0);
    expect(MAX_PER_SOURCE_TOKENS).toBeLessThan(MAX_TOTAL_INPUT_TOKENS);
  });

  it("MAX_TOTAL_INPUT_TOKENS 定义合理", () => {
    expect(MAX_TOTAL_INPUT_TOKENS).toBe(100000);
    expect(MAX_TOTAL_INPUT_TOKENS).toBeGreaterThan(MAX_PER_SOURCE_TOKENS);
  });

  it("OUTPUT_TOKEN_RESERVE 定义合理", () => {
    expect(OUTPUT_TOKEN_RESERVE).toBe(4000);
    expect(OUTPUT_TOKEN_RESERVE).toBeGreaterThan(0);
    expect(OUTPUT_TOKEN_RESERVE).toBeLessThan(MAX_TOTAL_INPUT_TOKENS);
  });

  it("Token 限制满足合理的约束关系", () => {
    // 至少可以处理几个来源
    expect(MAX_TOTAL_INPUT_TOKENS / MAX_PER_SOURCE_TOKENS).toBeGreaterThan(5);
    // 输出预留不超过总量的 10%
    expect(OUTPUT_TOKEN_RESERVE / MAX_TOTAL_INPUT_TOKENS).toBeLessThanOrEqual(
      0.1,
    );
  });
});

// ============================================================================
// 书签限制测试
// ============================================================================

describe("书签限制常量", () => {
  it("MIN_BOOKMARKS_COUNT 定义合理", () => {
    expect(MIN_BOOKMARKS_COUNT).toBe(2);
    expect(MIN_BOOKMARKS_COUNT).toBeGreaterThanOrEqual(1);
  });

  it("MAX_BOOKMARKS_STANDARD 定义合理", () => {
    expect(MAX_BOOKMARKS_STANDARD).toBe(100);
    expect(MAX_BOOKMARKS_STANDARD).toBeGreaterThan(MIN_BOOKMARKS_COUNT);
  });

  it("MAX_BOOKMARKS_ACADEMIC 定义合理", () => {
    expect(MAX_BOOKMARKS_ACADEMIC).toBe(200);
    expect(MAX_BOOKMARKS_ACADEMIC).toBeGreaterThan(MAX_BOOKMARKS_STANDARD);
  });

  it("BATCH_THRESHOLD 定义合理", () => {
    expect(BATCH_THRESHOLD).toBe(50);
    expect(BATCH_THRESHOLD).toBeGreaterThan(MIN_BOOKMARKS_COUNT);
    expect(BATCH_THRESHOLD).toBeLessThanOrEqual(MAX_BOOKMARKS_STANDARD);
  });

  it("FORCE_SUGGEST_THRESHOLD 定义合理", () => {
    expect(FORCE_SUGGEST_THRESHOLD).toBe(100);
    expect(FORCE_SUGGEST_THRESHOLD).toBeGreaterThanOrEqual(BATCH_THRESHOLD);
  });
});

// ============================================================================
// 超时配置测试
// ============================================================================

describe("超时配置常量", () => {
  it("QUICK_MODE_TIMEOUT_MS 定义合理", () => {
    expect(QUICK_MODE_TIMEOUT_MS).toBe(90 * 1000);
    expect(QUICK_MODE_TIMEOUT_MS).toBeGreaterThan(STEP_TIMEOUT_MS);
  });

  it("STANDARD_MODE_TIMEOUT_MS 定义合理", () => {
    expect(STANDARD_MODE_TIMEOUT_MS).toBe(150 * 1000);
    expect(STANDARD_MODE_TIMEOUT_MS).toBeGreaterThan(QUICK_MODE_TIMEOUT_MS);
  });

  it("ACADEMIC_MODE_TIMEOUT_MS 定义合理", () => {
    expect(ACADEMIC_MODE_TIMEOUT_MS).toBe(300 * 1000);
    expect(ACADEMIC_MODE_TIMEOUT_MS).toBeGreaterThan(STANDARD_MODE_TIMEOUT_MS);
  });

  it("STEP_TIMEOUT_MS 定义合理", () => {
    expect(STEP_TIMEOUT_MS).toBe(60 * 1000);
    expect(STEP_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("超时配置按模式递增", () => {
    expect(QUICK_MODE_TIMEOUT_MS).toBeLessThan(STANDARD_MODE_TIMEOUT_MS);
    expect(STANDARD_MODE_TIMEOUT_MS).toBeLessThan(ACADEMIC_MODE_TIMEOUT_MS);
  });
});

// ============================================================================
// 输出限制测试
// ============================================================================

describe("输出限制常量", () => {
  describe("概述字数范围", () => {
    it("QUICK_OVERVIEW_WORDS 是有效的范围", () => {
      expect(QUICK_OVERVIEW_WORDS).toEqual([50, 150]);
      expect(QUICK_OVERVIEW_WORDS[0]).toBeLessThan(QUICK_OVERVIEW_WORDS[1]);
    });

    it("STANDARD_OVERVIEW_WORDS 是有效的范围", () => {
      expect(STANDARD_OVERVIEW_WORDS).toEqual([300, 500]);
      expect(STANDARD_OVERVIEW_WORDS[0]).toBeLessThan(
        STANDARD_OVERVIEW_WORDS[1],
      );
    });

    it("ACADEMIC_OVERVIEW_WORDS 是有效的范围", () => {
      expect(ACADEMIC_OVERVIEW_WORDS).toEqual([800, 1200]);
      expect(ACADEMIC_OVERVIEW_WORDS[0]).toBeLessThan(
        ACADEMIC_OVERVIEW_WORDS[1],
      );
    });

    it("概述字数范围按模式递增", () => {
      expect(QUICK_OVERVIEW_WORDS[1]).toBeLessThan(STANDARD_OVERVIEW_WORDS[0]);
      expect(STANDARD_OVERVIEW_WORDS[1]).toBeLessThan(
        ACADEMIC_OVERVIEW_WORDS[0],
      );
    });
  });

  describe("最大数量限制", () => {
    it("MAX_CONSENSUS_POINTS 定义合理", () => {
      expect(MAX_CONSENSUS_POINTS).toBe(10);
      expect(MAX_CONSENSUS_POINTS).toBeGreaterThan(0);
    });

    it("MAX_DIVERGENCE_POINTS 定义合理", () => {
      expect(MAX_DIVERGENCE_POINTS).toBe(5);
      expect(MAX_DIVERGENCE_POINTS).toBeGreaterThan(0);
    });

    it("MAX_BLIND_SPOTS 定义合理", () => {
      expect(MAX_BLIND_SPOTS).toBe(5);
      expect(MAX_BLIND_SPOTS).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// 分页配置测试
// ============================================================================

describe("分页配置常量", () => {
  it("DEFAULT_PAGE_SIZE 定义合理", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
    expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(MAX_PAGE_SIZE);
  });

  it("MAX_PAGE_SIZE 定义合理", () => {
    expect(MAX_PAGE_SIZE).toBe(100);
    expect(MAX_PAGE_SIZE).toBeGreaterThan(DEFAULT_PAGE_SIZE);
  });
});

// ============================================================================
// AI 推荐配置测试
// ============================================================================

describe("AI 推荐配置常量", () => {
  it("RECOMMEND_THRESHOLD 定义合理", () => {
    expect(RECOMMEND_THRESHOLD).toBe(30);
    expect(RECOMMEND_THRESHOLD).toBeGreaterThan(MIN_BOOKMARKS_COUNT);
  });

  it("MAX_DAILY_RECOMMENDATIONS 定义合理", () => {
    expect(MAX_DAILY_RECOMMENDATIONS).toBe(3);
    expect(MAX_DAILY_RECOMMENDATIONS).toBeGreaterThan(0);
    expect(MAX_DAILY_RECOMMENDATIONS).toBeLessThanOrEqual(10);
  });

  it("RECOMMENDATION_AUTO_HIDE_SECONDS 定义合理", () => {
    expect(RECOMMENDATION_AUTO_HIDE_SECONDS).toBe(5);
    expect(RECOMMENDATION_AUTO_HIDE_SECONDS).toBeGreaterThan(0);
    expect(RECOMMENDATION_AUTO_HIDE_SECONDS).toBeLessThanOrEqual(30);
  });
});

// ============================================================================
// 缓存配置测试
// ============================================================================

describe("缓存配置常量", () => {
  it("LIST_CACHE_TTL_SECONDS 定义合理", () => {
    expect(LIST_CACHE_TTL_SECONDS).toBe(60);
    expect(LIST_CACHE_TTL_SECONDS).toBeGreaterThan(0);
  });

  it("DETAIL_CACHE_TTL_SECONDS 定义合理", () => {
    expect(DETAIL_CACHE_TTL_SECONDS).toBe(300);
    expect(DETAIL_CACHE_TTL_SECONDS).toBeGreaterThan(LIST_CACHE_TTL_SECONDS);
  });
});

// ============================================================================
// 预览配置测试
// ============================================================================

describe("预览配置常量", () => {
  it("OVERVIEW_PREVIEW_MAX_LENGTH 定义合理", () => {
    expect(OVERVIEW_PREVIEW_MAX_LENGTH).toBe(200);
    expect(OVERVIEW_PREVIEW_MAX_LENGTH).toBeGreaterThan(0);
  });

  it("SOURCE_PREVIEW_MAX_COUNT 定义合理", () => {
    expect(SOURCE_PREVIEW_MAX_COUNT).toBe(5);
    expect(SOURCE_PREVIEW_MAX_COUNT).toBeGreaterThan(0);
  });
});

// ============================================================================
// UI 文本测试
// ============================================================================

describe("UI_TEXT 常量", () => {
  describe("页面标题", () => {
    it("定义了所有页面标题", () => {
      expect(UI_TEXT.PAGE_TITLE_LIST).toBe("我的综述");
      expect(UI_TEXT.PAGE_TITLE_DETAIL).toBe("综述详情");
      expect(UI_TEXT.PAGE_TITLE_NEW).toBe("生成主题综述");
    });
  });

  describe("按钮文本", () => {
    it("定义了所有按钮文本", () => {
      expect(UI_TEXT.BUTTON_GENERATE).toBe("开始生成");
      expect(UI_TEXT.BUTTON_CANCEL).toBe("取消生成");
      expect(UI_TEXT.BUTTON_EXPORT).toBe("导出");
      expect(UI_TEXT.BUTTON_SHARE).toBe("分享");
      expect(UI_TEXT.BUTTON_DELETE).toBe("删除");
      expect(UI_TEXT.BUTTON_RETRY).toBe("重试");
    });
  });

  describe("步骤名称", () => {
    it("定义了所有步骤名称", () => {
      expect(UI_TEXT.STEP_PREPARE).toBe("准备阶段");
      expect(UI_TEXT.STEP_ANALYZE).toBe("分析阶段");
      expect(UI_TEXT.STEP_SYNTHESIZE).toBe("合成阶段");
      expect(UI_TEXT.STEP_CONFLICT).toBe("冲突检测");
      expect(UI_TEXT.STEP_BLINDSPOT).toBe("盲区发现");
    });
  });

  describe("状态文本", () => {
    it("定义了所有状态文本", () => {
      expect(UI_TEXT.STATUS_PENDING).toBe("等待中");
      expect(UI_TEXT.STATUS_GENERATING).toBe("生成中");
      expect(UI_TEXT.STATUS_COMPLETED).toBe("已完成");
      expect(UI_TEXT.STATUS_FAILED).toBe("生成失败");
      expect(UI_TEXT.STATUS_CANCELLED).toBe("已取消");
    });
  });

  describe("来源类型文本", () => {
    it("定义了所有来源类型", () => {
      expect(UI_TEXT.SOURCE_TYPE_FOLDER).toBe("文件夹");
      expect(UI_TEXT.SOURCE_TYPE_TAG).toBe("标签");
      expect(UI_TEXT.SOURCE_TYPE_SELECTION).toBe("手动选择");
      expect(UI_TEXT.SOURCE_TYPE_AI_RECOMMEND).toBe("AI 推荐");
    });
  });

  describe("深度模式文本", () => {
    it("定义了所有深度模式", () => {
      expect(UI_TEXT.DEPTH_QUICK).toBe("快读模式");
      expect(UI_TEXT.DEPTH_STANDARD).toBe("标准模式");
      expect(UI_TEXT.DEPTH_ACADEMIC).toBe("学术模式");
    });
  });

  describe("四维标题", () => {
    it("定义了所有四维标题", () => {
      expect(UI_TEXT.DIMENSION_OVERVIEW).toBe("概述");
      expect(UI_TEXT.DIMENSION_CONSENSUS).toBe("核心共识");
      expect(UI_TEXT.DIMENSION_DIVERGENCE).toBe("观点分歧");
      expect(UI_TEXT.DIMENSION_BLIND_SPOTS).toBe("知识盲区");
    });
  });

  describe("提示消息", () => {
    it("定义了所有提示消息", () => {
      expect(UI_TEXT.TIP_GENERATING).toBeDefined();
      expect(UI_TEXT.TIP_EMPTY_LIST).toBeDefined();
      expect(UI_TEXT.TIP_MIN_BOOKMARKS).toBeDefined();
      expect(UI_TEXT.TIP_LARGE_CONTENT).toBeDefined();
    });
  });

  describe("错误消息", () => {
    it("定义了所有错误消息", () => {
      expect(UI_TEXT.ERROR_SOURCE_NOT_FOUND).toBe("来源未找到");
      expect(UI_TEXT.ERROR_INSUFFICIENT_CONTENT).toBeDefined();
      expect(UI_TEXT.ERROR_TOKEN_EXCEEDED).toBeDefined();
      expect(UI_TEXT.ERROR_LLM_FAILED).toBeDefined();
      expect(UI_TEXT.ERROR_TIMEOUT).toBeDefined();
      expect(UI_TEXT.ERROR_UNAUTHORIZED).toBe("请先登录");
      expect(UI_TEXT.ERROR_NOT_FOUND).toBeDefined();
    });
  });

  it("UI_TEXT 定义为 const 对象", () => {
    // as const 在运行时不会冻结对象，但确保类型系统中是只读的
    // 这里验证关键属性存在且类型正确
    expect(typeof UI_TEXT.PAGE_TITLE_LIST).toBe("string");
    expect(typeof UI_TEXT.BUTTON_GENERATE).toBe("string");
    expect(typeof UI_TEXT.STATUS_COMPLETED).toBe("string");
  });
});

// ============================================================================
// 导出格式配置测试
// ============================================================================

describe("EXPORT_FORMATS 常量", () => {
  it("包含四种导出格式", () => {
    expect(Object.keys(EXPORT_FORMATS)).toHaveLength(4);
  });

  it("markdown 格式配置正确", () => {
    expect(EXPORT_FORMATS.markdown.id).toBe("markdown");
    expect(EXPORT_FORMATS.markdown.name).toBe("Markdown");
    expect(EXPORT_FORMATS.markdown.extension).toBe(".md");
    expect(EXPORT_FORMATS.markdown.mimeType).toBe("text/markdown");
  });

  it("obsidian 格式配置正确", () => {
    expect(EXPORT_FORMATS.obsidian.id).toBe("obsidian");
    expect(EXPORT_FORMATS.obsidian.name).toBe("Obsidian");
    expect(EXPORT_FORMATS.obsidian.extension).toBe(".md");
    expect(EXPORT_FORMATS.obsidian.mimeType).toBe("text/markdown");
  });

  it("json 格式配置正确", () => {
    expect(EXPORT_FORMATS.json.id).toBe("json");
    expect(EXPORT_FORMATS.json.name).toBe("JSON");
    expect(EXPORT_FORMATS.json.extension).toBe(".json");
    expect(EXPORT_FORMATS.json.mimeType).toBe("application/json");
  });

  it("html 格式配置正确", () => {
    expect(EXPORT_FORMATS.html.id).toBe("html");
    expect(EXPORT_FORMATS.html.name).toBe("HTML");
    expect(EXPORT_FORMATS.html.extension).toBe(".html");
    expect(EXPORT_FORMATS.html.mimeType).toBe("text/html");
  });

  it("EXPORT_FORMATS 定义为 const 对象", () => {
    // as const 在运行时不会冻结对象，但确保类型系统中是只读的
    // 验证所有格式配置存在
    expect(Object.keys(EXPORT_FORMATS).sort()).toEqual([
      "html",
      "json",
      "markdown",
      "obsidian",
    ]);
  });
});
