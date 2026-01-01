// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import { randomUUID } from "crypto";

// Configure React act() environment for React 18
// This is required for async state updates in hook tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import { TextEncoder, TextDecoder } from "util";
import { TransformStream, ReadableStream, WritableStream } from "stream/web";

// Polyfill crypto.randomUUID for Jest environment
if (typeof globalThis.crypto === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = {
    randomUUID,
  };
} else if (typeof globalThis.crypto.randomUUID === "undefined") {
  globalThis.crypto.randomUUID = randomUUID;
}

// Polyfill TextEncoder/TextDecoder for Jest environment
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.TextDecoder = TextDecoder as any;
}

// Polyfill Web Streams API for Jest environment (required by AI SDK)
if (typeof globalThis.TransformStream === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.TransformStream = TransformStream as any;
}
if (typeof globalThis.ReadableStream === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.ReadableStream = ReadableStream as any;
}
if (typeof globalThis.WritableStream === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.WritableStream = WritableStream as any;
}

// Set test environment variables
// These are required by env.ts but don't need real values in tests
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}
if (!process.env.NODE_ENV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.env as any).NODE_ENV = "test";
}
