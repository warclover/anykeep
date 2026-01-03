/**
 * Cron Job: Process System Jobs
 * Schedule: Every 5 minutes (cron: * /5 * * * *)
 *
 * Processes pending jobs from system_jobs table using consumer architecture
 *
 * @module api/internal/cron/process-jobs
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/supabase";
import { MetadataConsumer } from "@/jobs/consumers/metadata-consumer";
import { EmbeddingConsumer } from "@/jobs/consumers/embedding-consumer";
import { ClassificationConsumer } from "@/jobs/consumers/classification-consumer";

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Use Service Role Key to bypass RLS
let supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

const initSupabaseAdmin = (): ReturnType<typeof createClient<Database>> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase credentials");
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient<Database>(url, serviceKey);
  }
  return supabaseAdmin;
};

// Max jobs per consumer per run
const MAX_JOBS_PER_CONSUMER = 10;

/**
 * GET /api/internal/cron/process-jobs
 * Process pending jobs from system_jobs table
 */
export async function GET(request: Request) {
  try {
    // Verify environment variables
    if (!CRON_SECRET) {
      logger.error("CRON_SECRET environment variable is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    // Verify Cron request
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Initialize Supabase admin
    let supabase: ReturnType<typeof createClient<Database>>;
    try {
      supabase = initSupabaseAdmin();
    } catch (error) {
      logger.error({ error }, "Failed to initialize Supabase admin");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    logger.info(
      { action: "system_jobs_cron_start" },
      "System jobs processor started",
    );

    const startTime = Date.now();
    const stats = {
      metadata: 0,
      embedding: 0,
      classification: 0,
      total: 0,
    };

    // Initialize consumers
    const metadataConsumer = new MetadataConsumer(supabase);
    const embeddingConsumer = new EmbeddingConsumer(supabase);
    const classificationConsumer = new ClassificationConsumer(supabase);

    // Process jobs in parallel for each consumer
    const [metadataResult, embeddingResult, classificationResult] =
      await Promise.allSettled([
        metadataConsumer.processBatch(MAX_JOBS_PER_CONSUMER),
        embeddingConsumer.processBatch(MAX_JOBS_PER_CONSUMER),
        classificationConsumer.processBatch(MAX_JOBS_PER_CONSUMER),
      ]);

    // Collect stats
    if (metadataResult.status === "fulfilled") {
      stats.metadata = metadataResult.value;
    } else {
      logger.error(
        { error: metadataResult.reason },
        "Metadata consumer failed",
      );
    }

    if (embeddingResult.status === "fulfilled") {
      stats.embedding = embeddingResult.value;
    } else {
      logger.error(
        { error: embeddingResult.reason },
        "Embedding consumer failed",
      );
    }

    if (classificationResult.status === "fulfilled") {
      stats.classification = classificationResult.value;
    } else {
      logger.error(
        { error: classificationResult.reason },
        "Classification consumer failed",
      );
    }

    stats.total = stats.metadata + stats.embedding + stats.classification;

    // Cleanup old jobs (keep 7 days of completed/failed jobs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: cleanupError } = await (supabase.rpc as any)("cleanup_old_jobs", {
      p_days_to_keep: 7,
    }) as { error: { message: string } | null };

    if (cleanupError) {
      logger.warn({ error: cleanupError }, "Failed to cleanup old jobs");
    }

    // Reset stuck jobs (locked for more than 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stuckJobs, error: stuckError } = await (supabase
      .from("system_jobs") as any)
      .update({
        status: "PENDING",
        locked_by: null,
        locked_at: null,
      })
      .eq("status", "RUNNING")
      .lt("locked_at", tenMinutesAgo)
      .select("id") as { data: { id: string }[] | null; error: { message: string } | null };

    const resetCount = stuckJobs?.length ?? 0;
    if (resetCount > 0) {
      logger.info({ resetCount }, "Reset stuck system jobs");
    }

    if (stuckError) {
      logger.warn({ error: stuckError }, "Failed to reset stuck jobs");
    }

    const duration = Date.now() - startTime;

    logger.info(
      { ...stats, resetCount, duration },
      "System jobs processor completed",
    );

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        resetCount,
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "System jobs processor failed",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Config: Allow longer execution time
export const maxDuration = 300; // 5 minutes
