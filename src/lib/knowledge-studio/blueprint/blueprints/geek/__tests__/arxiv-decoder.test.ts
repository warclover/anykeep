/**
 * ArxivDecoder Blueprint Tests (Story 4.1)
 * @module knowledge-studio/blueprint/blueprints/geek/__tests__
 */

import type { ArxivDecoderBlueprint } from "../arxiv-decoder";
import { createArxivDecoderBlueprint } from "../arxiv-decoder";
import type { EnhancedBlueprintInput, BriefingContext } from "../../../types";

// ============================================================
// Test Data
// ============================================================

const mockMaterial = {
  id: "paper-1",
  bookmarkId: "paper-1",
  type: "document" as const,
  title: "Attention Is All You Need",
  content: `
# Attention Is All You Need

## Abstract
The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.
We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.

## Introduction
Recurrent neural networks have established the state of the art in sequence modeling.
The Transformer is the first transduction model relying entirely on self-attention.

## Model Architecture
The Transformer follows an encoder-decoder structure using stacked self-attention.

\`\`\`python
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, n_heads):
        super().__init__()
        self.d_model = d_model
        self.n_heads = n_heads

    def forward(self, query, key, value):
        # attention computation
        return output
\`\`\`

## Results
Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task.

## Conclusion
The Transformer can be trained significantly faster than architectures based on recurrent or convolutional layers.

适用场景：NLP任务、机器翻译、文本生成
建议：
- 使用混合精度训练
- 优化注意力计算效率
- 添加梯度检查点
`,
  url: "https://arxiv.org/abs/1706.03762",
  sourceUrl: "https://arxiv.org/abs/1706.03762",
};

const mockBriefingContext: BriefingContext = {
  answers: {
    audience: "intermediate",
    focus: ["implementation", "engineering"],
    length: "standard",
  },
  answeredAt: new Date(),
};

const _mockInput: EnhancedBlueprintInput = {
  materials: [mockMaterial],
  briefingContext: mockBriefingContext,
  targetLength: "medium",
};

// ============================================================
// Tests
// ============================================================

describe("ArxivDecoderBlueprint", () => {
  let blueprint: ArxivDecoderBlueprint;

  beforeEach(() => {
    blueprint = createArxivDecoderBlueprint();
  });

  describe("Metadata", () => {
    it("should have correct blueprint ID", () => {
      expect(blueprint.blueprintId).toBe("geek-arxiv_decoder");
    });

    it("should have correct display name", () => {
      expect(blueprint.displayName).toBe("论文实战解码器");
    });

    it("should be categorized as geek", () => {
      expect(blueprint.category).toBe("geek");
    });

    it("should be a pro tier blueprint", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target AI bloggers and developers", () => {
      expect(blueprint.targetUsers).toContain("ai_blogger");
      expect(blueprint.targetUsers).toContain("developer");
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have priority 1 (P0)", () => {
      expect(blueprint.priority).toBe(1);
    });
  });

  describe("Briefing Configuration", () => {
    it("should have briefing enabled", () => {
      expect(blueprint.briefingConfig.enabled).toBe(true);
    });

    it("should have 3 briefing questions", () => {
      expect(blueprint.briefingConfig.questions).toHaveLength(3);
    });

    it("should have audience question", () => {
      const audienceQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "audience",
      );
      expect(audienceQ).toBeDefined();
      expect(audienceQ?.type).toBe("single_choice");
      expect(audienceQ?.required).toBe(true);
    });

    it("should have focus question with multi-choice", () => {
      const focusQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "focus",
      );
      expect(focusQ).toBeDefined();
      expect(focusQ?.type).toBe("multi_choice");
      expect(focusQ?.options?.length).toBeGreaterThanOrEqual(4);
    });

    it("should have length question as optional", () => {
      const lengthQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "length",
      );
      expect(lengthQ).toBeDefined();
      expect(lengthQ?.required).toBe(false);
    });
  });

  describe("getBriefingQuestions", () => {
    it("should return all briefing questions", () => {
      const questions = blueprint.getBriefingQuestions();
      expect(questions).toHaveLength(3);
      expect(questions).toEqual(blueprint.briefingConfig.questions);
    });
  });

  describe("getOutputSchema", () => {
    it("should return valid JSON Schema", () => {
      const schema = blueprint.getOutputSchema();
      expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
      expect(schema.type).toBe("object");
    });

    it("should have required fields", () => {
      const schema = blueprint.getOutputSchema();
      expect(schema.required).toContain("paperTitle");
      expect(schema.required).toContain("coreContribution");
      expect(schema.required).toContain("sections");
      expect(schema.required).toContain("reproductionDifficulty");
      expect(schema.required).toContain("conclusion");
    });

    it("should define sections as array", () => {
      const schema = blueprint.getOutputSchema();
      const properties = schema.properties as Record<string, JSONSchema7>;
      expect(properties.sections.type).toBe("array");
    });

    it("should have reproduction difficulty with min/max", () => {
      const schema = blueprint.getOutputSchema();
      const properties = schema.properties as Record<string, JSONSchema7>;
      expect(properties.reproductionDifficulty.minimum).toBe(1);
      expect(properties.reproductionDifficulty.maximum).toBe(5);
    });
  });

  describe("Metadata via OrchestrationSkill", () => {
    it("should have correct skill metadata", () => {
      const metadata = blueprint.metadata;
      expect(metadata.id).toBe("geek-arxiv_decoder");
      expect(metadata.name).toBe("论文实战解码器");
      expect(metadata.version).toBe("2.0.0");
      expect(metadata.category).toBe("learning");
    });

    it("should have correct capabilities", () => {
      const metadata = blueprint.metadata;
      expect(metadata.capabilities).toContain("generation");
      expect(metadata.capabilities).toContain("outline");
      expect(metadata.capabilities).toContain("structured-output");
    });
  });
});

// Type helper for JSON Schema
interface JSONSchema7 {
  $schema?: string;
  type?: string;
  properties?: Record<string, JSONSchema7>;
  required?: string[];
  items?: JSONSchema7;
  minimum?: number;
  maximum?: number;
}
