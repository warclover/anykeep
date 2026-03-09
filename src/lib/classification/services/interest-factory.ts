/**
 * InterestService 工厂函数
 *
 * 替代 ClassificationContainer.getInterestService()
 * 直接创建 InterestService 实例，无需 DI 容器
 *
 * @version 1.0.0
 * @since 2026-03-09
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { InterestService } from "./interest.service";
import { InterestRepository } from "../repositories/interest.repository";

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
