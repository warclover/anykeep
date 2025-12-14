/**
 * Next.js Instrumentation
 *
 * This file is used to initialize Sentry on the server.
 * It's automatically loaded by Next.js when instrumentation is enabled.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * @version 1.0.0
 * @since 2025-12-14
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Import server config for Node.js runtime
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Import edge config for Edge runtime
    await import("./sentry.edge.config");
  }
}
