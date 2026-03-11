/**
 * 文件夹命名规则和清理函数
 *
 * 自包含模块，提供命名规则常量和名称清洗工具
 */
export { FOLDER_NAMING_RULES } from "./naming-rules";
export {
  sanitizeFolderName,
  generateFallbackName,
} from "./folder-name-sanitizer";
