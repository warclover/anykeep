/// <reference types="vite/client" />

declare const __BROWSER__: "chrome" | "firefox";
declare const __DEV__: boolean;

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
