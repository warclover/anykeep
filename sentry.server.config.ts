/**
 * Sentry Server Configuration
 *
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
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

  // Release version (can be set via CI/CD)
  release: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",

  // Don't send events in development unless explicitly enabled
  enabled:
    process.env.NODE_ENV === "production" ||
    process.env.SENTRY_DEBUG === "true",

  // Performance monitoring
  integrations: [
    // Automatically instrument Node.js libraries and frameworks
    ...Sentry.getAutoPerformanceIntegrations(),
  ],

  // Filter out common noise
  ignoreErrors: [
    // Network errors that are expected
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    // Common Next.js errors that aren't actionable
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],

  // Capture unhandled promise rejections
  beforeSend(event, _hint) {
    // Skip certain errors in development
    if (process.env.NODE_ENV !== "production") {
      // Still log to console in development
      console.error("[Sentry] Would send event:", event.message);
      return null;
    }

    // Add additional context
    if (event.extra) {
      event.extra.nodeVersion = process.version;
    }

    return event;
  },
});
