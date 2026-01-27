/**
 * Supabase Json 类型序列化工具
 *
 * 提供类型安全的 JSON 序列化/反序列化，解决 Supabase 的 Json 类型兼容问题
 */

import type { Json } from "@/types/supabase.generated";

/**
 * 将任意类型安全地转换为 Supabase Json 类型
 *
 * @example
 * const groups: DuplicateFolderGroup[] = [...];
 * await supabase.from('table').insert({
 *   data: toJson(groups)  // ✅ 类型安全
 * });
 */
export function toJson<T>(value: T): Json {
  // 使用 JSON 序列化/反序列化确保值符合 Json 类型约束
  return JSON.parse(JSON.stringify(value)) as Json;
}

/**
 * 将 Supabase Json 类型转换为指定类型
 *
 * @example
 * const row = await supabase.from('table').select('data').single();
 * const groups = fromJson<DuplicateFolderGroup[]>(row.data);
 */
export function fromJson<T>(value: Json): T {
  return value as unknown as T;
}

/**
 * 类型守卫：检查值是否为有效的 Json 对象
 */
export function isJsonObject(
  value: Json,
): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 类型守卫：检查值是否为有效的 Json 数组
 */
export function isJsonArray(value: Json): value is Json[] {
  return Array.isArray(value);
}

/**
 * 安全获取 Json 对象的属性
 *
 * @example
 * const obj = fromJson<{ name: string }>(row.data);
 * const name = getJsonProp(row.data, 'name', '');
 */
export function getJsonProp<T>(json: Json, key: string, defaultValue: T): T {
  if (isJsonObject(json) && key in json) {
    return json[key] as unknown as T;
  }
  return defaultValue;
}
