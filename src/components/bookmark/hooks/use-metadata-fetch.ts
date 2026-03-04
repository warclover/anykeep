"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface WebMetadata {
  title: string;
  description: string;
  coverUrl: string;
  sourceName: string;
  author: string;
  publishTime: string;
  platform: string;
  siteName: string;
  wordCount: number;
  imageCount: number;
}

export type FetchStatus = "idle" | "loading" | "success" | "error";

export function isValidUrl(urlString: string): boolean {
  try {
    const urlObj = new URL(urlString);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}

interface UseMetadataFetchParams {
  url: string;
  setTitle: (v: string) => void;
  setDescription: (v: string) => void;
  setCoverUrl: (v: string) => void;
  setSourceName: (v: string) => void;
  setAuthor: (v: string) => void;
  setPublishTime: (v: string) => void;
  setWordCount: (v: number | null) => void;
  setImageCount: (v: number | null) => void;
  debouncedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  abortAll: () => void;
}

export function useMetadataFetch(params: UseMetadataFetchParams) {
  const {
    url,
    setTitle,
    setDescription,
    setCoverUrl,
    setSourceName,
    setAuthor,
    setPublishTime,
    setWordCount,
    setImageCount,
    debouncedFetch,
    abortAll,
  } = params;

  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchError, setFetchError] = useState("");
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(
    new Set(),
  );
  const userModifiedFieldsRef = useRef<Set<string>>(new Set());

  const fetchMetadata = useCallback(
    async (urlToFetch: string) => {
      if (!isValidUrl(urlToFetch)) return;

      setFetchStatus("loading");
      setFetchError("");

      try {
        const response = await debouncedFetch(
          `/api/bookmarks/metadata?url=${encodeURIComponent(urlToFetch)}`,
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || "获取网页信息失败");
        }

        const data = await response.json();
        const metadata: WebMetadata = data.data;
        const newAutoFilled = new Set<string>();

        if (metadata.title && !userModifiedFieldsRef.current.has("title")) {
          setTitle(metadata.title);
          newAutoFilled.add("title");
        }
        if (
          metadata.description &&
          !userModifiedFieldsRef.current.has("description")
        ) {
          setDescription(metadata.description);
          newAutoFilled.add("description");
        }
        if (
          metadata.coverUrl &&
          !userModifiedFieldsRef.current.has("coverUrl")
        ) {
          setCoverUrl(metadata.coverUrl);
          newAutoFilled.add("coverUrl");
        }
        if (metadata.sourceName) setSourceName(metadata.sourceName);
        if (metadata.author) setAuthor(metadata.author);
        if (metadata.publishTime) setPublishTime(metadata.publishTime);
        if (metadata.wordCount) setWordCount(metadata.wordCount);
        if (metadata.imageCount) setImageCount(metadata.imageCount);

        setAutoFilledFields(newAutoFilled);
        setFetchStatus("success");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setFetchStatus("error");
        setFetchError(
          error instanceof Error ? error.message : "获取网页信息失败",
        );
      }
    },
    [
      debouncedFetch,
      setTitle,
      setDescription,
      setCoverUrl,
      setSourceName,
      setAuthor,
      setPublishTime,
      setWordCount,
      setImageCount,
    ],
  );

  useEffect(() => {
    if (url && isValidUrl(url)) {
      fetchMetadata(url);
    } else {
      setFetchStatus("idle");
      setFetchError("");
    }
    return () => {
      abortAll();
    };
  }, [url, fetchMetadata, abortAll]);

  const markFieldAsModified = useCallback((field: string) => {
    userModifiedFieldsRef.current.add(field);
    setAutoFilledFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }, []);

  const handleRefetch = useCallback(() => {
    if (url && isValidUrl(url)) {
      userModifiedFieldsRef.current.clear();
      fetchMetadata(url);
    }
  }, [url, fetchMetadata]);

  const resetFetchState = useCallback(() => {
    setFetchStatus("idle");
    setFetchError("");
    setAutoFilledFields(new Set());
    userModifiedFieldsRef.current = new Set();
  }, []);

  return {
    fetchStatus,
    fetchError,
    autoFilledFields,
    markFieldAsModified,
    handleRefetch,
    resetFetchState,
  };
}

export type UseMetadataFetchReturn = ReturnType<typeof useMetadataFetch>;
