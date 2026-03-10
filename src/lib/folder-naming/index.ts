/**
 * 文件夹命名规则和清理函数桥接模块
 */
export { FOLDER_NAMING_RULES } from "@/lib/classification/constants/naming-rules";
export {
  sanitizeFolderName,
  generateFallbackName,
} from "@/lib/classification/utils/folder-name-sanitizer";
