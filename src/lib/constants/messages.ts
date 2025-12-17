/**
 * 应用文案常量
 *
 * 统一管理所有用户可见的文案，便于维护和国际化准备
 *
 * @example
 * ```typescript
 * import { MESSAGES } from '@/lib/constants/messages'
 *
 * toast.success(MESSAGES.BOOKMARK.CREATE_SUCCESS)
 * if (!confirm(MESSAGES.BOOKMARK.DELETE_CONFIRM)) return
 * alert(MESSAGES.BOOKMARK.DELETE_SUCCESS(count))
 * ```
 */

/**
 * 通用文案
 */
export const COMMON = {
  LOADING: "加载中...",
  SAVING: "保存中...",
  DELETING: "删除中...",
  UPLOADING: "上传中...",
  SUCCESS: "操作成功",
  ERROR: "操作失败",
  CONFIRM: "确认",
  CANCEL: "取消",
  SAVE: "保存",
  DELETE: "删除",
  EDIT: "编辑",
  CREATE: "创建",
  SEARCH: "搜索",
  FILTER: "筛选",
  CLEAR: "清空",
  CLOSE: "关闭",
  SUBMIT: "提交",
  RESET: "重置",
  YES: "是",
  NO: "否",
  BACK: "返回",
  NEXT: "下一步",
  PREVIOUS: "上一步",
  SELECT_ALL: "全选",
  DESELECT_ALL: "取消全选",
} as const;

/**
 * 收藏相关文案
 */
export const BOOKMARK = {
  // 创建
  CREATE_SUCCESS: "收藏创建成功",
  CREATE_ERROR: "创建收藏失败",
  CREATING: "创建收藏中...",

  // 更新
  UPDATE_SUCCESS: "收藏更新成功",
  UPDATE_ERROR: "更新收藏失败",
  UPDATING: "更新收藏中...",

  // 删除
  DELETE_CONFIRM: "确定要删除这条收藏吗？删除后无法恢复。",
  DELETE_SUCCESS: (count: number) =>
    count === 1 ? "删除成功" : `成功删除 ${count} 条收藏`,
  DELETE_ERROR: (count: number) =>
    count === 1 ? "删除失败" : `删除失败 ${count} 条`,
  DELETING: (count: number) =>
    count === 1 ? "删除中..." : `删除 ${count} 条收藏中...`,
  LOCKED_CANNOT_DELETE: "此收藏已锁定，无法删除",

  // 批量删除
  BATCH_DELETE_CONFIRM: (count: number) =>
    `确定要删除选中的 ${count} 条收藏吗？删除后无法恢复。`,
  BATCH_DELETE_SUCCESS: (count: number) => `成功删除 ${count} 条收藏`,
  BATCH_DELETE_ERROR: "批量删除失败",

  // 查询
  NOT_FOUND: "收藏不存在",
  LOAD_ERROR: "加载收藏失败",
  EMPTY: "暂无收藏",
  EMPTY_HINT: "点击右下角按钮添加第一条收藏",

  // 搜索
  SEARCH_PLACEHOLDER: "搜索标题、描述、标签...",
  SEARCH_ERROR: "搜索时出错，请稍后重试",
  SEARCH_NO_RESULTS: "未找到匹配的收藏",

  // 批量导入
  BATCH_IMPORT_SUCCESS: "批量导入完成",
  BATCH_IMPORT_ERROR: "批量导入失败",
  BATCH_IMPORTING: "正在导入...",
  BATCH_IMPORT_FILE_ERROR: "文件格式错误",
  BATCH_IMPORT_EMPTY: "文件中没有有效的书签数据",

  // 字段
  TITLE: "标题",
  DESCRIPTION: "描述",
  URL: "URL",
  PLATFORM: "平台",
  FOLDER: "文件夹",
  TAGS: "标签",
  CREATED_AT: "创建时间",
  UPDATED_AT: "更新时间",
} as const;

/**
 * 文件夹相关文案
 */
export const FOLDER = {
  // 创建
  CREATE_SUCCESS: "文件夹创建成功",
  CREATE_ERROR: "创建文件夹失败",
  CREATING: "创建文件夹中...",

  // 更新
  UPDATE_SUCCESS: "文件夹更新成功",
  UPDATE_ERROR: "更新文件夹失败",
  UPDATING: "更新文件夹中...",

  // 删除
  DELETE_SUCCESS: "文件夹删除成功",
  DELETE_ERROR: "删除文件夹失败",
  DELETE_CONFIRM: "确定要删除这个文件夹吗？",
  DELETE_ERROR_HAS_BOOKMARKS: (count: number) =>
    `文件夹下还有 ${count} 条收藏，请先移动或删除这些收藏`,
  DELETING: "删除文件夹中...",

  // 错误
  CIRCULAR_REFERENCE_ERROR: "不能将文件夹移动到自己或其子文件夹下",
  NOT_FOUND: "文件夹不存在",
  LOAD_ERROR: "加载文件夹失败",

  // 其他
  ROOT: "所有收藏",
  UNCATEGORIZED: "未分类",
  EMPTY: "暂无文件夹",
  SELECT_FOLDER: "选择文件夹",
} as const;

/**
 * 认证相关文案
 */
export const AUTH = {
  // 登录
  LOGIN: "登录",
  LOGIN_SUCCESS: "登录成功",
  LOGIN_ERROR: "登录失败",
  LOGIN_REQUIRED: "请先登录",
  LOGIN_WITH_EMAIL: "使用邮箱登录",

  // 注册
  REGISTER: "注册",
  REGISTER_SUCCESS: "注册成功，请查收邮箱验证邮件",
  REGISTER_ERROR: "注册失败",

  // 登出
  LOGOUT: "登出",
  LOGOUT_SUCCESS: "登出成功",
  LOGOUT_ERROR: "登出失败",

  // 权限
  UNAUTHORIZED: "无权限访问此资源",
  FORBIDDEN: "无权限修改此资源",

  // 字段
  EMAIL: "邮箱",
  PASSWORD: "密码",
  CONFIRM_PASSWORD: "确认密码",
} as const;

/**
 * 验证错误文案
 */
export const VALIDATION = {
  // 必填字段
  REQUIRED: (field: string) => `${field}不能为空`,

  // 长度限制
  TOO_SHORT: (field: string, min: number) =>
    `${field}长度不能少于 ${min} 个字符`,
  TOO_LONG: (field: string, max: number) =>
    `${field}长度不能超过 ${max} 个字符`,

  // 格式验证
  INVALID_EMAIL: "请输入有效的邮箱地址",
  INVALID_URL: "请输入有效的 URL 地址",
  INVALID_FORMAT: (field: string) => `${field}格式不正确`,

  // 数值验证
  TOO_SMALL: (field: string, min: number) => `${field}不能小于 ${min}`,
  TOO_LARGE: (field: string, max: number) => `${field}不能大于 ${max}`,

  // 密码
  PASSWORD_TOO_SHORT: "密码长度不能少于 6 个字符",
  PASSWORD_MISMATCH: "两次输入的密码不一致",

  // 文件夹
  FOLDER_NAME_REQUIRED: "文件夹名称不能为空",
  FOLDER_NAME_TOO_LONG: (max: number) => `文件夹名称不能超过 ${max} 个字符`,

  // 收藏
  BOOKMARK_TITLE_REQUIRED: "收藏标题不能为空",
  BOOKMARK_URL_REQUIRED: "URL 不能为空",

  // 批量操作
  BATCH_SELECT_REQUIRED: "请至少选择一项",
  BATCH_LIMIT_EXCEEDED: (max: number) => `单次最多选择 ${max} 项`,
} as const;

/**
 * 上传相关文案
 */
export const UPLOAD = {
  // 状态
  UPLOADING: "上传中...",
  UPLOAD_SUCCESS: "上传成功",
  UPLOAD_ERROR: "上传失败",

  // 验证
  FILE_TOO_LARGE: (maxSizeMB: number) => `文件大小不能超过 ${maxSizeMB}MB`,
  INVALID_FILE_TYPE: (allowedTypes: string) =>
    `只支持 ${allowedTypes} 格式的文件`,
  UPLOAD_LIMIT_EXCEEDED: (max: number) => `最多只能上传 ${max} 个文件`,

  // 提示
  DRAG_AND_DROP: "拖拽文件到这里，或点击上传",
  COMPRESS_HINT: "图片将自动压缩以节省存储空间",
} as const;

/**
 * 存储相关文案
 */
export const STORAGE = {
  QUOTA_EXCEEDED: "存储空间不足",
  QUOTA_WARNING: (percent: number) => `存储空间已使用 ${percent}%`,
  USED: (used: number, total: number) => `已使用 ${used} / ${total}`,
} as const;

/**
 * 设置相关文案
 */
export const SETTINGS = {
  // 通用
  SETTINGS: "设置",
  SAVE_SUCCESS: "设置保存成功",
  SAVE_ERROR: "保存设置失败",
  RESET_CONFIRM: "确定要重置所有设置吗？",

  // 主题
  THEME: "主题",
  THEME_LIGHT: "浅色",
  THEME_DARK: "深色",
  THEME_SYSTEM: "跟随系统",

  // 账户
  ACCOUNT: "账户",
  PROFILE: "个人资料",
  CHANGE_PASSWORD: "修改密码",
  DELETE_ACCOUNT: "删除账户",
  DELETE_ACCOUNT_CONFIRM: "确定要删除账户吗？此操作不可恢复。",
} as const;

/**
 * 统计相关文案
 */
export const ANALYTICS = {
  TITLE: "统计分析",
  TOTAL_BOOKMARKS: "收藏总数",
  DAILY_GROWTH: "今日新增",
  STORAGE_USED: "存储使用",
  PLATFORM_DISTRIBUTION: "平台分布",
  TIME_TREND: "时间趋势",
  TAG_CLOUD: "标签云",
  NO_DATA: "暂无数据",
} as const;

/**
 * V4.2.15: 快照相关文案
 */
export const SNAPSHOT = {
  // 创建
  CREATE_SUCCESS: "快照创建成功",
  CREATE_ERROR: "快照创建失败",
  CREATING: "正在创建快照...",
  CREATING_FOR_TAG: (tag: string) => `正在为「${tag}」内容创建快照...`,

  // 配额
  QUOTA_EXCEEDED: "快照配额已满",
  QUOTA_WARNING: "快照配额即将用尽",
  UPGRADE_HINT: "升级到 Pro 获取更多配额",

  // 操作
  CANCELLED: "已取消自动快照",
  VIEW: "查看快照",
  DELETE_CONFIRM: "确定要删除这个快照吗？",
  DELETE_SUCCESS: "快照删除成功",
  DELETE_ERROR: "快照删除失败",

  // 提示
  DESCRIPTION: "内容将被永久保存，防止网页失效",
  BATCH_CREATING: (count: number) => `正在为 ${count} 个收藏创建快照...`,
  BATCH_SUCCESS: (count: number) => `成功创建 ${count} 个快照`,
} as const;

/**
 * V4.2.15: 垃圾箱相关文案
 */
export const TRASH = {
  TITLE: "垃圾箱",
  EMPTY: "垃圾箱为空",
  EMPTY_HINT: "删除的收藏会显示在这里",

  // 操作
  RESTORE_SUCCESS: "已恢复收藏",
  RESTORE_ERROR: "恢复失败",
  RESTORE_CONFIRM: "确定要恢复这个收藏吗？",

  // 清空
  EMPTY_CONFIRM: "确定要清空垃圾箱吗？此操作不可恢复。",
  EMPTY_SUCCESS: "垃圾箱已清空",
  EMPTY_ERROR: "清空垃圾箱失败",
  EMPTIED_COUNT: (count: number) => `已永久删除 ${count} 个收藏`,

  // 批量
  BATCH_RESTORE_SUCCESS: (count: number) => `已恢复 ${count} 个收藏`,
  BATCH_DELETE_SUCCESS: (count: number) => `已永久删除 ${count} 个收藏`,
} as const;

/**
 * V4.2.15: 分类相关文案
 */
export const CLASSIFICATION = {
  // 建议
  SUGGESTION_ACCEPTED: "已接受分类建议",
  SUGGESTION_REJECTED: "已拒绝分类建议",
  SUGGESTION_ERROR: "分类操作失败",

  // 整理
  ORGANIZING: "正在整理...",
  NO_SUGGESTIONS: "暂无整理建议",
  INBOX_ANALYZING: "正在分析待整理内容...",

  // 重分类
  RECLASSIFY_SUCCESS: "重新分类成功",
  RECLASSIFY_ERROR: "重新分类失败",
} as const;

/**
 * P2-007: MD 收藏相关文案
 */
export const MD_COLLECTION = {
  // 创建
  CREATE_SUCCESS: "MD 收藏创建成功",
  CREATE_ERROR: "创建 MD 收藏失败",
  CREATING: "创建 MD 收藏中...",

  // 更新
  UPDATE_SUCCESS: "MD 收藏更新成功",
  UPDATE_ERROR: "更新 MD 收藏失败",
  UPDATING: "更新 MD 收藏中...",

  // 删除
  DELETE_SUCCESS: "MD 收藏删除成功",
  DELETE_ERROR: "删除 MD 收藏失败",
  DELETE_CONFIRM: "确定要删除这篇 MD 收藏吗？删除后无法恢复。",
  DELETING: "删除 MD 收藏中...",

  // 查询
  NOT_FOUND: "MD 收藏不存在",
  LOAD_ERROR: "加载 MD 收藏失败",
  EMPTY: "暂无 MD 收藏",
  EMPTY_HINT: "支持直接粘贴 Markdown 内容或上传 .md 文件",

  // 上传
  UPLOAD_SUCCESS: "文件上传成功",
  UPLOAD_ERROR: "文件上传失败",
  UPLOADING: "上传文件中...",
  INVALID_FILE_TYPE: "仅支持 .md 或 .txt 文件",
  FILE_TOO_LARGE: "文件大小不能超过 1MB",
  CONTENT_TOO_LARGE: "内容超过 100KB 限制",

  // 重复检测
  DUPLICATE_FOUND: "检测到重复内容",
  DUPLICATE_CONFIRM: "已存在相似内容，是否继续保存？",

  // 处理状态
  PROCESSING: "AI 处理中...",
  PROCESS_SUCCESS: "AI 处理完成",
  PROCESS_ERROR: "AI 处理失败",

  // 权限
  FEATURE_DISABLED: "MD 收藏功能仅限 Pro 会员使用",
  UPGRADE_HINT: "升级到 Pro 解锁 MD 收藏功能",

  // 验证
  TITLE_REQUIRED: "标题不能为空",
  CONTENT_REQUIRED: "内容不能为空",
} as const;

/**
 * 所有文案的聚合导出
 */
export const MESSAGES = {
  COMMON,
  BOOKMARK,
  FOLDER,
  AUTH,
  VALIDATION,
  UPLOAD,
  STORAGE,
  SETTINGS,
  ANALYTICS,
  SNAPSHOT,
  TRASH,
  CLASSIFICATION,
  MD_COLLECTION,
} as const;

/**
 * 默认导出（推荐使用具名导出）
 */
export default MESSAGES;
