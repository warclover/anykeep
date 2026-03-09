/**
 * Integration 适配器
 *
 * 适配旧系统 classifyBookmarkV2() 函数签名。
 * 旧系统返回 { classified, folderId, folderName, confidence, action, suggestionId? }
 *
 * 旧系统接口来源：src/lib/classification/integration.ts
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { classify } from "../classify";
import {
  mapToIntegrationResult,
  type LegacyIntegrationResult,
} from "./type-mapping";

/**
 * 适配旧系统 classifyBookmarkV2() 签名
 *
 * 旧系统用法：
 * ```typescript
 * import { classifyBookmarkV2 } from '@/lib/classification/integration';
 *
 * const result = await classifyBookmarkV2(
 *   bookmarkId,   // number（旧）→ 转为 string（新）
 *   title,
 *   summary,      // string | null
 *   tags,
 *   userId,
 * );
 * ```
 *
 * @param bookmarkId - 书签 ID（旧系统为 number，新系统统一为 string）
 * @param title - 标题
 * @param summary - 摘要（可为 null）
 * @param tags - 标签数组
 * @param userId - 用户 ID
 */
export async function classifyBookmarkV2(
  bookmarkId: number | string,
  title: string,
  summary: string | null,
  tags: string[],
  userId: string,
): Promise<LegacyIntegrationResult> {
  const result = await classify({
    bookmarkId: String(bookmarkId),
    title,
    summary: summary ?? undefined,
    tags,
    userId,
  });

  return mapToIntegrationResult(result);
}
