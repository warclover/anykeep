/**
 * @deprecated Use /api/classification/folders/profiles?id=X instead
 *
 * This route now redirects to the consolidated folders/profiles endpoint.
 * Keeping for backward compatibility.
 */

import { type NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET - Redirect to consolidated endpoint
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return NextResponse.redirect(
    new URL(
      `/api/classification/folders/profiles?id=${id}`,
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    ),
    { status: 308 }, // Permanent redirect
  );
}
