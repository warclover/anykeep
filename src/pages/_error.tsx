/**
 * Pages Router 错误页面回退
 * 这是一个独立的错误页面，不依赖于任何 Context Provider
 * 用于处理 Next.js 内部生成的 404/500 错误页面
 */

import type { NextPageContext } from "next";

interface ErrorPageProps {
  statusCode: number;
}

function ErrorPage({ statusCode }: ErrorPageProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "#f9fafb",
      }}
    >
      <h1
        style={{
          fontSize: "4rem",
          fontWeight: "bold",
          color: "#111827",
          marginBottom: "1rem",
        }}
      >
        {statusCode}
      </h1>
      <p
        style={{
          fontSize: "1.25rem",
          color: "#6b7280",
          marginBottom: "2rem",
        }}
      >
        {statusCode === 404
          ? "页面未找到"
          : statusCode === 500
            ? "服务器错误"
            : "发生了错误"}
      </p>
      <a
        href="/home"
        style={{
          padding: "0.75rem 1.5rem",
          backgroundColor: "#2563eb",
          color: "white",
          borderRadius: "0.5rem",
          textDecoration: "none",
          fontSize: "0.875rem",
          fontWeight: "500",
        }}
      >
        返回首页
      </a>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode: statusCode || 500 };
};

export default ErrorPage;
