/**
 * TTS 模块导出
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

// 类型导出
export type {
  TTSModel,
  TTSSampleRate,
  TTSAudioFormat,
  TTSVoiceGender,
  TTSOptions,
  TTSDefaultVoices,
  TTSResult,
  TTSSynthesizeRequest,
  TTSServiceStatus,
  TTSContentType,
  TTSContentTypeConfig,
  TTSAPIRequest,
  TTSAPIResponse,
  TTSAPIError,
} from "./types";

// 常量导出
export {
  TTS_DEFAULT_CONFIG,
  TTS_ERROR_CODES,
  TTS_CONTENT_TYPES,
} from "./types";

// 服务导出
export { getTTSService, resetTTSService, TTSError } from "./aliyun-tts.service";
