"use client";

/**
 * 自定义兴趣添加弹窗
 * 用于添加用户自定义的兴趣领域
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { CUSTOM_INTEREST_LIMITS } from "@/lib/interests";
import type { CustomInterestInput } from "@/lib/interest-profile/types";
import { clientLogger } from "@/lib/client-logger";

// 可选的 emoji 图标
const EMOJI_OPTIONS = [
  "🎯",
  "🔮",
  "💡",
  "🚀",
  "⭐",
  "🎨",
  "📱",
  "💻",
  "🎮",
  "🎵",
  "📸",
  "✈️",
  "🏠",
  "🎓",
  "💰",
  "🔬",
];

interface CustomInterestDialogProps {
  /** 触发按钮内容 */
  trigger?: React.ReactNode;
  /** 提交回调 */
  onSubmit: (interest: CustomInterestInput) => Promise<void>;
  /** 是否打开 */
  open?: boolean;
  /** 打开状态变更回调 */
  onOpenChange?: (open: boolean) => void;
}

export function CustomInterestDialog({
  trigger,
  onSubmit,
  open: controlledOpen,
  onOpenChange,
}: CustomInterestDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 表单状态
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [suggestedFolders, setSuggestedFolders] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [folderInput, setFolderInput] = useState("");

  // 控制打开状态
  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  // 重置表单
  const resetForm = () => {
    setName("");
    setIcon("🎯");
    setKeywords([]);
    setSuggestedFolders([]);
    setKeywordInput("");
    setFolderInput("");
  };

  // 添加关键词
  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (
      trimmed &&
      !keywords.includes(trimmed) &&
      keywords.length < CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS
    ) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput("");
    }
  };

  // 删除关键词
  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  // 添加建议文件夹
  const addFolder = () => {
    const trimmed = folderInput.trim();
    if (
      trimmed &&
      !suggestedFolders.includes(trimmed) &&
      suggestedFolders.length < CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS
    ) {
      setSuggestedFolders([...suggestedFolders, trimmed]);
      setFolderInput("");
    }
  };

  // 删除建议文件夹
  const removeFolder = (folder: string) => {
    setSuggestedFolders(suggestedFolders.filter((f) => f !== folder));
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        icon,
        keywords,
        suggestedFolders,
      });
      resetForm();
      setIsOpen(false);
    } catch (error) {
      clientLogger.error(
        { error },
        "[CustomInterestDialog] Failed to create custom interest",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理键盘事件
  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  const handleFolderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addFolder();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>添加自定义兴趣领域</DialogTitle>
          <DialogDescription>
            创建一个新的兴趣领域，帮助 AI 更好地理解你的收藏偏好。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 图标选择 */}
          <div className="space-y-2">
            <Label>图标</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                    icon === emoji
                      ? "bg-primary text-primary-foreground ring-2 ring-primary"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* 名称输入 */}
          <div className="space-y-2">
            <Label htmlFor="name">
              名称{" "}
              <span className="text-muted-foreground text-xs">
                (最多 {CUSTOM_INTEREST_LIMITS.MAX_NAME_LENGTH} 字符)
              </span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value.slice(
                    0,
                    CUSTOM_INTEREST_LIMITS.MAX_NAME_LENGTH,
                  ),
                )
              }
              placeholder="例如：区块链技术"
            />
          </div>

          {/* 关键词输入 */}
          <div className="space-y-2">
            <Label>
              关键词{" "}
              <span className="text-muted-foreground text-xs">
                (帮助 AI 识别相关内容，最多{" "}
                {CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS} 个)
              </span>
            </Label>
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                placeholder="输入关键词后按回车"
                disabled={
                  keywords.length >= CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS
                }
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={addKeyword}
                disabled={
                  !keywordInput.trim() ||
                  keywords.length >= CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 建议文件夹输入 */}
          <div className="space-y-2">
            <Label>
              建议创建的文件夹{" "}
              <span className="text-muted-foreground text-xs">
                (可选，最多 {CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS} 个)
              </span>
            </Label>
            <div className="flex gap-2">
              <Input
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                onKeyDown={handleFolderKeyDown}
                placeholder="例如：区块链学习"
                disabled={
                  suggestedFolders.length >=
                  CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS
                }
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={addFolder}
                disabled={
                  !folderInput.trim() ||
                  suggestedFolders.length >=
                    CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {suggestedFolders.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {suggestedFolders.map((folder) => (
                  <Badge key={folder} variant="outline" className="gap-1">
                    {folder}
                    <button
                      type="button"
                      onClick={() => removeFolder(folder)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CustomInterestDialog;
