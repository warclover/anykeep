/**
 * 内置工作流模块导出
 *
 * Phase 4: 完整内置工作流实现
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

// Phase 1 验证工作流
export * from "./bookmark-health-simple.workflow";

// Phase 4 完整工作流
export * from "./new-user-onboarding.workflow";
export * from "./bookmark-health.workflow";
export * from "./topic-deep-dive.workflow";
export * from "./periodic-backup.workflow";
export * from "./daily-digest.workflow";
export * from "./folder-cleanup.workflow";

// 种子数据
export * from "./seed-builtin-workflows";

// 工作流注册表
import { bookmarkHealthSimpleWorkflow } from "./bookmark-health-simple.workflow";
import { newUserOnboardingWorkflow } from "./new-user-onboarding.workflow";
import { bookmarkHealthWorkflow } from "./bookmark-health.workflow";
import { topicDeepDiveWorkflow } from "./topic-deep-dive.workflow";
import { periodicBackupWorkflow } from "./periodic-backup.workflow";
import { dailyDigestWorkflow } from "./daily-digest.workflow";
import { folderCleanupWorkflow } from "./folder-cleanup.workflow";
import type { WorkflowDefinition } from "../types";

/**
 * 内置工作流注册表
 */
export const builtinWorkflows: WorkflowDefinition[] = [
  // P0 优先级
  newUserOnboardingWorkflow,
  bookmarkHealthWorkflow,

  // P1 优先级
  topicDeepDiveWorkflow,
  periodicBackupWorkflow,
  dailyDigestWorkflow,

  // P2 优先级
  folderCleanupWorkflow,

  // Phase 1 验证工作流
  bookmarkHealthSimpleWorkflow,
];

/**
 * 根据 ID 获取内置工作流
 */
export function getBuiltinWorkflow(id: string): WorkflowDefinition | undefined {
  return builtinWorkflows.find((w) => w.id === id);
}

/**
 * 获取所有内置工作流
 */
export function getAllBuiltinWorkflows(): WorkflowDefinition[] {
  return builtinWorkflows;
}
