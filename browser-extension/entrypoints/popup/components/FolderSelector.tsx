/**
 * 文件夹选择器组件
 * 用于在收藏时选择目标文件夹
 */

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Folder, FolderOpen, X } from "lucide-react";
import {
  getFolders,
  flattenFolders,
  type FolderTreeNode,
  type FlatFolderItem,
} from "../../../lib/folders";

interface FolderSelectorProps {
  value: number | null;
  onChange: (folderId: number | null) => void;
  disabled?: boolean;
}

export function FolderSelector({
  value,
  onChange,
  disabled = false,
}: FolderSelectorProps) {
  const [_folders, setFolders] = useState<FolderTreeNode[]>([]);
  const [flatList, setFlatList] = useState<FlatFolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载文件夹列表
  useEffect(() => {
    loadFolders();
  }, []);

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadFolders() {
    setLoading(true);
    setError(null);
    try {
      const data = await getFolders();
      setFolders(data);
      setFlatList(flattenFolders(data));
    } catch (err) {
      setError("加载文件夹失败");
      console.error("[FolderSelector] Failed to load folders:", err);
    } finally {
      setLoading(false);
    }
  }

  // 获取选中文件夹的显示名称
  const selectedFolder = flatList.find((f) => f.id === value);
  const displayText = loading
    ? "加载中..."
    : error
      ? "加载失败"
      : selectedFolder?.fullPath || "选择文件夹（可选）";

  // 处理选择
  function handleSelect(folderId: number | null) {
    onChange(folderId);
    setOpen(false);
  }

  // 清除选择
  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => !disabled && !loading && setOpen(!open)}
        disabled={disabled || loading}
        className={`
          w-full px-3 py-2 text-left text-sm
          border rounded-lg
          flex items-center justify-between gap-2
          transition-colors
          ${disabled || loading ? "bg-gray-100 cursor-not-allowed" : "bg-white hover:bg-gray-50 cursor-pointer"}
          ${open ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200"}
          ${error ? "border-red-300" : ""}
        `}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedFolder ? (
            <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <span className={selectedFolder ? "text-gray-900" : "text-gray-500"}>
            {displayText}
          </span>
        </span>

        <span className="flex items-center gap-1 flex-shrink-0">
          {value !== null && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {/* 下拉列表 */}
      {open && !loading && !error && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {/* 不选择选项 */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`
              w-full px-3 py-2 text-left text-sm
              hover:bg-gray-100
              flex items-center gap-2
              ${value === null ? "bg-blue-50 text-blue-600" : "text-gray-600"}
            `}
          >
            <Folder className="w-4 h-4 text-gray-400" />
            不选择文件夹
          </button>

          {/* 分隔线 */}
          {flatList.length > 0 && <div className="border-t border-gray-100" />}

          {/* 文件夹列表 */}
          {flatList.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              暂无文件夹
            </div>
          ) : (
            flatList.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => handleSelect(folder.id)}
                className={`
                  w-full px-3 py-2 text-left text-sm
                  hover:bg-gray-100
                  flex items-center gap-2
                  ${value === folder.id ? "bg-blue-50 text-blue-600" : "text-gray-900"}
                `}
                style={{ paddingLeft: `${12 + folder.depth * 16}px` }}
              >
                {folder.depth > 0 && (
                  <span className="text-gray-300 mr-1">└</span>
                )}
                <FolderOpen
                  className={`w-4 h-4 flex-shrink-0 ${value === folder.id ? "text-blue-500" : "text-amber-500"}`}
                />
                <span className="truncate">{folder.name}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <button
          type="button"
          onClick={loadFolders}
          className="mt-1 text-xs text-red-500 hover:text-red-600"
        >
          {error}，点击重试
        </button>
      )}
    </div>
  );
}

export default FolderSelector;
