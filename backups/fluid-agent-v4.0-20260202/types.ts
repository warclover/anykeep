// =====================================================
// 共享类型定义
// =====================================================

import type { Bookmark } from '@/types/bookmark';

// --- 规则引擎 ---

export type RuleCategory =
  | 'language'
  | 'content'
  | 'quantity'
  | 'time'
  | 'source'
  | 'tag'
  | 'folder';

export interface PredictionRule {
  id: string;
  name: string;
  icon: string;
  priority: number;  // 0-100
  category: RuleCategory;
  enabled: boolean;
  condition: (selection: Bookmark[]) => boolean;
  action: string;  // Skill 或 Tool 名称
  params?: (selection: Bookmark[]) => Record<string, unknown>;
}

export interface PredictionResult {
  ruleId: string;
  action: string;
  icon: string;
  label: string;
  confidence: number;
  affectedCount: number;
  params?: Record<string, unknown>;
}

// --- 执行引擎 ---

export type OperationStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface OperationStep {
  id: string;
  name: string;
  status: OperationStepStatus;
  progress?: number;
  error?: string;
}

export interface OperationContext {
  operationId: string;
  userId: string;
  action: string;
  selection: Bookmark[];
  steps: OperationStep[];
  startedAt: Date;
  isCancelled: boolean;
}

export interface OperationResult {
  success: boolean;
  operationId: string;
  affectedCount: number;
  error?: string;
}

// --- 快照 ---

export type EntityType = 'bookmark' | 'folder' | 'tag';

export interface SnapshotEntity {
  type: EntityType;
  id: string;
  data: unknown;
}

export interface RollbackResult {
  success: boolean;
  restoredCount: number;
  error?: string;
}

// --- 遥测 ---

export interface TelemetryEvent {
  id: string;
  userId: string;
  ruleId: string;
  selectionCount: number;
  matchedAt: Date;
  accepted: boolean | null;
  decidedAt: Date | null;
  sessionId: string;
}

export interface RuleStats {
  ruleId: string;
  matchCount: number;
  acceptCount: number;
  ignoreCount: number;
  acceptRate: number;
}

// --- 电池系统 ---

export type BatteryLevel = 'full' | 'medium' | 'low' | 'empty';

export interface BatteryState {
  level: BatteryLevel;
  remaining: number;
  total: number;
  resetAt: Date;
  isPro: boolean;
}

// --- 指令框 ---

export interface PresetCommand {
  id: string;
  keywords: string[];
  name: string;
  description: string;
  icon: string;
  action: string;
  tools: string[];
  requiresSelection: boolean;
}
