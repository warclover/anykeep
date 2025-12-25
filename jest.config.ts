import type { Config } from "jest";
import nextJest from "next/jest";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Mock lucide-react to avoid ESM issues
    // Match both the barrel export and individual icon imports (from modularizeImports)
    "^lucide-react$": "<rootDir>/__mocks__/lucide-react.js",
    "^lucide-react/dist/esm/icons/(.*)$": "<rootDir>/__mocks__/lucide-react.js",
    "^lucide-react/dist/cjs/icons/(.*)$": "<rootDir>/__mocks__/lucide-react.js",
    "^lucide-react/dist/(.*)$": "<rootDir>/__mocks__/lucide-react.js",
  },
  // Transform ESM modules that Jest can't handle natively
  // Note: lucide-react is handled by moduleNameMapper, so not included here
  transformIgnorePatterns: [
    "/node_modules/(?!(react-virtuoso|sonner|@radix-ui)/)",
  ],
  testMatch: [
    "**/__tests__/**/*.(test|spec).[jt]s?(x)",
    "**/?(*.)+(test|spec).[jt]s?(x)",
  ],
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/types/**",
    "!src/app/**", // 排除 App Router 页面（SSR 相关）
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "/coverage/",
    "/figma1121/",
    "/browser-extension/",
    "/.backups/",
    "/e2e/", // 排除 Playwright E2E 测试
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
