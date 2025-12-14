/**
 * Sentry Edge Configuration
 *
 * This file configures the initialization of Sentry for edge features (Middleware, Edge Routers).
 * The config you add here will be used whenever one of the edge features is loaded.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 *
 * @version 1.0.0
 * @since 2025-12-14
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Environment tag
  environment: process.env.NODE_ENV,

  // Release version
  release: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",

  // Don't send events in development unless explicitly enabled
  enabled:
    process.env.NODE_ENV === "production" ||
    process.env.SENTRY_DEBUG === "true",
});
