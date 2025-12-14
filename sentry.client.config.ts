/**
 * Sentry Client Configuration
 *
 * This file configures the initialization of Sentry on the client.
 * The config you add here will be used whenever a users loads a page in their browser.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 *
 * @version 1.0.0
 * @since 2025-12-14
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Enable replay in production with reduced sampling
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Environment tag
  environment: process.env.NODE_ENV,

  // Release version (can be set via CI/CD)
  release: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",

  // Filter out common noise
  ignoreErrors: [
    // Random plugins/extensions
    "top.GLOBALS",
    // See: http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
    "originalCreateNotification",
    "canvas.contentDocument",
    "MyApp_RemoveAllHighlights",
    "http://tt.teletrax.tv",
    "fb_xd_fragment",
    // Safari extension errors
    /.*@webkit-masked-url.*/,
    // Network errors
    "Network request failed",
    "Failed to fetch",
    "NetworkError",
    // Chrome extensions
    /chrome-extension/,
    /moz-extension/,
    // Common browser errors
    "ResizeObserver loop",
    "Non-Error promise rejection",
  ],

  // Don't send events in development unless explicitly enabled
  enabled:
    process.env.NODE_ENV === "production" ||
    process.env.SENTRY_DEBUG === "true",
});
