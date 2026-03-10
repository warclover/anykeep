/**
 * 文件夹演进服务桥接模块
 *
 * merge/split/rename/report 服务的统一入口
 *
 * @deprecated 过渡模块，后续将内联化
 */
export { mergeService } from "@/lib/classification/services/merge.service";
export { splitService } from "@/lib/classification/services/split.service";
export { renameService } from "@/lib/classification/services/rename.service";
export { reportService } from "@/lib/classification/services/report.service";
