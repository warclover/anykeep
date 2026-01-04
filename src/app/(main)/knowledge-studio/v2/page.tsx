/**
 * Knowledge Studio v2 - 主页面
 * @route /knowledge-studio/v2
 *
 * 工作流:
 * 1. 选择蓝图 (BlueprintSelector)
 * 2. 选择素材 (BookmarkPicker)
 * 3. 进入蓝图工作流
 */

import { Suspense } from "react";
import { KnowledgeStudioV2PageClient } from "./knowledge-studio-v2-page-client";

export const metadata = {
  title: "知识工坊 Beta | AnyKeep",
  description: "使用增强蓝图生成专业内容",
};

export default function KnowledgeStudioV2Page() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">加载中...</div>
        </div>
      }
    >
      <KnowledgeStudioV2PageClient />
    </Suspense>
  );
}
