/**
 * @deprecated Use /api/classification/folder-health?type=summary instead
 *
 * This route now redirects to the consolidated folder-health endpoint.
 * Keeping for backward compatibility.
 */

import { NextResponse } from "next/server";

/**
 * GET - Redirect to consolidated endpoint
 */
export async function GET() {
  return NextResponse.redirect(
    new URL(
      "/api/classification/folder-health?type=summary",
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    ),
    { status: 308 }, // Permanent redirect
  );
}
