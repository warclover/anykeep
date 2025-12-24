/**
 * API 文档页面
 *
 * @description 使用 Swagger UI 展示 OpenAPI 文档
 * @since 2025-12-24 (Phase 3.2)
 */

import type { Metadata } from "next";
import ApiDocsClient from "./api-docs-client";

export const metadata: Metadata = {
  title: "API 文档 - AnyKeep",
  description: "AnyKeep API 接口文档",
};

export default function ApiDocsPage() {
  return <ApiDocsClient />;
}
