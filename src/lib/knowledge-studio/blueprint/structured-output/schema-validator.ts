/**
 * Schema 验证器 (Story 3.1)
 * @module knowledge-studio/blueprint/structured-output
 *
 * 使用 Ajv 实现 JSON Schema Draft 7 验证。
 * AC:
 * - 实现 validateOutput(content, schema) 验证函数
 * - 验证通过率目标 > 98%
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";
import { createLogger } from "@/lib/logger";
import type {
  StructuredOutputType,
  AnyStructuredOutput,
  SchemaValidationResult,
  SchemaValidationError,
  StructuredOutputMeta,
} from "./types";
import { schemaRegistry, getSchemaForType } from "./schemas";

// ============================================================
// Logger
// ============================================================

const logger = createLogger("blueprint:schema-validator");

// ============================================================
// Ajv Instance
// ============================================================

/**
 * 创建配置好的 Ajv 实例
 */
function createAjvInstance(): Ajv {
  const ajv = new Ajv({
    allErrors: true, // 收集所有错误，而不是遇到第一个就停止
    strict: false, // 允许非严格模式，提高兼容性
    coerceTypes: true, // 尝试类型转换
    useDefaults: true, // 应用默认值
    removeAdditional: "all", // 移除额外属性
  });

  // 添加格式验证支持
  addFormats(ajv);

  // 预编译所有 Schema
  for (const [type, schema] of Object.entries(schemaRegistry)) {
    try {
      ajv.addSchema(schema, type);
    } catch {
      logger.warn({ type }, "Failed to add schema, may already exist");
    }
  }

  return ajv;
}

// 单例 Ajv 实例
let ajvInstance: Ajv | null = null;

function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = createAjvInstance();
  }
  return ajvInstance;
}

// ============================================================
// Validation Functions
// ============================================================

/**
 * 验证结构化输出
 *
 * @param content - 要验证的内容（JSON 字符串或对象）
 * @param outputType - 输出类型
 * @returns 验证结果
 *
 * @example
 * ```typescript
 * const result = validateOutput(jsonString, 'swot');
 * if (result.valid) {
 *   const data = result.data as SwotOutput;
 *   // 使用验证后的数据
 * } else {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validateOutput(
  content: string | object,
  outputType: StructuredOutputType,
): SchemaValidationResult {
  const ajv = getAjv();
  const schema = getSchemaForType(outputType);

  // 解析 JSON（如果是字符串）
  let data: unknown;
  try {
    data = typeof content === "string" ? JSON.parse(content) : content;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to parse JSON content",
    );
    return {
      valid: false,
      errors: [
        {
          path: "",
          message: "Invalid JSON format",
          expected: "valid JSON",
          actual: typeof content,
        },
      ],
      outputType,
    };
  }

  // 执行验证
  const validate = ajv.getSchema(outputType) ?? ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    logger.debug({ outputType }, "Schema validation passed");
    return {
      valid: true,
      errors: [],
      outputType,
      data: data as AnyStructuredOutput,
    };
  }

  // 收集错误
  const errors: SchemaValidationError[] = (validate.errors ?? []).map(
    (error) => ({
      path: error.instancePath || "/",
      message: error.message ?? "Unknown validation error",
      expected: error.params ? JSON.stringify(error.params) : undefined,
      actual: undefined,
    }),
  );

  logger.warn(
    {
      outputType,
      errorCount: errors.length,
      errors: errors.slice(0, 3), // 只记录前 3 个错误
    },
    "Schema validation failed",
  );

  return {
    valid: false,
    errors,
    outputType,
  };
}

/**
 * 从内容中推断输出类型
 *
 * @param content - 要推断的内容
 * @returns 推断的输出类型，或 undefined 如果无法推断
 */
export function inferOutputType(
  content: string | object,
): StructuredOutputType | undefined {
  let data: unknown;
  try {
    data = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    return undefined;
  }

  if (!data || typeof data !== "object") {
    return undefined;
  }

  const meta = (data as Record<string, unknown>).meta as
    | StructuredOutputMeta
    | undefined;
  if (meta?.type) {
    return meta.type;
  }

  // 基于结构推断
  const obj = data as Record<string, unknown>;

  if (obj.quadrants) {
    return "swot";
  }
  if (obj.shots) {
    return "script_timeline";
  }
  if (obj.rows && obj.subjects) {
    return "feature_matrix";
  }
  if (obj.sections) {
    return "sections";
  }
  if (obj.items && Array.isArray(obj.items) && obj.items.length > 0) {
    const firstItem = obj.items[0] as Record<string, unknown>;
    if (firstItem && typeof firstItem === "object" && "status" in firstItem) {
      return "checklist";
    }
  }
  if (typeof obj.content === "string" && !obj.sections) {
    return "markdown";
  }

  return undefined;
}

/**
 * 自动验证内容（自动推断类型）
 *
 * @param content - 要验证的内容
 * @returns 验证结果
 */
export function validateOutputAuto(
  content: string | object,
): SchemaValidationResult {
  const outputType = inferOutputType(content);

  if (!outputType) {
    return {
      valid: false,
      errors: [
        {
          path: "",
          message: "Unable to infer output type from content",
          expected: "structured output with meta.type",
        },
      ],
    };
  }

  return validateOutput(content, outputType);
}

/**
 * 批量验证多个输出
 *
 * @param outputs - 要验证的输出列表
 * @returns 验证结果列表
 */
export function validateOutputBatch(
  outputs: Array<{ content: string | object; type: StructuredOutputType }>,
): SchemaValidationResult[] {
  return outputs.map(({ content, type }) => validateOutput(content, type));
}

/**
 * 检查输出是否有效（简化版本）
 *
 * @param content - 要检查的内容
 * @param outputType - 输出类型
 * @returns 是否有效
 */
export function isValidOutput(
  content: string | object,
  outputType: StructuredOutputType,
): boolean {
  return validateOutput(content, outputType).valid;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 创建空的元数据对象
 */
export function createEmptyMeta(
  outputType: StructuredOutputType,
  blueprintId: string,
  generationMode: "quick" | "guided" = "guided",
): StructuredOutputMeta {
  return {
    type: outputType,
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    blueprintId,
    generationMode,
    isFallback: false,
  };
}

/**
 * 创建降级元数据
 */
export function createFallbackMeta(
  originalType: StructuredOutputType,
  blueprintId: string,
  generationMode: "quick" | "guided" = "guided",
): StructuredOutputMeta {
  return {
    type: "markdown",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    blueprintId,
    generationMode,
    isFallback: true,
  };
}

/**
 * 获取所有支持的输出类型
 */
export function getSupportedOutputTypes(): StructuredOutputType[] {
  return Object.keys(schemaRegistry) as StructuredOutputType[];
}

/**
 * 检查是否支持指定的输出类型
 */
export function isOutputTypeSupported(
  type: string,
): type is StructuredOutputType {
  return type in schemaRegistry;
}
