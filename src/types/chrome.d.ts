/**
 * Chrome Extension API 类型声明
 *
 * 仅声明与扩展通信相关的 API
 */

declare namespace chrome {
  namespace runtime {
    const lastError: { message: string } | undefined

    function sendMessage(
      extensionId: string,
      message: Record<string, unknown>,
      callback?: (response: { success?: boolean; [key: string]: unknown }) => void
    ): void
  }
}
