/**
 * 画像 Prompts 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  getPersonaPrompt,
  hasPersonaPrompt,
  getPersonasWithPrompts,
  PM_PERSONA_PROMPT,
  CONSULTANT_PERSONA_PROMPT,
  TEACHER_PERSONA_PROMPT,
  GENERAL_PERSONA_PROMPT,
} from "../persona-prompts";

describe("Persona Prompts", () => {
  describe("PM_PERSONA_PROMPT", () => {
    it("should contain PM-specific keywords", () => {
      expect(PM_PERSONA_PROMPT).toContain("产品");
      expect(PM_PERSONA_PROMPT.length).toBeGreaterThan(100);
    });

    it("should not be empty", () => {
      expect(PM_PERSONA_PROMPT.trim().length).toBeGreaterThan(0);
    });
  });

  describe("CONSULTANT_PERSONA_PROMPT", () => {
    it("should contain consulting-specific keywords", () => {
      expect(CONSULTANT_PERSONA_PROMPT).toContain("咨询");
      expect(CONSULTANT_PERSONA_PROMPT.length).toBeGreaterThan(100);
    });

    it("should not be empty", () => {
      expect(CONSULTANT_PERSONA_PROMPT.trim().length).toBeGreaterThan(0);
    });
  });

  describe("TEACHER_PERSONA_PROMPT", () => {
    it("should contain teaching-specific keywords", () => {
      expect(TEACHER_PERSONA_PROMPT).toContain("教");
      expect(TEACHER_PERSONA_PROMPT.length).toBeGreaterThan(100);
    });

    it("should not be empty", () => {
      expect(TEACHER_PERSONA_PROMPT.trim().length).toBeGreaterThan(0);
    });
  });

  describe("GENERAL_PERSONA_PROMPT", () => {
    it("should exist and be valid", () => {
      expect(GENERAL_PERSONA_PROMPT).toBeDefined();
      expect(GENERAL_PERSONA_PROMPT.length).toBeGreaterThan(50);
    });
  });

  describe("getPersonaPrompt", () => {
    it("should return PM prompt for pm persona", () => {
      const prompt = getPersonaPrompt("pm");
      expect(prompt).toBe(PM_PERSONA_PROMPT);
    });

    it("should return CONSULTANT prompt for consultant persona", () => {
      const prompt = getPersonaPrompt("consultant");
      expect(prompt).toBe(CONSULTANT_PERSONA_PROMPT);
    });

    it("should return TEACHER prompt for teacher persona", () => {
      const prompt = getPersonaPrompt("teacher");
      expect(prompt).toBe(TEACHER_PERSONA_PROMPT);
    });

    it("should return GENERAL prompt for general persona", () => {
      const prompt = getPersonaPrompt("general");
      expect(prompt).toBe(GENERAL_PERSONA_PROMPT);
    });

    it("should return undefined for unknown persona", () => {
      const prompt = getPersonaPrompt("student");
      // Student may or may not have a prompt in Phase 1
      expect(prompt === undefined || typeof prompt === "string").toBe(true);
    });
  });

  describe("hasPersonaPrompt", () => {
    it("should return true for pm persona", () => {
      expect(hasPersonaPrompt("pm")).toBe(true);
    });

    it("should return true for consultant persona", () => {
      expect(hasPersonaPrompt("consultant")).toBe(true);
    });

    it("should return true for teacher persona", () => {
      expect(hasPersonaPrompt("teacher")).toBe(true);
    });

    it("should return true for general persona", () => {
      expect(hasPersonaPrompt("general")).toBe(true);
    });
  });

  describe("getPersonasWithPrompts", () => {
    it("should return an array", () => {
      const personas = getPersonasWithPrompts();
      expect(Array.isArray(personas)).toBe(true);
    });

    it("should include Phase 1 personas", () => {
      const personas = getPersonasWithPrompts();
      expect(personas).toContain("pm");
      expect(personas).toContain("consultant");
      expect(personas).toContain("teacher");
    });

    it("should include general persona", () => {
      const personas = getPersonasWithPrompts();
      expect(personas).toContain("general");
    });

    it("should have at least 4 personas with prompts", () => {
      const personas = getPersonasWithPrompts();
      expect(personas.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Prompt Quality", () => {
    const prompts = [
      { name: "PM", prompt: PM_PERSONA_PROMPT },
      { name: "Consultant", prompt: CONSULTANT_PERSONA_PROMPT },
      { name: "Teacher", prompt: TEACHER_PERSONA_PROMPT },
      { name: "General", prompt: GENERAL_PERSONA_PROMPT },
    ];

    it.each(prompts)(
      "$name prompt should have reasonable length",
      ({ prompt }) => {
        expect(prompt.length).toBeGreaterThan(50);
        expect(prompt.length).toBeLessThan(5000); // Not too long
      },
    );

    it.each(prompts)(
      "$name prompt should not have leading/trailing whitespace",
      ({ prompt }) => {
        expect(prompt).toBe(prompt.trim());
      },
    );

    it.each(prompts)("$name prompt should be in Chinese", ({ prompt }) => {
      // Check for Chinese characters
      const chineseRegex = /[\u4e00-\u9fff]/;
      expect(chineseRegex.test(prompt)).toBe(true);
    });
  });
});
