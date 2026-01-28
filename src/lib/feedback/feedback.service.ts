import type { UserFeedback, FeedbackListResponse } from "@/types/user-feedback";

interface CreateFeedbackPayload {
  type: string;
  category?: string;
  title: string;
  description: string;
  is_anonymous?: boolean;
  context?: Record<string, unknown>;
  attachments?: string[];
}

export class FeedbackService {
  private static BASE_URL = "/api/user-feedback";

  /**
   * 创建反馈
   */
  static async create(payload: CreateFeedbackPayload): Promise<UserFeedback> {
    const response = await fetch(this.BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "提交反馈失败");
    }
    return result.data;
  }

  /**
   * 获取反馈列表
   */
  static async getList(
    page = 1,
    pageSize = 10,
    filters?: { type?: string; status?: string },
  ): Promise<FeedbackListResponse["data"]> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (filters?.type) params.append("type", filters.type);
    if (filters?.status) params.append("status", filters.status);

    const response = await fetch(`${this.BASE_URL}?${params.toString()}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "获取反馈列表失败");
    }
    return result.data;
  }

  /**
   * 获取反馈详情
   */
  static async getDetail(id: string): Promise<UserFeedback> {
    const response = await fetch(`${this.BASE_URL}/${id}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "获取反馈详情失败");
    }
    return result.data;
  }

  /**
   * 更新反馈 (仅限 pending 状态或追加评论)
   */
  static async update(
    id: string,
    updates: Partial<UserFeedback> & { additional_comment?: string },
  ): Promise<UserFeedback> {
    const response = await fetch(`${this.BASE_URL}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "更新反馈失败");
    }
    return result.data;
  }

  /**
   * 删除反馈 (仅限 pending 状态)
   */
  static async delete(id: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/${id}`, {
      method: "DELETE",
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "删除反馈失败");
    }
  }

  /**
   * 上传附件 (预留)
   */
  static async uploadAttachment(file: File): Promise<string> {
    // 这里需要实现上传逻辑，通常是先请求 Signed URL 或直接上传到 /api/user-feedback/upload
    // 暂时实现为一个空壳，等待 upload API 实现
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.BASE_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "上传失败");
    }
    return result.data.url;
  }
}
