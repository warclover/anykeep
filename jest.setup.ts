// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import { randomUUID } from "crypto";
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
