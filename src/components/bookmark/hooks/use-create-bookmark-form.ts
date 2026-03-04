"use client";

import { useState, useCallback } from "react";
import type { CustomUsageTag } from "@/types/supabase";

export function useCreateBookmarkForm() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [sourceName, setSourceName] = useState<string>("");
  const [author, setAuthor] = useState<string>("");
  const [publishTime, setPublishTime] = useState<string>("");
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [imageCount, setImageCount] = useState<number | null>(null);
  const [userAddedTags, setUserAddedTags] = useState<string[]>([]);
  const [selectedUsageTags, setSelectedUsageTags] = useState<string[]>([]);
  const [customUsageTags, setCustomUsageTags] = useState<CustomUsageTag[]>([]);
  const [enableVisionAnalysis, setEnableVisionAnalysis] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setUrl("");
    setTitle("");
    setDescription("");
    setFolderId("");
    setTags("");
    setNotes("");
    setCoverUrl("");
    setSourceName("");
    setAuthor("");
    setPublishTime("");
    setWordCount(null);
    setImageCount(null);
    setErrors({});
    setUserAddedTags([]);
    setSelectedUsageTags([]);
    setEnableVisionAnalysis(false);
  }, []);

  const addUserTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (trimmed) {
      setUserAddedTags((prev) =>
        prev.includes(trimmed) ? prev : [...prev, trimmed],
      );
    }
  }, []);

  const removeUserTag = useCallback((tag: string) => {
    setUserAddedTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  return {
    url,
    setUrl,
    title,
    setTitle,
    description,
    setDescription,
    folderId,
    setFolderId,
    tags,
    setTags,
    notes,
    setNotes,
    coverUrl,
    setCoverUrl,
    sourceName,
    setSourceName,
    author,
    setAuthor,
    publishTime,
    setPublishTime,
    wordCount,
    setWordCount,
    imageCount,
    setImageCount,
    userAddedTags,
    setUserAddedTags,
    selectedUsageTags,
    setSelectedUsageTags,
    customUsageTags,
    setCustomUsageTags,
    enableVisionAnalysis,
    setEnableVisionAnalysis,
    errors,
    setErrors,
    resetForm,
    addUserTag,
    removeUserTag,
  };
}

export type UseCreateBookmarkFormReturn = ReturnType<
  typeof useCreateBookmarkForm
>;
