"use client";

/**
 * API 文档客户端组件
 *
 * @description 加载 Swagger UI 展示 OpenAPI 规范
 * 使用本地静态资源，避免 unpkg.com CDN 在国内不稳定
 */

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientLogger } from "@/lib/client-logger";

// Swagger UI 本地资源路径（从 public/vendor/swagger-ui/ 加载）
const SWAGGER_UI_CSS = "/vendor/swagger-ui/swagger-ui.css";
const SWAGGER_UI_BUNDLE = "/vendor/swagger-ui/swagger-ui-bundle.js";
const SWAGGER_UI_STANDALONE =
  "/vendor/swagger-ui/swagger-ui-standalone-preset.js";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SwaggerUIBundle: any;
    SwaggerUIStandalonePreset: unknown;
  }
}

export default function ApiDocsClient() {
  const [isLoading, setIsLoading] = useState(true);
  const [scriptsLoaded, setScriptsLoaded] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 初始化 Swagger UI
  useEffect(() => {
    if (scriptsLoaded < 2) return;

    const initSwagger = () => {
      if (typeof window.SwaggerUIBundle === "undefined") {
        clientLogger.error("SwaggerUIBundle not loaded");
        return;
      }

      window.SwaggerUIBundle({
        url: "/openapi.yaml",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          window.SwaggerUIBundle.presets.apis,
          window.SwaggerUIStandalonePreset,
        ],
        plugins: [window.SwaggerUIBundle.plugins.DownloadUrl],
        layout: "StandaloneLayout",
        // 自定义配置
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: "list",
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: false, // 禁用 Try it out（需要认证）
      });

      setIsLoading(false);
    };

    // 延迟初始化确保 DOM 准备就绪
    const timer = setTimeout(initSwagger, 100);
    return () => clearTimeout(timer);
  }, [scriptsLoaded]);

  const handleScriptLoad = () => {
    setScriptsLoaded((prev) => prev + 1);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回设置
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">API 文档</h1>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                v2.4.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/openapi.yaml" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                OpenAPI 规范
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* CSS */}
      <link rel="stylesheet" href={SWAGGER_UI_CSS} />

      {/* Scripts */}
      <Script src={SWAGGER_UI_BUNDLE} onLoad={handleScriptLoad} />
      <Script src={SWAGGER_UI_STANDALONE} onLoad={handleScriptLoad} />

      {/* Loading State */}
      {isLoading && (
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
            <p className="text-muted-foreground">加载 API 文档...</p>
          </div>
        </div>
      )}

      {/* Swagger UI Container */}
      <div
        id="swagger-ui"
        ref={containerRef}
        className={isLoading ? "hidden" : ""}
      />

      {/* Custom Styles */}
      <style jsx global>{`
        /* 自定义 Swagger UI 样式以适配暗色主题 */
        .swagger-ui {
          font-family: inherit;
        }

        .swagger-ui .topbar {
          display: none;
        }

        .swagger-ui .info {
          margin: 20px 0;
        }

        .swagger-ui .info .title {
          font-size: 2rem;
          font-weight: 600;
        }

        .swagger-ui .scheme-container {
          padding: 20px;
          background: var(--background);
        }

        .swagger-ui .opblock-tag {
          border-bottom: 1px solid var(--border);
        }

        .swagger-ui .opblock {
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .swagger-ui .opblock .opblock-summary-method {
          border-radius: 4px;
        }

        .swagger-ui .btn {
          border-radius: 6px;
        }

        /* 暗色模式适配 */
        @media (prefers-color-scheme: dark) {
          .swagger-ui,
          .swagger-ui .info .title,
          .swagger-ui .info .base-url,
          .swagger-ui .scheme-container {
            color: #e5e7eb;
          }

          .swagger-ui .opblock-tag {
            color: #e5e7eb;
            border-color: #374151;
          }

          .swagger-ui .opblock-description-wrapper p,
          .swagger-ui .opblock-external-docs-wrapper p,
          .swagger-ui .opblock-title_normal p,
          .swagger-ui table thead tr th,
          .swagger-ui table thead tr td,
          .swagger-ui .parameter__name,
          .swagger-ui .parameter__type,
          .swagger-ui .response-col_status,
          .swagger-ui .response-col_description {
            color: #e5e7eb;
          }

          .swagger-ui .opblock .opblock-section-header {
            background: #1f2937;
          }

          .swagger-ui section.models {
            border-color: #374151;
          }

          .swagger-ui section.models .model-container {
            background: #1f2937;
          }
        }
      `}</style>
    </div>
  );
}
