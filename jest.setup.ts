// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import { randomUUID } from "crypto";
import { TextEncoder, TextDecoder } from "util";

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
