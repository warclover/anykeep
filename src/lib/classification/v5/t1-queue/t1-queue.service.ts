/**
 * T1异步队列服务
 * 用于Optimistic UI模式下的T1任务管理
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoggerService } from "../shared/logger";

/**
 * T1任务状态
 */
export type T1TaskStatus = "pending" | "processing" | "completed" | "failed";

/**
 * T1任务数据
 */
export interface T1Task {
  eventId: string;
  userId: string;
  bookmarkId: string;
  t0FolderId: string;
  t0Confidence: number;
  status: T1TaskStatus;
  t1FolderId?: string;
  t1Confidence?: number;
  t1Reasoning?: string;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
  executionTimeMs?: number;
}

/**
 * T1队列服务
 */
export class T1QueueService {
  constructor(
    private supabase: SupabaseClient,
    private logger: LoggerService,
  ) {}

  /**
   * 创建T1任务记录
   */
  async createTask(
    eventId: string,
    userId: string,
    bookmarkId: string,
    t0FolderId: string,
    t0Confidence: number,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("classification_t1_queue_v5")
      .insert({
        event_id: eventId,
        user_id: userId,
        bookmark_id: parseInt(bookmarkId, 10),
        t0_folder_id: parseInt(t0FolderId, 10),
        t0_confidence: t0Confidence,
        status: "pending",
      });

    if (error) {
      this.logger.error("创建T1任务失败", { error, eventId });
      throw error;
    }

    this.logger.info("T1任务已创建", { eventId, bookmarkId });
  }

  /**
   * 查询T1任务结果
   */
  async getTask(eventId: string): Promise<T1Task | null> {
    const { data, error } = await this.supabase
      .from("classification_t1_queue_v5")
      .select("*")
      .eq("event_id", eventId)
      .single();

    if (error) {
      this.logger.warn("查询T1任务失败", { error, eventId });
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      eventId: data.event_id,
      userId: data.user_id,
      bookmarkId: data.bookmark_id.toString(),
      t0FolderId: data.t0_folder_id.toString(),
      t0Confidence: data.t0_confidence,
      status: data.status,
      t1FolderId: data.t1_folder_id?.toString(),
      t1Confidence: data.t1_confidence,
      t1Reasoning: data.t1_reasoning,
      errorMessage: data.error_message,
      createdAt: new Date(data.created_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      executionTimeMs: data.execution_time_ms,
    };
  }

  /**
   * 更新T1任务状态为processing
   */
  async markAsProcessing(eventId: string): Promise<void> {
    const { error } = await this.supabase
      .from("classification_t1_queue_v5")
      .update({ status: "processing" })
      .eq("event_id", eventId);

    if (error) {
      this.logger.error("更新T1任务状态失败", { error, eventId });
      throw error;
    }
  }

  /**
   * 更新T1任务结果（成功）
   */
  async completeTask(
    eventId: string,
    t1FolderId: string,
    t1Confidence: number,
    t1Reasoning: string | undefined,
    executionTimeMs: number,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("classification_t1_queue_v5")
      .update({
        status: "completed",
        t1_folder_id: parseInt(t1FolderId, 10),
        t1_confidence: t1Confidence,
        t1_reasoning: t1Reasoning,
        completed_at: new Date().toISOString(),
        execution_time_ms: executionTimeMs,
      })
      .eq("event_id", eventId);

    if (error) {
      this.logger.error("更新T1任务结果失败", { error, eventId });
      throw error;
    }

    this.logger.info("T1任务已完成", { eventId, t1FolderId });
  }

  /**
   * 更新T1任务状态为失败
   */
  async failTask(eventId: string, errorMessage: string): Promise<void> {
    const { error } = await this.supabase
      .from("classification_t1_queue_v5")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);

    if (error) {
      this.logger.error("更新T1任务失败状态失败", { error, eventId });
      throw error;
    }

    this.logger.warn("T1任务失败", { eventId, errorMessage });
  }
}
