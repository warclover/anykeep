/**
 * MD 阅读图片灯箱组件
 * Spec: md-reader-upgrade / REQ-7
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ImageLightboxProps, ImageInfo } from "../../types/reader";

// 动态导入 Lightbox 组件避免 SSR 问题
const Lightbox = dynamic(
  () => import("yet-another-react-lightbox").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => null,
  },
);

// 导入 Lightbox 样式
import "yet-another-react-lightbox/styles.css";

/**
 * 图片灯箱组件
 *
 * 使用 yet-another-react-lightbox 实现图片放大查看功能：
 * - 支持键盘导航（← → 切换，Esc 关闭）
 * - 支持触摸手势（移动端滑动）
 * - 优雅的加载和错误处理
 *
 * @example
 * ```tsx
 * function ImageGallery() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const [index, setIndex] = useState(0);
 *
 *   const images = [
 *     { src: "/image1.jpg", alt: "Image 1" },
 *     { src: "/image2.jpg", alt: "Image 2" },
 *   ];
 *
 *   return (
 *     <>
 *       {images.map((img, i) => (
 *         <img
 *           key={i}
 *           src={img.src}
 *           alt={img.alt}
 *           onClick={() => {
 *             setIndex(i);
 *             setIsOpen(true);
 *           }}
 *         />
 *       ))}
 *       <ImageLightbox
 *         images={images}
 *         initialIndex={index}
 *         isOpen={isOpen}
 *         onClose={() => setIsOpen(false)}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function ImageLightbox({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  // 当 initialIndex 变化时更新当前索引
  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  // 转换图片格式为 Lightbox 需要的格式
  const slides = images.map((img) => ({
    src: img.src,
    alt: img.alt || "",
  }));

  // 如果没有图片或未打开，不渲染
  if (!isOpen || images.length === 0) {
    return null;
  }

  return (
    <Lightbox
      open={isOpen}
      close={onClose}
      index={index}
      slides={slides}
      on={{
        view: ({ index: newIndex }) => setIndex(newIndex),
      }}
      carousel={{
        finite: images.length <= 1,
      }}
      controller={{
        closeOnBackdropClick: true,
        closeOnPullDown: true,
        closeOnPullUp: true,
      }}
      styles={{
        container: {
          backgroundColor: "rgba(0, 0, 0, 0.9)",
        },
      }}
      animation={{
        fade: 300,
        swipe: 300,
      }}
      render={{
        buttonPrev: images.length <= 1 ? () => null : undefined,
        buttonNext: images.length <= 1 ? () => null : undefined,
      }}
    />
  );
}

// ============================================
// Hook: useImageLightbox
// ============================================

export interface UseImageLightboxResult {
  /** 当前图片列表 */
  images: ImageInfo[];
  /** 是否打开 */
  isOpen: boolean;
  /** 当前索引 */
  currentIndex: number;
  /** 打开灯箱 */
  openLightbox: (index: number) => void;
  /** 关闭灯箱 */
  closeLightbox: () => void;
  /** 添加图片 */
  addImage: (image: ImageInfo) => void;
  /** 设置图片列表 */
  setImages: (images: ImageInfo[]) => void;
  /** 清空图片列表 */
  clearImages: () => void;
}

/**
 * useImageLightbox Hook
 *
 * 管理图片灯箱状态，方便与 MdRenderer 集成。
 *
 * @example
 * ```tsx
 * function Reader({ content }) {
 *   const lightbox = useImageLightbox();
 *
 *   const handleImageClick = (src: string, alt: string, index: number) => {
 *     lightbox.openLightbox(index);
 *   };
 *
 *   return (
 *     <>
 *       <MdRenderer
 *         content={content}
 *         onImageClick={handleImageClick}
 *         onImagesCollected={lightbox.setImages}
 *       />
 *       <ImageLightbox
 *         images={lightbox.images}
 *         initialIndex={lightbox.currentIndex}
 *         isOpen={lightbox.isOpen}
 *         onClose={lightbox.closeLightbox}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useImageLightbox(): UseImageLightboxResult {
  const [images, setImagesState] = useState<ImageInfo[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openLightbox = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
  }, []);

  const addImage = useCallback((image: ImageInfo) => {
    setImagesState((prev) => {
      // 避免重复添加相同 src 的图片
      if (prev.some((img) => img.src === image.src)) {
        return prev;
      }
      return [...prev, image];
    });
  }, []);

  const setImages = useCallback((newImages: ImageInfo[]) => {
    setImagesState(newImages);
  }, []);

  const clearImages = useCallback(() => {
    setImagesState([]);
  }, []);

  return {
    images,
    isOpen,
    currentIndex,
    openLightbox,
    closeLightbox,
    addImage,
    setImages,
    clearImages,
  };
}

export default ImageLightbox;
