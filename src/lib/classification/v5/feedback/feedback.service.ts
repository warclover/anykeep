/**
 * 智能分类 v5.0 - 反馈服务
 *
 * 处理用户对分类结果的反馈，实现反馈闭环：
 * - accept: 强化建议的文件夹 Profile
 * - modify: 削弱建议的文件夹，强化实际选择的文件夹
 * - reject: 削弱建议的文件夹
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { LoggerService } from "../shared/logger";
import type {
  ClassificationFeedback,
  FeedbackResult,
  ProfileUpdateParams,
} from "./types";
import { ChatToRuleService } from "../chat-to-rule";

export class FeedbackService {
  private supabase: SupabaseClient<Database>;
  private logger: LoggerService;
  private chatToRuleService: ChatToRuleService;

  constructor(supabase: SupabaseClient<Database>, logger: LoggerService) {
    this.supabase = supabase;
    this.logger = logger.child({ service: "FeedbackService" });
    this.chatToRuleService = new ChatToRuleService(supabase, logger);
  }

  /**
   * 处理分类反馈
   */
  async processFeedback(
    feedback: ClassificationFeedback,
  ): Promise<FeedbackResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Processing classification feedback", {
        bookmarkId: feedback.bookmarkId,
        feedbackType: feedback.feedbackType,
      });

      let profileUpdated = false;
      let ruleExtracted = false;

      // 根据反馈类型处理
      switch (feedback.feedbackType) {
        case "accept":
          // 强化建议的文件夹
          if (feedback.suggestedFolderId) {
            await this.updateProfile({
              folderId: feedback.suggestedFolderId,
              bookmarkId: feedback.bookmarkId,
              updateType: "reinforce",
            });
            profileUpdated = true;
          }
          break;

        case "modify":
          // 这是强负反馈
          // 1. 削弱原建议文件夹
          if (feedback.suggestedFolderId) {
            await this.updateProfile({
              folderId: feedback.suggestedFolderId,
              bookmarkId: feedback.bookmarkId,
              updateType: "weaken",
            });
          }
          // 2. 强化实际选择的文件夹
          await this.updateProfile({
            folderId: feedback.actualFolderId,
            bookmarkId: feedback.bookmarkId,
            updateType: "reinforce",
          });
          profileUpdated = true;
          break;

        case "reject":
          // 削弱建议的文件夹
          if (feedback.suggestedFolderId) {
            await this.updateProfile({
              folderId: feedback.suggestedFolderId,
              bookmarkId: feedback.bookmarkId,
              updateType: "weaken",
            });
            profileUpdated = true;
          }
          break;
      }

      // 尝试从用户评论中提取规则（仅在 modify 类型且有评论时）
      if (feedback.feedbackType === "modify" && feedback.userComment) {
        try {
          ruleExtracted = await this.extractAndCreateRule(feedback);
        } catch (error) {
          this.logger.warn("Failed to extract rule from feedback", {
            error,
            bookmarkId: feedback.bookmarkId,
          });
          // 规则提取失败不影响整体反馈处理
        }
      }

      // 记录分类日志
      const logRecorded = await this.logClassificationFeedback(feedback);

      const duration = Date.now() - startTime;
      this.logger.info("Feedback processed successfully", {
        bookmarkId: feedback.bookmarkId,
        profileUpdated,
        ruleExtracted,
        logRecorded,
        duration,
      });

      return {
        success: true,
        profileUpdated,
        ruleExtracted,
        logRecorded,
      };
    } catch (error) {
      this.logger.error("Failed to process feedback", {
        error,
        feedback,
      });

      return {
        success: false,
        profileUpdated: false,
        ruleExtracted: false,
        logRecorded: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 更新文件夹 Profile（强化或削弱）
   */
  private async updateProfile(params: ProfileUpdateParams): Promise<void> {
    const { folderId, bookmarkId, updateType, learningRate = 0.1 } = params;

    try {
      // 1. 获取书签的 embedding
      const { data: bookmark, error: bookmarkError } = await this.supabase
        .from("bookmarks")
        .select("embedding")
        .eq("id", bookmarkId)
        .single();

      if (bookmarkError || !bookmark?.embedding) {
        throw new Error(
          `Failed to get bookmark embedding: ${bookmarkError?.message}`,
        );
      }

      // 2. 根据更新类型调整学习率
      // 强化：正常学习率
      // 削弱：负学习率（反向更新）
      const adjustedLearningRate =
        updateType === "reinforce" ? learningRate : -learningRate * 0.5; // 削弱时使用较小的负学习率

      // 3. 调用 RPC 函数更新 Profile
      const { error: updateError } = await this.supabase.rpc(
        "update_folder_profile_incremental",
        {
          p_folder_id: folderId,
          p_new_embedding: bookmark.embedding as unknown as string,
          p_learning_rate: adjustedLearningRate,
        },
      );

      if (updateError) {
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }

      this.logger.debug("Profile updated", {
        folderId,
        bookmarkId,
        updateType,
        learningRate: adjustedLearningRate,
      });
    } catch (error) {
      this.logger.error("Failed to update profile", {
        error,
        params,
      });
      throw error;
    }
  }

  /**
   * 记录分类反馈到日志表
   */
  private async logClassificationFeedback(
    feedback: ClassificationFeedback,
  ): Promise<boolean> {
    try {
      // 获取当前用户ID
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // 插入日志记录
      const { error } = await this.supabase.from("classification_logs").insert({
        user_id: user.id,
        bookmark_id: feedback.bookmarkId,
        suggested_folder_id: feedback.suggestedFolderId,
        suggested_folder_name: feedback.suggestedFolderName,
        suggested_confidence: feedback.confidence
          ? feedback.confidence / 100
          : null,
        actual_folder_id: feedback.actualFolderId,
        actual_folder_name: feedback.actualFolderName,
        feedback_type: feedback.feedbackType,
      });

      if (error) {
        throw new Error(`Failed to log feedback: ${error.message}`);
      }

      return true;
    } catch (error) {
      this.logger.error("Failed to log classification feedback", {
        error,
        feedback,
      });
      return false;
    }
  }

  /**
   * 从反馈中提取并创建规则
   */
  private async extractAndCreateRule(
    feedback: ClassificationFeedback,
  ): Promise<boolean> {
    try {
      // 1. 获取书签信息
      const { data: bookmark, error: bookmarkError } = await this.supabase
        .from("bookmarks")
        .select("title, url")
        .eq("id", feedback.bookmarkId)
        .single();

      if (bookmarkError || !bookmark) {
        throw new Error(`Failed to get bookmark: ${bookmarkError?.message}`);
      }

      // 2. 提取规则
      const extractedRule =
        await this.chatToRuleService.extractRuleFromFeedback({
          bookmarkTitle: bookmark.title,
          bookmarkUrl: bookmark.url,
          suggestedFolderName: feedback.suggestedFolderName || "",
          actualFolderName: feedback.actualFolderName,
          userComment: feedback.userComment ?? "",
        });

      if (!extractedRule) {
        this.logger.debug("No rule extracted from feedback", {
          bookmarkId: feedback.bookmarkId,
        });
        return false;
      }

      // 3. 验证规则
      const validation =
        await this.chatToRuleService.validateRule(extractedRule);
      if (!validation.isValid) {
        this.logger.warn("Extracted rule is invalid", {
          bookmarkId: feedback.bookmarkId,
          errors: validation.errors,
        });
        return false;
      }

      // 4. 检查置信度阈值
      if (extractedRule.confidence < 0.7) {
        this.logger.debug("Rule confidence too low", {
          bookmarkId: feedback.bookmarkId,
          confidence: extractedRule.confidence,
        });
        return false;
      }

      // 5. 创建规则
      const ruleId = await this.chatToRuleService.createRule({
        ruleType: extractedRule.ruleType,
        patternType: extractedRule.patternType,
        pattern: extractedRule.pattern,
        targetFolderId: feedback.actualFolderId,
        targetFolderName: feedback.actualFolderName,
        description: extractedRule.description,
        confidence: extractedRule.confidence,
      });

      this.logger.info("Rule created from feedback", {
        bookmarkId: feedback.bookmarkId,
        ruleId,
        ruleType: extractedRule.ruleType,
        patternType: extractedRule.patternType,
        confidence: extractedRule.confidence,
      });

      return true;
    } catch (error) {
      this.logger.error("Failed to extract and create rule", {
        error,
        feedback,
      });
      throw error;
    }
  }
}
