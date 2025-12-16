/**
 * 标签选择器组件
 * 支持预设标签和自定义标签
 */

import { useState, useRef, useEffect, memo } from "react";
import { Tag, Plus, X } from "lucide-react";

/** 预设标签 */
const PRESET_TAGS = [
  { id: "share", label: "下次分享用", color: "#3B82F6" }, // blue
  { id: "reread", label: "值得复读", color: "#8B5CF6" }, // purple
  { id: "quality", label: "优质经验", color: "#22C55E" }, // green
  { id: "follow", label: "值得关注", color: "#F97316" }, // orange
] as const;

/** 最大标签数量 */
const MAX_TAGS = 10;

/** 最大标签长度 */
const MAX_TAG_LENGTH = 20;

interface TagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

/** 预设标签按钮 */
const PresetTagButton = memo(function PresetTagButton({
  tag,
  selected,
  onClick,
  disabled,
}: {
  tag: (typeof PRESET_TAGS)[number];
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        px-2.5 py-1 text-xs rounded-full
        border transition-all duration-150
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${
          selected
            ? "text-white border-transparent shadow-sm"
            : "bg-white hover:bg-gray-50 border-gray-200"
        }
      `}
      style={{
        backgroundColor: selected ? tag.color : undefined,
        borderColor: selected ? tag.color : undefined,
      }}
    >
      {tag.label}
    </button>
  );
});

/** 已选标签 */
const SelectedTag = memo(function SelectedTag({
  tag,
  onRemove,
  disabled,
}: {
  tag: string;
  onRemove: () => void;
  disabled: boolean;
}) {
  // 检查是否是预设标签
  const preset = PRESET_TAGS.find((p) => p.label === tag);

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5
        text-xs rounded-md
        ${preset ? "text-white" : "bg-gray-100 text-gray-700"}
      `}
      style={{ backgroundColor: preset?.color }}
    >
      {tag}
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className={`
            p-0.5 rounded hover:bg-black/10
            ${preset ? "text-white/80 hover:text-white" : "text-gray-400 hover:text-gray-600"}
          `}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
});

export function TagSelector({
  value,
  onChange,
  disabled = false,
}: TagSelectorProps) {
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 显示输入框时自动聚焦
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  // 切换预设标签
  function toggleTag(tagLabel: string) {
    if (disabled) return;

    if (value.includes(tagLabel)) {
      // 移除标签
      onChange(value.filter((t) => t !== tagLabel));
    } else {
      // 添加标签（检查数量限制）
      if (value.length < MAX_TAGS) {
        onChange([...value, tagLabel]);
      }
    }
  }

  // 添加自定义标签
  function addCustomTag() {
    const trimmed = inputValue.trim();

    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setInputValue("");
      return;
    }
    if (value.length >= MAX_TAGS) return;
    if (trimmed.length > MAX_TAG_LENGTH) return;

    onChange([...value, trimmed]);
    setInputValue("");
    setShowInput(false);
  }

  // 处理输入框按键
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomTag();
    } else if (e.key === "Escape") {
      setInputValue("");
      setShowInput(false);
    }
  }

  // 移除标签
  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  const canAddMore = value.length < MAX_TAGS;

  return (
    <div className="space-y-2">
      {/* 标题 */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Tag className="w-4 h-4" />
        <span>添加标签（可选）</span>
        {value.length > 0 && (
          <span className="text-xs text-gray-400">
            {value.length}/{MAX_TAGS}
          </span>
        )}
      </div>

      {/* 预设标签 */}
      <div className="flex flex-wrap gap-2">
        {PRESET_TAGS.map((tag) => (
          <PresetTagButton
            key={tag.id}
            tag={tag}
            selected={value.includes(tag.label)}
            onClick={() => toggleTag(tag.label)}
            disabled={disabled || (!value.includes(tag.label) && !canAddMore)}
          />
        ))}

        {/* 添加自定义标签按钮 */}
        {canAddMore && !showInput && (
          <button
            type="button"
            onClick={() => setShowInput(true)}
            disabled={disabled}
            className={`
              px-2.5 py-1 text-xs rounded-full
              border border-dashed border-gray-300
              text-gray-500 hover:text-gray-700 hover:border-gray-400
              flex items-center gap-1
              transition-colors
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            <Plus className="w-3 h-3" />
            自定义
          </button>
        )}
      </div>

      {/* 自定义标签输入 */}
      {showInput && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!inputValue.trim()) {
                setShowInput(false);
              }
            }}
            placeholder="输入自定义标签"
            maxLength={MAX_TAG_LENGTH}
            className="
              flex-1 px-3 py-1.5 text-sm
              border border-gray-200 rounded-lg
              focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
            "
          />
          <button
            type="button"
            onClick={addCustomTag}
            disabled={!inputValue.trim()}
            className="
              px-3 py-1.5 text-sm
              bg-blue-500 text-white rounded-lg
              hover:bg-blue-600
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
          >
            添加
          </button>
          <button
            type="button"
            onClick={() => {
              setInputValue("");
              setShowInput(false);
            }}
            className="
              px-2 py-1.5 text-sm
              text-gray-500 hover:text-gray-700
              transition-colors
            "
          >
            取消
          </button>
        </div>
      )}

      {/* 已选标签展示（不包括预设标签，预设标签在上方显示选中状态） */}
      {value.filter((t) => !PRESET_TAGS.some((p) => p.label === t)).length >
        0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {value
            .filter((t) => !PRESET_TAGS.some((p) => p.label === t))
            .map((tag) => (
              <SelectedTag
                key={tag}
                tag={tag}
                onRemove={() => removeTag(tag)}
                disabled={disabled}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default TagSelector;
