/**
 * Cron Job: Process Scheduled Workflow Triggers
 * Schedule: Every minute (cron: * * * * *)
 *
 * Processes pending scheduled workflow executions
 *
 * @module api/internal/cron/workflow-scheduled-triggers
 * @version 1.0.0
 * @since 2026-01-09
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getTriggerScheduler } from "@/lib/workflow/triggers/trigger-scheduler";
import { isWorkflowEnabled } from "@/lib/ai-agent/config/feature-flags";

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/internal/cron/workflow-scheduled-triggers
 * Process pending scheduled workflow executions
 */
export async function GET(request: Request) {
  const startTime = Date.now();

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

    // Check if workflow system is enabled
    if (!isWorkflowEnabled()) {
      logger.info("Workflow scheduled triggers: System disabled, skipping");
      return NextResponse.json({
        success: true,
        message: "Workflow system is disabled",
        stats: {
          processed: 0,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      });
    }

    logger.info(
      { action: "workflow_scheduled_triggers_start" },
      "Workflow scheduled triggers processor started",
    );

    // Get scheduler and process pending executions
    const scheduler = getTriggerScheduler();
    const processed = await scheduler.processPendingExecutions();

    const duration = Date.now() - startTime;

    logger.info(
      { processed, duration },
      "Workflow scheduled triggers processor completed",
    );

    return NextResponse.json({
      success: true,
      stats: {
        processed,
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        duration,
      },
      "Workflow scheduled triggers processor failed",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Config: Allow longer execution time for workflow processing
export const maxDuration = 60; // 1 minute
