/**
 * Chrome Extension API 类型声明
 *
 * 为浏览器扩展相关功能提供类型支持
 *
 * @since 2025-12-10
 * @updated 2025-12-25 - 添加 ChromeMessageResponse 接口
 */

/**
 * Chrome 扩展消息响应类型
 */
interface ChromeMessageResponse {
  /** 操作是否成功 */
  success?: boolean;
  /** 响应数据 */
  data?: unknown;
  /** 错误信息 */
  error?: string;
}

declare namespace chrome {
  namespace runtime {
    const id: string | undefined;
    const lastError: { message?: string } | undefined;

    function sendMessage<T = ChromeMessageResponse>(
      extensionId: string | undefined,
      message: unknown,
      callback?: (response: T) => void,
    ): void;

    function sendMessage<T = ChromeMessageResponse>(
      message: unknown,
      callback?: (response: T) => void,
    ): void;
  }
}
