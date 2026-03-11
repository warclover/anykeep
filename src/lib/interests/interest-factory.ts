/**
 * InterestService 工厂函数
 *
 * 直接创建 InterestService 实例，无需 DI 容器。
 * Extracted from classification-v1/services/interest-factory.
 *
 * @module interests
 * @version 1.0.0
 * @since 2026-03-11
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { InterestService } from "./interest.service";
import { InterestRepository } from "./interest.repository";

/**
 * 创建 InterestService 实例
 *
 * @param supabase - Supabase 客户端
 * @returns InterestService 实例
 */
export function createInterestService(
  supabase: SupabaseClient,
): InterestService {
  const repository = new InterestRepository(supabase);
  return new InterestService(repository, supabase);
}
