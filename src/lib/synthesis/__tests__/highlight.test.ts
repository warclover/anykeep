/**
 * 综述标注类型转换函数单元测试
 *
 * @description 测试 toHighlight 和 toHighlightRow 函数
 */

import {
  toHighlight,
  toHighlightRow,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_CLASSES,
  SECTION_LABELS,
  type SynthesisHighlightRow,
  type CreateHighlightRequest,
  type HighlightSection,
  type HighlightPosition,
} from "../types/highlight";

// ============================================================================
// 测试数据工厂
// ============================================================================

function createMockHighlightRow(
  overrides?: Partial<SynthesisHighlightRow>,
): SynthesisHighlightRow {
  return {
    id: "highlight-123",
    report_id: "report-456",
    user_id: "user-789",
    content: "这是一段高亮内容",
    note: "这是一条笔记",
    color: "yellow",
    position: {
      start: 0,
      end: 10,
      section: "overview",
    },
    created_at: "2025-12-29T10:00:00Z",
    updated_at: "2025-12-29T10:30:00Z",
    ...overrides,
  };
}

function createMockHighlightRequest(
  overrides?: Partial<CreateHighlightRequest>,
): CreateHighlightRequest {
  return {
    content: "选中的文本内容",
    note: "用户笔记",
    color: "green",
    position: {
      start: 100,
      end: 150,
      section: "consensus",
      itemIndex: 2,
    },
    ...overrides,
  };
}

// ============================================================================
// toHighlight 测试
// ============================================================================

describe("toHighlight", () => {
  describe("基本字段映射", () => {
    it("正确映射所有基本字段", () => {
      const row = createMockHighlightRow();
      const result = toHighlight(row);

      expect(result.id).toBe("highlight-123");
      expect(result.reportId).toBe("report-456");
      expect(result.userId).toBe("user-789");
      expect(result.content).toBe("这是一段高亮内容");
      expect(result.note).toBe("这是一条笔记");
    });

    it("正确映射时间戳字段", () => {
      const row = createMockHighlightRow();
      const result = toHighlight(row);

      expect(result.createdAt).toBe("2025-12-29T10:00:00Z");
      expect(result.updatedAt).toBe("2025-12-29T10:30:00Z");
    });
  });

  describe("颜色字段映射", () => {
    HIGHLIGHT_COLORS.forEach((color) => {
      it(`正确映射颜色: ${color}`, () => {
        const row = createMockHighlightRow({ color });
        const result = toHighlight(row);

        expect(result.color).toBe(color);
      });
    });

    it("未知颜色时使用传入值（类型断言）", () => {
      const row = createMockHighlightRow({ color: "invalid-color" });
      const result = toHighlight(row);

      // 函数使用类型断言 (row.color as HighlightColor)，不做运行时校验
      // 但如果 row.color 为空，会默认 "yellow"
      expect(result.color).toBe("invalid-color");
    });

    it("空字符串颜色时默认为 yellow", () => {
      const row = createMockHighlightRow({ color: "" });
      const result = toHighlight(row);

      // 空字符串是 falsy，会触发 || "yellow" 默认值
      expect(result.color).toBe("yellow");
    });
  });

  describe("位置信息映射", () => {
    it("正确映射位置信息", () => {
      const position = {
        start: 50,
        end: 100,
        section: "divergence" as HighlightSection,
        itemIndex: 1,
      };
      const row = createMockHighlightRow({ position });
      const result = toHighlight(row);

      expect(result.position).toEqual(position);
      expect(result.position.start).toBe(50);
      expect(result.position.end).toBe(100);
      expect(result.position.section).toBe("divergence");
      expect(result.position.itemIndex).toBe(1);
    });

    it("位置信息不包含 itemIndex 时正常处理", () => {
      const position = {
        start: 0,
        end: 50,
        section: "overview" as HighlightSection,
      };
      const row = createMockHighlightRow({ position });
      const result = toHighlight(row);

      expect(result.position.itemIndex).toBeUndefined();
    });

    const sections: HighlightSection[] = [
      "overview",
      "consensus",
      "divergence",
      "blindspot",
      "full",
    ];

    sections.forEach((section) => {
      it(`正确处理区块类型: ${section}`, () => {
        const position = { start: 0, end: 10, section };
        const row = createMockHighlightRow({ position });
        const result = toHighlight(row);

        expect(result.position.section).toBe(section);
      });
    });
  });

  describe("空值处理", () => {
    it("note 为 null 时保持 null", () => {
      const row = createMockHighlightRow({ note: null });
      const result = toHighlight(row);

      expect(result.note).toBeNull();
    });

    it("note 有值时正确映射", () => {
      const row = createMockHighlightRow({ note: "用户笔记" });
      const result = toHighlight(row);

      expect(result.note).toBe("用户笔记");
    });
  });
});

// ============================================================================
// toHighlightRow 测试
// ============================================================================

describe("toHighlightRow", () => {
  const reportId = "report-test-123";
  const userId = "user-test-456";

  describe("基本字段映射", () => {
    it("正确设置 report_id 和 user_id", () => {
      const request = createMockHighlightRequest();
      const result = toHighlightRow(request, reportId, userId);

      expect(result.report_id).toBe(reportId);
      expect(result.user_id).toBe(userId);
    });

    it("正确映射 content", () => {
      const request = createMockHighlightRequest({ content: "测试内容" });
      const result = toHighlightRow(request, reportId, userId);

      expect(result.content).toBe("测试内容");
    });

    it("正确映射 note（有值时）", () => {
      const request = createMockHighlightRequest({ note: "测试笔记" });
      const result = toHighlightRow(request, reportId, userId);

      expect(result.note).toBe("测试笔记");
    });

    it("正确映射 note（未提供时转为 null）", () => {
      const request = createMockHighlightRequest();
      delete request.note;
      const result = toHighlightRow(request, reportId, userId);

      expect(result.note).toBeNull();
    });

    it("正确映射 note（空字符串时转为 null）", () => {
      // 注意：当前实现会保留空字符串，这里测试实际行为
      const request = createMockHighlightRequest({ note: "" });
      const result = toHighlightRow(request, reportId, userId);

      // 空字符串 || null = null
      expect(result.note).toBeNull();
    });
  });

  describe("颜色字段处理", () => {
    HIGHLIGHT_COLORS.forEach((color) => {
      it(`正确映射颜色: ${color}`, () => {
        const request = createMockHighlightRequest({ color });
        const result = toHighlightRow(request, reportId, userId);

        expect(result.color).toBe(color);
      });
    });

    it("未提供颜色时默认为 yellow", () => {
      const request = createMockHighlightRequest();
      delete request.color;
      const result = toHighlightRow(request, reportId, userId);

      expect(result.color).toBe("yellow");
    });
  });

  describe("位置信息处理", () => {
    it("正确映射完整的位置信息", () => {
      const position: HighlightPosition = {
        start: 100,
        end: 200,
        section: "blindspot",
        itemIndex: 3,
      };
      const request = createMockHighlightRequest({ position });
      const result = toHighlightRow(request, reportId, userId);

      expect(result.position).toEqual(position);
    });

    it("位置信息被转换为 Json 兼容格式", () => {
      const request = createMockHighlightRequest();
      const result = toHighlightRow(request, reportId, userId);

      // position 应该可以被 JSON 序列化
      expect(() => JSON.stringify(result.position)).not.toThrow();
    });
  });

  describe("返回值结构", () => {
    it("返回正确的字段结构", () => {
      const request = createMockHighlightRequest();
      const result = toHighlightRow(request, reportId, userId);

      expect(Object.keys(result).sort()).toEqual([
        "color",
        "content",
        "note",
        "position",
        "report_id",
        "user_id",
      ]);
    });

    it("不包含 id、created_at、updated_at（这些由数据库生成）", () => {
      const request = createMockHighlightRequest();
      const result = toHighlightRow(request, reportId, userId);

      expect("id" in result).toBe(false);
      expect("created_at" in result).toBe(false);
      expect("updated_at" in result).toBe(false);
    });
  });
});

// ============================================================================
// 常量测试
// ============================================================================

describe("HIGHLIGHT_COLORS", () => {
  it("包含四种预定义颜色", () => {
    expect(HIGHLIGHT_COLORS).toHaveLength(4);
    expect(HIGHLIGHT_COLORS).toContain("yellow");
    expect(HIGHLIGHT_COLORS).toContain("green");
    expect(HIGHLIGHT_COLORS).toContain("blue");
    expect(HIGHLIGHT_COLORS).toContain("pink");
  });

  it("定义为 const 数组", () => {
    // as const 在运行时不会冻结对象，但确保类型系统中是只读的
    // 这里验证数组内容是预期的字面量类型
    const colors: readonly string[] = HIGHLIGHT_COLORS;
    expect(colors).toEqual(["yellow", "green", "blue", "pink"]);
  });
});

describe("HIGHLIGHT_COLOR_CLASSES", () => {
  it("为每种颜色定义了样式类", () => {
    HIGHLIGHT_COLORS.forEach((color) => {
      expect(HIGHLIGHT_COLOR_CLASSES[color]).toBeDefined();
      expect(HIGHLIGHT_COLOR_CLASSES[color].bg).toBeDefined();
      expect(HIGHLIGHT_COLOR_CLASSES[color].hover).toBeDefined();
      expect(HIGHLIGHT_COLOR_CLASSES[color].border).toBeDefined();
    });
  });

  it("样式类包含 dark 模式变体", () => {
    HIGHLIGHT_COLORS.forEach((color) => {
      expect(HIGHLIGHT_COLOR_CLASSES[color].bg).toContain("dark:");
      expect(HIGHLIGHT_COLOR_CLASSES[color].hover).toContain("dark:");
      expect(HIGHLIGHT_COLOR_CLASSES[color].border).toContain("dark:");
    });
  });
});

describe("SECTION_LABELS", () => {
  it("包含所有区块的中文标签", () => {
    expect(SECTION_LABELS.overview).toBe("概述");
    expect(SECTION_LABELS.consensus).toBe("共识");
    expect(SECTION_LABELS.divergence).toBe("分歧");
    expect(SECTION_LABELS.blindspot).toBe("盲区");
    expect(SECTION_LABELS.full).toBe("全文");
  });

  it("包含 5 种区块类型", () => {
    expect(Object.keys(SECTION_LABELS)).toHaveLength(5);
  });
});
