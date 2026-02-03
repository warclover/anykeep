/**
 * 快捷命令解析测试
 *
 * @since 2026-01-11
 */

import {
  parseFastCommand,
  isFastCommand,
  getAllFastCommands,
  generateHelpText,
  FAST_COMMANDS,
} from "../fast-commands";

describe("fast-commands", () => {
  describe("parseFastCommand", () => {
    // ============================================
    // 基础解析测试
    // ============================================
    describe("basic parsing", () => {
      it("should return null for non-command input", () => {
        expect(parseFastCommand("hello")).toBeNull();
        expect(parseFastCommand("搜索 React")).toBeNull();
        expect(parseFastCommand("")).toBeNull();
        expect(parseFastCommand("   ")).toBeNull();
      });

      it("should return null for unknown commands", () => {
        expect(parseFastCommand("/unknown")).toBeNull();
        expect(parseFastCommand("/abc")).toBeNull();
        expect(parseFastCommand("/未知命令")).toBeNull();
      });

      it("should parse command without args", () => {
        const result = parseFastCommand("/search");
        expect(result).not.toBeNull();
        expect(result?.intent).toBe("query");
        expect(result?.subType).toBe("search");
        expect(result?.args).toBe("");
        expect(result?.confidence).toBe(1.0);
        expect(result?.source).toBe("fast_command");
      });

      it("should parse command with args", () => {
        const result = parseFastCommand("/search React hooks");
        expect(result).not.toBeNull();
        expect(result?.intent).toBe("query");
        expect(result?.subType).toBe("search");
        expect(result?.args).toBe("React hooks");
      });

      it("should handle leading/trailing whitespace", () => {
        const result = parseFastCommand("  /search  React  ");
        expect(result).not.toBeNull();
        expect(result?.args).toBe("React");
      });

      it("should be case-insensitive for English commands", () => {
        const lower = parseFastCommand("/search");
        const upper = parseFastCommand("/SEARCH");
        const mixed = parseFastCommand("/Search");

        expect(lower?.intent).toBe("query");
        expect(upper?.intent).toBe("query");
        expect(mixed?.intent).toBe("query");
      });
    });

    // ============================================
    // 搜索命令测试
    // ============================================
    describe("search commands", () => {
      it("should parse /search", () => {
        const result = parseFastCommand("/search TypeScript");
        expect(result?.intent).toBe("query");
        expect(result?.subType).toBe("search");
        expect(result?.args).toBe("TypeScript");
        expect(result?.requireConfirm).toBe(false);
      });

      it("should parse /s (alias)", () => {
        const result = parseFastCommand("/s React");
        expect(result?.intent).toBe("query");
        expect(result?.subType).toBe("search");
      });

      it("should parse /找 (Chinese)", () => {
        const result = parseFastCommand("/找 AI");
        expect(result?.intent).toBe("query");
        expect(result?.subType).toBe("search");
        expect(result?.args).toBe("AI");
      });

      it("should parse /搜索 (Chinese)", () => {
        const result = parseFastCommand("/搜索 机器学习");
        expect(result?.intent).toBe("query");
        expect(result?.subType).toBe("search");
        expect(result?.args).toBe("机器学习");
      });
    });

    // ============================================
    // 列表/统计命令测试
    // ============================================
    describe("list/count commands", () => {
      it("should parse /list", () => {
        const result = parseFastCommand("/list");
        expect(result?.intent).toBe("query");
        expect(result?.subType).toBe("list");
      });

      it("should parse /ls (alias)", () => {
        const result = parseFastCommand("/ls");
        expect(result?.intent).toBe("query");
        expect(result?.subType).toBe("list");
      });

      it("should parse /count", () => {
        const result = parseFastCommand("/count");
        expect(result?.intent).toBe("query");
        expect(result?.subType).toBe("count");
      });

      it("should parse /统计 (Chinese)", () => {
        const result = parseFastCommand("/统计");
        expect(result?.intent).toBe("query");
        expect(result?.subType).toBe("count");
      });
    });

    // ============================================
    // 删除命令测试（高风险）
    // ============================================
    describe("delete commands (high-risk)", () => {
      it("should parse /delete with requireConfirm", () => {
        const result = parseFastCommand("/delete");
        expect(result?.intent).toBe("action");
        expect(result?.subType).toBe("delete");
        expect(result?.requireConfirm).toBe(true);
      });

      it("should parse /del (alias)", () => {
        const result = parseFastCommand("/del");
        expect(result?.intent).toBe("action");
        expect(result?.subType).toBe("delete");
        expect(result?.requireConfirm).toBe(true);
      });

      it("should parse /rm (alias)", () => {
        const result = parseFastCommand("/rm");
        expect(result?.intent).toBe("action");
        expect(result?.subType).toBe("delete");
        expect(result?.requireConfirm).toBe(true);
      });

      it("should parse /删除 (Chinese)", () => {
        const result = parseFastCommand("/删除");
        expect(result?.intent).toBe("action");
        expect(result?.subType).toBe("delete");
        expect(result?.requireConfirm).toBe(true);
      });
    });

    // ============================================
    // 导出命令测试
    // ============================================
    describe("export commands", () => {
      it("should parse /export", () => {
        const result = parseFastCommand("/export markdown");
        expect(result?.intent).toBe("create");
        expect(result?.subType).toBe("export");
        expect(result?.args).toBe("markdown");
      });

      it("should parse /导出 (Chinese)", () => {
        const result = parseFastCommand("/导出 json");
        expect(result?.intent).toBe("create");
        expect(result?.subType).toBe("export");
      });

      it("should parse /备份 (Chinese)", () => {
        const result = parseFastCommand("/备份");
        expect(result?.intent).toBe("create");
        expect(result?.subType).toBe("share");
      });
    });

    // ============================================
    // 整理命令测试
    // ============================================
    describe("organize commands", () => {
      it("should parse /organize", () => {
        const result = parseFastCommand("/organize");
        expect(result?.intent).toBe("organize");
        expect(result?.subType).toBe("cleanup");
      });

      it("should parse /整理 (Chinese)", () => {
        const result = parseFastCommand("/整理");
        expect(result?.intent).toBe("organize");
        expect(result?.subType).toBe("cleanup");
      });

      it("should parse /dedupe", () => {
        const result = parseFastCommand("/dedupe");
        expect(result?.intent).toBe("organize");
        expect(result?.subType).toBe("dedupe");
      });

      it("should parse /去重 (Chinese)", () => {
        const result = parseFastCommand("/去重");
        expect(result?.intent).toBe("organize");
        expect(result?.subType).toBe("dedupe");
      });

      it("should parse /classify", () => {
        const result = parseFastCommand("/classify");
        expect(result?.intent).toBe("organize");
        expect(result?.subType).toBe("classify");
      });

      it("should parse /分类 (Chinese)", () => {
        const result = parseFastCommand("/分类");
        expect(result?.intent).toBe("organize");
        expect(result?.subType).toBe("classify");
      });
    });

    // ============================================
    // 标签/移动命令测试
    // ============================================
    describe("tag/move commands", () => {
      it("should parse /tag", () => {
        const result = parseFastCommand("/tag 重要");
        expect(result?.intent).toBe("action");
        expect(result?.subType).toBe("tag");
        expect(result?.args).toBe("重要");
      });

      it("should parse /标签 (Chinese)", () => {
        const result = parseFastCommand("/标签 待读");
        expect(result?.intent).toBe("action");
        expect(result?.subType).toBe("tag");
      });

      it("should parse /move", () => {
        const result = parseFastCommand("/move 工作");
        expect(result?.intent).toBe("action");
        expect(result?.subType).toBe("move");
        expect(result?.args).toBe("工作");
      });

      it("should parse /mv (alias)", () => {
        const result = parseFastCommand("/mv 学习");
        expect(result?.intent).toBe("action");
        expect(result?.subType).toBe("move");
      });
    });

    // ============================================
    // 帮助命令测试
    // ============================================
    describe("help commands", () => {
      it("should parse /help", () => {
        const result = parseFastCommand("/help");
        expect(result?.intent).toBe("chitchat");
        expect(result?.subType).toBe("help");
      });

      it("should parse /h (alias)", () => {
        const result = parseFastCommand("/h");
        expect(result?.intent).toBe("chitchat");
        expect(result?.subType).toBe("help");
      });

      it("should parse /? (alias)", () => {
        const result = parseFastCommand("/?");
        expect(result?.intent).toBe("chitchat");
        expect(result?.subType).toBe("help");
      });

      it("should parse /帮助 (Chinese)", () => {
        const result = parseFastCommand("/帮助");
        expect(result?.intent).toBe("chitchat");
        expect(result?.subType).toBe("help");
      });
    });

    // ============================================
    // 摘要/TTS 命令测试
    // ============================================
    describe("summary/tts commands", () => {
      it("should parse /summary", () => {
        const result = parseFastCommand("/summary");
        expect(result?.intent).toBe("create");
        expect(result?.subType).toBe("digest");
      });

      it("should parse /摘要 (Chinese)", () => {
        const result = parseFastCommand("/摘要");
        expect(result?.intent).toBe("create");
        expect(result?.subType).toBe("digest");
      });

      it("should parse /tts", () => {
        const result = parseFastCommand("/tts");
        expect(result?.intent).toBe("create");
        expect(result?.subType).toBe("tts");
      });

      it("should parse /朗读 (Chinese)", () => {
        const result = parseFastCommand("/朗读");
        expect(result?.intent).toBe("create");
        expect(result?.subType).toBe("tts");
      });
    });
  });

  // ============================================
  // isFastCommand 测试
  // ============================================
  describe("isFastCommand", () => {
    it("should return true for valid commands", () => {
      expect(isFastCommand("/search")).toBe(true);
      expect(isFastCommand("/delete")).toBe(true);
      expect(isFastCommand("/整理")).toBe(true);
    });

    it("should return false for non-commands", () => {
      expect(isFastCommand("hello")).toBe(false);
      expect(isFastCommand("/unknown")).toBe(false);
      expect(isFastCommand("")).toBe(false);
    });
  });

  // ============================================
  // getAllFastCommands 测试
  // ============================================
  describe("getAllFastCommands", () => {
    it("should return array of command info", () => {
      const commands = getAllFastCommands();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    });

    it("should include command, description, aliases, requireConfirm", () => {
      const commands = getAllFastCommands();
      const searchCmd = commands.find((c) => c.command === "/search");

      expect(searchCmd).toBeDefined();
      expect(searchCmd?.description).toBeDefined();
      expect(Array.isArray(searchCmd?.aliases)).toBe(true);
      expect(typeof searchCmd?.requireConfirm).toBe("boolean");
    });

    it("should mark delete command as requireConfirm", () => {
      const commands = getAllFastCommands();
      const deleteCmd = commands.find((c) => c.command === "/delete");

      expect(deleteCmd?.requireConfirm).toBe(true);
    });
  });

  // ============================================
  // generateHelpText 测试
  // ============================================
  describe("generateHelpText", () => {
    it("should return non-empty string", () => {
      const helpText = generateHelpText();
      expect(typeof helpText).toBe("string");
      expect(helpText.length).toBeGreaterThan(0);
    });

    it("should include header", () => {
      const helpText = generateHelpText();
      expect(helpText).toContain("快捷命令");
    });

    it("should include warning indicator", () => {
      const helpText = generateHelpText();
      expect(helpText).toContain("⚠️");
    });

    it("should include command examples", () => {
      const helpText = generateHelpText();
      expect(helpText).toContain("/search");
      expect(helpText).toContain("/delete");
    });
  });

  // ============================================
  // FAST_COMMANDS 配置完整性测试
  // ============================================
  describe("FAST_COMMANDS configuration", () => {
    it("should have valid intent types", () => {
      const validIntents = [
        "query",
        "action",
        "organize",
        "analyze",
        "learn",
        "create",
        "chitchat",
        "refine",
      ];

      for (const [_cmd, config] of Object.entries(FAST_COMMANDS)) {
        expect(validIntents).toContain(config.intent);
      }
    });

    it("should have non-empty subType", () => {
      for (const [_cmd, config] of Object.entries(FAST_COMMANDS)) {
        expect(config.subType).toBeDefined();
        expect(config.subType.length).toBeGreaterThan(0);
      }
    });

    it("should have at least 20 commands", () => {
      const commandCount = Object.keys(FAST_COMMANDS).length;
      expect(commandCount).toBeGreaterThanOrEqual(20);
    });
  });
});
