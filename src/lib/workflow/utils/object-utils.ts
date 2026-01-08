/**
 * 对象工具函数
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

/**
 * 获取嵌套对象的值
 *
 * @param obj - 源对象
 * @param path - 点分隔的路径（如 "level1.level2.value"）
 * @returns 路径对应的值，找不到返回 undefined
 *
 * @example
 * ```typescript
 * const obj = { a: { b: { c: 1 } } };
 * getNestedValue(obj, "a.b.c"); // 1
 * getNestedValue(obj, "a.b.d"); // undefined
 * ```
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
