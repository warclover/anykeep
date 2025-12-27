import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import { resolve } from "path";

// Manifest 配置
import manifestChrome from "./src/manifests/manifest.chrome";
import manifestFirefox from "./src/manifests/manifest.firefox";

// 获取构建模式
const getManifest = (mode: string) => {
  switch (mode) {
    case "firefox":
      return manifestFirefox;
    case "chrome":
    default:
      return manifestChrome;
  }
};

export default defineConfig(({ mode }) => {
  const manifest = getManifest(mode);
  const browser = mode === "firefox" ? "firefox" : "chrome";

  return {
    plugins: [react(), crx({ manifest })],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        "@shared": resolve(__dirname, "../src/lib"),
      },
    },
    build: {
      outDir: `dist/${browser}`,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "src/popup/index.html"),
        },
      },
    },
    define: {
      __BROWSER__: JSON.stringify(browser),
      __DEV__: JSON.stringify(mode === "development"),
    },
    server: {
      port: 5174,
      strictPort: true,
      hmr: {
        port: 5174,
      },
    },
  };
});
